"""
MiniMemo API — Phase 1 foundation.

Single endpoint: POST /analyze
Accepts a CSV or XLSX file, runs deterministic profiling,
returns structured analysis with insights and report sections.

TODO (Phase 2): Add POST /sessions/{id}/join for multi-table support
TODO (Phase 3): Add POST /sessions/{id}/context for user objective + notes
TODO (Phase 4): Replace mock report sections with LLM-generated narrative
"""

import io
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

from models import AnalysisResponse, DatasetSummary, InsightBlock, ReportSection
from processing import profile_dataframe
from report.charts import bar_spec, histogram_spec, line_spec
from report.llm_client import get_llm_client
from report.narrative import rewrite_insight_bullets

load_dotenv()
_llm_client = get_llm_client()

app = FastAPI(title="MiniMemo API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_ROWS = 200_000
ALLOWED_EXTENSIONS = {".csv", ".xlsx"}

# String flags that mark a column as non-analytic (exclude from dimensions)
_EXCLUSION_FLAGS = {"email", "url_like", "phone_like", "id_like"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(file: UploadFile = File(...)):
    filename = file.filename or ""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Upload a CSV or XLSX file.",
        )

    contents = await file.read()

    try:
        df = (
            pd.read_csv(io.BytesIO(contents))
            if ext == ".csv"
            else pd.read_excel(io.BytesIO(contents))
        )
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Could not parse file: {exc}",
        )

    if len(df) > MAX_ROWS:
        raise HTTPException(
            status_code=413,
            detail=f"File has {len(df):,} rows, which exceeds the {MAX_ROWS:,} row limit.",
        )

    if len(df) == 0:
        raise HTTPException(status_code=422, detail="The uploaded file has no rows.")

    dataset  = profile_dataframe(df, filename)
    insights = _build_insights(dataset, df)
    insights = _apply_narrative_rewrite(insights)

    return AnalysisResponse(
        dataset=dataset,
        insights=insights,
        report_sections=_build_report_sections(dataset),
    )


# ---------------------------------------------------------------------------
# AI narrative post-processing
# ---------------------------------------------------------------------------

def _apply_narrative_rewrite(insights: list[InsightBlock]) -> list[InsightBlock]:
    """Find the Key Insights block and rewrite its bullets with the LLM.

    Falls back silently to the original deterministic bullets on any failure,
    including when no API key is configured (MockLLMClient returns '{}').
    All other insight blocks are untouched.
    """
    key_idx = next(
        (i for i, b in enumerate(insights) if b.title == "Key Insights"), None
    )
    if key_idx is None:
        return insights

    original = insights[key_idx]
    rewritten = rewrite_insight_bullets(_llm_client, original.bullets)
    if not rewritten:
        return insights

    result = list(insights)
    result[key_idx] = original.model_copy(update={"bullets": rewritten})
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

def _build_insights(dataset: DatasetSummary, df: pd.DataFrame) -> list[InsightBlock]:
    measures   = _measures(dataset)
    dimensions = _dimensions(dataset)
    time_cols  = _time_dims(dataset)
    excl_cols  = _excluded(dataset)

    # Other string columns (not dimension, not excluded)
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
        bullets.append(f"Excluded from analysis — identifiers/contact ({len(excl_cols)}): {excl_desc}")

    insights.append(InsightBlock(
        title="Dataset Overview",
        summary=f"'{dataset.filename}' — {dataset.row_count:,} rows × {dataset.col_count} columns.",
        bullets=bullets or ["No typed columns detected."],
        caveat=None,
    ))

    # ── 2. Key Insights (analyst thinking layer) ───────────────────────────
    key = _build_key_insights(measures, dimensions, time_cols, df)
    if key:
        insights.append(key)

    # ── 3. Per-measure distributions (histogram, up to 2) ─────────────────
    for m in measures[:2]:
        s = m.numeric_stats
        if not s:
            continue
        chart = histogram_spec(df[m.name], m.name)
        insights.append(InsightBlock(
            title=f"Distribution: {m.name}",
            summary=f"'{m.name}' ranges from {s.min} to {s.max}.",
            bullets=[
                f"Mean: {s.mean}",
                f"Median: {s.median}",
                f"Std dev: {s.std}",
                f"Null rate: {m.null_pct * 100:.1f}%",
                f"Unique values: {m.unique_count:,}",
            ],
            chart=chart,
        ))

    # ── 3. Dimension × measure breakdowns (bar chart, up to 2 dimensions) ─
    for dim in dimensions[:2]:
        insight = _dim_breakdown_insight(df, dim, measures)
        if insight:
            insights.append(insight)

    # ── 4. Time trend (line chart) ─────────────────────────────────────────
    if time_cols and measures:
        time_col = time_cols[0]
        measure  = measures[0]
        chart = line_spec(df, time_col.name, measure.name)
        if chart:
            insights.append(InsightBlock(
                title=f"Trend: {measure.name} over Time",
                summary=f"Average '{measure.name}' grouped by time period using '{time_col.name}'.",
                bullets=[
                    f"Time column: {time_col.name}",
                    f"Measure: {measure.name}",
                    f"Periods shown: {len(chart.x)}",
                ],
                chart=chart,
            ))
        else:
            # Fall back to text note if line spec fails (e.g. too few parsed dates)
            insights.append(InsightBlock(
                title="Time Dimension Available",
                summary=f"Datetime column '{time_col.name}' detected but could not generate a trend chart.",
                bullets=["Verify the column contains parseable date values."],
            ))

    return insights


def _build_key_insights(
    measures: list,
    dimensions: list,
    time_cols: list,
    df: pd.DataFrame,
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
# Report sections
# ---------------------------------------------------------------------------

def _build_report_sections(dataset: DatasetSummary) -> list[ReportSection]:
    measure_names = ", ".join(c.name for c in _measures(dataset)) or "none"
    dim_names     = ", ".join(c.name for c in _dimensions(dataset)) or "none"
    time_names    = ", ".join(c.name for c in _time_dims(dataset)) or "none"

    col_summary = f"measures: {measure_names}; dimensions: {dim_names}; time: {time_names}"

    return [
        ReportSection(
            title="Project Background",
            content=(
                "TODO (Phase 4 — AI layer): This section will be generated from the "
                "user's stated analysis objective and domain context notes. It will describe "
                "the dataset origin, the business question being answered, and the scope of analysis."
            ),
        ),
        ReportSection(
            title="Executive Summary",
            content=(
                f"Dataset: {dataset.filename} — {dataset.row_count:,} rows, {dataset.col_count} columns. "
                f"Column roles: {col_summary}. "
                "TODO (Phase 4 — AI layer): Key findings and top-line conclusions will appear here."
            ),
        ),
        ReportSection(
            title="Recommendations",
            content=(
                "TODO (Phase 4 — AI layer): Actionable recommendations will be generated "
                "from detected patterns, user objectives, and domain context."
            ),
        ),
        ReportSection(
            title="Assumptions & Limitations",
            content=(
                "Phase 1 limitations: single-file analysis only; no join detection; "
                "no chart generation; no AI-generated narrative. "
                "Type inference is heuristic and may misclassify edge-case columns. "
                "Multi-table joins, Plotly charts, and LLM narrative are planned for future phases."
            ),
        ),
    ]
