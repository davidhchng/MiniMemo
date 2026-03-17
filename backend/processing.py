"""
Layer 1 — deterministic data processing.

All numbers computed here. Nothing estimated or invented.
Physical dtype: numeric | datetime | string (3 values only).
Semantic flags: applied to string columns to capture meaning without losing the simple physical type.
"""

from __future__ import annotations
import re
import pandas as pd
from models import CategoryCount, ColumnSummary, DatasetSummary, NumericStats

# Regex for phone-like detection (digits, spaces, dashes, parens, dots, +)
_PHONE_RE = re.compile(r"^[\d\s\-\+\(\)\.]{7,20}$")
_URL_RE = re.compile(r"^https?://", re.IGNORECASE)

_NAME_TOKENS = {"name", "first", "last", "fname", "lname", "fullname", "surname"}
_LOCATION_TOKENS = {"country", "city", "state", "region", "location", "province", "address", "zip", "postal"}
_ID_NAME_TOKENS = {"id", "key", "idx", "index", "seq", "num", "no", "number", "ref", "code"}


# ---------------------------------------------------------------------------
# Physical type inference (3-way only)
# ---------------------------------------------------------------------------

def infer_physical_dtype(series: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(series):
        return "string"  # booleans treated as low-cardinality strings
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    if series.dtype == object or isinstance(series.dtype, pd.StringDtype):
        if _looks_like_datetime(series):
            return "datetime"
        return "string"
    return "string"


def _looks_like_datetime(series: pd.Series) -> bool:
    """80%+ of a 100-value sample parses as datetime."""
    sample = series.dropna().head(100)
    if len(sample) == 0:
        return False
    try:
        parsed = pd.to_datetime(sample, errors="coerce")
        return float(parsed.notna().mean()) >= 0.8
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Numeric ID detection
# ---------------------------------------------------------------------------

def _is_numeric_id_like(series: pd.Series, col_name: str) -> bool:
    """True when a numeric column is a row identifier, not a measure.

    Criteria: all-integer values AND (uniqueness ≥ 99% OR name contains an ID
    token with uniqueness ≥ 90%).  Fractional columns (floats with decimals)
    are never flagged — they are almost always real measures.
    """
    non_null = series.notna().sum()
    if non_null == 0:
        return False
    clean = series.dropna()
    # Must be all-integer (no fractional part)
    try:
        all_integers = bool((clean % 1 == 0).all())
    except Exception:
        return False
    if not all_integers:
        return False
    unique_ratio = series.nunique(dropna=True) / non_null
    name_tokens = set(re.split(r"[\s_\-]+", col_name.lower()))
    has_id_name = bool(name_tokens & _ID_NAME_TOKENS)
    if unique_ratio >= 0.99:
        return True
    if has_id_name and unique_ratio >= 0.90:
        return True
    return False


# ---------------------------------------------------------------------------
# Semantic flags (string columns only)
# ---------------------------------------------------------------------------

def infer_semantic_flags(series: pd.Series, col_name: str, row_count: int) -> list[str]:
    """Return semantic flags for a string column. Exclusion flags short-circuit further analysis."""
    sample = series.dropna().head(100)
    if len(sample) == 0:
        return []

    # ── Exclusion flags (early return when matched) ───────────────────────
    # Email
    if float(sample.str.contains("@", na=False).mean()) >= 0.8:
        return ["email"]

    # URL-like
    if float(sample.str.match(_URL_RE, na=False).mean()) >= 0.7:
        return ["url_like"]

    # Phone-like
    if float(sample.str.match(_PHONE_RE, na=False).mean()) >= 0.7:
        return ["phone_like"]

    # ID-like: very high uniqueness + short + no spaces
    non_null = series.notna().sum()
    if non_null > 0:
        unique_ratio = series.nunique(dropna=True) / non_null
        avg_len = float(sample.str.len().mean())
        space_ratio = float(sample.str.contains(r" ", na=False).mean())
        if unique_ratio >= 0.95 and avg_len <= 40 and space_ratio < 0.3:
            return ["id_like"]

    # ── Descriptive flags (can stack) ─────────────────────────────────────
    flags: list[str] = []

    non_null = series.notna().sum()
    if non_null > 0:
        unique_ratio = series.nunique(dropna=True) / non_null
        n_unique = series.nunique(dropna=True)

        if unique_ratio <= 0.05 and n_unique <= 50:
            flags.append("low_cardinality")
        elif unique_ratio >= 0.50:
            flags.append("high_cardinality")

    # Column name token hints
    name_tokens = set(re.split(r"[\s_\-]+", col_name.lower()))
    if name_tokens & _NAME_TOKENS:
        flags.append("likely_name")
    if name_tokens & _LOCATION_TOKENS:
        flags.append("likely_location")

    return flags


# ---------------------------------------------------------------------------
# Stats computation
# ---------------------------------------------------------------------------

def _compute_numeric_stats(series: pd.Series) -> NumericStats | None:
    clean = series.dropna()
    if len(clean) == 0:
        return None
    return NumericStats(
        mean=round(float(clean.mean()), 4),
        median=round(float(clean.median()), 4),
        std=round(float(clean.std()), 4) if len(clean) > 1 else 0.0,
        min=round(float(clean.min()), 4),
        max=round(float(clean.max()), 4),
    )


def _compute_top_categories(series: pd.Series, top_n: int = 10) -> list[CategoryCount]:
    n_non_null = int(series.notna().sum())
    if n_non_null == 0:
        return []
    counts = series.value_counts(dropna=True).head(top_n)
    return [
        CategoryCount(value=str(k), count=int(v), pct=round(int(v) / n_non_null, 4))
        for k, v in counts.items()
    ]


# ---------------------------------------------------------------------------
# Column and dataframe profiling
# ---------------------------------------------------------------------------

def profile_column(series: pd.Series, row_count: int) -> ColumnSummary:
    n = max(len(series), 1)
    null_count = int(series.isna().sum())
    dtype = infer_physical_dtype(series)

    flags: list[str] = []
    top_categories = None

    if dtype == "numeric":
        if _is_numeric_id_like(series, str(series.name)):
            flags = ["id_like"]
    elif dtype == "string":
        flags = infer_semantic_flags(series, str(series.name), row_count)
        if "low_cardinality" in flags:
            top_categories = _compute_top_categories(series)

    is_measure = dtype == "numeric" and "id_like" not in flags

    return ColumnSummary(
        name=str(series.name),
        dtype=dtype,
        flags=flags,
        null_count=null_count,
        null_pct=round(null_count / n, 4),
        unique_count=int(series.nunique(dropna=True)),
        sample_values=[str(v) for v in series.dropna().head(5).tolist()],
        numeric_stats=_compute_numeric_stats(series) if is_measure else None,
        top_categories=top_categories,
    )


def profile_dataframe(df: pd.DataFrame, filename: str) -> DatasetSummary:
    row_count = len(df)
    columns = [profile_column(df[col], row_count) for col in df.columns]

    return DatasetSummary(
        filename=filename,
        row_count=row_count,
        col_count=len(df.columns),
        columns=columns,
    )
