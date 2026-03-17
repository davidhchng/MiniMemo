"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import type { PlotParams } from "react-plotly.js"
import { useReportStore } from "../../store/report-store"
import type { ChartSpec, ColumnSummary, InsightBlock, ReportSection } from "../../lib/types"

const Plot = dynamic<PlotParams>(() => import("react-plotly.js"), { ssr: false })

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportPage() {
  const report = useReportStore((s) => s.report)
  const clear  = useReportStore((s) => s.clear)
  const router = useRouter()

  useEffect(() => {
    if (!report) router.replace("/")
  }, [report, router])

  if (!report) return null

  const { dataset, insights, report_sections } = report
  const keyInsights   = insights.find((b) => b.title === "Key Insights") ?? null
  const otherInsights = insights.filter((b) => b.title !== "Key Insights")

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fb" }}>

      {/* ── Nav bar ─────────────────────────────────────────────────────── */}
      <nav style={{
        background: "#fff",
        borderBottom: "1px solid #e2e8f0",
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em", color: "#0f172a" }}>
          MiniMemo
        </span>
        <button
          onClick={() => { clear(); router.push("/") }}
          style={{
            background: "none",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            padding: "5px 12px",
            fontSize: 13,
            color: "#475569",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          ← New analysis
        </button>
      </nav>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 32px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px", color: "#0f172a" }}>
          Analytics Report
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 32px", display: "flex", gap: 0, alignItems: "center" }}>
          {dataset.filename}
          <Dot />
          {dataset.row_count.toLocaleString()} rows
          <Dot />
          {dataset.col_count} columns
        </p>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 32px 72px" }}>

        {/* Key Insights — featured accent card */}
        {keyInsights && (
          <PageBlock label="Key Insights">
            <div style={{
              background: "#faf9ff",
              border: "1px solid #ddd6fe",
              borderLeft: "3px solid #7c3aed",
              borderRadius: 10,
              padding: "18px 22px",
            }}>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {keyInsights.bullets.map((b, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      fontSize: 14,
                      lineHeight: 1.65,
                      color: "#1e1b4b",
                      paddingBottom: i < keyInsights.bullets.length - 1 ? 11 : 0,
                      marginBottom: i < keyInsights.bullets.length - 1 ? 11 : 0,
                      borderBottom: i < keyInsights.bullets.length - 1 ? "1px solid #ede9fe" : "none",
                    }}
                  >
                    <span style={{ color: "#7c3aed", flexShrink: 0, lineHeight: 1.65, fontSize: 12 }}>◆</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </PageBlock>
        )}

        {/* Data Structure */}
        <PageBlock label="Data Structure">
          <Card noPad>
            <div style={{ padding: "12px 18px 11px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                {dataset.row_count.toLocaleString()} rows · {dataset.col_count} columns
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8f9fb" }}>
                    {["Column", "Type", "Flags", "Nulls", "Unique", "Mean", "Min", "Max"].map((h) => (
                      <th key={h} style={{
                        textAlign: "left",
                        padding: "8px 14px",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                        borderBottom: "1px solid #e2e8f0",
                        whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.columns.map((col: ColumnSummary, i) => (
                    <tr key={col.name} style={{ background: i % 2 === 1 ? "#fafbfc" : "#fff" }}>
                      <td style={tdStyle}><span style={{ fontWeight: 500, color: "#0f172a" }}>{col.name}</span></td>
                      <td style={tdStyle}>
                        <Badge {...dtypeBadgeStyle(col.dtype)}>{col.dtype}</Badge>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {col.flags.length > 0
                            ? col.flags.map((f) => (
                                <Badge key={f} {...flagBadgeStyle(f)}>
                                  {f.replace(/_/g, "\u00a0")}
                                </Badge>
                              ))
                            : <span style={{ color: "#d1d5db" }}>—</span>
                          }
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {(col.null_pct * 100).toFixed(1)}%
                      </td>
                      <td style={{ ...tdStyle, color: "#475569" }}>
                        {col.unique_count.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, color: "#475569" }}>
                        {col.numeric_stats?.mean ?? <Dash />}
                      </td>
                      <td style={{ ...tdStyle, color: "#475569" }}>
                        {col.numeric_stats?.min ?? <Dash />}
                      </td>
                      <td style={{ ...tdStyle, color: "#475569" }}>
                        {col.numeric_stats?.max ?? <Dash />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </PageBlock>

        {/* Report sections */}
        {report_sections.map((section: ReportSection) => (
          <PageBlock key={section.title} label={section.title}>
            <Card>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: "#475569" }}>
                {section.content}
              </p>
            </Card>
          </PageBlock>
        ))}

        {/* Insight cards */}
        {otherInsights.length > 0 && (
          <PageBlock label="Analysis">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {otherInsights.map((insight: InsightBlock) => (
                <Card key={insight.title}>
                  <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.01em" }}>
                    {insight.title}
                  </p>
                  <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
                    {insight.summary}
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 16, color: "#374151", fontSize: 13, lineHeight: 1.85 }}>
                    {insight.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                  {insight.chart && <InsightChart chart={insight.chart} />}
                  {insight.caveat && (
                    <p style={{ margin: "12px 0 0", fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>
                      {insight.caveat}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </PageBlock>
        )}

      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layout components
// ---------------------------------------------------------------------------

function PageBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "#94a3b8",
        margin: "0 0 9px",
      }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function Card({ children, noPad }: { children: React.ReactNode; noPad?: boolean }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: 10,
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      overflow: "hidden",
      ...(noPad ? {} : { padding: "18px 22px" }),
    }}>
      {children}
    </div>
  )
}

function Badge({
  children,
  background,
  color,
}: {
  children: React.ReactNode
  background: string
  color: string
}) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 7px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.02em",
      background,
      color,
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  )
}

function InsightChart({ chart }: { chart: ChartSpec }) {
  const isLine = chart.type === "line"
  return (
    <div style={{ marginTop: 18, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
      <Plot
        data={[{
          type: isLine ? "scatter" : "bar",
          mode: isLine ? "lines+markers" : undefined,
          x: chart.x,
          y: chart.y,
          marker: { color: "#6366f1", opacity: 0.85 },
          line: isLine ? { color: "#6366f1", width: 2 } : undefined,
        }]}
        layout={{
          xaxis: {
            title: { text: chart.x_label, font: { size: 11, color: "#94a3b8" } },
            tickangle: -30,
            tickfont: { size: 11, color: "#64748b" },
            gridcolor: "#f1f5f9",
          },
          yaxis: {
            title: { text: chart.y_label, font: { size: 11, color: "#94a3b8" } },
            tickfont: { size: 11, color: "#64748b" },
            gridcolor: "#f1f5f9",
          },
          margin: { t: 8, r: 12, b: 64, l: 56 },
          height: 240,
          paper_bgcolor: "transparent",
          plot_bgcolor: "#fafbfc",
          font: { family: "Inter, ui-sans-serif, system-ui, sans-serif", size: 12 },
          bargap: 0.35,
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function Dot() {
  return <span style={{ margin: "0 8px", color: "#d1d5db" }}>·</span>
}

function Dash() {
  return <span style={{ color: "#d1d5db" }}>—</span>
}

const tdStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
}

// ---------------------------------------------------------------------------
// Badge style maps
// ---------------------------------------------------------------------------

function dtypeBadgeStyle(dtype: ColumnSummary["dtype"]) {
  const map: Record<ColumnSummary["dtype"], { background: string; color: string }> = {
    numeric:  { background: "#dbeafe", color: "#1d4ed8" },
    datetime: { background: "#dcfce7", color: "#15803d" },
    string:   { background: "#f1f5f9", color: "#475569" },
  }
  return map[dtype]
}

function flagBadgeStyle(flag: string) {
  const map: Record<string, { background: string; color: string }> = {
    email:            { background: "#fce7f3", color: "#9d174d" },
    url_like:         { background: "#e0f2fe", color: "#0369a1" },
    phone_like:       { background: "#fef3c7", color: "#92400e" },
    id_like:          { background: "#ede9fe", color: "#6d28d9" },
    low_cardinality:  { background: "#fef9c3", color: "#854d0e" },
    high_cardinality: { background: "#f1f5f9", color: "#475569" },
    likely_name:      { background: "#fdf2f8", color: "#86198f" },
    likely_location:  { background: "#ecfdf5", color: "#065f46" },
  }
  return map[flag] ?? { background: "#f1f5f9", color: "#475569" }
}
