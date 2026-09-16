import { NextResponse } from 'next/server'
import type { PscCallItem, PscStatsSummary } from '@/types/psc'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PSC_API_BASE_URL = process.env.PSC_API_BASE_URL || 'https://psc.kemkes.go.id/web_api/v1'
const PSC_API_TOKEN = process.env.PSC_API_TOKEN || ''

let cachedStats: { timestamp: number; data: PscStatsSummary; key: string } | null = null
const CACHE_TTL_MS = 60000 // 1 menit cache

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      tahun = '2026',
      kd_prop = '',
      kd_kab = '',
      kode_psc = '',
    } = body

    const cacheKey = `${tahun}-${kd_prop}-${kd_kab}-${kode_psc}`
    if (cachedStats && cachedStats.key === cacheKey && Date.now() - cachedStats.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ status: true, data: cachedStats.data })
    }

    const formData = new FormData()
    formData.append('tahun', tahun)
    if (kd_prop) formData.append('kd_prop', kd_prop)
    if (kd_kab) formData.append('kd_kab', kd_kab)
    if (kode_psc) formData.append('kode_psc', kode_psc)
    formData.append('page', '1')
    formData.append('per_page', '100') // Ambil sample 100 panggilan terbaru untuk statistik tren

    const headers: Record<string, string> = {}
    if (PSC_API_TOKEN) headers['TTOKEN'] = PSC_API_TOKEN

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)

    const response = await fetch(`${PSC_API_BASE_URL}/data-pelaporan-panggilan`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json({ status: false, message: 'Upstream PSC API error' }, { status: response.status })
    }

    const json = await response.json()
    const calls: PscCallItem[] = json.data || []
    const totalDataNational = json.total_data || calls.length

    // Agregasi metrik KPI
    let totalEmergency = 0
    let totalNonEmergency = 0
    let totalTrauma = 0
    let totalNonTrauma = 0
    let totalAmbulans = 0
    let totalSelesai = 0
    let totalDiproses = 0
    let responseTimeSum = 0
    let responseTimeCount = 0

    const kategoriCounts: Record<string, number> = {}
    const wilayahCounts: Record<string, { count: number; emergency: number; trauma: number }> = {}
    const hourlyCounts: Record<string, number> = {}

    calls.forEach((c) => {
      // 1. Jenis Layanan
      const jenis = (c.jenis_layanan || '').toLowerCase()
      if (jenis.includes('emergency') && !jenis.includes('non')) {
        totalEmergency++
      } else {
        totalNonEmergency++
      }

      // 2. Kategori Layanan
      const kat = (c.kategori_layanan || 'Lainnya').trim()
      kategoriCounts[kat] = (kategoriCounts[kat] || 0) + 1

      if (kat.toLowerCase().includes('trauma') && !kat.toLowerCase().includes('non')) {
        totalTrauma++
      } else {
        totalNonTrauma++
      }

      // 3. Ambulans
      if (c.nomor_kendaraan || c.nama_petugas_ambulan || c.layanan_ambulance) {
        totalAmbulans++
      }

      // 4. Status Penanganan
      const status = (c.status_penanganan_code || c.status_penanganan || '').toLowerCase()
      if (status.includes('selesai')) {
        totalSelesai++
      } else {
        totalDiproses++
      }

      // 5. Response Time (menit)
      if (c.waktu_respons) {
        const parsedMins = parseFloat(String(c.waktu_respons))
        if (!isNaN(parsedMins) && parsedMins > 0 && parsedMins < 600) {
          responseTimeSum += parsedMins
          responseTimeCount++
        }
      }

      // 6. Wilayah (Provinsi / Kabupaten)
      const wil = c.provinsi || c.kabupaten || 'Nasional'
      if (!wilayahCounts[wil]) {
        wilayahCounts[wil] = { count: 0, emergency: 0, trauma: 0 }
      }
      wilayahCounts[wil].count++
      if (jenis.includes('emergency') && !jenis.includes('non')) wilayahCounts[wil].emergency++
      if (kat.toLowerCase().includes('trauma') && !kat.toLowerCase().includes('non')) wilayahCounts[wil].trauma++

      // 7. Hourly Trend
      const jam = c.jam_pelaporan_panggilan ? c.jam_pelaporan_panggilan.slice(0, 2) + ':00' : '00:00'
      hourlyCounts[jam] = (hourlyCounts[jam] || 0) + 1
    })

    const avgResponseTime = responseTimeCount > 0 ? Math.round(responseTimeSum / responseTimeCount) : 0

    const kategoriDistribution = Object.entries(kategoriCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: calls.length > 0 ? Math.round((count / calls.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)

    const topWilayah = Object.entries(wilayahCounts)
      .map(([name, val]) => ({
        name,
        count: val.count,
        emergency: val.emergency,
        trauma: val.trauma,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Jam 00:00 s/d 23:00 berurutan
    const hourlyTrend = Array.from({ length: 24 }, (_, i) => {
      const hStr = String(i).padStart(2, '0') + ':00'
      return {
        hour: hStr,
        calls: hourlyCounts[hStr] || 0,
      }
    })

    const uniquePscInCalls = new Set(calls.map((c) => c.kode_psc).filter(Boolean)).size

    const statsData: PscStatsSummary = {
      totalPanggilan: totalDataNational,
      totalEmergency,
      totalNonEmergency,
      totalTrauma,
      totalNonTrauma,
      totalAmbulans,
      totalSelesai,
      totalDiproses,
      avgResponseTime,
      totalPscCenters: uniquePscInCalls > 0 ? uniquePscInCalls : Number(json.total_psc || 0),
      kategoriDistribution,
      topWilayah,
      hourlyTrend,
    }

    cachedStats = { timestamp: Date.now(), data: statsData, key: cacheKey }

    return NextResponse.json({
      status: true,
      data: statsData,
    })

  } catch (error: any) {
    console.error('[PSC API /stats] Error:', error)
    return NextResponse.json({
      status: false,
      message: error?.message || 'Gagal mengagregasi statistik PSC 119',
    }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  return POST(new Request(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tahun: searchParams.get('tahun') || '2026',
      kd_prop: searchParams.get('kd_prop') || '',
      kd_kab: searchParams.get('kd_kab') || '',
      kode_psc: searchParams.get('kode_psc') || '',
    })
  }))
}
