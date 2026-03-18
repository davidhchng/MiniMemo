/**
 * TypeScript mirrors of backend Pydantic models (backend/models.py).
 * Keep these in sync when the backend models change.
 */

export interface NumericStats {
  mean: number
  median: number
  std: number
  min: number
  max: number
}

export interface CategoryCount {
  value: string
  count: number
  pct: number
}

export interface ColumnSummary {
  name: string
  dtype: "numeric" | "datetime" | "string"
  flags: string[]
  null_count: number
  null_pct: number
  unique_count: number
  sample_values: string[]
  numeric_stats: NumericStats | null
  top_categories: CategoryCount[] | null
}

export interface DatasetSummary {
  filename: string
  row_count: number
  col_count: number
  columns: ColumnSummary[]
}

export interface ChartSpec {
  type: "bar" | "histogram" | "line"
  title: string
  x_label: string
  y_label: string
  x: string[]
  y: number[]
}

export interface InsightBlock {
  title: string
  summary: string
  bullets: string[]
  caveat: string | null
  chart: ChartSpec | null
}

export interface ReportSection {
  title: string
  content: string
  bullets: string[]
}

export interface AnalysisResponse {
  dataset: DatasetSummary
  insights: InsightBlock[]
  report_sections: ReportSection[]
}
