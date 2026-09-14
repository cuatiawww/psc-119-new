import { NextRequest, NextResponse } from 'next/server'

const BACKEND_BASE_URL = (
  process.env.SIPKK_BACKEND_BASE_URL ||
  'http://localhost/sipkk-baru'
).replace(/\/+$/, '')

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const targetUrl = `${BACKEND_BASE_URL}/index.php?r=api/generate-infografis`

  try {
    let res: Response
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const body = await request.formData()
      res = await fetch(targetUrl, {
        method: 'POST',
        body,
        cache: 'no-store',
      })
    } else {
      const jsonBody = await request.json().catch(() => ({}))
      const params = new URLSearchParams()
      if (jsonBody.title) params.append('title', jsonBody.title)
      if (jsonBody.category) params.append('category', jsonBody.category)
      if (jsonBody.prompt) params.append('prompt', jsonBody.prompt)

      res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        cache: 'no-store',
      })
    }

    const payload = await res.json().catch(() => null)
    if (payload !== null) {
      return NextResponse.json(payload, { status: 200 })
    }

    return NextResponse.json({ success: false, message: 'Respon server tidak valid' }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Terjadi kesalahan sistem' }, { status: 200 })
  }
}
