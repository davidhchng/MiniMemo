"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { analyzeFiles } from "../../lib/api"
import { useReportStore } from "../../store/report-store"

export default function ContextPage() {
  const router = useRouter()
  const pendingFiles = useReportStore((s) => s.pendingFiles)
  const setReport    = useReportStore((s) => s.setReport)
  const clear        = useReportStore((s) => s.clear)

  const [goals, setGoals]           = useState("")
  const [background, setBackground] = useState("")
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    if (!pendingFiles || pendingFiles.length === 0) {
      router.replace("/upload")
    }
  }, [pendingFiles, router])

  if (!pendingFiles || pendingFiles.length === 0) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingFiles) return
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeFiles(pendingFiles, {
        goals: goals.trim() || undefined,
        background: background.trim() || undefined,
      })
      setReport(result)
      router.push("/report")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
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
          onClick={() => router.push("/upload")}
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

        {/* Files summary */}
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
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>
            Files
          </span>
          {pendingFiles.map((f) => (
            <span key={f.name} style={{ fontSize: 13, color: "#059669" }}>
              ✓ {f.name}
            </span>
          ))}
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
            }}
          >
            {loading ? "Generating report…" : "Generate Report"}
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
