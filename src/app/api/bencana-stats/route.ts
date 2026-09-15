import { NextResponse } from 'next/server'
import type { PscCallItem } from '@/types/psc'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PSC_API_BASE_URL = process.env.PSC_API_BASE_URL || 'https://psc.kemkes.go.id/web_api/v1'
const PSC_API_TOKEN = process.env.PSC_API_TOKEN || ''

let cachedResponse: { timestamp: number; data: any; key: string } | null = null
const CACHE_TTL_MS = 30000

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tahun = searchParams.get('year') || searchParams.get('tahun') || '2026'
    const month = searchParams.get('month') || searchParams.get('bulan') || ''
    const kode_psc = searchParams.get('kode_psc') || ''
    const province = searchParams.get('province') || ''
    const kabupaten = searchParams.get('kabupaten') || ''

    const cacheKey = `${tahun}-${month}-${province}-${kabupaten}-${kode_psc}`
    if (cachedResponse && cachedResponse.key === cacheKey && Date.now() - cachedResponse.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedResponse.data)
    }

    const formData = new FormData()
    formData.append('tahun', tahun)
    if (kode_psc) formData.append('kode_psc', kode_psc)
    if (province) formData.append('kd_prop', province)
    if (kabupaten) formData.append('kd_kab', kabupaten)
    formData.append('page', '1')
    formData.append('per_page', '100') // Ambil 100 panggilan terbaru

    const headers: Record<string, string> = {}
    if (PSC_API_TOKEN) headers['TTOKEN'] = PSC_API_TOKEN

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const pscRes = await fetch(`${PSC_API_BASE_URL}/data-pelaporan-panggilan`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!pscRes.ok) {
      throw new Error(`Upstream PSC status ${pscRes.status}`)
    }

    const pscJson = await pscRes.json()
    let calls: PscCallItem[] = pscJson.data || []
    
    // Filter berdasarkan bulan jika dipilih
    if (month && month !== 'all' && month !== 'semua') {
      const monthNum = parseInt(month, 10)
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        calls = calls.filter((c) => {
          const dateStr = c.tgl_pelaporan_panggilan || c.tanggal_panggilan || ''
          if (dateStr.includes('-')) {
            const parts = dateStr.split('-')
            if (parts.length >= 2 && parseInt(parts[1], 10) === monthNum) return true
          }
          const d = new Date(dateStr)
          if (!isNaN(d.getTime()) && d.getMonth() + 1 === monthNum) return true
          return false
        })
      }
    }

    const totalCount = pscJson.total_data || calls.length

    let totalEmergency = 0
    let totalNonEmergency = 0
    let totalNonCategory = 0
    let totalTrauma = 0
    let totalAmbulans = 0
    let totalSelesai = 0

    const kategoriCounts: Record<string, number> = {}
    const wilayahCounts: Record<string, number> = {}
    const extensionCounts: Record<string, number> = {}
    const sumberCounts: Record<string, number> = {}
    const spesifikasiCounts: Record<string, number> = {}

    const markers = calls
      .filter(c => c.latitude && c.longitude && !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude)))
      .map((c, idx) => {
        const lat = parseFloat(c.latitude!)
        const lng = parseFloat(c.longitude!)
        const jenisLower = (c.jenis_layanan || '').toLowerCase()
        const isEmergency = (jenisLower.includes('emergency') && !jenisLower.includes('non')) || ((c as any).is_krisis === 1 && !jenisLower.includes('non'))
        const isNonEmergency = jenisLower.includes('non') && jenisLower.includes('emergency')
        const isNonCategory = (jenisLower.includes('non') && (jenisLower.includes('cat') || jenisLower.includes('kat'))) || (!isEmergency && !isNonEmergency && Boolean(jenisLower))
        const isTrauma = (c.kategori_layanan || '').toLowerCase().includes('trauma')

        if (isEmergency) totalEmergency++
        if (isNonEmergency) totalNonEmergency++
        if (isNonCategory) totalNonCategory++
        if (isTrauma) totalTrauma++
        if (c.nomor_kendaraan || c.nama_petugas_ambulan) totalAmbulans++
        if ((c.status_penanganan_code || '').toLowerCase().includes('selesai')) totalSelesai++

        const kat = c.kategori_layanan || 'Lainnya'
        kategoriCounts[kat] = (kategoriCounts[kat] || 0) + 1

        const wil = c.provinsi || c.kabupaten || 'Nasional'
        wilayahCounts[wil] = (wilayahCounts[wil] || 0) + 1

        const ext = c.extension || (c.id_extension ? `Ext ${c.id_extension}` : (c.nama_psc ? `Ext ${c.nama_psc}` : 'Ext 119'))
        extensionCounts[ext] = (extensionCounts[ext] || 0) + 1

        const sumber = c.sumber_panggilan || 'Masyarakat (119)'
        sumberCounts[sumber] = (sumberCounts[sumber] || 0) + 1

        const spesifikasi = c.spesifikasi_layanan || c.kategori_layanan || c.keluhan || 'Gawat Darurat 119'
        spesifikasiCounts[spesifikasi] = (spesifikasiCounts[spesifikasi] || 0) + 1

        return {
          kode_trans: c.ticket_id || c.kode_pelaporan_panggilan || `PSC-${idx}`,
          tgl_kejadian: c.tgl_pelaporan_panggilan || c.tanggal_panggilan || '',
          jenis_bencana: spesifikasi,
          kategori_bencana: isEmergency ? '1' : '2',
          lat,
          lng,
          provinsi: c.provinsi || '',
          kabupaten: c.kabupaten || '',
          nama_desa: c.nama_lokasi || c.alamat || '',
          kecamatan: c.nama_psc || '',
          is_krisis: isEmergency ? 1 : 0,
          total_korban: 1,
          icon_file: isEmergency ? 'icon_krisis_red.png' : 'icon_krisis_yellow.png',
          raw_psc: c,
          extension: ext,
          sumber_panggilan: sumber,
          spesifikasi_layanan: spesifikasi,
          jenis_layanan: c.jenis_layanan || (isEmergency ? 'Emergency' : (isNonEmergency ? 'Non Emergency' : 'Non Category')),
        }
      })

    const jenis_bencana = Object.entries(kategoriCounts)
      .map(([nama, jumlah]) => ({ nama, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)

    const wilayah = Object.entries(wilayahCounts)
      .map(([nama, jumlah]) => ({ nama, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)

    const sebaran_extension = Object.entries(extensionCounts)
      .map(([nama, jumlah]) => ({ nama, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)

    const sebaran_sumber = Object.entries(sumberCounts)
      .map(([nama, jumlah]) => ({ nama, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)

    const sebaran_spesifikasi = Object.entries(spesifikasiCounts)
      .map(([nama, jumlah]) => ({ nama, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)

    const payload = {
      success: true,
      summary: {
        total_bencana: totalCount,
        total_krisis: totalEmergency,
        total_meninggal: totalNonEmergency > 0 ? totalNonEmergency : totalTrauma,
        total_luka: totalNonCategory > 0 ? totalNonCategory : totalEmergency,
        total_hilang: 0,
        total_pengungsi: totalAmbulans,
        total_terdampak: totalCount,
        total_emergency: totalEmergency,
        total_non_emergency: totalNonEmergency,
        total_non_category: totalNonCategory,
        total_personil: 450,
      },
      jenis_bencana,
      wilayah,
      sebaran_extension,
      sebaran_sumber,
      sebaran_spesifikasi,
      markers,
    }

    cachedResponse = { timestamp: Date.now(), data: payload, key: cacheKey }
    return NextResponse.json(payload)

  } catch (err: any) {
    console.error('[bencana-stats proxy error]:', err)
    return NextResponse.json({
      success: false,
      message: err?.message || 'Gagal memuat statistik PSC',
      summary: {
        total_bencana: 0,
        total_krisis: 0,
        total_meninggal: 0,
        total_luka: 0,
        total_hilang: 0,
        total_pengungsi: 0,
        total_terdampak: 0,
      },
      jenis_bencana: [],
      wilayah: [],
      markers: [],
    }, { status: 500 })
  }
}
