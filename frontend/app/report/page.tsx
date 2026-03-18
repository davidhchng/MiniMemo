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
  pageBg:        "#ffffff",
  cardBg:        "#ffffff",
  divider:       "#e5e7eb",
  borderLight:   "#f3f4f6",
  textPrimary:   "#111827",
  textSecondary: "#374151",
  textMuted:     "#6b7280",
  textFaint:     "#9ca3af",
  tableZebra:    "#fafafa",
  // kept for dtype/flag badges only
  violet:        "#7c3aed",
  violetLight:   "#f5f3ff",
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
        background: T.pageBg,
        borderBottom: `1px solid ${T.divider}`,
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 48px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.01em", color: T.textPrimary }}>
          MiniMemo
        </span>
        <button
          onClick={() => { clear(); router.push("/") }}
          style={{
            background: "none",
            border: "none",
            padding: "5px 0",
            fontSize: 13,
            color: T.textMuted,
            cursor: "pointer",
            fontWeight: 400,
          }}
        >
          ← New analysis
        </button>
      </nav>

      {/* Body */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "64px 48px 120px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 72 }}>
          <h1 style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            margin: "0 0 20px",
            color: T.textPrimary,
          }}>
            Analytics Report
          </h1>
          <div style={{
            height: 1,
            background: T.divider,
            marginBottom: 16,
          }} />
          <p style={{
            fontSize: 13,
            color: T.textFaint,
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 0,
          }}>
            <span style={{ color: T.textMuted, fontWeight: 500 }}>{dataset.filename}</span>
            <Sep />
            {dataset.row_count.toLocaleString()} rows
            <Sep />
            {dataset.col_count} columns
          </p>
        </div>

        {/* Key Insights — editorial numbered list */}
        {keyInsights && (
          <Section label="Key Insights">
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {keyInsights.bullets.map((b, i) => (
                <li
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "36px 1fr",
                    gap: 16,
                    padding: "18px 0",
                    borderBottom: `1px solid ${T.borderLight}`,
                    alignItems: "start",
                  }}
                >
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.textFaint,
                    letterSpacing: "0.06em",
                    paddingTop: 4,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 15, lineHeight: 1.75, color: T.textSecondary }}>
                    {b}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Data Structure — bare table, no card */}
        <Section label="Data Structure">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Column", "Type", "Flags", "Nulls", "Unique", "Mean", "Min", "Max"].map((h) => (
                    <th key={h} style={{
                      textAlign: "left",
                      padding: "0 20px 12px 0",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color: T.textFaint,
                      borderBottom: `1px solid ${T.divider}`,
                      whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataset.columns.map((col: ColumnSummary, i) => (
                  <tr key={col.name} style={{ background: i % 2 === 1 ? T.tableZebra : T.pageBg }}>
                    <td style={td}>
                      <span style={{ fontWeight: 500, color: T.textPrimary, fontSize: 13 }}>
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
                          : <Dash />
                        }
                      </div>
                    </td>
                    <td style={{ ...td, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
                      {(col.null_pct * 100).toFixed(1)}%
                    </td>
                    <td style={{ ...td, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
                      {col.unique_count.toLocaleString()}
                    </td>
                    <td style={{ ...td, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
                      {col.numeric_stats?.mean ?? <Dash />}
                    </td>
                    <td style={{ ...td, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
                      {col.numeric_stats?.min ?? <Dash />}
                    </td>
                    <td style={{ ...td, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
                      {col.numeric_stats?.max ?? <Dash />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Report sections — no card, just text */}
        {report_sections.map((section: ReportSection) => (
          <Section key={section.title} label={section.title}>
            <p style={{
              margin: section.bullets.length > 0 ? "0 0 20px" : 0,
              fontSize: 15,
              lineHeight: 1.85,
              color: T.textMuted,
              maxWidth: 680,
            }}>
              {section.content}
            </p>
            {section.bullets.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                {section.bullets.map((b, i) => (
                  <li key={i} style={{
                    display: "flex",
                    gap: 16,
                    padding: "11px 0",
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: T.textSecondary,
                    borderTop: `1px solid ${T.borderLight}`,
                  }}>
                    <span style={{ color: T.textFaint, flexShrink: 0, lineHeight: 1.7 }}>—</span>
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ))}

        {/* Analysis blocks */}
        {otherInsights.length > 0 && (
          <Section label="Analysis">
            <div style={{ display: "flex", flexDirection: "column" }}>
              {otherInsights.map((insight: InsightBlock, idx) => (
                <div
                  key={insight.title}
                  style={{
                    padding: "28px 0",
                    borderTop: idx === 0 ? "none" : `1px solid ${T.borderLight}`,
                  }}
                >
                  <p style={{
                    margin: "0 0 6px",
                    fontSize: 17,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: T.textPrimary,
                  }}>
                    {insight.title}
                  </p>
                  <p style={{
                    margin: "0 0 16px",
                    fontSize: 13,
                    color: T.textFaint,
                    lineHeight: 1.6,
                  }}>
                    {insight.summary}
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                    {insight.bullets.map((b, i) => (
                      <li key={i} style={{
                        display: "flex",
                        gap: 14,
                        padding: "8px 0",
                        fontSize: 14,
                        lineHeight: 1.7,
                        color: T.textSecondary,
                        borderTop: `1px solid ${T.borderLight}`,
                      }}>
                        <span style={{ color: T.textFaint, flexShrink: 0 }}>—</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  {insight.chart && <InsightChart chart={insight.chart} />}
                  {insight.caveat && (
                    <p style={{ margin: "14px 0 0", fontSize: 12, color: T.textFaint, fontStyle: "italic" }}>
                      {insight.caveat}
                    </p>
                  )}
                </div>
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
    <div style={{ marginBottom: 64 }}>
      <div style={{
        borderTop: `1px solid ${T.divider}`,
        paddingTop: 20,
        marginBottom: 28,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: T.textFaint,
        }}>
          {label}
        </span>
      </div>
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
      borderRadius: 3,
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
    <div style={{ marginTop: 24 }}>
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 500, color: T.textFaint, letterSpacing: "0.02em" }}>
        {chart.title}
      </p>
      <Plot
        data={[{
          type: isLine ? "scatter" : "bar",
          mode: isLine ? "lines+markers" : undefined,
          x: chart.x,
          y: chart.y,
          marker: { color: "#374151", opacity: 0.75 },
          line: isLine ? { color: "#374151", width: 1.5 } : undefined,
        }]}
        layout={{
          xaxis: {
            title: { text: chart.x_label, font: { size: 11, color: T.textFaint } },
            tickangle: -30,
            tickfont: { size: 11, color: T.textMuted },
            gridcolor: T.borderLight,
            linecolor: T.divider,
          },
          yaxis: {
            title: { text: chart.y_label, font: { size: 11, color: T.textFaint } },
            tickfont: { size: 11, color: T.textMuted },
            gridcolor: T.borderLight,
            linecolor: T.divider,
          },
          margin: { t: 4, r: 12, b: 60, l: 54 },
          height: 220,
          paper_bgcolor: "transparent",
          plot_bgcolor: T.tableZebra,
          font: { family: "Inter, ui-sans-serif, system-ui, sans-serif", size: 12 },
          bargap: 0.45,
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
    </div>
  )
}

// ─── Micro-components ────────────────────────────────────────────────────────

function Sep() {
  return <span style={{ margin: "0 10px", color: T.borderLight }}>·</span>
}

function Dash() {
  return <span style={{ color: T.borderLight }}>—</span>
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const td: React.CSSProperties = {
  padding: "13px 20px 13px 0",
  borderBottom: `1px solid ${T.borderLight}`,
  verticalAlign: "middle",
}

// ─── Badge maps ──────────────────────────────────────────────────────────────

function dtypeStyle(dtype: ColumnSummary["dtype"]) {
  const map: Record<ColumnSummary["dtype"], { background: string; color: string }> = {
    numeric:  { background: "#e5e7eb", color: "#1f2937" },
    datetime: { background: "#f3f4f6", color: "#374151" },
    string:   { background: "#f9fafb", color: "#6b7280" },
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
