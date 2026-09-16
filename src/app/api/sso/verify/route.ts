import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PSC_SSO_VERIFY_URL = (
  process.env.PSC_SSO_VERIFY_URL ||
  `${process.env.PSC_API_BASE_URL || 'https://psc.kemkes.go.id/web_api/v1'}/verify-sso-psc`
).replace(/\/+$/, '')
const PSC_API_TOKEN = process.env.PSC_API_TOKEN || ''
const PSC_SSO_CLIENT_SECRET = process.env.PSC_SSO_CLIENT_SECRET || ''

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token.trim() : ''

    if (!token) {
      return NextResponse.json({ success: false, message: 'Token SSO wajib diisi.' }, { status: 400 })
    }

    const formData = new URLSearchParams({ token })
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    }
    if (PSC_API_TOKEN) headers.TTOKEN = PSC_API_TOKEN
    if (PSC_SSO_CLIENT_SECRET) headers['X-PSC-SSO-SECRET'] = PSC_SSO_CLIENT_SECRET

    const response = await fetch(PSC_SSO_VERIFY_URL, {
      method: 'POST',
      headers,
      body: formData.toString(),
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok || !payload || payload.error !== 0 || !payload.user) {
      return NextResponse.json({
        success: false,
        message: payload?.error_message || 'Token SSO tidak valid atau sudah kedaluwarsa.',
      }, { status: response.status === 403 ? 403 : 401 })
    }

    return NextResponse.json({
      success: true,
      token: payload.token || token,
      user: payload.user,
    })
  } catch (error) {
    console.error('[SSO verify] Gagal menghubungi endpoint PSC:', error)
    return NextResponse.json({
      success: false,
      message: 'Endpoint SSO PSC tidak dapat dihubungi.',
    }, { status: 502 })
  }
}
