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


class AnalysisResponse(BaseModel):
    dataset: DatasetSummary
    insights: list[InsightBlock]
    report_sections: list[ReportSection]
