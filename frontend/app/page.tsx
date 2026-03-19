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
    desc: "Drop in any CSV or Excel file. Multiple files are supported, and each is profiled independently.",
  },
  {
    num: "02",
    title: "Add context (optional)",
    desc: "Tell MiniMemo what you're trying to find out. This shapes the analysis and recommendation tone.",
  },
  {
    num: "03",
    title: "Get your report",
    desc: "A structured report covering key metrics, distributions, trends, correlations, and ranked recommendations.",
  },
]

const FEATURES = [
  { label: "Column profiling", desc: "Types, nulls, cardinality, and distributions, computed automatically." },
  { label: "Outlier detection", desc: "IQR-based flagging across all numeric columns." },
  { label: "Correlation analysis", desc: "Strongest linear relationships ranked and surfaced." },
  { label: "Group breakdowns", desc: "Dimension by measure splits showing who performs best and where." },
  { label: "Time trends", desc: "Dates detected automatically; series plotted if found." },
  { label: "Recommendations", desc: "Actionable next steps ranked by estimated impact." },
]

function BackgroundShapes() {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {/* ── Angular bar chart — top left ── */}
      {[
        { x: 32,  h: 44 },
        { x: 54,  h: 88 },
        { x: 76,  h: 56 },
        { x: 98,  h: 112 },
        { x: 120, h: 70 },
        { x: 142, h: 36 },
      ].map(({ x, h }) => (
        <rect key={x} x={x} y={180 - h} width="16" height={h} rx="0" fill="#22c55e" opacity="0.22" />
      ))}
      <line x1="24" y1="181" x2="166" y2="181" stroke="#22c55e" strokeWidth="1.5" opacity="0.3" />
      <line x1="24" y1="100" x2="24" y2="182" stroke="#22c55e" strokeWidth="1.5" opacity="0.3" />

      {/* ── Jagged trend line — top right ── */}
      <polyline
        points="calc(100% - 340px),60 calc(100% - 280px),28 calc(100% - 220px),72 calc(100% - 160px),18 calc(100% - 100px),50 calc(100% - 40px),10"
        fill="none"
        stroke="#22c55e"
        strokeWidth="2.5"
        strokeLinejoin="miter"
        opacity="0.35"
      />
      {/* sharp tick marks on x-axis */}
      {[340, 280, 220, 160, 100, 40].map((offset) => (
        <line key={offset}
          x1={`calc(100% - ${offset}px)`} y1="82"
          x2={`calc(100% - ${offset}px)`} y2="92"
          stroke="#22c55e" strokeWidth="1.5" opacity="0.3"
        />
      ))}
      <line x1="calc(100% - 350px)" y1="92" x2="calc(100% - 28px)" y2="92" stroke="#22c55e" strokeWidth="1.5" opacity="0.25" />

      {/* ── Abstract grid / heatmap — bottom right ── */}
      {[0,1,2,3].map(row =>
        [0,1,2,3,4].map(col => {
          const opacity = ((row * 5 + col) % 7) * 0.04 + 0.06
          return (
            <rect
              key={`hm-${row}-${col}`}
              x={`calc(100% - ${col * 28 + 80}px)`}
              y={`calc(100% - ${row * 28 + 120}px)`}
              width="22" height="22" rx="0"
              fill="#22c55e"
              opacity={opacity}
            />
          )
        })
      )}

      {/* ── Diagonal slash marks — left side middle ── */}
      {[0,1,2,3].map(i => (
        <line key={i}
          x1={20 + i * 18} y1="48%"
          x2={36 + i * 18} y2="calc(48% + 48px)"
          stroke="#22c55e" strokeWidth="2" opacity="0.2"
        />
      ))}

      {/* ── Sharp triangle — bottom left ── */}
      <polygon
        points="30,calc(100% - 30px) 30,calc(100% - 130px) 100,calc(100% - 30px)"
        fill="none"
        stroke="#22c55e"
        strokeWidth="1.5"
        opacity="0.25"
      />
      <polygon
        points="55,calc(100% - 30px) 55,calc(100% - 85px) 100,calc(100% - 30px)"
        fill="#22c55e"
        opacity="0.08"
      />

      {/* ── Cross / plus markers scattered ── */}
      {[
        { cx: "calc(100% - 20px)", cy: "38%"  },
        { cx: "8%",                cy: "32%"  },
        { cx: "calc(100% - 48px)", cy: "62%"  },
      ].map(({ cx, cy }, i) => (
        <g key={i}>
          <line x1={cx} y1={`calc(${cy} - 8px)`} x2={cx} y2={`calc(${cy} + 8px)`} stroke="#111827" strokeWidth="1.5" opacity="0.12" />
          <line x1={`calc(${cx} - 8px)`} y1={cy} x2={`calc(${cx} + 8px)`} y2={cy} stroke="#111827" strokeWidth="1.5" opacity="0.12" />
        </g>
      ))}
    </svg>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const btn = useBtn()

  return (
    <div style={{
      position: "relative",
      minHeight: "100vh",
      background: "#ffffff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "96px 24px 120px",
      overflow: "hidden",
    }}>

      <BackgroundShapes />

      {/* Hero */}
      <div style={{ position: "relative", textAlign: "center", maxWidth: 560, marginBottom: 72 }}>

        {/* Logo mark */}
        <svg width="28" height="20" viewBox="0 0 28 20" fill="none" aria-hidden="true" style={{ marginBottom: 16 }}>
          <rect x="0"  y="12" width="6" height="8"  rx="1.5" fill="#111827" opacity="0.15" />
          <rect x="11" y="6"  width="6" height="14" rx="1.5" fill="#111827" opacity="0.3" />
          <rect x="22" y="0"  width="6" height="20" rx="1.5" fill="#111827" opacity="0.75" />
        </svg>

        <h1 style={{
          fontSize: 48,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          margin: "0 0 20px",
          color: "#111827",
        }}>
          MiniMemo Data Analytics
        </h1>
        <p style={{
          fontSize: 18,
          color: "#6b7280",
          lineHeight: 1.6,
          margin: "0 0 36px",
          fontWeight: 400,
        }}>
          Feed your data, feed your context, and receive a tailored and driven analysis.
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
      <div style={{ position: "relative", width: "100%", maxWidth: 720, height: 1, background: "#e5e7eb", marginBottom: 72 }} />

      {/* How it works */}
      <div style={{ position: "relative", width: "100%", maxWidth: 720, marginBottom: 80 }}>
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
      <div style={{ position: "relative", width: "100%", maxWidth: 720 }}>
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
