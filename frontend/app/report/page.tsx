"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import type { PlotParams } from "react-plotly.js"
import { useReportStore } from "../../store/report-store"
import type { ChartSpec, ColumnSummary, InsightBlock, JoinInsight, JoinSuggestion, RecommendationItem, ReportSection } from "../../lib/types"

const Plot = dynamic<PlotParams>(() => import("react-plotly.js"), { ssr: false })

// ─── Design tokens ──────────────────────────────────────────────────────────
const T = {
  pageBg:        "#ffffff",
  divider:       "#e5e7eb",
  borderLight:   "#f3f4f6",
  textPrimary:   "#111827",
  textSecondary: "#374151",
  textMuted:     "#6b7280",
  textFaint:     "#9ca3af",
  tableZebra:    "#fafafa",
  violet:        "#7c3aed",
  violetLight:   "#f5f3ff",
}

// ─── Button hook ─────────────────────────────────────────────────────────────

function useBtn() {
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const report = useReportStore((s) => s.report)
  const clear  = useReportStore((s) => s.clear)
  const router = useRouter()

  const [activeIndex, setActiveIndex] = useState(0)
  const [pendingJoins, setPendingJoins] = useState(true)
  const [confirmedJoins, setConfirmedJoins] = useState<JoinSuggestion[]>([])
  const newAnalysisBtn = useBtn()
  const downloadBtn    = useBtn()
  const dashboardRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!report) router.replace("/")
  }, [report, router])

  useEffect(() => {
    if (report && report.suggested_joins.length === 0) setPendingJoins(false)
  }, [report])

  if (!report) return null

  if (pendingJoins && report.suggested_joins.length > 0) {
    return (
      <JoinConfirmScreen
        suggestions={report.suggested_joins}
        onConfirm={(confirmed) => { setConfirmedJoins(confirmed); setPendingJoins(false) }}
      />
    )
  }

  const current = report.results[activeIndex]
  const {
    dataset, insights, report_sections,
    recommendation_items, assumptions, limitations, conclusion,
  } = current

  const keyInsights   = insights.find((b) => b.title === "Key Insights") ?? null
  const otherInsights = insights.filter((b) => b.title !== "Key Insights")
  const multiFile     = report.results.length > 1
  const projectBg     = report_sections.find((s: ReportSection) => s.title === "Project Background") ?? null

  return (
    <div style={{ minHeight: "100vh", background: T.pageBg }}>

      <style>{`
        @media print {
          .mm-nav { display: none !important; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .mm-section { page-break-inside: avoid; break-inside: avoid; }
          .mm-main { padding: 32px 24px 60px !important; max-width: 100% !important; }
          table { page-break-inside: avoid; break-inside: avoid; }
          h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
          .js-plotly-plot { page-break-inside: avoid; break-inside: avoid; }
        }
        @media (max-width: 640px) {
          .mm-main { padding: 40px 20px 80px !important; }
          .mm-nav-inner { padding: 0 20px !important; }
          .mm-dashboard-grid { grid-template-columns: 1fr !important; }
          .mm-kpi-grid { grid-template-columns: 1fr 1fr !important; }
          .mm-table-wrap { font-size: 12px !important; }
          .mm-nav-actions { gap: 12px !important; }
          .mm-nav-actions .nav-edit { display: none; }
        }
      `}</style>

      {/* Nav */}
      <nav className="mm-nav" style={{
        background: T.pageBg,
        borderBottom: `1px solid ${T.divider}`,
        height: 56,
        padding: "0 48px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div className="mm-nav-inner" style={{ maxWidth: 860, margin: "0 auto", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0" }}>
          <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em", color: T.textPrimary }}>MiniMemo</span>
          <div className="mm-nav-actions" style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button
              onClick={() => window.print()}
              onMouseEnter={downloadBtn.onMouseEnter}
              onMouseLeave={downloadBtn.onMouseLeave}
              onMouseDown={downloadBtn.onMouseDown}
              onMouseUp={downloadBtn.onMouseUp}
              className="no-print"
              style={{ background: "none", border: "none", padding: "5px 0", fontSize: 13, color: T.textMuted, cursor: "pointer", ...downloadBtn.style }}
            >
              Download PDF
            </button>
            <button
              onClick={() => router.push("/context")}
              className="no-print"
              style={{ background: "none", border: "none", padding: "5px 0", fontSize: 13, color: T.textMuted, cursor: "pointer" }}
            >
              Edit goals
            </button>
            <button
              onClick={() => { clear(); router.push("/") }}
              onMouseEnter={newAnalysisBtn.onMouseEnter}
              onMouseLeave={newAnalysisBtn.onMouseLeave}
              onMouseDown={newAnalysisBtn.onMouseDown}
              onMouseUp={newAnalysisBtn.onMouseUp}
              style={{ background: "none", border: "none", padding: "5px 0", fontSize: 13, color: T.textMuted, cursor: "pointer", ...newAnalysisBtn.style }}
            >
              ← New analysis
            </button>
          </div>
        </div>
      </nav>

      <main className="mm-main" style={{ maxWidth: 860, margin: "0 auto", padding: "64px 32px 120px" }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 64 }}>
          <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 16px", color: T.textPrimary }}>
            Full Report
          </h1>
          <div style={{ height: 1, background: T.divider, marginBottom: 14 }} />
          <p style={{ fontSize: 13, color: T.textMuted, margin: "0 0 24px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
            <span style={{ color: T.textSecondary, fontWeight: 500 }}>{dataset.filename}</span>
            <Sep />{dataset.row_count.toLocaleString()} rows
            <Sep />{dataset.col_count} columns
            <Sep />{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.9, color: T.textMuted, maxWidth: 680 }}>
            <ReportIntro dataset={dataset} insights={otherInsights} hasBackground={!!projectBg} />
          </p>
        </div>

        {/* ── Dataset tabs ── */}
        {multiFile && (
          <div style={{ marginBottom: 48 }}>
            <SectionLabel>Datasets</SectionLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {report.results.map((r, i) => (
                <TabBtn key={i} active={i === activeIndex} onClick={() => setActiveIndex(i)}>
                  {r.dataset.filename}
                </TabBtn>
              ))}
            </div>
          </div>
        )}

        {/* ── Relationships ── */}
        {confirmedJoins.length > 0 && (
          <Section label="Relationships">
            {confirmedJoins.map((j, i) => (
              <div key={i} style={{ marginBottom: i < confirmedJoins.length - 1 ? 48 : 0 }}>
                <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                  {j.dataset_a} · {j.column_a} → {j.dataset_b} · {j.column_b}
                </p>
                <p style={{ margin: "0 0 16px", fontSize: 13, color: T.textMuted }}>{j.reason}</p>
                <JoinStats insight={j.join_insight} nameA={j.dataset_a} nameB={j.dataset_b} />
                {j.join_insight.cross_insights.length > 0 && (
                  <div style={{ marginTop: 28 }}>
                    {j.join_insight.cross_insights.map((insight, idx) => (
                      <InsightDeepDiveBlock key={insight.title} insight={insight} isFirst={idx === 0} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* ── 1. Project Background ── */}
        {projectBg && (
          <Section label="Project Background">
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.9, color: T.textSecondary, maxWidth: 660 }}>
              {projectBg.content}
            </p>
          </Section>
        )}

        {/* ── 2. Executive Summary ── */}
        {keyInsights && keyInsights.bullets.length > 0 && (
          <Section label="Executive Summary">
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {keyInsights.bullets.map((b, i) => (
                <li key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "20px 1fr",
                  gap: 14,
                  padding: "12px 0",
                  borderBottom: `1px solid ${T.borderLight}`,
                  fontSize: 15,
                  lineHeight: 1.9,
                  color: T.textSecondary,
                  alignItems: "start",
                }}>
                  <span style={{ color: T.violet, fontSize: 7, paddingTop: 7 }}>●</span>
                  {b}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── 3. Data Structure ── */}
        <Section label="Data Structure">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Column", "Type", "Flags", "Nulls", "Unique", "Mean", "Min", "Max"].map((h) => (
                    <th key={h} style={{
                      textAlign: "left", padding: "0 20px 12px 0",
                      fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                      textTransform: "uppercase", color: T.textFaint,
                      borderBottom: `1px solid ${T.divider}`, whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataset.columns.map((col: ColumnSummary, i) => (
                  <tr key={col.name} style={{ background: i % 2 === 1 ? T.tableZebra : T.pageBg }}>
                    <td style={td}><span style={{ fontWeight: 500, color: T.textPrimary }}>{col.name}</span></td>
                    <td style={td}><Badge {...dtypeStyle(col.dtype)}>{col.dtype}</Badge></td>
                    <td style={td}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {col.flags.length > 0
                          ? col.flags.map((f) => <Badge key={f} {...flagStyle(f)}>{f.replace(/_/g, "\u00a0")}</Badge>)
                          : <Dash />}
                      </div>
                    </td>
                    <td style={{ ...td, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>{(col.null_pct * 100).toFixed(1)}%</td>
                    <td style={{ ...td, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>{col.unique_count.toLocaleString()}</td>
                    <td style={{ ...td, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>{col.numeric_stats?.mean ?? <Dash />}</td>
                    <td style={{ ...td, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>{col.numeric_stats?.min ?? <Dash />}</td>
                    <td style={{ ...td, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>{col.numeric_stats?.max ?? <Dash />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 4. Insights Deep-Dive ── */}
        {otherInsights.length > 0 && (
          <Section label="Insights Deep-Dive">
            {otherInsights.map((insight: InsightBlock, idx) => (
              <InsightDeepDiveBlock key={insight.title} insight={insight} isFirst={idx === 0} />
            ))}
          </Section>
        )}

        {/* ── 5. Recommendations ── */}
        {recommendation_items.length > 0 && (
          <Section label="Recommendations">
            <p style={{ margin: "0 0 28px", fontSize: 14, lineHeight: 1.8, color: T.textMuted, maxWidth: 660 }}>
              The following recommendations are grounded in the patterns identified above.
              {" "}Each recommendation is paired with the observation that motivates it.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {recommendation_items.map((rec: RecommendationItem, i) => (
                <RecommendationBlock key={i} rec={rec} index={i} total={recommendation_items.length} />
              ))}
            </div>
          </Section>
        )}

        {/* ── 6. Assumptions ── */}
        {assumptions.length > 0 && (
          <Section label="Assumptions">
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {assumptions.map((a, i) => (
                <BulletRow key={i} text={a} isLast={i === assumptions.length - 1} />
              ))}
            </ul>
          </Section>
        )}

        {/* ── 7. Limitations ── */}
        {limitations.length > 0 && (
          <Section label="Limitations">
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {limitations.map((l, i) => (
                <BulletRow key={i} text={l} isLast={i === limitations.length - 1} />
              ))}
            </ul>
          </Section>
        )}

        {/* ── 8. Conclusion ── */}
        {(conclusion || (keyInsights && keyInsights.bullets.length > 0)) && (
          <Section label="Conclusion">
            <div style={{ background: T.violetLight, borderRadius: 10, padding: "28px 32px" }}>
              {conclusion && (
                <p style={{
                  margin: keyInsights && keyInsights.bullets.length > 0 ? "0 0 24px" : 0,
                  fontSize: 16,
                  lineHeight: 2.0,
                  color: T.textSecondary,
                  maxWidth: 660,
                }}>
                  {conclusion}
                </p>
              )}
              {keyInsights && keyInsights.bullets.length > 0 && (
                <>
                  <p style={{
                    margin: "0 0 10px",
                    fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                    textTransform: "uppercase", color: T.textFaint,
                    borderTop: conclusion ? `1px solid ${T.divider}` : "none",
                    paddingTop: conclusion ? 20 : 0,
                  }}>
                    Key Findings
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {keyInsights.bullets.map((b, i) => (
                      <li key={i} style={{
                        display: "grid", gridTemplateColumns: "20px 1fr", gap: 12,
                        padding: "8px 0", borderTop: `1px solid ${T.divider}`,
                        fontSize: 15, lineHeight: 1.9, color: T.textSecondary, alignItems: "start",
                      }}>
                        <span style={{ color: T.violet, fontSize: 7, paddingTop: 7 }}>●</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Section>
        )}

        {/* ── 9. Dashboard ── */}
        <DashboardSection
          dataset={dataset}
          insights={otherInsights}
          dashboardRef={dashboardRef}
        />

      </main>
    </div>
  )
}

// ─── Dashboard Section ────────────────────────────────────────────────────────

function DashboardSection({
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

// ─── Insight Deep-Dive Block ──────────────────────────────────────────────────

function InsightDeepDiveBlock({ insight, isFirst }: { insight: InsightBlock; isFirst: boolean }) {
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

// ─── Recommendation Block ────────────────────────────────────────────────────

function RecommendationBlock({
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

// ─── Bullet Row ──────────────────────────────────────────────────────────────

function BulletRow({ text, isLast }: { text: string; isLast: boolean }) {
  return (
    <li style={{
      display: "grid", gridTemplateColumns: "20px 1fr", gap: 12,
      padding: "10px 0", borderTop: `1px solid ${T.borderLight}`,
      borderBottom: isLast ? `1px solid ${T.borderLight}` : "none",
      fontSize: 15, lineHeight: 1.9, color: T.textSecondary, alignItems: "start",
    }}>
      <span style={{ color: T.textFaint, paddingTop: 1 }}>—</span>
      <span>{text}</span>
    </li>
  )
}

// ─── Join confirmation screen ─────────────────────────────────────────────────

function JoinConfirmScreen({
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

// ─── Layout components ───────────────────────────────────────────────────────

function JoinStats({ insight, nameA, nameB }: { insight: JoinInsight; nameA: string; nameB: string }) {
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textMuted }}>
      {children}
    </span>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mm-section" style={{ marginBottom: 64 }}>
      <div style={{ borderTop: `1px solid ${T.divider}`, paddingTop: 20, marginBottom: 28 }}>
        <SectionLabel>{label}</SectionLabel>
      </div>
      {children}
    </div>
  )
}

function Badge({ children, background, color }: { children: React.ReactNode; background: string; color: string }) {
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

function InsightChart({ chart }: { chart: ChartSpec }) {
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

// ─── Micro-components ────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function ReportIntro({
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
