"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useReportStore } from "../../store/report-store"
import { testDbConnection, previewDbTable } from "../../lib/api"
import type { DatabaseConnection, TablePreview } from "../../lib/types"

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

const DEFAULT_PORTS: Record<string, number> = {
  postgresql: 5432,
  mysql: 3306,
  sqlite: 0,
}

export default function ConnectPage() {
  const router = useRouter()
  const setPendingDbQuery = useReportStore((s) => s.setPendingDbQuery)

  const [conn, setConn] = useState<DatabaseConnection>({
    db_type: "postgresql",
    host: "localhost",
    port: DEFAULT_PORTS.postgresql,
    database: "",
    username: "",
    password: "",
  })

  const [step, setStep] = useState<"form" | "tables">("form")
  const [tables, setTables] = useState<string[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [preview, setPreview] = useState<TablePreview | null>(null)
  const [customSql, setCustomSql] = useState(false)
  const [sqlQuery, setSqlQuery] = useState("")
  const [sourceLabel, setSourceLabel] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connectBtn = useBtn()
  const analyzeBtn = useBtn()

  function setField<K extends keyof DatabaseConnection>(key: K, value: DatabaseConnection[K]) {
    setConn((prev) => ({ ...prev, [key]: value }))
  }

  function handleDbTypeChange(dbType: "postgresql" | "mysql" | "sqlite") {
    setConn((prev) => ({
      ...prev,
      db_type: dbType,
      port: DEFAULT_PORTS[dbType] || null,
      host: dbType === "sqlite" ? "" : prev.host,
    }))
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await testDbConnection(conn)
      if (!result.ok) {
        setError(result.error ?? "Connection failed.")
        return
      }
      setTables(result.tables)
      setStep("tables")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectTable(table: string) {
    setSelectedTable(table)
    setPreview(null)
    setError(null)
    try {
      const p = await previewDbTable(conn, table)
      setPreview(p)
    } catch {
      // preview is optional, don't block
    }
  }

  function handleAnalyze() {
    const query = customSql
      ? sqlQuery.trim()
      : `SELECT * FROM ${selectedTable}`

    if (!query) return

    const label = sourceLabel.trim() || selectedTable || "database_query"
    setPendingDbQuery({ connection: conn, query, source_label: label })
    router.push("/context")
  }

  const canAnalyze = customSql ? sqlQuery.trim().length > 0 : selectedTable !== null

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    fontSize: 13,
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    outline: "none",
    background: "#fff",
    color: "#111827",
    boxSizing: "border-box",
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "#9ca3af",
    marginBottom: 6,
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
      <div style={{ width: "100%", maxWidth: 440, marginBottom: 24 }}>
        <button
          onClick={() => step === "tables" ? setStep("form") : router.push("/upload")}
          style={{ background: "none", border: "none", padding: 0, fontSize: 13, color: "#9ca3af", cursor: "pointer" }}
        >
          {step === "tables" ? "← Change connection" : "← Back"}
        </button>
      </div>

      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "32px 28px",
        width: "100%",
        maxWidth: 440,
      }}>

        {/* Step 1: Connection form */}
        {step === "form" && (
          <>
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px", color: "#111827" }}>
                Connect to a database
              </h2>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                PostgreSQL, MySQL, or SQLite
              </p>
            </div>

            <form onSubmit={handleConnect} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* DB type */}
              <div>
                <span style={labelStyle}>Database type</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["postgresql", "mysql", "sqlite"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleDbTypeChange(t)}
                      style={{
                        flex: 1,
                        padding: "7px 0",
                        fontSize: 12,
                        fontWeight: 500,
                        border: "1px solid",
                        borderColor: conn.db_type === t ? "#111827" : "#e5e7eb",
                        borderRadius: 6,
                        background: conn.db_type === t ? "#111827" : "#fff",
                        color: conn.db_type === t ? "#fff" : "#6b7280",
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {t === "postgresql" ? "Postgres" : t === "mysql" ? "MySQL" : "SQLite"}
                    </button>
                  ))}
                </div>
              </div>

              {/* SQLite: just a file path */}
              {conn.db_type === "sqlite" ? (
                <div>
                  <label style={labelStyle}>Database file path</label>
                  <input
                    style={fieldStyle}
                    placeholder="/path/to/database.db"
                    value={conn.database}
                    onChange={(e) => setField("database", e.target.value)}
                    required
                  />
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Host</label>
                      <input
                        style={fieldStyle}
                        placeholder="localhost"
                        value={conn.host}
                        onChange={(e) => setField("host", e.target.value)}
                        required
                      />
                    </div>
                    <div style={{ width: 80 }}>
                      <label style={labelStyle}>Port</label>
                      <input
                        style={fieldStyle}
                        type="number"
                        value={conn.port ?? ""}
                        onChange={(e) => setField("port", e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Database name</label>
                    <input
                      style={fieldStyle}
                      placeholder="mydb"
                      value={conn.database}
                      onChange={(e) => setField("database", e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Username</label>
                      <input
                        style={fieldStyle}
                        placeholder="postgres"
                        value={conn.username}
                        onChange={(e) => setField("username", e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Password</label>
                      <input
                        style={fieldStyle}
                        type="password"
                        placeholder="••••••••"
                        value={conn.password}
                        onChange={(e) => setField("password", e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading || !conn.database}
                {...(loading || !conn.database ? {} : connectBtn)}
                style={{
                  padding: "10px 0",
                  background: loading || !conn.database ? "#f3f4f6" : "#111827",
                  color: loading || !conn.database ? "#9ca3af" : "#ffffff",
                  border: "none",
                  borderRadius: 7,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading || !conn.database ? "not-allowed" : "pointer",
                  letterSpacing: "-0.01em",
                  ...(!loading && conn.database ? connectBtn.style : {}),
                }}
              >
                {loading ? "Connecting..." : "Test connection →"}
              </button>
            </form>
          </>
        )}

        {/* Step 2: Table picker */}
        {step === "tables" && (
          <>
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px", color: "#111827" }}>
                Select data to analyze
              </h2>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                {conn.db_type === "sqlite" ? conn.database : `${conn.database} on ${conn.host}`}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Toggle */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setCustomSql(false)}
                  style={{
                    flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 500,
                    border: "1px solid", borderColor: !customSql ? "#111827" : "#e5e7eb",
                    borderRadius: 6, background: !customSql ? "#111827" : "#fff",
                    color: !customSql ? "#fff" : "#6b7280", cursor: "pointer",
                  }}
                >
                  Pick a table
                </button>
                <button
                  type="button"
                  onClick={() => setCustomSql(true)}
                  style={{
                    flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 500,
                    border: "1px solid", borderColor: customSql ? "#111827" : "#e5e7eb",
                    borderRadius: 6, background: customSql ? "#111827" : "#fff",
                    color: customSql ? "#fff" : "#6b7280", cursor: "pointer",
                  }}
                >
                  Custom SQL
                </button>
              </div>

              {/* Table list */}
              {!customSql && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                  {tables.length === 0 && (
                    <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>No tables found.</p>
                  )}
                  {tables.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleSelectTable(t)}
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        textAlign: "left",
                        border: "1px solid",
                        borderColor: selectedTable === t ? "#111827" : "#e5e7eb",
                        borderRadius: 6,
                        background: selectedTable === t ? "#f9fafb" : "#fff",
                        color: "#111827",
                        cursor: "pointer",
                        fontWeight: selectedTable === t ? 600 : 400,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              {/* SQL textarea */}
              {customSql && (
                <div>
                  <label style={labelStyle}>SQL query</label>
                  <textarea
                    style={{ ...fieldStyle, fontFamily: "monospace", minHeight: 100, resize: "vertical" }}
                    placeholder="SELECT * FROM orders WHERE created_at > '2024-01-01'"
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                  />
                </div>
              )}

              {/* Preview */}
              {preview && !customSql && (
                <div style={{ fontSize: 12, color: "#6b7280", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ marginBottom: 6, fontWeight: 600, color: "#374151" }}>
                    {preview.row_count_estimate.toLocaleString()} rows · {preview.columns.length} columns
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
                      <thead>
                        <tr>
                          {preview.columns.slice(0, 6).map((col) => (
                            <th key={col} style={{ padding: "2px 8px", textAlign: "left", color: "#9ca3af", fontWeight: 600, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{col}</th>
                          ))}
                          {preview.columns.length > 6 && <th style={{ padding: "2px 8px", color: "#9ca3af" }}>+{preview.columns.length - 6} more</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sample_rows.slice(0, 3).map((row, i) => (
                          <tr key={i}>
                            {preview.columns.slice(0, 6).map((col) => (
                              <td key={col} style={{ padding: "2px 8px", color: "#374151", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {String(row[col] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Optional label */}
              <div>
                <label style={labelStyle}>Dataset label <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                <input
                  style={fieldStyle}
                  placeholder={selectedTable || "e.g. sales_q1"}
                  value={sourceLabel}
                  onChange={(e) => setSourceLabel(e.target.value)}
                />
              </div>

              <button
                type="button"
                disabled={!canAnalyze}
                onClick={handleAnalyze}
                {...(canAnalyze ? analyzeBtn : {})}
                style={{
                  padding: "10px 0",
                  background: canAnalyze ? "#111827" : "#f3f4f6",
                  color: canAnalyze ? "#ffffff" : "#9ca3af",
                  border: "none",
                  borderRadius: 7,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: canAnalyze ? "pointer" : "not-allowed",
                  letterSpacing: "-0.01em",
                  ...(canAnalyze ? analyzeBtn.style : {}),
                }}
              >
                Continue →
              </button>
            </div>
          </>
        )}

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
