import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PSC_API_BASE_URL = process.env.PSC_API_BASE_URL || 'https://psc.kemkes.go.id/web_api/v1'
const PSC_API_TOKEN = process.env.PSC_API_TOKEN || ''

// In-memory cache untuk data-psc (5 menit)
const centersCacheMap = new Map<string, { timestamp: number; data: any }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const kode_psc = searchParams.get('kode_psc')?.trim() || ''

    const cacheKey = kode_psc || '__ALL__'
    const cached = centersCacheMap.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data)
    }

    const headers: Record<string, string> = {}
    if (PSC_API_TOKEN) {
      headers['TTOKEN'] = PSC_API_TOKEN
    }

    const formData = new FormData()
    if (kode_psc) {
      formData.append('kode_psc', kode_psc)
    }
    formData.append('page', '1')
    formData.append('per_page', '100')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)

    const response = await fetch(`${PSC_API_BASE_URL}/data-psc`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    })

    if (response.ok) {
      const result = await response.json()

      // Master PSC biasanya berisi ratusan unit dan endpoint memakai pagination.
      // Untuk daftar filter nasional, gabungkan seluruh halaman agar search tidak
      // berhenti pada 100 unit pertama.
      if (!kode_psc && Array.isArray(result?.data)) {
        const totalData = Number(result.total_data ?? result.total ?? result.data.length)
        const totalPages = Number(result.total_page ?? result.total_pages ?? Math.ceil(totalData / 100)) || 1
        const allCenters = [...result.data]
        const pageNumbers = Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 2)

        for (let index = 0; index < pageNumbers.length; index += 5) {
          const batch = pageNumbers.slice(index, index + 5)
          const pageResults = await Promise.all(batch.map(async (page) => {
            const pageForm = new FormData()
            pageForm.append('page', String(page))
            pageForm.append('per_page', '100')
            const pageResponse = await fetch(`${PSC_API_BASE_URL}/data-psc`, {
              method: 'POST',
              headers,
              body: pageForm,
              signal: controller.signal,
            })
            if (!pageResponse.ok) return []
            const pagePayload = await pageResponse.json().catch(() => ({}))
            return Array.isArray(pagePayload?.data) ? pagePayload.data : []
          }))
          pageResults.forEach((items) => allCenters.push(...items))
        }

        result.data = allCenters
        result.total_data = totalData || allCenters.length
      }

      clearTimeout(timeoutId)
      centersCacheMap.set(cacheKey, { timestamp: Date.now(), data: result })
      return NextResponse.json(result)
    }

    clearTimeout(timeoutId)

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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const kode_psc = body.kode_psc || ''
    const url = new URL(req.url)
    if (kode_psc) url.searchParams.set('kode_psc', kode_psc)
    return GET(new Request(url.toString(), { method: 'GET' }))
  } catch {
    return GET(req)
  }
}
