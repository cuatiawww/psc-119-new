import { NextRequest, NextResponse } from 'next/server'

const BACKEND_BASE_URL = (
  process.env.SIPKK_BACKEND_BASE_URL ||
  'http://localhost/sipkk-baru'
).replace(/\/+$/, '')

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const targetUrl = `${BACKEND_BASE_URL}/index.php?r=api/infografis-list`

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const payload = await res.json().catch(() => null)
    if (payload !== null) {
      return NextResponse.json(payload, { status: 200 })
    }

    return NextResponse.json({ success: false, data: [] }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ success: false, data: [] }, { status: 200 })
  }
}
