import type {
  BatchAnalysisResponse,
  DatabaseConnection,
  DatabaseConnectionResult,
  DatabaseQuery,
  TablePreview,
} from "./types"

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

async function _dbPost<T>(action: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/db/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.detail ?? `Request failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function testDbConnection(
  conn: DatabaseConnection,
): Promise<DatabaseConnectionResult> {
  return _dbPost("test-connection", conn)
}

export function previewDbTable(
  conn: DatabaseConnection,
  table: string,
): Promise<TablePreview> {
  return _dbPost(`preview?table=${encodeURIComponent(table)}`, conn)
}

export function analyzeDb(
  query: DatabaseQuery,
  context?: { goals?: string; background?: string },
): Promise<BatchAnalysisResponse> {
  const params = new URLSearchParams()
  if (context?.goals) params.set("goals", context.goals)
  if (context?.background) params.set("background", context.background)
  const qs = params.toString()
  return _dbPost(qs ? `analyze?${qs}` : "analyze", query)
}
