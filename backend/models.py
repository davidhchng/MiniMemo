"""
Core data contracts for MiniMemo.

These models define the shape of every response the backend sends.
The frontend TypeScript types in frontend/lib/types.ts mirror these exactly.
"""

from __future__ import annotations
from typing import Any, Literal
from pydantic import BaseModel


class NumericStats(BaseModel):
    mean: float
    median: float
    std: float
    min: float
    max: float


class CategoryCount(BaseModel):
    value: str
    count: int
    pct: float  # proportion of non-null values, 0.0–1.0


class ColumnSummary(BaseModel):
    name: str
    dtype: Literal["numeric", "datetime", "string"]
    flags: list[str] = []    # semantic flags for string columns (e.g. email, id_like, low_cardinality)
    null_count: int
    null_pct: float          # 0.0–1.0
    unique_count: int
    sample_values: list[str]  # up to 5 non-null values, stringified
    numeric_stats: NumericStats | None = None
    top_categories: list[CategoryCount] | None = None  # populated when low_cardinality flag is set


class DatasetSummary(BaseModel):
    filename: str
    row_count: int
    col_count: int
    columns: list[ColumnSummary]


class ChartSpec(BaseModel):
    """Pre-aggregated chart data. Frontend renders with Plotly — no computation needed there."""
    type: Literal["bar", "histogram", "line"]
    title: str
    x_label: str
    y_label: str
    x: list[str]    # categories, bin labels, or date strings
    y: list[float]  # counts or aggregated values


class InsightBlock(BaseModel):
    title: str
    summary: str
    bullets: list[str]
    caveat: str | None = None
    chart: ChartSpec | None = None


class ReportSection(BaseModel):
    title: str
    content: str
    bullets: list[str] = []  # optional scannable items


class RecommendationItem(BaseModel):
    title: str        # short action-oriented heading, e.g. "Prioritize High-Demand Stations"
    observation: str  # one sentence: what the data shows
    action: str       # one sentence: what to do about it


class AnalysisResponse(BaseModel):
    dataset: DatasetSummary
    insights: list[InsightBlock]
    report_sections: list[ReportSection]   # used for Project Background only
    recommendation_items: list[RecommendationItem] = []
    assumptions: list[str] = []
    limitations: list[str] = []
    conclusion: str = ""


class JoinInsight(BaseModel):
    total_a: int                           # row count of dataset_a
    total_b: int                           # row count of dataset_b
    matched_rows: int                      # inner join row count (distinct key values matched)
    left_only_rows: int                    # distinct keys in a with no match in b
    right_only_rows: int                   # distinct keys in b with no match in a
    match_pct: float                       # matched / min(total_a, total_b)
    cross_insights: list[InsightBlock] = []  # cross-dataset breakdowns computed from the join


class JoinSuggestion(BaseModel):
    dataset_a: str       # filename
    dataset_b: str       # filename
    column_a: str
    column_b: str
    reason: str          # human-readable explanation
    confidence: float    # 0.0–1.0
    join_insight: JoinInsight


class BatchAnalysisResponse(BaseModel):
    results: list[AnalysisResponse]
    suggested_joins: list[JoinSuggestion] = []
