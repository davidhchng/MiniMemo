"use client"

import { useRef, useState } from "react"

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
import { useReportStore } from "../../store/report-store"

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const setPendingFiles = useReportStore((s) => s.setPendingFiles)
  const inputRef = useRef<HTMLInputElement>(null)
  const submitBtn = useBtn()

  const VALID_EXTS = [".csv", ".xlsx", ".tsv", ".tab", ".json", ".jsonl", ".ndjson", ".parquet"]

  function addFiles(incoming: File[]) {
    const valid = incoming.filter((f) => VALID_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)))
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      return [...prev, ...valid.filter((f) => !existing.has(f.name))]
    })
    setError(null)
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) return
    setPendingFiles(files)
    router.push("/context")
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
          style={{ background: "none", border: "none", padding: 0, fontSize: 13, color: "#9ca3af", cursor: "pointer" }}
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
          <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px", color: "#111827" }}>
            Upload datasets
          </h2>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
            CSV, XLSX, JSON, JSONL, Parquet, TSV · up to 200,000 rows · multiple files supported
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Drop zone */}
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
              Files
            </span>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                addFiles(Array.from(e.dataTransfer.files))
              }}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `1.5px dashed ${isDragging ? "#6b7280" : files.length > 0 ? "#86efac" : "#d1d5db"}`,
                borderRadius: 7,
                padding: "20px 16px",
                cursor: "pointer",
                background: isDragging ? "#f9fafb" : files.length > 0 ? "#f0fdf4" : "#fafafa",
                textAlign: "center",
                transition: "border-color 0.1s, background 0.1s",
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                Drop files here{" "}
                <span style={{ color: "#374151", fontWeight: 500 }}>or browse</span>
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>CSV, XLSX, JSON, JSONL, Parquet, TSV</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.tsv,.tab,.json,.jsonl,.ndjson,.parquet"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []))
                e.target.value = ""
              }}
            />
          </div>

          {/* Selected file list */}
          {files.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
              {files.map((f) => (
                <li key={f.name} style={{ fontSize: 13, color: "#16a34a", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>✓</span>
                  <span style={{ flex: 1 }}>{f.name} · {(f.size / 1024).toFixed(1)} KB</span>
                  <button
                    type="button"
                    onClick={() => removeFile(f.name)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "0 2px",
                      fontSize: 14,
                      color: "#9ca3af",
                      cursor: "pointer",
                      lineHeight: 1,
                    }}
                    aria-label={`Remove ${f.name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="submit"
            disabled={files.length === 0}
            onMouseEnter={files.length > 0 ? submitBtn.onMouseEnter : undefined}
            onMouseLeave={files.length > 0 ? submitBtn.onMouseLeave : undefined}
            onMouseDown={files.length > 0 ? submitBtn.onMouseDown : undefined}
            onMouseUp={files.length > 0 ? submitBtn.onMouseUp : undefined}
            style={{
              padding: "10px 0",
              background: files.length === 0 ? "#f3f4f6" : "#111827",
              color: files.length === 0 ? "#9ca3af" : "#ffffff",
              border: "none",
              borderRadius: 7,
              fontSize: 14,
              fontWeight: 600,
              cursor: files.length === 0 ? "not-allowed" : "pointer",
              letterSpacing: "-0.01em",
              ...(files.length > 0 ? submitBtn.style : {}),
            }}
          >
            Continue →
          </button>

          <div style={{ textAlign: "center", marginTop: 4 }}>
            <button
              type="button"
              onClick={() => router.push("/connect")}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 12,
                color: "#9ca3af",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Or connect to a database
            </button>
          </div>
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
