"use client"

import { useState } from "react"
import type { ColumnSummary, InsightBlock } from "../../../lib/types"
import { T, Section, useBtn } from "./ReportLayout"
import { InsightChart } from "./InsightDeepDive"

export function DashboardSection({
  dataset,
  insights,
  dashboardRef,
}: {
  dataset: { filename: string; row_count: number; col_count: number; columns: ColumnSummary[] }
  insights: InsightBlock[]
  dashboardRef: React.RefObject<HTMLDivElement>
}) {
  const saveBtn = useBtn()
  const [saving, setSaving] = useState(false)

  const avgNullPct = dataset.columns.length > 0
    ? (dataset.columns.reduce((s, c) => s + c.null_pct, 0) / dataset.columns.length * 100).toFixed(1)
    : "0.0"

  const chartsToShow = insights.filter((b) => b.chart !== null).slice(0, 3)

  async function handleSave() {
    if (!dashboardRef.current) return
    setSaving(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(dashboardRef.current, { backgroundColor: "#ffffff", scale: 2 })
      const a = document.createElement("a")
      a.download = `${dataset.filename.replace(/\.[^.]+$/, "")}-dashboard.png`
      a.href = canvas.toDataURL()
      a.click()
    } finally {
      setSaving(false)
    }
  }

  const kpis: [string, string][] = [
    ["Total Rows",    dataset.row_count.toLocaleString()],
    ["Columns",       String(dataset.col_count)],
    ["Avg Null Rate", `${avgNullPct}%`],
    ["Insights",      String(insights.length)],
  ]

  return (
    <Section label="Dashboard">
      <div ref={dashboardRef} style={{ background: T.pageBg, padding: "4px 0 20px" }}>
        {/* KPI cards */}
        <div className="mm-kpi-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: chartsToShow.length > 0 ? 28 : 0 }}>
          {kpis.map(([label, value]) => (
            <div key={label} style={{
              border: `1px solid ${T.divider}`,
              borderRadius: 10,
              padding: "20px 24px",
              background: T.pageBg,
            }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: T.textPrimary, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 8 }}>
                {value}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: T.textFaint }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Chart panels */}
        {chartsToShow.length > 0 && (
          <div className="mm-dashboard-grid" style={{
            display: "grid",
            gridTemplateColumns: chartsToShow.length === 1 ? "1fr" : "1fr 1fr",
            gap: 16,
          }}>
            {chartsToShow.map((insight) => (
              <div key={insight.title} style={{
                border: `1px solid ${T.divider}`,
                borderRadius: 10,
                padding: "20px 20px 16px",
                background: T.pageBg,
              }}>
                <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.textPrimary, letterSpacing: "-0.01em" }}>
                  {insight.title}
                </p>
                <InsightChart chart={insight.chart!} />
                {insight.summary && (
                  <p style={{ margin: "14px 0 10px", fontSize: 13, color: T.textSecondary, lineHeight: 1.7 }}>
                    {insight.summary}
                  </p>
                )}
                {insight.bullets.length > 0 && (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {insight.bullets.slice(0, 3).map((b, i) => (
                      <li key={i} style={{
                        display: "grid", gridTemplateColumns: "16px 1fr", gap: 8,
                        padding: "5px 0", borderTop: `1px solid ${T.borderLight}`,
                        fontSize: 12, lineHeight: 1.6, color: T.textMuted, alignItems: "start",
                      }}>
                        <span style={{ color: T.textFaint, paddingTop: 1 }}>—</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        className="no-print"
        onClick={handleSave}
        disabled={saving}
        onMouseEnter={!saving ? saveBtn.onMouseEnter : undefined}
        onMouseLeave={!saving ? saveBtn.onMouseLeave : undefined}
        onMouseDown={!saving ? saveBtn.onMouseDown : undefined}
        onMouseUp={!saving ? saveBtn.onMouseUp : undefined}
        style={{
          marginTop: 20,
          padding: "9px 20px",
          background: saving ? T.borderLight : T.textPrimary,
          color: saving ? T.textMuted : "#ffffff",
          border: "none",
          borderRadius: 7,
          fontSize: 13,
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
          letterSpacing: "-0.01em",
          ...(!saving ? saveBtn.style : {}),
        }}
      >
        {saving ? "Saving…" : "Save as Image"}
      </button>
    </Section>
  )
}
