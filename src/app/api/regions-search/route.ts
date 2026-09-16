import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PSC_API_BASE_URL = process.env.PSC_API_BASE_URL || 'https://psc.kemkes.go.id/web_api/v1'
const PSC_API_TOKEN = process.env.PSC_API_TOKEN || ''

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase()

export async function GET(req: Request) {
  try {
    const query = new URL(req.url).searchParams.get('q')?.trim() || ''
    if (query.length < 2) {
      return NextResponse.json({ success: true, data: [] })
    }

    const headers: Record<string, string> = {}
    if (PSC_API_TOKEN) headers.TTOKEN = PSC_API_TOKEN

    const formData = new FormData()
    formData.append('search', query)
    formData.append('page', '1')
    formData.append('per_page', '100')

    const response = await fetch(`${PSC_API_BASE_URL}/data-psc`, {
      method: 'POST',
      headers,
      body: formData,
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json({ success: false, data: [], message: `Upstream error: ${response.status}` }, { status: 502 })
    }

    const payload = await response.json().catch(() => ({}))
    const rows = Array.isArray(payload?.data) ? payload.data : []
    const queryNormalized = normalize(query)
    const suggestions: Array<Record<string, string>> = []
    const seen = new Set<string>()

    for (const row of rows) {
      const province = String(row?.provinsi ?? '').trim()
      const kabupaten = String(row?.kabupaten ?? '').trim()

      if (province && normalize(province).includes(queryNormalized)) {
        const key = `provinsi-${normalize(province)}`
        if (!seen.has(key)) {
          seen.add(key)
          suggestions.push({
            type: 'provinsi',
            label: province,
            province_name: province,
            kabupaten_name: '',
            kecamatan_name: '',
            desa_name: '',
          })
        }
      }

      if (kabupaten && normalize(kabupaten).includes(queryNormalized)) {
        const key = `kabupaten-${normalize(kabupaten)}`
        if (!seen.has(key)) {
          seen.add(key)
          suggestions.push({
            type: 'kabupaten',
            label: kabupaten,
            province_name: province,
            kabupaten_name: kabupaten,
            kecamatan_name: '',
            desa_name: '',
          })
        }
      }
    }

    return NextResponse.json({ success: true, data: suggestions.slice(0, 50) })
  } catch (error: unknown) {
    console.error('[regions-search proxy error]:', error)
    const message = error instanceof Error ? error.message : 'Gagal mencari wilayah'
    return NextResponse.json({ success: false, data: [], message }, { status: 500 })
  }
}
