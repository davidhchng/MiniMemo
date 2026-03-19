"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useReportStore } from "../../store/report-store"
import type { ColumnSummary, JoinSuggestion, RecommendationItem, ReportSection } from "../../lib/types"
import { T, useBtn, Section, SectionLabel, BulletRow, TabBtn, Badge, Sep, Dash, ReportIntro, td, dtypeStyle, flagStyle } from "./components/ReportLayout"
import { InsightDeepDiveBlock } from "./components/InsightDeepDive"
import { DashboardSection } from "./components/DashboardSection"
import { RecommendationBlock } from "./components/RecommendationSection"
import { JoinConfirmScreen, JoinStats } from "./components/JoinConfirm"

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
            {otherInsights.map((insight, idx) => (
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
