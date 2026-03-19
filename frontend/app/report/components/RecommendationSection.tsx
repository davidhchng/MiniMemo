"use client"

import type { RecommendationItem } from "../../../lib/types"
import { T } from "./ReportLayout"

export function RecommendationBlock({
  rec, index, total,
}: {
  rec: RecommendationItem
  index: number
  total: number
}) {
  return (
    <div style={{
      padding: "24px 0",
      borderTop: `1px solid ${T.borderLight}`,
      borderBottom: index === total - 1 ? `1px solid ${T.borderLight}` : "none",
    }}>
      {/* Title row */}
      <div style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 14, alignItems: "start", marginBottom: 14 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: T.violet,
          letterSpacing: "0.04em", paddingTop: 3, fontVariantNumeric: "tabular-nums",
        }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.textPrimary, letterSpacing: "-0.01em", lineHeight: 1.3 }}>
          {rec.title}
        </h4>
      </div>
      {/* Observation + Action bullets */}
      <div style={{ paddingLeft: 46, display: "flex", flexDirection: "column", gap: 0 }}>
        {rec.observation && (
          <div style={{
            display: "grid", gridTemplateColumns: "20px 1fr", gap: 10,
            padding: "7px 0", borderTop: `1px solid ${T.borderLight}`,
            fontSize: 15, lineHeight: 1.9, color: T.textSecondary,
          }}>
            <span style={{ color: T.textFaint, paddingTop: 1 }}>—</span>
            <span>{rec.observation}</span>
          </div>
        )}
        {rec.action && (
          <div style={{
            display: "grid", gridTemplateColumns: "20px 1fr", gap: 10,
            padding: "7px 0", borderTop: `1px solid ${T.borderLight}`,
            fontSize: 15, lineHeight: 1.9, color: T.textSecondary,
          }}>
            <span style={{ color: T.violet, fontSize: 10, paddingTop: 5 }}>▸</span>
            <span>{rec.action}</span>
          </div>
        )}
      </div>
    </div>
  )
}
