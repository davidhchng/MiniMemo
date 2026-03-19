import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8001"

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const res = await fetch(`${BACKEND_URL}/analyze`, {
    method: "POST",
    body: formData,
  })

  const text = await res.text()
  try {
    const data = JSON.parse(text)
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ detail: text || `Backend error ${res.status}` }, { status: res.status })
  }
}
