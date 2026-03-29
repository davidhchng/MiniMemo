"""
MiniMemo API — Phase 1 foundation.

Single endpoint: POST /analyze
Accepts a CSV or XLSX file, runs deterministic profiling,
returns structured analysis with insights and report sections.

TODO (Phase 2): Add POST /sessions/{id}/join for multi-table support
TODO (Phase 3): Add POST /sessions/{id}/context for user objective + notes
TODO (Phase 4): Replace mock report sections with LLM-generated narrative
"""

import hashlib
import io
import json
import logging
import os
import re
import traceback
from collections import OrderedDict
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd

logging.basicConfig(level=logging.INFO)

from database import (
    build_connection_url,
    execute_query,
    fetch_preview_data,
    test_connection,
)
from models import (
    AnalysisResponse,
    BatchAnalysisResponse,
    DatabaseConnection,
    DatabaseConnectionResult,
    DatabaseQuery,
    DatasetSummary,
    InsightBlock,
    JoinInsight,
    JoinSuggestion,
    RecommendationItem,
    ReportSection,
    TablePreview,
)
from processing import profile_dataframe
from report.charts import bar_spec, histogram_spec, line_spec
from report.llm_client import get_llm_client
from report.narrative import get_narrative_service

load_dotenv()
_narrative_svc = get_narrative_service()
_llm_client = get_llm_client()

app = FastAPI(title="MiniMemo API", version="0.1.0")

# CORS: defaults to allow-all for local dev.
# Set ALLOWED_ORIGINS="https://your-app.vercel.app" in production.
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()] if _raw_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    logging.error("Unhandled exception:\n%s", tb)
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})

MAX_ROWS = 200_000
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".tsv", ".tab", ".json", ".jsonl", ".ndjson", ".parquet"}
_CACHE_MAX = 50

# In-memory LRU cache: hash(file_bytes + goals + background) → AnalysisResponse
_RESULT_CACHE: OrderedDict[str, AnalysisResponse] = OrderedDict()

def _cache_key(content: bytes, goals: str | None, background: str | None) -> str:
    h = hashlib.sha256(content)
    h.update((goals or "").encode())
    h.update((background or "").encode())
    return h.hexdigest()

# String flags that mark a column as non-analytic (exclude from dimensions)
_EXCLUSION_FLAGS = {"email", "url_like", "phone_like", "id_like"}


# ---------------------------------------------------------------------------
# File parsing
# ---------------------------------------------------------------------------

def _is_nested(df: pd.DataFrame) -> bool:
    """Return True if any column contains dicts or lists (nested JSON)."""
    for col in df.columns:
        sample = df[col].dropna().head(5)
        if any(isinstance(v, (dict, list)) for v in sample):
            return True
    return False


def _parse_file(contents: bytes, ext: str) -> pd.DataFrame:
    """Parse raw file bytes into a DataFrame based on extension."""
    buf = io.BytesIO(contents)

    if ext == ".csv":
        return pd.read_csv(buf)

    if ext in (".tsv", ".tab"):
        return pd.read_csv(buf, sep="\t")

    if ext == ".parquet":
        return pd.read_parquet(buf)

    if ext in (".jsonl", ".ndjson"):
        return pd.read_json(buf, lines=True)

    if ext == ".json":
        try:
            df = pd.read_json(buf)
        except Exception:
            df = None
        # If any column contains dicts/lists, try json_normalize to flatten
        if df is not None and _is_nested(df):
            try:
                df = pd.json_normalize(json.loads(contents))
            except Exception:
                pass
        if df is None:
            raise ValueError("Could not parse JSON into a flat table. Ensure the file is an array of objects or a JSON object with array values.")
        return df

    if ext == ".xlsx":
        return pd.read_excel(buf)

    raise ValueError(f"Unrecognised extension: {ext}")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=BatchAnalysisResponse)
async def analyze(
    files: list[UploadFile] = File(...),
    goals: str | None = Form(None),
    background: str | None = Form(None),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    per_file: list[tuple[DatasetSummary, pd.DataFrame]] = []
    results: list[AnalysisResponse] = []

    for file in files:
        filename = file.filename or ""
        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}'. Supported formats: CSV, TSV, JSON, JSONL, Parquet, XLSX.",
            )

        contents = await file.read()
        cache_key = _cache_key(contents, goals, background)

        if cache_key in _RESULT_CACHE:
            _RESULT_CACHE.move_to_end(cache_key)
            cached = _RESULT_CACHE[cache_key]
            results.append(cached)
            try:
                per_file.append((cached.dataset, _parse_file(contents, ext)))
            except Exception:
                pass
            continue

        try:
            df = _parse_file(contents, ext)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Could not parse '{filename}': {exc}")

        dupes = [n for n, c in pd.Series(df.columns).value_counts().items() if c > 1]
        if dupes:
            raise HTTPException(
                status_code=422,
                detail=f"'{filename}' has duplicate column names: {', '.join(str(c) for c in dupes[:5])}. Rename them and re-upload.",
            )

        if len(df) > MAX_ROWS:
            raise HTTPException(
                status_code=413,
                detail=f"'{filename}' has {len(df):,} rows, exceeding the {MAX_ROWS:,} row limit.",
            )

        if len(df) == 0:
            raise HTTPException(status_code=422, detail=f"'{filename}' has no rows.")

        result = _analyze_dataframe(df, filename, goals, background)
        _RESULT_CACHE[cache_key] = result
        if len(_RESULT_CACHE) > _CACHE_MAX:
            _RESULT_CACHE.popitem(last=False)
        results.append(result)
        per_file.append((result.dataset, df))

    suggested_joins = _detect_joins(per_file) if len(per_file) > 1 else []
    return BatchAnalysisResponse(results=results, suggested_joins=suggested_joins)


def _analyze_dataframe(
    df: pd.DataFrame,
    source_name: str,
    goals: str | None,
    background: str | None,
) -> AnalysisResponse:
    dataset  = profile_dataframe(df, source_name, llm_client=_llm_client)
    insights = _build_insights(dataset, df, goals)
    insights = _apply_narrative_rewrite(insights, dataset, df, goals)

    key_block   = next((b for b in insights if b.title == "Key Insights"), None)
    key_bullets = key_block.bullets if key_block else []

    excl = _excluded(dataset)
    assumptions, limitations = _build_split_assumptions(dataset, excl, _narrative_svc)
    if dataset.row_count < 100:
        assumptions.insert(0, f"This dataset has only {dataset.row_count} rows. Statistical patterns may not generalise — interpret results cautiously.")
    rec_items = _build_recommendation_items(dataset, df, key_bullets, goals, background)
    conclusion = _build_conclusion(key_bullets, dataset.filename, _narrative_svc, goals)

    return AnalysisResponse(
        dataset=dataset,
        insights=insights,
        report_sections=_build_report_sections(dataset, key_bullets, goals, background),
        recommendation_items=rec_items,
        assumptions=assumptions,
        limitations=limitations,
        conclusion=conclusion,
    )


# ---------------------------------------------------------------------------
# Database connectivity endpoints
# ---------------------------------------------------------------------------

