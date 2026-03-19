"use client"

import dynamic from "next/dynamic"
import type { PlotParams } from "react-plotly.js"
import type { ChartSpec, InsightBlock } from "../../../lib/types"
import { T } from "./ReportLayout"

const Plot = dynamic<PlotParams>(() => import("react-plotly.js"), { ssr: false })

export function InsightChart({ chart }: { chart: ChartSpec }) {
  if (!chart.x || chart.x.length < 2) {
    return (
      <p style={{ margin: "8px 0", fontSize: 12, color: T.textFaint, fontStyle: "italic" }}>
        Insufficient data to render chart.
      </p>
    )
  }
  const isLine = chart.type === "line"
  return (
    <div style={{ marginBottom: 4 }}>
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
            tickangle: -30, tickfont: { size: 11, color: T.textMuted },
            gridcolor: T.borderLight, linecolor: T.divider,
          },
          yaxis: {
            title: { text: chart.y_label, font: { size: 11, color: T.textFaint } },
            tickfont: { size: 11, color: T.textMuted },
            gridcolor: T.borderLight, linecolor: T.divider,
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

export function InsightDeepDiveBlock({ insight, isFirst }: { insight: InsightBlock; isFirst: boolean }) {
  return (
    <div style={{
      padding: "32px 0",
      borderTop: isFirst ? "none" : `1px solid ${T.borderLight}`,
    }}>
      <h3 style={{
        margin: "0 0 10px",
        fontSize: 17,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        color: T.textPrimary,
        lineHeight: 1.3,
      }}>
        {insight.title}
      </h3>
      {insight.summary && (
        <p style={{ margin: "0 0 16px", fontSize: 15, color: T.textSecondary, lineHeight: 1.9, maxWidth: 640 }}>
          {insight.summary}
        </p>
      )}
      {insight.chart && <InsightChart chart={insight.chart} />}
      {insight.bullets.length > 0 && (
        <ul style={{ margin: insight.chart ? "20px 0 0" : 0, padding: 0, listStyle: "none" }}>
          {insight.bullets.map((b, i) => (
            <li key={i} style={{
              display: "grid", gridTemplateColumns: "20px 1fr", gap: 12,
              padding: "8px 0", borderTop: `1px solid ${T.borderLight}`,
              fontSize: 15, lineHeight: 1.9, color: T.textSecondary, alignItems: "start",
            }}>
              <span style={{ color: T.textFaint, flexShrink: 0, paddingTop: 1 }}>—</span>
              {b}
            </li>
          ))}
        </ul>
      )}
      {insight.caveat && (
        <p style={{ margin: "14px 0 0", fontSize: 12, color: T.textFaint, fontStyle: "italic" }}>
          {insight.caveat}
        </p>
      )}
    </div>
  )
}
