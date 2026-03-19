"use client"

import { useState } from "react"
import type { JoinInsight, JoinSuggestion } from "../../../lib/types"
import { T } from "./ReportLayout"

export function JoinStats({ insight, nameA, nameB }: { insight: JoinInsight; nameA: string; nameB: string }) {
  const rows: [string, string, string][] = [
    ["Matched", insight.matched_rows.toLocaleString(), `${(insight.match_pct * 100).toFixed(1)}% of smaller dataset`],
    ["Only in " + nameA, insight.left_only_rows.toLocaleString(), "no match in " + nameB],
    ["Only in " + nameB, insight.right_only_rows.toLocaleString(), "no match in " + nameA],
  ]
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {rows.map(([label, value, note]) => (
        <div key={label} style={{ display: "grid", gridTemplateColumns: "160px 80px 1fr", fontSize: 12, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ color: T.textFaint }}>{label}</span>
          <span style={{ color: T.textSecondary, fontWeight: 500 }}>{value}</span>
          <span style={{ color: T.textFaint }}>{note}</span>
        </div>
      ))}
    </div>
  )
}

export function JoinConfirmScreen({
  suggestions,
  onConfirm,
}: {
  suggestions: JoinSuggestion[]
  onConfirm: (confirmed: JoinSuggestion[]) => void
}) {
  const [included, setIncluded] = useState<Set<number>>(new Set())

  function toggle(i: number) {
    setIncluded((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#ffffff",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "80px 24px",
    }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 8px", color: "#111827" }}>
          Possible relationships detected
        </h2>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 36px" }}>
          These columns appear in multiple files and may be joinable. Select any to include as noted relationships in the report.
        </p>
        <div style={{ borderTop: "1px solid #e5e7eb", marginBottom: 32 }}>
          {suggestions.map((s, i) => {
            const on = included.has(i)
            return (
              <div key={i} onClick={() => toggle(i)} style={{
                display: "flex", alignItems: "flex-start", gap: 16,
                padding: "18px 0", borderBottom: "1px solid #f3f4f6", cursor: "pointer",
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: `2px solid ${on ? "#111827" : "#d1d5db"}`,
                  background: on ? "#111827" : "transparent",
                  flexShrink: 0, marginTop: 2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {on && <span style={{ color: "#fff", fontSize: 11, lineHeight: 1 }}>✓</span>}
                </div>
                <div>
                  <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: "#111827" }}>
                    {s.dataset_a} · <span style={{ fontFamily: "monospace" }}>{s.column_a}</span>
                    {" → "}{s.dataset_b} · <span style={{ fontFamily: "monospace" }}>{s.column_b}</span>
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>{s.reason}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>Confidence: {Math.round(s.confidence * 100)}%</p>
                </div>
              </div>
            )
          })}
        </div>
        <button
          onClick={() => onConfirm(suggestions.filter((_, i) => included.has(i)))}
          style={{
            padding: "10px 28px", background: "#111827", color: "#ffffff",
            border: "none", borderRadius: 7, fontSize: 14, fontWeight: 600,
            cursor: "pointer", letterSpacing: "-0.01em",
          }}
        >
          Continue to Report →
        </button>
      </div>
    </div>
  )
}