@app.post("/db/test-connection", response_model=DatabaseConnectionResult)
def db_test_connection(conn: DatabaseConnection):
    url = build_connection_url(
        conn.db_type, conn.host, conn.port, conn.database, conn.username, conn.password
    )
    result = test_connection(url)
    return DatabaseConnectionResult(**result)


@app.post("/db/preview", response_model=TablePreview)
def db_preview(conn: DatabaseConnection, table: str):
    url = build_connection_url(
        conn.db_type, conn.host, conn.port, conn.database, conn.username, conn.password
    )
    try:
        df, row_count = fetch_preview_data(url, table, limit=50)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    sample_rows = df.astype(str).to_dict(orient="records")
    return TablePreview(
        columns=list(df.columns),
        sample_rows=sample_rows,
        row_count_estimate=row_count,
    )


@app.post("/db/analyze", response_model=BatchAnalysisResponse)
def db_analyze(
    payload: DatabaseQuery,
    goals: str | None = None,
    background: str | None = None,
):
    conn = payload.connection
    url = build_connection_url(
        conn.db_type, conn.host, conn.port, conn.database, conn.username, conn.password
    )

    try:
        df = execute_query(url, payload.query)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Query failed: {exc}")

    if len(df) == 0:
        raise HTTPException(status_code=422, detail="Query returned no rows.")

    source_name = payload.source_label or "database_query"
    result = _analyze_dataframe(df, source_name, goals, background)
    return BatchAnalysisResponse(results=[result], suggested_joins=[])


# ---------------------------------------------------------------------------
# Join detection (multi-dataset)
# ---------------------------------------------------------------------------

def _detect_joins(
    per_file: list[tuple[DatasetSummary, pd.DataFrame]],
) -> list[JoinSuggestion]:
    """Detect potential join columns across dataset pairs.

    Criteria: same column name (case-insensitive) + compatible dtype
    + ≥30% value overlap. Returns up to 3 highest-confidence suggestions.
    """
    suggestions: list[JoinSuggestion] = []

    for i in range(len(per_file)):
        for j in range(i + 1, len(per_file)):
            ds_a, df_a = per_file[i]
            ds_b, df_b = per_file[j]

            cols_a = {c.name.lower(): c for c in ds_a.columns}
            cols_b = {c.name.lower(): c for c in ds_b.columns}
            shared_names = set(cols_a) & set(cols_b)

            for name in shared_names:
                col_a = cols_a[name]
                col_b = cols_b[name]
                if col_a.dtype != col_b.dtype:
                    continue
                # id_like columns are good join candidates regardless
                is_id = "id_like" in col_a.flags or "id_like" in col_b.flags

                vals_a = set(df_a[col_a.name].dropna().astype(str))
                vals_b = set(df_b[col_b.name].dropna().astype(str))
                if not vals_a or not vals_b:
                    continue

                overlap = len(vals_a & vals_b) / min(len(vals_a), len(vals_b))
                if overlap < 0.30 and not is_id:
                    continue

                confidence = min(overlap + (0.15 if is_id else 0.0), 1.0)

                # Compute row-level join insight using outer merge on distinct keys
                keys_a = df_a[[col_a.name]].drop_duplicates().rename(columns={col_a.name: "_key"})
                keys_b = df_b[[col_b.name]].drop_duplicates().rename(columns={col_b.name: "_key"})
                merged = pd.merge(keys_a, keys_b, on="_key", how="outer", indicator=True)
                matched     = int((merged["_merge"] == "both").sum())
                left_only   = int((merged["_merge"] == "left_only").sum())
                right_only  = int((merged["_merge"] == "right_only").sum())
                match_pct   = matched / min(len(df_a), len(df_b)) if min(len(df_a), len(df_b)) > 0 else 0.0

                cross = _cross_dataset_insights(ds_a, df_a, ds_b, df_b, col_a.name, col_b.name)

                join_insight = JoinInsight(
                    total_a=len(df_a),
                    total_b=len(df_b),
                    matched_rows=matched,
                    left_only_rows=left_only,
                    right_only_rows=right_only,
                    match_pct=round(match_pct, 3),
                    cross_insights=cross,
                )

                suggestions.append(JoinSuggestion(
                    dataset_a=ds_a.filename,
                    dataset_b=ds_b.filename,
                    column_a=col_a.name,
                    column_b=col_b.name,
                    reason=(
                        f"Column '{col_a.name}' appears in both files "
                        f"({col_a.dtype}), {overlap:.0%} value overlap"
                    ),
                    confidence=round(confidence, 2),
                    join_insight=join_insight,
                ))

    suggestions.sort(key=lambda s: s.confidence, reverse=True)
    return suggestions[:3]


def _cross_dataset_insights(
    ds_a: DatasetSummary, df_a: pd.DataFrame,
    ds_b: DatasetSummary, df_b: pd.DataFrame,
    col_a_name: str, col_b_name: str,
) -> list[InsightBlock]:
    """Compute insights from an inner join of two datasets.

    Looks for cross-dataset measure × dimension pairs — e.g. a numeric column
    from dataset A broken down by a categorical column from dataset B (and vice
    versa).  Returns up to 2 InsightBlocks, each with a bar chart.
    """
    try:
        merged = pd.merge(
            df_a, df_b,
            left_on=col_a_name, right_on=col_b_name,
            how="inner",
            suffixes=("_a", "_b"),
        )
    except Exception:
        return []

    if len(merged) == 0:
        return []

    def _col_in_merged(name: str, suffix: str) -> str | None:
        """Return the actual column name in the merged df (handles suffix conflicts)."""
        if name in merged.columns:
            return name
        s = name + suffix
        return s if s in merged.columns else None

    measures_a  = [c for c in ds_a.columns if c.dtype == "numeric" and "id_like" not in c.flags]
    dims_b      = [c for c in ds_b.columns if c.dtype == "string" and "low_cardinality" in c.flags
                   and not (_EXCLUSION_FLAGS & set(c.flags))]
    measures_b  = [c for c in ds_b.columns if c.dtype == "numeric" and "id_like" not in c.flags]
    dims_a      = [c for c in ds_a.columns if c.dtype == "string" and "low_cardinality" in c.flags
                   and not (_EXCLUSION_FLAGS & set(c.flags))]

    insights: list[InsightBlock] = []

    # Try two directions: (measures from A × dims from B) and (measures from B × dims from A)
    for measures, dims, meas_suffix, dim_suffix, meas_src, dim_src in [
        (measures_a, dims_b, "_a", "_b", ds_a.filename, ds_b.filename),
        (measures_b, dims_a, "_b", "_a", ds_b.filename, ds_a.filename),
    ]:
        for dim in dims[:1]:
            dim_col = _col_in_merged(dim.name, dim_suffix)
            if not dim_col:
                continue
            for measure in measures[:1]:
                meas_col = _col_in_merged(measure.name, meas_suffix)
                if not meas_col:
                    continue
                try:
                    group_means = (
                        merged.groupby(dim_col)[meas_col]
                        .mean()
                        .dropna()
                        .sort_values(ascending=False)
                        .head(5)
                    )
                    if len(group_means) < 2:
                        continue

                    chart = bar_spec(
                        [str(g) for g in group_means.index],
                        [float(v) for v in group_means.values],
                        dim.name, measure.name,
                    )
                    global_mean = float(merged[meas_col].mean())
                    bullets = [
                        f"{group}: avg {val:,.2f}"
                        + (f" ({(val - global_mean) / abs(global_mean):+.0%} vs overall)"
                           if global_mean != 0 else "")
                        for group, val in zip(group_means.index, group_means.values)
                    ]
                    insights.append(InsightBlock(
                        title=f"{measure.name} by {dim.name}",
                        summary=(
                            f"After joining {ds_a.filename} and {ds_b.filename} on "
                            f"'{col_a_name}', {measure.name} (from {meas_src}) broken down "
                            f"by {dim.name} (from {dim_src})."
                        ),
                        bullets=bullets,
                        chart=chart,
                    ))
                except Exception:
                    continue
        if len(insights) >= 1:
            break

    return insights[:2]


