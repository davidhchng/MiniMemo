"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { analyzeFile } from "../lib/api"
import { useReportStore } from "../store/report-store"

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const setReport = useReportStore((s) => s.setReport)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeFile(file)
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
      background: "#f8f9fb",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: "40px 36px",
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 8px", color: "#0f172a" }}>
            MiniMemo
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
            Upload a CSV or XLSX file to generate a structured analytics brief.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>
              Dataset file
            </span>
            <label style={{
              display: "block",
              border: `1.5px dashed ${file ? "#86efac" : "#cbd5e1"}`,
              borderRadius: 8,
              padding: "14px 16px",
              cursor: "pointer",
              background: file ? "#f0fdf4" : "#fafbfc",
            }}>
              <input
                type="file"
                accept=".csv,.xlsx"
                style={{ display: "block", width: "100%", cursor: "pointer", fontSize: 13, color: "#374151" }}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setError(null)
                }}
              />
            </label>
          </div>

          {file && (
            <p style={{ fontSize: 13, color: "#059669", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <span>✓</span>
              <span>{file.name} — {(file.size / 1024).toFixed(1)} KB</span>
            </p>
          )}

          <button
            type="submit"
            disabled={!file || loading}
            style={{
              padding: "10px 0",
              background: !file || loading ? "#e2e8f0" : "#4f46e5",
              color: !file || loading ? "#94a3b8" : "#fff",
              border: "none",
              borderRadius: 7,
              fontSize: 14,
              fontWeight: 600,
              cursor: !file || loading ? "not-allowed" : "pointer",
              letterSpacing: "-0.01em",
            }}
          >
            {loading ? "Analyzing…" : "Generate Report"}
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

      <p style={{ marginTop: 24, fontSize: 12, color: "#94a3b8" }}>
        Supports CSV and XLSX · up to 200,000 rows
      </p>
    </div>
  )
}
