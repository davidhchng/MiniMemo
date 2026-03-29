import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8001"

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } },
) {
  const action = params.action
  const body = await req.text()

  // For preview, table name comes as a query param from the client
  const url = new URL(req.url)
  const backendUrl = new URL(`${BACKEND_URL}/db/${action}`)
  url.searchParams.forEach((v, k) => backendUrl.searchParams.set(k, v))

  const res = await fetch(backendUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(40_000),
  })

  const text = await res.text()
  try {
    const data = JSON.parse(text)
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json(
      { detail: text || `Backend error ${res.status}` },
      { status: res.status },
    )
  }
}
