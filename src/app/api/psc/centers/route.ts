import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PSC_API_BASE_URL = process.env.PSC_API_BASE_URL || 'https://psc.kemkes.go.id/web_api/v1'
const PSC_API_TOKEN = process.env.PSC_API_TOKEN || ''

// In-memory cache untuk data-psc (5 menit)
let pscCentersCache: { timestamp: number; data: any } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

export async function GET() {
  try {
    if (pscCentersCache && Date.now() - pscCentersCache.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(pscCentersCache.data)
    }

    const headers: Record<string, string> = {}
    if (PSC_API_TOKEN) {
      headers['TTOKEN'] = PSC_API_TOKEN
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)

    const response = await fetch(`${PSC_API_BASE_URL}/data-psc`, {
      method: 'POST',
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (response.ok) {
      const result = await response.json()
      pscCentersCache = { timestamp: Date.now(), data: result }
      return NextResponse.json(result)
    }

    return NextResponse.json({
      status: false,
      message: `Upstream error: ${response.status}`,
      total_data: 0,
      data: [],
    }, { status: response.status })

  } catch (error: any) {
    console.error('[PSC API /centers] Error:', error)
    return NextResponse.json({
      status: false,
      message: error?.message || 'Gagal mengambil data PSC centers',
      total_data: 0,
      data: [],
    }, { status: 500 })
  }
}

export async function POST() {
  return GET()
}
