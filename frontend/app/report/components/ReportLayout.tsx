"use client"

import { useState } from "react"
import type { ColumnSummary, InsightBlock } from "../../../lib/types"

// ─── Design tokens ─────────────────────────────────────────────────────────

export const T = {
  pageBg:        "#ffffff",
  divider:       "#e5e7eb",
  borderLight:   "#f3f4f6",
  textPrimary:   "#111827",
  textSecondary: "#374151",
  textMuted:     "#6b7280",
  textFaint:     "#9ca3af",
  tableZebra:    "#fafafa",
  violet:        "#22c55e",
  violetLight:   "#f0fdf4",
}

// ─── Shared styles ──────────────────────────────────────────────────────────

export const td: React.CSSProperties = {
  padding: "13px 20px 13px 0",
  borderBottom: `1px solid ${T.borderLight}`,
  verticalAlign: "middle",
}

// ─── Button hook ────────────────────────────────────────────────────────────

export function useBtn() {
  const [hov, setHov] = useState(false)
  const [pressed, setPressed] = useState(false)
  return {
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => { setHov(false); setPressed(false) },
    onMouseDown:  () => setPressed(true),
    onMouseUp:    () => setPressed(false),
    style: {
      transition: "transform 0.12s ease, opacity 0.12s ease, background 0.15s ease",
      transform: pressed ? "scale(0.96)" : hov ? "scale(1.02)" : "scale(1)",
      opacity: hov ? 0.88 : 1,
    } as React.CSSProperties,
  }
}

// ─── Layout components ──────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textMuted }}>
      {children}
    </span>
  )
}

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mm-section" style={{ marginBottom: 64 }}>
      <div style={{ borderTop: `1px solid ${T.divider}`, paddingTop: 20, marginBottom: 28 }}>
        <SectionLabel>{label}</SectionLabel>
      </div>
      {children}
    </div>
  )
}

export function BulletRow({ text, isLast }: { text: string; isLast: boolean }) {
  return (
    <li style={{
      display: "grid", gridTemplateColumns: "20px 1fr", gap: 12,
      padding: "10px 0", borderTop: `1px solid ${T.borderLight}`,
      borderBottom: isLast ? `1px solid ${T.borderLight}` : "none",
      fontSize: 15, lineHeight: 1.9, color: T.textSecondary, alignItems: "start",
    }}>
      <span style={{ color: T.textFaint, paddingTop: 1 }}>·</span>
      <span>{text}</span>
    </li>
  )
}

export function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const btn = useBtn()
  return (
    <button
      onClick={onClick}
      onMouseEnter={btn.onMouseEnter}
      onMouseLeave={btn.onMouseLeave}
      onMouseDown={btn.onMouseDown}
      onMouseUp={btn.onMouseUp}
      style={{
        padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 13,
        fontWeight: active ? 600 : 400,
        background: active ? T.textPrimary : T.borderLight,
        color: active ? "#ffffff" : T.textMuted,
        letterSpacing: "-0.01em",
        ...btn.style,
      }}
    >
      {children}
    </button>
  )
}

export function Badge({ children, background, color }: { children: React.ReactNode; background: string; color: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 6px", borderRadius: 3,
      fontSize: 11, fontWeight: 500, letterSpacing: "0.01em",
      background, color, whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  )
}

export function Sep() {
  return <span style={{ margin: "0 10px", color: T.borderLight }}>·</span>
}

export function Dash() {
  return <span style={{ color: T.borderLight }}>·</span>
}

export function ReportIntro({
  dataset,
  insights,
  hasBackground,
}: {
  dataset: { filename: string; row_count: number; col_count: number }
  insights: InsightBlock[]
  hasBackground: boolean
}) {
  const insightTitles = insights.map((b) => b.title.toLowerCase())
  const hasCorrelation = insightTitles.some((t) => t.includes("relationship") || t.includes("correlation"))
  const hasTrend       = insightTitles.some((t) => t.includes("time") || t.includes("trend"))
  const hasOutlier     = insightTitles.some((t) => t.includes("outlier"))
  const hasDist        = insightTitles.some((t) => t.includes("distribution"))

  const coverage: string[] = []
  if (hasCorrelation) coverage.push("variable relationships")
  if (hasDist)        coverage.push("distribution patterns")
  if (hasOutlier)     coverage.push("outlier detection")
  if (hasTrend)       coverage.push("trends over time")
  if (coverage.length === 0) coverage.push("column structure and value distributions")

  const last  = coverage.pop()!
  const coverageStr = coverage.length > 0 ? `${coverage.join(", ")}, and ${last}` : last

  return (
    <>
      This report provides a structured analysis of{" "}
      <span style={{ color: T.textSecondary, fontWeight: 500 }}>{dataset.filename}</span>
      {", "}covering {dataset.row_count.toLocaleString()} records across {dataset.col_count} columns.
      {" "}It examines {coverageStr}
      {hasBackground ? ", informed by the context and goals provided." : "."}
      {" "}Key findings, recommendations, and assumptions are outlined in the sections below.
    </>
  )
}

// ─── Badge maps ─────────────────────────────────────────────────────────────

export function dtypeStyle(dtype: ColumnSummary["dtype"]) {
  const map: Record<ColumnSummary["dtype"], { background: string; color: string }> = {
    numeric:  { background: "#e5e7eb", color: "#1f2937" },
    datetime: { background: "#f3f4f6", color: "#374151" },
    string:   { background: "#f9fafb", color: "#6b7280" },
  }
  return map[dtype]
}

export function flagStyle(flag: string) {
  const map: Record<string, { background: string; color: string }> = {
    email:            { background: "#fce7f3", color: "#9d174d" },
    url_like:         { background: "#e0f2fe", color: "#0369a1" },
    phone_like:       { background: "#fef3c7", color: "#92400e" },
    id_like:          { background: "#dcfce7", color: "#16a34a" },
    low_cardinality:  { background: "#fef9c3", color: "#854d0e" },
    high_cardinality: { background: "#f1f5f9", color: "#475569" },
    likely_name:      { background: "#fdf2f8", color: "#86198f" },
    likely_location:  { background: "#ecfdf5", color: "#065f46" },
  }
  return map[flag] ?? { background: "#f1f5f9", color: "#475569" }
}
