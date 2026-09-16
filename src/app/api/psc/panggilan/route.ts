import { NextResponse } from 'next/server'
import type { PscCallItem } from '@/types/psc'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PSC_API_BASE_URL = process.env.PSC_API_BASE_URL || 'https://psc.kemkes.go.id/web_api/v1'
const PSC_API_TOKEN = process.env.PSC_API_TOKEN || ''

// Cache in-memory sederhana untuk respons panggilan (30 detik)
const cacheMap = new Map<string, { timestamp: number; data: any }>()
const CACHE_TTL_MS = 30000

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      kode_psc = '',
      kd_prop = '',
      kd_kab = '',
      status_penanganan = '',
      ticket_id = '',
      tahun = '2026',
      page = '1',
      per_page = '50',
    } = body

    const cacheKey = JSON.stringify({ kode_psc, kd_prop, kd_kab, status_penanganan, ticket_id, tahun, page, per_page })
    const cached = cacheMap.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data)
    }

    const formData = new FormData()
    if (kode_psc) formData.append('kode_psc', kode_psc)
    if (kd_prop) formData.append('kd_prop', kd_prop)
    if (kd_kab) formData.append('kd_kab', kd_kab)
    if (status_penanganan) formData.append('status_penanganan', status_penanganan)
    if (ticket_id) formData.append('ticket_id', ticket_id)
    if (tahun) formData.append('tahun', tahun)
    if (page) formData.append('page', String(page))
    if (per_page) formData.append('per_page', String(per_page))

    const headers: Record<string, string> = {}
    if (PSC_API_TOKEN) {
      headers['TTOKEN'] = PSC_API_TOKEN
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)

    const response = await fetch(`${PSC_API_BASE_URL}/data-pelaporan-panggilan`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (response.ok) {
      const result = await response.json()
      cacheMap.set(cacheKey, { timestamp: Date.now(), data: result })
      return NextResponse.json(result)
    }

    console.warn('[PSC API /data-pelaporan-panggilan] Upstream error:', response.status)
    return NextResponse.json({
      status: false,
      message: `Upstream error: ${response.status}`,
      total_data: 0,
      data: [],
    }, { status: response.status })

  } catch (error: any) {
    console.error('[PSC API /panggilan] Error fetching data:', error)
    return NextResponse.json({
      status: false,
      message: error?.message || 'Gagal menghubungi server PSC 119',
      total_data: 0,
      data: [],
    }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const body = {
    kode_psc: searchParams.get('kode_psc') || '',
    kd_prop: searchParams.get('kd_prop') || '',
    kd_kab: searchParams.get('kd_kab') || '',
    status_penanganan: searchParams.get('status_penanganan') || '',
    ticket_id: searchParams.get('ticket_id') || '',
    tahun: searchParams.get('tahun') || '2026',
    page: searchParams.get('page') || '1',
    per_page: searchParams.get('per_page') || '50',
  }
  return POST(new Request(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }))
}
