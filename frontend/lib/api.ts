import type { AnalysisResponse } from "./types"

const API_URL = "http://localhost:8001"

export async function analyzeFile(file: File): Promise<AnalysisResponse> {
  const form = new FormData()
  form.append("file", file)

  const res = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    body: form,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? `Request failed with status ${res.status}`)
  }

  return res.json() as Promise<AnalysisResponse>
}
