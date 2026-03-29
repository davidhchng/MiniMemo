"use client"

import { useEffect, useRef, useState } from "react"

const LOAD_STEPS = [
  "Reading dataset…",
  "Profiling columns…",
  "Running statistical analysis…",
  "Generating insights…",
  "Writing recommendations…",
  "Finishing up…",
]
const STEP_DELAYS = [800, 2500, 5000, 8500, 13000]

function useBtn() {
  const [hov, setHov] = useState(false)
  const [pressed, setPressed] = useState(false)
  return {
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => { setHov(false); setPressed(false) },
    onMouseDown:  () => setPressed(true),
    onMouseUp:    () => setPressed(false),
    style: {
      transition: "transform 0.12s ease, opacity 0.12s ease",
      transform: pressed ? "scale(0.96)" : hov ? "scale(1.02)" : "scale(1)",
      opacity: hov ? 0.88 : 1,
    } as React.CSSProperties,
  }
}
import { useRouter } from "next/navigation"
import { analyzeFiles, analyzeDb } from "../../lib/api"
import { useReportStore } from "../../store/report-store"

export default function ContextPage() {
  const router = useRouter()
  const pendingFiles   = useReportStore((s) => s.pendingFiles)
  const pendingDbQuery = useReportStore((s) => s.pendingDbQuery)
  const setReport      = useReportStore((s) => s.setReport)
  const clear          = useReportStore((s) => s.clear)

  const [goals, setGoals]           = useState("")
  const [background, setBackground] = useState("")
  const [loading, setLoading]       = useState(false)
  const [loadStep, setLoadStep]     = useState(0)
  const [error, setError]           = useState<string | null>(null)
  const submitBtn  = useBtn()
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (!loading) {
      setLoadStep(0)
      return
    }
    stepTimers.current = STEP_DELAYS.map((delay, i) =>
      setTimeout(() => setLoadStep(i + 1), delay),
    )
    return () => stepTimers.current.forEach(clearTimeout)
  }, [loading])

  const hasSource = (pendingFiles && pendingFiles.length > 0) || pendingDbQuery !== null

  useEffect(() => {
    if (!hasSource) {
      router.replace("/upload")
    }
  }, [hasSource, router])

  if (!hasSource) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      let result
      if (pendingDbQuery) {
        result = await analyzeDb(pendingDbQuery, {
          goals: goals.trim() || undefined,
          background: background.trim() || undefined,
        })
      } else if (pendingFiles) {
        result = await analyzeFiles(pendingFiles, {
          goals: goals.trim() || undefined,
          background: background.trim() || undefined,
        })
      } else {
        throw new Error("No data source selected.")
      }
      setReport(result)
      router.push("/report")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#ffffff",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "48px 24px",
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 32px" }}>
            Generating report
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {LOAD_STEPS.map((label, i) => {
              const done    = i < loadStep
              const active  = i === loadStep
              const pending = i > loadStep
              return (
                <div key={label} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 0",
                  borderTop: "1px solid #f3f4f6",
                  borderBottom: i === LOAD_STEPS.length - 1 ? "1px solid #f3f4f6" : "none",
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: done ? "#111827" : active ? "#f3f4f6" : "transparent",
                    border: done ? "none" : active ? "2px solid #111827" : "2px solid #e5e7eb",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}>
                    {done && <span style={{ color: "#fff", fontSize: 11, lineHeight: 1 }}>✓</span>}
                    {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#111827", display: "block" }} />}
                  </div>
                  <span style={{
                    fontSize: 14, lineHeight: 1,
                    color: done ? "#111827" : active ? "#111827" : "#d1d5db",
                    fontWeight: active ? 600 : done ? 500 : 400,
                    transition: "color 0.2s ease",
                  }}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#ffffff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px 80px",
    }}>

      {/* Back link */}
      <div style={{ width: "100%", maxWidth: 520, marginBottom: 24 }}>
        <button
          onClick={() => router.push(pendingDbQuery ? "/connect" : "/upload")}
          style={{ background: "none", border: "none", padding: 0, fontSize: 13, color: "#9ca3af", cursor: "pointer" }}
        >
          ← Back
        </button>
      </div>

      {/* Card */}
      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "32px 28px",
        width: "100%",
        maxWidth: 520,
      }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px", color: "#111827" }}>
            Tell us about your goal
          </h2>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
            This helps the analysis focus on what matters to you. Both fields are optional.
          </p>
        </div>

        {/* Source summary */}
        <div style={{
          background: "#f9fafb",
          border: "1px solid #f3f4f6",
          borderRadius: 7,
          padding: "12px 14px",
          marginBottom: 22,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}>
          {pendingDbQuery ? (
            <>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>
                Database
              </span>
              <span style={{ fontSize: 13, color: "#16a34a" }}>
                ✓ {pendingDbQuery.source_label || pendingDbQuery.connection.database}
              </span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>
                {pendingDbQuery.connection.db_type} · {pendingDbQuery.query.length > 60 ? pendingDbQuery.query.slice(0, 57) + "..." : pendingDbQuery.query}
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>
                Files
              </span>
              {(pendingFiles ?? []).map((f) => (
                <span key={f.name} style={{ fontSize: 13, color: "#16a34a" }}>
                  ✓ {f.name}
                </span>
              ))}
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Goals */}
          <div>
            <label style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "#9ca3af",
              marginBottom: 8,
            }}>
              What are you trying to find out?
            </label>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="e.g. Which regions are underperforming? Where should we cut costs?"
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                fontSize: 13,
                lineHeight: 1.6,
                color: "#111827",
                border: "1px solid #e5e7eb",
                borderRadius: 7,
                background: "#fafafa",
                resize: "vertical",
                fontFamily: "inherit",
                outline: "none",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#111827"; e.target.style.background = "#fff" }}
              onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#fafafa" }}
            />
          </div>

          {/* Background */}
          <div>
            <label style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "#9ca3af",
              marginBottom: 8,
            }}>
              About this data <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="e.g. Q3 2024 sales data from our CRM, covering North America only."
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                fontSize: 13,
                lineHeight: 1.6,
                color: "#111827",
                border: "1px solid #e5e7eb",
                borderRadius: 7,
                background: "#fafafa",
                resize: "vertical",
                fontFamily: "inherit",
                outline: "none",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#111827"; e.target.style.background = "#fff" }}
              onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#fafafa" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            onMouseEnter={!loading ? submitBtn.onMouseEnter : undefined}
            onMouseLeave={!loading ? submitBtn.onMouseLeave : undefined}
            onMouseDown={!loading ? submitBtn.onMouseDown : undefined}
            onMouseUp={!loading ? submitBtn.onMouseUp : undefined}
            style={{
              padding: "10px 0",
              background: loading ? "#f3f4f6" : "#111827",
              color: loading ? "#9ca3af" : "#ffffff",
              border: "none",
              borderRadius: 7,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "-0.01em",
              marginTop: 4,
              ...(!loading ? submitBtn.style : {}),
            }}
          >
            Run Analysis
          </button>
        </form>

        {error && (
          <p style={{
            marginTop: 16,
            color: "#dc2626",
            fontSize: 13,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            padding: "8px 12px",
            margin: "16px 0 0",
          }}>
            {error}
          </p>
        )}
      </div>

    </div>
  )
}