# ---------------------------------------------------------------------------
# New: deeper analysis helpers
# ---------------------------------------------------------------------------

def _build_correlation_insight(measures: list, df: pd.DataFrame, row_count: int = 0) -> InsightBlock | None:
    """Compute pairwise Pearson correlations between numeric measures.

    Only surfaces pairs with |r| > 0.3. Returns a bar chart of correlation coefficients.
    """
    if len(measures) < 2:
        return None

    measure_names = [m.name for m in measures if m.name in df.columns]
    corr_pairs: list[tuple[str, str, float]] = []

    for i in range(len(measure_names)):
        for j in range(i + 1, len(measure_names)):
            a, b = measure_names[i], measure_names[j]
            try:
                pair_df = df[[a, b]].apply(pd.to_numeric, errors="coerce").dropna()
                if len(pair_df) < 10:
                    continue
                r = float(pair_df.corr().iloc[0, 1])
                if not pd.isna(r) and abs(r) > 0.3:
                    corr_pairs.append((a, b, round(r, 3)))
            except Exception:
                continue

    if not corr_pairs:
        return None

    corr_pairs.sort(key=lambda x: abs(x[2]), reverse=True)

    def _strength(r: float) -> str:
        if abs(r) >= 0.7: return "strong"
        if abs(r) >= 0.5: return "moderate"
        return "weak"

    def _direction(r: float) -> str:
        return "positive" if r > 0 else "negative"

    bullets: list[str] = []
    for a, b, r in corr_pairs[:6]:
        s, d = _strength(r), _direction(r)
        implication = (
            f"as {a} increases, {b} tends to {'increase' if r > 0 else 'decrease'} with it"
        )
        bullets.append(f"{a} × {b}: {s} {d} correlation (r = {r:+.2f}) — {implication}.")

    chart_labels = [f"{a} × {b}" for a, b, _ in corr_pairs[:6]]
    chart_values = [r for _, _, r in corr_pairs[:6]]
    chart = bar_spec(chart_labels, chart_values, "Variable Pair", "Pearson r")

    total_pairs = len(measure_names) * (len(measure_names) - 1) // 2
    return InsightBlock(
        title="Variable Relationships",
        summary=(
            f"{len(corr_pairs)} of {total_pairs} numeric variable pair(s) show meaningful correlation (|r| > 0.30). "
            "Correlation values range from −1 (perfect inverse) to +1 (perfect direct)."
        ),
        bullets=bullets,
        chart=chart,
        caveat=(
            f"Dataset has only {row_count} rows — correlation values are unreliable at small sample sizes. Treat these as indicative only."
            if row_count > 0 and row_count < 100
            else "Correlation indicates statistical association, not causation. Investigate confounding factors before drawing causal conclusions."
        ),
    )


def _build_distribution_insight(m, df: pd.DataFrame) -> InsightBlock | None:
    """Richer distribution analysis: shape, skew, and practical interpretation."""
    s = m.numeric_stats
    if not s or m.name not in df.columns:
        return None

    try:
        series = pd.to_numeric(df[m.name], errors="coerce").dropna()
        if len(series) < 5:
            return None
        chart = histogram_spec(series, m.name)
    except Exception:
        return None

    bullets: list[str] = [
        f"Range: {s.min:,} to {s.max:,} (span of {s.max - s.min:,.2f})",
        f"Central tendency: mean {s.mean:,.2f}, median {s.median:,.2f}",
        f"Spread: standard deviation {s.std:,.2f}",
    ]

    # Skewness interpretation
    if s.std > 0:
        skew_ratio = (s.mean - s.median) / s.std
        if abs(skew_ratio) > 0.5:
            direction = "right" if skew_ratio > 0 else "left"
            tail_side = "upper" if skew_ratio > 0 else "lower"
            mean_vs_median = "above" if skew_ratio > 0 else "below"
            bullets.append(
                f"Distribution is {direction}-skewed (mean is {mean_vs_median} median) — "
                f"{tail_side} extreme values are pulling the average. "
                f"The median ({s.median:,.2f}) is a more reliable typical value here."
            )
        else:
            bullets.append(f"Distribution is roughly symmetric — mean and median are close ({abs(s.mean - s.median):,.2f} apart).")

        # Coefficient of variation
        if s.mean != 0:
            cv = s.std / abs(s.mean)
            if cv > 1.0:
                bullets.append(f"High variability (CV = {cv:.2f}) — individual values differ greatly from the average, suggesting multiple distinct sub-groups may be present.")
            elif cv > 0.5:
                bullets.append(f"Moderate variability (CV = {cv:.2f}) — meaningful spread around the average.")

    if m.null_pct > 0.01:
        bullets.append(f"Missing data: {m.null_pct * 100:.1f}% null — statistics above reflect only {int(len(series)):,} non-null records.")

    return InsightBlock(
        title=f"Distribution: {m.name}",
        summary=f"Shape and spread of '{m.name}' across {len(series):,} non-null records.",
        bullets=bullets,
        chart=chart,
    )


def _build_outlier_insight(measures: list, df: pd.DataFrame) -> InsightBlock | None:
    """IQR-based outlier detection. Only surfaces columns where outliers meaningfully affect the mean."""
    summaries: list[dict] = []

    for m in measures:
        if m.name not in df.columns:
            continue
        try:
            series = pd.to_numeric(df[m.name], errors="coerce").dropna()
            if len(series) < 20:
                continue
            q1, q3 = float(series.quantile(0.25)), float(series.quantile(0.75))
            iqr = q3 - q1
            if iqr == 0:
                continue
            lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
            outliers = series[(series < lower) | (series > upper)]
            n = len(outliers)
            pct = n / len(series) * 100
            if n == 0 or pct < 0.3:
                continue
            non_outliers = series[(series >= lower) & (series <= upper)]
            mean_all  = float(series.mean())
            mean_clean = float(non_outliers.mean()) if len(non_outliers) > 0 else mean_all
            impact_pct = abs(mean_all - mean_clean) / abs(mean_clean) * 100 if mean_clean != 0 else 0
            summaries.append({
                "name": m.name,
                "count": n,
                "pct": round(pct, 1),
                "lower": round(lower, 2),
                "upper": round(upper, 2),
                "mean_all": round(mean_all, 2),
                "mean_clean": round(mean_clean, 2),
                "impact_pct": round(impact_pct, 1),
                "max_val": round(float(outliers.max()), 2),
                "min_val": round(float(outliers.min()), 2),
            })
        except Exception:
            continue

    if not summaries:
        return None

    bullets: list[str] = []
    for o in summaries[:4]:
        impact_str = (
            f" Removing them shifts the mean by {o['impact_pct']:.1f}% "
            f"({o['mean_all']:,.2f} → {o['mean_clean']:,.2f})."
            if o["impact_pct"] > 3 else ""
        )
        bullets.append(
            f"{o['name']}: {o['count']} outlier(s) ({o['pct']}% of records) "
            f"beyond [{o['lower']:,.1f}, {o['upper']:,.1f}].{impact_str}"
        )

    return InsightBlock(
        title="Outlier Analysis",
        summary=(
            f"{len(summaries)} numeric column(s) contain records that fall outside 1.5× the interquartile range. "
            "These may be data quality issues, measurement errors, or genuine extremes worth investigating."
        ),
        bullets=bullets,
        caveat="Outliers are not automatically errors — high-value records may be legitimate. Investigate each case in context before removing.",
    )


