"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { analyzeFile } from "../../lib/api"
import { useReportStore } from "../../store/report-store"

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
      background: "#ffffff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px 80px",
    }}>

      {/* Back link */}
      <div style={{ width: "100%", maxWidth: 400, marginBottom: 24 }}>
        <button
          onClick={() => router.push("/")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 13,
            color: "#9ca3af",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
      </div>

      {/* Form card */}
      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "32px 28px",
        width: "100%",
        maxWidth: 400,
      }}>
        <div style={{ marginBottom: 22 }}>
          <h2 style={{
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            margin: "0 0 6px",
            color: "#111827",
          }}>
            Upload dataset
          </h2>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
            CSV or XLSX · up to 200,000 rows
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "#9ca3af",
              marginBottom: 8,
            }}>
              File
            </span>
            <label style={{
              display: "block",
              border: `1.5px dashed ${file ? "#86efac" : "#d1d5db"}`,
              borderRadius: 7,
              padding: "14px 16px",
              cursor: "pointer",
              background: file ? "#f0fdf4" : "#fafafa",
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
              background: !file || loading ? "#f3f4f6" : "#111827",
              color: !file || loading ? "#9ca3af" : "#ffffff",
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

    </div>
  )
}
