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
      justifyContent: "center",
      padding: "96px 24px 80px",
    }}>

      {/* Wordmark */}
      <h1 style={{
        fontSize: 64,
        fontWeight: 800,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        margin: "0 0 32px",
        color: "#111827",
      }}>
        MiniMemo
      </h1>

      {/* Divider */}
      <div style={{ width: 480, maxWidth: "100%", height: 1, background: "#e5e7eb", marginBottom: 32 }} />

      {/* What it does */}
      <div style={{ marginBottom: 52, textAlign: "center" }}>
        <span style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#9ca3af",
          marginBottom: 20,
        }}>
          What it does
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            "Upload any CSV or XLSX file",
            "Automatic profiling — types, distributions, outliers",
            "Structured insights and chart breakdowns",
          ].map((line) => (
            <p key={line} style={{
              margin: 0,
              fontSize: 16,
              color: "#6b7280",
              lineHeight: 1.5,
            }}>
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => router.push("/upload")}
        onMouseEnter={btn.onMouseEnter}
        onMouseLeave={btn.onMouseLeave}
        onMouseDown={btn.onMouseDown}
        onMouseUp={btn.onMouseUp}
        style={{
          padding: "12px 32px",
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
  )
}
