"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

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

const STEPS = [
  {
    num: "01",
    title: "Upload your data",
    desc: "Drop in any CSV or Excel file. Multiple files are supported — each is profiled independently.",
  },
  {
    num: "02",
    title: "Add context (optional)",
    desc: "Tell MiniMemo what you're trying to find out. This shapes the analysis and recommendation tone.",
  },
  {
    num: "03",
    title: "Get your report",
    desc: "A structured report is generated: key metrics, distributions, trends, correlations, and ranked recommendations.",
  },
]

const FEATURES = [
  { label: "Column profiling", desc: "Types, nulls, cardinality, and distributions — automatic." },
  { label: "Outlier detection", desc: "IQR-based flagging across all numeric columns." },
  { label: "Correlation analysis", desc: "Strongest linear relationships ranked and surfaced." },
  { label: "Group breakdowns", desc: "Dimension × measure splits — who performs best, where." },
  { label: "Time trends", desc: "Dates detected automatically; series plotted if found." },
  { label: "Recommendations", desc: "Actionable next steps ranked by estimated impact." },
]

export default function LandingPage() {
  const router = useRouter()
  const btn = useBtn()

  return (
    <div style={{
      minHeight: "100vh",
      background: "#ffffff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "96px 24px 120px",
    }}>

      {/* Hero */}
      <div style={{ textAlign: "center", maxWidth: 560, marginBottom: 72 }}>
        <h1 style={{
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          margin: "0 0 20px",
          color: "#111827",
        }}>
          MiniMemo
        </h1>
        <p style={{
          fontSize: 18,
          color: "#6b7280",
          lineHeight: 1.6,
          margin: "0 0 36px",
          fontWeight: 400,
        }}>
          Upload a dataset. Get a clean, structured analytics report — instantly.
          No dashboards, no configuration, no SQL.
        </p>
        <button
          onClick={() => router.push("/upload")}
          onMouseEnter={btn.onMouseEnter}
          onMouseLeave={btn.onMouseLeave}
          onMouseDown={btn.onMouseDown}
          onMouseUp={btn.onMouseUp}
          style={{
            padding: "13px 36px",
            background: "#111827",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "-0.01em",
            ...btn.style,
          }}
        >
          Get Started →
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: "100%", maxWidth: 720, height: 1, background: "#e5e7eb", marginBottom: 72 }} />

      {/* How it works */}
      <div style={{ width: "100%", maxWidth: 720, marginBottom: 80 }}>
        <span style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#9ca3af",
          marginBottom: 32,
        }}>
          How it works
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {STEPS.map((step, i) => (
            <div key={step.num} style={{
              display: "grid",
              gridTemplateColumns: "56px 1fr",
              gap: "0 24px",
              padding: "24px 0",
              borderTop: "1px solid #f3f4f6",
              borderBottom: i === STEPS.length - 1 ? "1px solid #f3f4f6" : "none",
            }}>
              <span style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#d1d5db",
                letterSpacing: "0.04em",
                paddingTop: 2,
              }}>
                {step.num}
              </span>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em" }}>
                  {step.title}
                </p>
                <p style={{ margin: 0, fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What gets analyzed */}
      <div style={{ width: "100%", maxWidth: 720 }}>
        <span style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#9ca3af",
          marginBottom: 28,
        }}>
          What gets analyzed
        </span>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1px",
          background: "#f3f4f6",
          border: "1px solid #f3f4f6",
          borderRadius: 10,
          overflow: "hidden",
        }}>
          {FEATURES.map((f) => (
            <div key={f.label} style={{
              background: "#ffffff",
              padding: "20px 22px",
            }}>
              <p style={{ margin: "0 0 5px", fontSize: 13, fontWeight: 700, color: "#111827" }}>
                {f.label}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
