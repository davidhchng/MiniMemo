"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import type { PlotParams } from "react-plotly.js"
import { useReportStore } from "../../store/report-store"
import type { ChartSpec, ColumnSummary, InsightBlock, ReportSection } from "../../lib/types"

const Plot = dynamic<PlotParams>(() => import("react-plotly.js"), { ssr: false })

// ─── Design tokens ──────────────────────────────────────────────────────────
const T = {
  pageBg:        "#eef0f3",
  cardBg:        "#ffffff",
  cardBorder:    "#e2e8f0",
  cardShadow:    "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  violet:        "#7c3aed",
  violetLight:   "#f5f3ff",
  violetBorder:  "#c4b5fd",
  violetMid:     "#5b21b6",
  textPrimary:   "#0f172a",
  textSecondary: "#374151",
  textMuted:     "#64748b",
  textFaint:     "#94a3b8",
  borderLight:   "#f1f5f9",
  tableZebra:    "#f8f9fa",
}

// ─── Page ────────────────────────────────────────────────────────────────────

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
    <div style={{ minHeight: "100vh", background: T.pageBg }}>

      {/* Nav */}
      <nav style={{
        background: T.cardBg,
        borderBottom: `1px solid ${T.cardBorder}`,
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 40px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em", color: T.textPrimary }}>
          MiniMemo
        </span>
        <button
          onClick={() => { clear(); router.push("/") }}
          style={{
            background: "none",
            border: `1px solid ${T.cardBorder}`,
            borderRadius: 6,
            padding: "5px 13px",
            fontSize: 13,
            color: T.textMuted,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          ← New analysis
        </button>
      </nav>

      {/* Page header */}
      <div style={{
        background: T.cardBg,
        borderBottom: `1px solid ${T.cardBorder}`,
        padding: "32px 40px",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h1 style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            margin: "0 0 8px",
            color: T.textPrimary,
          }}>
            Analytics Report
          </h1>
          <p style={{
            fontSize: 13,
            color: T.textMuted,
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 0,
          }}>
            <span style={{ fontWeight: 500, color: T.textSecondary }}>{dataset.filename}</span>
            <Sep />
            {dataset.row_count.toLocaleString()} rows
            <Sep />
            {dataset.col_count} columns
          </p>
        </div>
      </div>

      {/* Body */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "36px 40px 80px" }}>

        {/* Key Insights — self-contained accent card */}
        {keyInsights && (
          <Section label="Key Insights">
            <div style={{
              background: T.cardBg,
              border: `1px solid ${T.violetBorder}`,
              borderRadius: 10,
              boxShadow: T.cardShadow,
              overflow: "hidden",
            }}>
              {/* Card header strip */}
              <div style={{
                background: T.violetLight,
                borderBottom: `1px solid ${T.violetBorder}`,
                padding: "11px 22px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <span style={{ color: T.violet, fontSize: 12, lineHeight: 1 }}>◆</span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: T.violetMid,
                }}>
                  Key Insights
                </span>
              </div>
              {/* Bullets */}
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {keyInsights.bullets.map((b, i) => (
                  <li
                    key={i}
                    style={{
                      padding: "14px 22px",
                      fontSize: 14,
                      lineHeight: 1.65,
                      color: T.textSecondary,
                      borderBottom: i < keyInsights.bullets.length - 1
                        ? `1px solid ${T.borderLight}` : "none",
                    }}
                  >
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        )}

        {/* Data Structure */}
        <Section label="Data Structure">
          <Card noPad>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8f9fb" }}>
                    {["Column", "Type", "Flags", "Nulls", "Unique", "Mean", "Min", "Max"].map((h) => (
                      <th key={h} style={{
                        textAlign: "left",
                        padding: "10px 16px",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: T.textFaint,
                        borderBottom: `1px solid ${T.cardBorder}`,
                        whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.columns.map((col: ColumnSummary, i) => (
                    <tr key={col.name} style={{
                      background: i % 2 === 1 ? T.tableZebra : T.cardBg,
                    }}>
                      <td style={td}>
                        <span style={{ fontWeight: 600, color: T.textPrimary, fontSize: 13 }}>
                          {col.name}
                        </span>
                      </td>
                      <td style={td}>
                        <Badge {...dtypeStyle(col.dtype)}>{col.dtype}</Badge>
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {col.flags.length > 0
                            ? col.flags.map((f) => (
                                <Badge key={f} {...flagStyle(f)}>
                                  {f.replace(/_/g, "\u00a0")}
                                </Badge>
                              ))
                            : <span style={{ color: T.cardBorder }}>—</span>
                          }
                        </div>
                      </td>
                      <td style={{ ...td, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
                        {(col.null_pct * 100).toFixed(1)}%
                      </td>
                      <td style={{ ...td, color: T.textMuted }}>
                        {col.unique_count.toLocaleString()}
                      </td>
                      <td style={{ ...td, color: T.textMuted }}>
                        {col.numeric_stats?.mean ?? <Dash />}
                      </td>
                      <td style={{ ...td, color: T.textMuted }}>
                        {col.numeric_stats?.min ?? <Dash />}
                      </td>
                      <td style={{ ...td, color: T.textMuted }}>
                        {col.numeric_stats?.max ?? <Dash />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Section>

        {/* Report sections */}
        {report_sections.map((section: ReportSection) => (
          <Section key={section.title} label={section.title}>
            <Card>
              <p style={{
                margin: section.bullets.length > 0 ? "0 0 14px" : 0,
                fontSize: 14,
                lineHeight: 1.8,
                color: T.textMuted,
              }}>
                {section.content}
              </p>
              {section.bullets.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                  {section.bullets.map((b, i) => (
                    <li key={i} style={{
                      display: "flex",
                      gap: 10,
                      padding: "9px 0",
                      fontSize: 14,
                      lineHeight: 1.65,
                      color: T.textSecondary,
                      borderTop: i > 0 ? `1px solid ${T.borderLight}` : "none",
                    }}>
                      <span style={{ color: T.textFaint, flexShrink: 0, lineHeight: 1.65 }}>·</span>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Section>
        ))}

        {/* Analysis cards */}
        {otherInsights.length > 0 && (
          <Section label="Analysis">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {otherInsights.map((insight: InsightBlock) => (
                <Card key={insight.title}>
                  <p style={{
                    margin: "0 0 2px",
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    color: T.textPrimary,
                  }}>
                    {insight.title}
                  </p>
                  <p style={{
                    margin: "0 0 12px",
                    fontSize: 13,
                    color: T.textMuted,
                    lineHeight: 1.6,
                  }}>
                    {insight.summary}
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 16, color: T.textSecondary, fontSize: 13, lineHeight: 1.9 }}>
                    {insight.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                  {insight.chart && <InsightChart chart={insight.chart} />}
                  {insight.caveat && (
                    <p style={{ margin: "12px 0 0", fontSize: 12, color: T.textFaint, fontStyle: "italic" }}>
                      {insight.caveat}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </Section>
        )}

      </main>
    </div>
  )
}

// ─── Layout components ───────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: T.textMuted,
          whiteSpace: "nowrap",
        }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 1, background: T.borderLight }} />
      </div>
      {children}
    </div>
  )
}

function Card({ children, noPad }: { children: React.ReactNode; noPad?: boolean }) {
  return (
    <div style={{
      background: T.cardBg,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 10,
      boxShadow: T.cardShadow,
      overflow: "hidden",
      ...(noPad ? {} : { padding: "20px 24px" }),
    }}>
      {children}
    </div>
  )
}

function Badge({ children, background, color }: {
  children: React.ReactNode
  background: string
  color: string
}) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 6px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: "0.01em",
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
    <div style={{ marginTop: 16, borderTop: `1px solid ${T.borderLight}`, paddingTop: 14 }}>
      <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 500, color: T.textFaint }}>
        {chart.title}
      </p>
      <Plot
        data={[{
          type: isLine ? "scatter" : "bar",
          mode: isLine ? "lines+markers" : undefined,
          x: chart.x,
          y: chart.y,
          marker: { color: "#6366f1", opacity: 0.9 },
          line: isLine ? { color: "#6366f1", width: 2 } : undefined,
        }]}
        layout={{
          xaxis: {
            title: { text: chart.x_label, font: { size: 11, color: T.textFaint } },
            tickangle: -30,
            tickfont: { size: 11, color: T.textMuted },
            gridcolor: T.borderLight,
            linecolor: T.cardBorder,
          },
          yaxis: {
            title: { text: chart.y_label, font: { size: 11, color: T.textFaint } },
            tickfont: { size: 11, color: T.textMuted },
            gridcolor: T.borderLight,
            linecolor: T.cardBorder,
          },
          margin: { t: 4, r: 12, b: 60, l: 54 },
          height: 240,
          paper_bgcolor: "transparent",
          plot_bgcolor: "#f8f9fb",
          font: { family: "Inter, ui-sans-serif, system-ui, sans-serif", size: 12 },
          bargap: 0.4,
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
    </div>
  )
}

// ─── Micro-components ────────────────────────────────────────────────────────

function Sep() {
  return <span style={{ margin: "0 10px", color: T.cardBorder }}>·</span>
}

function Dash() {
  return <span style={{ color: T.cardBorder }}>—</span>
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const td: React.CSSProperties = {
  padding: "11px 16px",
  borderBottom: `1px solid ${T.borderLight}`,
  verticalAlign: "middle",
}

// ─── Badge maps ──────────────────────────────────────────────────────────────

function dtypeStyle(dtype: ColumnSummary["dtype"]) {
  const map: Record<ColumnSummary["dtype"], { background: string; color: string }> = {
    numeric:  { background: "#dbeafe", color: "#1e40af" },
    datetime: { background: "#dcfce7", color: "#166534" },
    string:   { background: "#f1f5f9", color: "#475569" },
  }
  return map[dtype]
}

function flagStyle(flag: string) {
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