def _build_trend_bullets(df: pd.DataFrame, time_col: str, measure: str, chart) -> list[str]:
    """Generate analytical bullets for a time trend block."""
    bullets: list[str] = [f"{len(chart.x)} time periods shown."]
    try:
        vals = chart.y
        if len(vals) >= 2:
            peak_idx = int(pd.Series(vals).idxmax())
            trough_idx = int(pd.Series(vals).idxmin())
            bullets.append(f"Peak: {chart.x[peak_idx]} at {vals[peak_idx]:,.2f}.")
            bullets.append(f"Trough: {chart.x[trough_idx]} at {vals[trough_idx]:,.2f}.")
            first_half = vals[:len(vals)//2]
            second_half = vals[len(vals)//2:]
            if first_half and second_half:
                change = (sum(second_half)/len(second_half) - sum(first_half)/len(first_half))
                overall_mean = sum(vals) / len(vals)
                if overall_mean != 0:
                    change_pct = change / abs(overall_mean) * 100
                    direction = "higher" if change_pct > 0 else "lower"
                    bullets.append(
                        f"Second half of the period averages {abs(change_pct):.1f}% {direction} than the first half."
                    )
    except Exception:
        pass
    return bullets


def _build_rich_analysis_context(
    dataset: DatasetSummary,
    df: pd.DataFrame,
    measures: list,
    dimensions: list,
    time_cols: list,
    goals: str | None = None,
) -> dict:
    """Build a rich statistical context dict to pass to the LLM for insight generation."""
    context: dict = {
        "dataset": {
            "filename": dataset.filename,
            "row_count": dataset.row_count,
            "col_count": dataset.col_count,
        },
        "measures": [],
        "correlations": [],
        "dimensions": [],
        "time_trend": None,
    }

    if goals:
        context["goals"] = goals

    # Measure stats + outlier counts
    for m in measures:
        s = m.numeric_stats
        if not s:
            continue
        outlier_count = 0
        try:
            series = pd.to_numeric(df[m.name], errors="coerce").dropna()
            q1, q3 = float(series.quantile(0.25)), float(series.quantile(0.75))
            iqr = q3 - q1
            if iqr > 0:
                outlier_count = int(len(series[(series < q1 - 1.5*iqr) | (series > q3 + 1.5*iqr)]))
        except Exception:
            pass

        skew_indicator = round((s.mean - s.median) / s.std, 2) if s.std > 0 else 0
        cv = round(s.std / abs(s.mean), 2) if s.mean != 0 else 0

        context["measures"].append({
            "name": m.name,
            "mean": round(s.mean, 3),
            "median": round(s.median, 3),
            "std": round(s.std, 3),
            "min": round(s.min, 3),
            "max": round(s.max, 3),
            "null_pct": round(m.null_pct * 100, 1),
            "skew_indicator": skew_indicator,
            "cv": cv,
            "outlier_count": outlier_count,
            "outlier_pct": round(outlier_count / dataset.row_count * 100, 1),
        })

    # Pairwise correlations
    measure_names = [m.name for m in measures if m.name in df.columns]
    for i in range(len(measure_names)):
        for j in range(i + 1, len(measure_names)):
            a, b = measure_names[i], measure_names[j]
            try:
                pair_df = df[[a, b]].apply(pd.to_numeric, errors="coerce").dropna()
                if len(pair_df) >= 10:
                    r = float(pair_df.corr().iloc[0, 1])
                    if not pd.isna(r) and abs(r) > 0.2:
                        strength = "strong" if abs(r) >= 0.7 else "moderate" if abs(r) >= 0.4 else "weak"
                        context["correlations"].append({
                            "col_a": a, "col_b": b,
                            "r": round(r, 3),
                            "strength": f"{strength} {'positive' if r > 0 else 'negative'}",
                        })
            except Exception:
                continue
    context["correlations"].sort(key=lambda x: abs(x["r"]), reverse=True)

    # Dimension summaries (spread of primary measure across categories)
    if measures:
        primary_name = measures[0].name
        try:
            global_mean = float(df[primary_name].mean())
        except Exception:
            global_mean = 0

        for dim in dimensions[:5]:
            try:
                group_means = df.groupby(dim.name)[primary_name].mean().dropna()
                group_counts = df[dim.name].value_counts()
                if len(group_means) < 2:
                    continue
                top = str(group_means.idxmax())
                bot = str(group_means.idxmin())
                spread_pct = round((float(group_means.max()) - float(group_means.min())) / abs(global_mean) * 100, 1) if global_mean != 0 else 0
                context["dimensions"].append({
                    "name": dim.name,
                    "n_categories": int(df[dim.name].nunique()),
                    "primary_measure": primary_name,
                    "global_mean": round(global_mean, 2),
                    "top_category": top,
                    "top_mean": round(float(group_means[top]), 2),
                    "bottom_category": bot,
                    "bottom_mean": round(float(group_means[bot]), 2),
                    "spread_pct": spread_pct,
                    "top_category_count": int(group_counts.get(top, 0)),
                })
            except Exception:
                continue

    # Time trend summary
    if time_cols and measures:
        try:
            dates = pd.to_datetime(df[time_cols[0].name], errors="coerce")
            mvals = pd.to_numeric(df[measures[0].name], errors="coerce")
            temp = pd.DataFrame({"_d": dates, "_m": mvals}).dropna().sort_values("_d")
            if len(temp) >= 6:
                mid = len(temp) // 2
                first_mean = float(temp["_m"].iloc[:mid].mean())
                last_mean  = float(temp["_m"].iloc[mid:].mean())
                overall    = float(temp["_m"].mean())
                change_pct = (last_mean - first_mean) / abs(overall) * 100 if overall != 0 else 0
                context["time_trend"] = {
                    "column": time_cols[0].name,
                    "measure": measures[0].name,
                    "direction": "upward" if change_pct > 0 else "downward",
                    "change_pct": round(abs(change_pct), 1),
                    "first_half_mean": round(first_mean, 2),
                    "second_half_mean": round(last_mean, 2),
                }
        except Exception:
            pass

    return context


# ---------------------------------------------------------------------------
# AI narrative post-processing
# ---------------------------------------------------------------------------

def _apply_narrative_rewrite(
    insights: list[InsightBlock],
    dataset: DatasetSummary,
    df: pd.DataFrame,
    goals: str | None,
) -> list[InsightBlock]:
    """Replace the Key Insights block with LLM-generated analytical observations.

    The LLM receives the full rich analysis context (correlations, outliers,
    distribution shapes, category spreads) and writes genuinely analytical
    bullets rather than rephrasing deterministic templates.

    Falls back to the deterministic bullets if LLM is unavailable or fails.
    """
    key_idx = next(
        (i for i, b in enumerate(insights) if b.title == "Key Insights"), None
    )
    if key_idx is None:
        return insights

    measures   = _measures(dataset)
    dimensions = _dimensions(dataset)
    time_cols  = _time_dims(dataset)

    rich_context = _build_rich_analysis_context(dataset, df, measures, dimensions, time_cols, goals)
    llm_bullets  = _narrative_svc.generate_analytical_insights(rich_context)

    if not llm_bullets:
        return insights

    original = insights[key_idx]
    result   = list(insights)
    result[key_idx] = original.model_copy(update={
        "bullets": llm_bullets,
        "summary": "Key patterns and relationships identified across this dataset.",
    })
    return result


# ---------------------------------------------------------------------------
# Column role helpers
# ---------------------------------------------------------------------------

def _measures(dataset: DatasetSummary) -> list:
    """Numeric columns that are actual measures (not identifiers)."""
    return [c for c in dataset.columns if c.dtype == "numeric" and "id_like" not in c.flags]


def _dimensions(dataset: DatasetSummary) -> list:
    """Low-cardinality string columns usable as grouping dimensions."""
    return [
        c for c in dataset.columns
        if c.dtype == "string"
        and "low_cardinality" in c.flags
        and not (_EXCLUSION_FLAGS & set(c.flags))
    ]


def _time_dims(dataset: DatasetSummary) -> list:
    return [c for c in dataset.columns if c.dtype == "datetime"]


def _excluded(dataset: DatasetSummary) -> list:
    """Columns excluded from analysis (IDs, emails, URLs, phones)."""
    return [
        c for c in dataset.columns
        if "id_like" in c.flags or (_EXCLUSION_FLAGS & set(c.flags))
    ]


# ---------------------------------------------------------------------------
# Analyst thinking — thresholds
# ---------------------------------------------------------------------------

_DEVIATION_THRESHOLD   = 0.10   # group mean must differ from global mean by ≥10% to be surfaced
_SKEW_STD_RATIO        = 0.50   # |mean−median| / std > 0.5 → meaningful skew
_HIGH_CV_THRESHOLD     = 0.80   # std / |mean| > 0.8 → high variability
_TIME_TREND_THRESHOLD  = 0.15   # first-half vs second-half mean must differ by ≥15% of global mean
_MAX_KEY_STATEMENTS    = 5      # cap on bullets in the Key Insights block


# ---------------------------------------------------------------------------
# Insight generators
# ---------------------------------------------------------------------------

def _build_insights(dataset: DatasetSummary, df: pd.DataFrame, goals: str | None = None) -> list[InsightBlock]:
    measures   = _measures(dataset)
    dimensions = _dimensions(dataset)
    time_cols  = _time_dims(dataset)
    excl_cols  = _excluded(dataset)

    other_strings = [
        c for c in dataset.columns
        if c.dtype == "string"
        and "low_cardinality" not in c.flags
        and not (_EXCLUSION_FLAGS & set(c.flags))
    ]

    def _fmt(cols: list, limit: int = 5) -> str:
        names = [c.name for c in cols[:limit]]
        return ", ".join(names) + (", …" if len(cols) > limit else "")

    insights: list[InsightBlock] = []

    # ── 1. Dataset Overview ────────────────────────────────────────────────
    bullets: list[str] = []
    if measures:
        bullets.append(f"Measures ({len(measures)}): {_fmt(measures)}")
    if dimensions:
        bullets.append(f"Dimensions ({len(dimensions)}): {_fmt(dimensions)}")
    if time_cols:
        bullets.append(f"Time dimensions ({len(time_cols)}): {_fmt(time_cols)}")
    if other_strings:
        bullets.append(f"Other string columns ({len(other_strings)}): {_fmt(other_strings)}")
    if excl_cols:
        excl_desc = ", ".join(f"{c.name} ({', '.join(c.flags)})" for c in excl_cols[:5])
        bullets.append(f"Excluded from analysis ({len(excl_cols)}): {excl_desc}")

    insights.append(InsightBlock(
        title="Dataset Overview",
        summary=f"'{dataset.filename}' — {dataset.row_count:,} rows × {dataset.col_count} columns.",
        bullets=bullets or ["No typed columns detected."],
    ))

    # ── 2. Key Insights (will be replaced by LLM in _apply_narrative_rewrite) ─
    key = _build_key_insights(measures, dimensions, time_cols, df, goals=goals)
    if key:
        insights.append(key)
    elif not measures:
        # All-string dataset: generate a categorical overview instead
        string_overview = _build_string_overview_insight(dataset, df)
        if string_overview:
            insights.append(string_overview)

    # ── 3. Variable Relationships (correlation analysis) ──────────────────
    corr_block = _build_correlation_insight(measures, df, row_count=dataset.row_count)
    if corr_block:
        insights.append(corr_block)
    elif len(measures) >= 2:
        # Add a note to Key Insights if correlation was expected but found nothing
        key_block = next((b for b in insights if b.title == "Key Insights"), None)
        if key_block:
            key_block.bullets.append(
                "No strong linear relationships (|r| > 0.3) were detected between numeric columns — variables appear largely independent."
            )

    # ── 4. Per-measure distributions with shape analysis (up to 3) ────────
    for m in measures[:3]:
        insight = _build_distribution_insight(m, df)
        if insight:
            insights.append(insight)

    # ── 5. Outlier analysis ────────────────────────────────────────────────
    outlier_block = _build_outlier_insight(measures, df)
    if outlier_block:
        insights.append(outlier_block)
    elif measures:
        key_block = next((b for b in insights if b.title == "Key Insights"), None)
        if key_block:
            key_block.bullets.append(
                "No significant outliers were detected in the numeric columns using the IQR method."
            )

    # ── 6. Dimension × measure breakdowns — all dimensions, not just 2 ────
    for dim in _goal_relevant_dims(dimensions, goals)[:4]:
        insight = _dim_breakdown_insight(df, dim, measures)
        if insight:
            insights.append(insight)

    # ── 7. Time trends ────────────────────────────────────────────────────
    for time_col in time_cols[:2]:
        for measure in measures[:2]:
            chart = line_spec(df, time_col.name, measure.name)
            if chart:
                trend_bullets = _build_trend_bullets(df, time_col.name, measure.name, chart)
                trend_caveat = (
                    f"Only {len(chart.x)} time periods available — trend direction may not be reliable with this few data points."
                    if len(chart.x) < 6 else None
                )
                insights.append(InsightBlock(
                    title=f"{measure.name} over Time",
                    summary=f"How '{measure.name}' changes across time periods in '{time_col.name}'.",
                    bullets=trend_bullets,
                    chart=chart,
                    caveat=trend_caveat,
                ))
                break  # one chart per time column is enough
        else:
            # time col present but chart failed
            if time_cols:
                insights.append(InsightBlock(
                    title="Time Dimension Available",
                    summary=f"Datetime column '{time_cols[0].name}' detected but produced no chart.",
                    bullets=["Verify the column contains parseable date values."],
                ))
            break

    return insights


def _build_string_overview_insight(dataset: DatasetSummary, df: pd.DataFrame) -> InsightBlock | None:
    """Fallback insight for datasets with no numeric columns.

    Summarises the top categorical values for up to 3 string columns.
    """
    string_cols = [c for c in dataset.columns if c.dtype == "string" and not (_EXCLUSION_FLAGS & set(c.flags))]
    if not string_cols:
        return None

    bullets: list[str] = []
    for col in string_cols[:3]:
        if col.name not in df.columns:
            continue
        series = df[col.name].dropna().astype(str)
        if len(series) == 0:
            continue
        counts = series.value_counts(normalize=True).head(3)
        top_parts = [f"{val} ({pct:.0%})" for val, pct in counts.items()]
        n_unique = series.nunique()
        bullets.append(f"{col.name} — {n_unique} unique values. Top: {', '.join(top_parts)}.")

    if not bullets:
        return None

    return InsightBlock(
        title="Column Overview",
        summary=(
            "This dataset contains no numeric measures. "
            "The analysis below summarises the categorical structure of the most informative columns."
        ),
        bullets=bullets,
    )


def _build_key_insights(
    measures: list,
    dimensions: list,
    time_cols: list,
    df: pd.DataFrame,
    goals: str | None = None,
) -> InsightBlock | None:
    """Analyst thinking layer.

    Picks the most interesting measure and dimensions, then fills a
    capped statement budget in priority order:
      1. Best-dimension top outlier group
      2. Best-dimension bottom outlier group
      3. Second-dimension top outlier (if a second dimension exists)
      4. Distribution quality (skew OR high variance — whichever is stronger)
      5. Time trend (if datetime + measure both present)
    """
    if not measures:
        return None

    primary = _pick_primary_measure(measures, df)
    s = primary.numeric_stats
    if not s or s.mean == 0:
        return None

    try:
        global_mean = float(df[primary.name].mean())
    except Exception:
        return None
    if global_mean == 0:
        return None

    ranked_dims = _rank_dimensions(dimensions, primary.name, global_mean, df)
    ranked_dims = _goal_relevant_dims(ranked_dims, goals)
    statements: list[str] = []

    # ── Slots 1–3: deviation by dimension ─────────────────────────────────
    for i, dim in enumerate(ranked_dims[:2]):
        top_stmt, bot_stmt = _deviation_statements(dim, primary.name, global_mean, df)
        if i == 0:
            # First (best) dimension gets both top and bottom slots
            if top_stmt:
                statements.append(top_stmt)
            if bot_stmt:
                statements.append(bot_stmt)
        else:
            # Second dimension gets one slot (top only, avoids repetition)
            if top_stmt:
                statements.append(top_stmt)

    # ── Slot 4: distribution quality ──────────────────────────────────────
    dist_stmt = _distribution_statement(s, primary.name)
    if dist_stmt:
        statements.append(dist_stmt)

    # ── Slot 5: time trend ─────────────────────────────────────────────────
    if time_cols and len(statements) < _MAX_KEY_STATEMENTS:
        trend_stmt = _time_trend_statement(time_cols[0], primary.name, global_mean, df)
        if trend_stmt:
            statements.append(trend_stmt)

    if not statements:
        return None

    return InsightBlock(
        title="Key Insights",
        summary=f"Top patterns in '{primary.name}' — the most variable measure in this dataset.",
        bullets=statements[:_MAX_KEY_STATEMENTS],
    )


# ---------------------------------------------------------------------------
# Key insight helpers
# ---------------------------------------------------------------------------

def _pick_primary_measure(measures: list, df: pd.DataFrame):
    """Return the measure with the highest coefficient of variation.

    High CV = most spread relative to its scale = most analytically interesting.
    Falls back to the first measure if CV cannot be computed.
    """
    best, best_cv = measures[0], -1.0
    for m in measures:
        s = m.numeric_stats
        if s and s.mean != 0 and s.std >= 0:
            cv = s.std / abs(s.mean)
            if cv > best_cv:
                best_cv, best = cv, m
    return best


def _rank_dimensions(dimensions: list, measure_name: str, global_mean: float, df: pd.DataFrame) -> list:
    """Sort dimensions by how much they discriminate the primary measure.

    Score = (max_group_mean − min_group_mean) / |global_mean|.
    Higher score → dimension creates larger splits → more useful for analysis.
    """
    if len(dimensions) <= 1:
        return dimensions
    scored: list[tuple[float, object]] = []
    for dim in dimensions:
        try:
            group_means = df.groupby(dim.name)[measure_name].mean().dropna()
            if len(group_means) < 2:
                scored.append((0.0, dim))
                continue
            spread = (float(group_means.max()) - float(group_means.min())) / abs(global_mean)
            scored.append((spread, dim))
        except Exception:
            scored.append((0.0, dim))
    scored.sort(key=lambda t: t[0], reverse=True)
    return [dim for _, dim in scored]


def _goal_relevant_dims(dimensions: list, goals: str | None) -> list:
    """Re-rank dimensions so those whose name appears in goals text come first.

    Conservative: only boosts dims directly named in goals. Falls back to
    original order if goals is None or no match is found.
    """
    if not goals or not dimensions:
        return dimensions
    goals_lower = goals.lower()
    goal_tokens = set(re.split(r"[\s,./;:!?]+", goals_lower))

    def score(dim) -> int:
        dim_tokens = set(re.split(r"[\s_\-]+", dim.name.lower()))
        return 1 if dim_tokens & goal_tokens else 0

    return sorted(dimensions, key=score, reverse=True)


def _deviation_statements(
    dim, measure_name: str, global_mean: float, df: pd.DataFrame
) -> tuple[str | None, str | None]:
    """Return (top_group_statement, bottom_group_statement) for a dimension.

    Each fires only if the group mean deviates ≥ _DEVIATION_THRESHOLD from the global mean.
    """
    try:
        group_means = df.groupby(dim.name)[measure_name].mean().dropna()
        if len(group_means) < 2:
            return None, None

        top_group = group_means.idxmax()
        bot_group = group_means.idxmin()
        top_mean  = float(group_means[top_group])
        bot_mean  = float(group_means[bot_group])
        top_pct   = (top_mean - global_mean) / abs(global_mean)
        bot_pct   = (bot_mean - global_mean) / abs(global_mean)

        top_stmt = (
            f"In {dim.name}, {top_group} leads on {measure_name} "
            f"(avg {top_mean:,.2f} — {top_pct:+.0%} vs overall mean)."
            if top_pct >= _DEVIATION_THRESHOLD else None
        )
        bot_stmt = (
            f"In {dim.name}, {bot_group} trails on {measure_name} "
            f"(avg {bot_mean:,.2f} — {bot_pct:+.0%} vs overall mean)."
            if bot_pct <= -_DEVIATION_THRESHOLD else None
        )
        return top_stmt, bot_stmt
    except Exception:
        return None, None


def _distribution_statement(s, measure_name: str) -> str | None:
    """Return ONE distribution-quality statement: skew if present, else high CV.

    Never both — whichever is more extreme wins. Returns None if neither threshold is met.
    """
    if s.std <= 0 or s.mean == 0:
        return None

    skew_ratio = (s.mean - s.median) / s.std   # positive = right skew
    cv         = s.std / abs(s.mean)

    skew_notable = abs(skew_ratio) > _SKEW_STD_RATIO
    cv_notable   = cv > _HIGH_CV_THRESHOLD

    if skew_notable:
        # Skew is more specific and actionable than CV — prefer it when both fire
        direction = "right" if skew_ratio > 0 else "left"
        tail_desc = "high values inflate" if skew_ratio > 0 else "low values depress"
        return (
            f"{measure_name} is {direction}-skewed — {tail_desc} the average, "
            "so the median is a more reliable central estimate."
        )
    if cv_notable:
        return (
            f"{measure_name} is highly variable (CV {cv:.2f}) — "
            "the average alone may not be representative of a typical record."
        )
    return None


def _time_trend_statement(
    time_col, measure_name: str, global_mean: float, df: pd.DataFrame
) -> str | None:
    """Compare first-half vs second-half mean along the time axis.

    Fires only if the halves differ by ≥ _TIME_TREND_THRESHOLD relative to the global mean.
    """
    try:
        dates   = pd.to_datetime(df[time_col.name], errors="coerce")
        measure = pd.to_numeric(df[measure_name], errors="coerce")
        temp    = pd.DataFrame({"_d": dates, "_m": measure}).dropna().sort_values("_d")
        if len(temp) < 4:
            return None
        mid   = len(temp) // 2
        first = float(temp["_m"].iloc[:mid].mean())
        last  = float(temp["_m"].iloc[mid:].mean())
        change_pct = (last - first) / abs(global_mean)
        if abs(change_pct) < _TIME_TREND_THRESHOLD:
            return None
        direction = "upward" if change_pct > 0 else "downward"
        return (
            f"{measure_name} trends {direction} over time — "
            f"the second half of the period averages {abs(change_pct):.0%} "
            f"{'higher' if change_pct > 0 else 'lower'} than the first."
        )
    except Exception:
        return None


def _dim_breakdown_insight(
    df: pd.DataFrame,
    dim,
    measures: list,
    max_groups: int = 5,
    max_measures: int = 3,
) -> InsightBlock | None:
    """Aggregate top measures by a dimension column and return an InsightBlock."""
    if not measures:
        return None
    top_measures = [m for m in measures if m.numeric_stats is not None][:max_measures]
    if not top_measures:
        return None

    measure_names = [m.name for m in top_measures]

    try:
        counts = df[dim.name].value_counts().head(max_groups)
        if counts.empty:
            return None
        top_groups = counts.index.tolist()
        sub = df[df[dim.name].isin(top_groups)]
        agg_mean = sub.groupby(dim.name)[measure_names].mean().round(2)

        bullets: list[str] = []
        for group in top_groups:
            if group not in agg_mean.index:
                continue
            n = int(counts[group])
            parts = []
            for m_name in measure_names:
                if m_name in agg_mean.columns:
                    val = agg_mean.loc[group, m_name]
                    parts.append(f"avg {m_name}: {val:,}")
            if parts:
                bullets.append(f"{group} ({n:,} records) — {', '.join(parts)}")

        if not bullets:
            return None

        # Bar chart: first measure only (cleanest single-series visual)
        primary = top_measures[0].name
        chart_groups = [g for g in top_groups if g in agg_mean.index]
        chart_means  = [float(agg_mean.loc[g, primary]) for g in chart_groups if primary in agg_mean.columns]
        chart = bar_spec(chart_groups, chart_means, dim.name, primary) if chart_means else None

        measure_label = ", ".join(measure_names[:2])
        n_groups = df[dim.name].nunique(dropna=True)
        return InsightBlock(
            title=f"{dim.name} Breakdown",
            summary=(
                f"'{dim.name}' has {n_groups} distinct value(s). "
                f"Top {len(bullets)} groups by record count, with mean {measure_label}:"
            ),
            bullets=bullets,
            chart=chart,
        )
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Report sections — deterministic narrative
# ---------------------------------------------------------------------------

def _build_report_sections(
    dataset: DatasetSummary,
    key_bullets: list[str],
    goals: str | None = None,
    background: str | None = None,
) -> list[ReportSection]:
    """Returns only the Project Background section now.
    Recommendations are built separately via _build_recommendation_items."""
    dataset_info = {
        "filename": dataset.filename,
        "row_count": dataset.row_count,
        "col_count": dataset.col_count,
        "measures": [c.name for c in _measures(dataset)[:6]],
        "dimensions": [c.name for c in _dimensions(dataset)[:6]],
        "has_datetime": any(c.dtype == "datetime" for c in dataset.columns),
    }
    raw_bg = _section_project_background(goals, background)
    bg_content = _narrative_svc.rewrite_project_background(goals, background, dataset_info) or raw_bg

    return [
        ReportSection(
            title="Project Background",
            content=bg_content,
        ),
    ]


def _build_recommendation_items(
    dataset: DatasetSummary,
    df: pd.DataFrame,
    key_bullets: list[str],
    goals: str | None,
    background: str | None,
) -> list[RecommendationItem]:
    ms   = _measures(dataset)
    dims = _dimensions(dataset)
    tcs  = _time_dims(dataset)

    dataset_info = {
        "filename": dataset.filename,
        "row_count": dataset.row_count,
        "col_count": dataset.col_count,
        "measures": [c.name for c in ms[:5]],
        "dimensions": [c.name for c in dims[:5]],
    }

    llm_items = _narrative_svc.generate_recommendation_items(
        key_bullets=key_bullets,
        dataset_info=dataset_info,
        goals=goals,
        background=background,
    )
    if llm_items:
        return [RecommendationItem(**i) for i in llm_items]

    # Fallback: convert deterministic bullets to simple RecommendationItem structs
    fallback_bullets = _section_recommendations(dataset, df, ms, dims, tcs)
    items = []
    for bullet in fallback_bullets:
        words = bullet.split()
        title = " ".join(words[:6]).rstrip(".,") if words else "Recommendation"
        items.append(RecommendationItem(
            title=title,
            observation=bullet,
            action="Review this finding with your team and determine whether it warrants a change to current strategy or processes.",
        ))
    return items


def _section_project_background(goals: str | None = None, background: str | None = None) -> str:
    if not goals and not background:
        return (
            "No objective or background context was provided for this analysis. "
            "Add a goal and data context on the upload step to receive targeted recommendations."
        )
    parts: list[str] = []
    if background:
        parts.append(background.strip())
    if goals:
        parts.append(f"Objective: {goals.strip()}")
    return " ".join(parts)


def _section_executive_summary(
    dataset: DatasetSummary,
    measures: list,
    dimensions: list,
    time_cols: list,
    key_bullets: list[str],
) -> str:
    parts: list[str] = []

    # Sentence 1: dataset size
    parts.append(
        f"This dataset ({dataset.filename}) contains {dataset.row_count:,} records "
        f"across {dataset.col_count} columns."
    )

    # Sentence 2: column roles
    role_clauses: list[str] = []
    if measures:
        names = ", ".join(c.name for c in measures[:3])
        role_clauses.append(f"{len(measures)} numeric measure{'s' if len(measures) > 1 else ''} ({names})")
    if dimensions:
        names = ", ".join(c.name for c in dimensions[:3])
        role_clauses.append(f"{len(dimensions)} categorical dimension{'s' if len(dimensions) > 1 else ''} ({names})")
    if time_cols:
        names = ", ".join(c.name for c in time_cols)
        role_clauses.append(f"{len(time_cols)} time column{'s' if len(time_cols) > 1 else ''} ({names})")
    if role_clauses:
        parts.append("It includes " + _join_natural(role_clauses) + ".")

    # Sentence 3: top finding (first key insight bullet, if any)
    if key_bullets:
        parts.append(key_bullets[0])

    return " ".join(parts)


def _section_recommendations(
    dataset: DatasetSummary,
    df: pd.DataFrame,
    measures: list,
    dimensions: list,
    time_cols: list,
) -> list[str]:
    recs: list[str] = []

    primary = _pick_primary_measure(measures, df) if measures else None
    s = primary.numeric_stats if primary else None

    if s and s.std > 0 and s.mean != 0:
        skew_ratio = (s.mean - s.median) / s.std
        cv = s.std / abs(s.mean)

        if abs(skew_ratio) > _SKEW_STD_RATIO:
            direction = "right" if skew_ratio > 0 else "left"
            tail = "high-value outliers are inflating" if skew_ratio > 0 else "low-value outliers are depressing"
            recs.append(
                f"{primary.name} is {direction}-skewed ({tail} the average). "
                "Use the median rather than the mean as the primary central estimate for more accurate reporting."
            )

        if cv > _HIGH_CV_THRESHOLD and dimensions:
            recs.append(
                f"{primary.name} shows high variability (CV {cv:.2f}). "
                f"Segment-level analysis — particularly by {dimensions[0].name} — "
                "is likely to surface meaningful sub-group differences obscured by the overall average."
            )

    if time_cols and measures and primary:
        try:
            gm = float(df[primary.name].mean())
        except Exception:
            gm = None
        if gm:
            trend_stmt = _time_trend_statement(time_cols[0], primary.name, gm, df)
            if trend_stmt:
                direction = "upward" if "upward" in trend_stmt else "downward"
                recs.append(
                    f"An {direction} trend is present in {primary.name} over time. "
                    f"Decomposing by {time_cols[0].name} — for example, comparing period-over-period averages — "
                    "will help distinguish sustained trend from short-term variation."
                )

    if len(dimensions) >= 2:
        d1, d2 = dimensions[0].name, dimensions[1].name
        recs.append(
            f"With {len(dimensions)} grouping dimensions available ({d1}, {d2}"
            f"{', …' if len(dimensions) > 2 else ''}), cross-dimensional analysis "
            "may reveal interaction effects not visible in single-dimension breakdowns."
        )

    high_null = [c for c in dataset.columns if c.null_pct > 0.10]
    if high_null:
        names = ", ".join(c.name for c in high_null[:3])
        recs.append(
            f"Column(s) with notable missing data ({names}) should be reviewed for "
            "imputation or exclusion before use in downstream aggregations or models."
        )

    if not recs:
        recs.append(
            "No significant structural issues were detected. "
            "The dataset appears suitable for the analysis patterns identified above."
        )

    return recs[:5]


def _section_limitations(dataset: DatasetSummary, excluded: list) -> str:
    parts: list[str] = [
        "Analysis covers a single uploaded file; findings reflect patterns in the "
        "provided sample and should not be generalized without validating against a "
        "broader or more representative population.",

        "Column type classification is heuristic — review the Data Structure table "
        "to confirm column roles, particularly for columns with ambiguous formatting "
        "(e.g. numeric-looking strings, inconsistent date formats).",
    ]

    high_null = [c for c in dataset.columns if c.null_pct > 0.05]
    if high_null:
        names = ", ".join(c.name for c in high_null[:3])
        parts.append(
            f"Aggregated statistics exclude null values. "
            f"Column(s) with notable missing data ({names}) may underrepresent "
            "certain subgroups in computed averages."
        )

    if excluded:
        names = ", ".join(c.name for c in excluded[:3])
        parts.append(
            f"Column(s) classified as identifiers or contact data ({names}) "
            "were excluded from aggregation and grouping."
        )

    parts.append(
        "This version does not perform multi-table joins, statistical significance "
        "testing, or causal inference."
    )

    return " ".join(parts)


def _build_split_assumptions(
    dataset: DatasetSummary,
    excluded: list,
    narrative_svc,
) -> tuple[list[str], list[str]]:
    """Returns (assumptions, limitations) as two separate flat string lists."""
    context = {
        "filename": dataset.filename,
        "row_count": dataset.row_count,
        "col_count": dataset.col_count,
        "high_null_columns": [
            {"name": c.name, "null_pct": round(c.null_pct * 100, 1)}
            for c in dataset.columns if c.null_pct > 0.05
        ],
        "excluded_columns": [c.name for c in excluded],
        "has_datetime": any(c.dtype == "datetime" for c in dataset.columns),
    }
    result = narrative_svc.generate_split_assumptions(context)
    if result:
        return result.get("assumptions", []), result.get("limitations", [])

    # Deterministic fallbacks
    fallback_assumptions = [
        "Assume that the number of recorded rows is a valid indicator of the underlying activity being measured.",
        "Assume that column names accurately reflect the data they contain.",
        "Assume that data collection methodology remained consistent throughout the dataset.",
    ]
    high_null = [c for c in dataset.columns if c.null_pct > 0.05]
    if high_null:
        names = ", ".join(c.name for c in high_null[:3])
        fallback_assumptions.append(
            f"Assume that null values in {names} are missing at random and do not introduce systematic bias."
        )

    fallback_limitations = [
        "This analysis covers a single uploaded file; findings may not generalize to the broader population.",
        "Column type classification uses heuristics and may misclassify ambiguous columns.",
        "This analysis does not perform statistical significance testing or causal inference.",
    ]
    if excluded:
        names = ", ".join(c.name for c in excluded[:3])
        fallback_limitations.append(
            f"Column(s) classified as identifiers or contact data ({names}) were excluded from aggregation."
        )

    return fallback_assumptions, fallback_limitations


def _build_conclusion(
    key_bullets: list[str],
    dataset_name: str,
    narrative_svc,
    goals: str | None = None,
) -> str:
    bullets_for_conclusion = key_bullets
    if goals:
        bullets_for_conclusion = [f"Goal: {goals}"] + key_bullets
    result = narrative_svc.generate_conclusion(bullets_for_conclusion, dataset_name)
    if result:
        return result
    # Fallback: join first 2 key bullets as a plain sentence
    return " ".join(key_bullets[:2]) if key_bullets else ""


def _join_natural(items: list[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return ", ".join(items[:-1]) + f", and {items[-1]}"
