import type { BatchAnalysisResponse } from "./types"

export async function analyzeFiles(
  files: File[],
  context?: { goals?: string; background?: string },
): Promise<BatchAnalysisResponse> {
  const form = new FormData()
  files.forEach((f) => form.append("files", f))
  if (context?.goals)      form.append("goals", context.goals)
  if (context?.background) form.append("background", context.background)

  const res = await fetch("/api/analyze", {
    method: "POST",
    body: form,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? `Request failed with status ${res.status}`)
  }

  return res.json() as Promise<BatchAnalysisResponse>
}
