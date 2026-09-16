import { NextResponse } from 'next/server'
import type { PscCallItem, PscAmbulanceItem, PscHospitalItem, PscCallRecord, PscPersonnelItem } from '@/types/psc'
import { getPscServiceCategory } from '@/lib/pscServiceCategory'
import { resolvePscIcd10 } from '@/lib/pscIcd10'
import { getPscResponseMinutes } from '@/lib/pscResponseTime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PSC_API_BASE_URL = process.env.PSC_API_BASE_URL || 'https://psc.kemkes.go.id/web_api/v1'
const PSC_API_TOKEN = process.env.PSC_API_TOKEN || ''

let cachedResponse: { timestamp: number; data: any; key: string } | null = null
const CACHE_TTL_MS = 45000 // 45 detik cache TTL
const PAGE_SIZE = 100
const PAGE_BATCH_SIZE = 4
const FULL_DATA_CACHE_TTL_MS = 5 * 60 * 1000
const fullDataCache = new Map<string, { timestamp: number; result: { rows: any[]; totalData: number; totalPages: number } }>()
const fullDataInFlight = new Map<string, Promise<{ rows: any[]; totalData: number; totalPages: number }>>()

type PscPageResponse = {
  data?: any[]
  total_data?: number | string
  total_page?: number | string
}

const toPositiveNumber = (value: unknown, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

async function fetchPscPage(
  endpoint: string,
  fields: Record<string, string>,
  page: number,
  headers: Record<string, string>,
): Promise<PscPageResponse> {
  let lastError: unknown = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    const formData = new FormData()
    Object.entries({ ...fields, page: String(page), per_page: String(PAGE_SIZE) }).forEach(([key, value]) => {
      if (value) formData.append(key, value)
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    try {
      const response = await fetch(`${PSC_API_BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error(`PSC API ${endpoint} page ${page} mengembalikan HTTP ${response.status}`)
      }
      return await response.json() as PscPageResponse
    } catch (error) {
      lastError = error
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250))
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Gagal mengambil ${endpoint} page ${page}`)
}

async function fetchAllPscPagesUncached(
  endpoint: string,
  fields: Record<string, string>,
  headers: Record<string, string>,
) {
  const fullDataCacheKey = `${endpoint}:${JSON.stringify(fields)}`
  const cached = fullDataCache.get(fullDataCacheKey)
  if (cached && Date.now() - cached.timestamp < FULL_DATA_CACHE_TTL_MS) {
    return cached.result
  }

  const firstPage = await fetchPscPage(endpoint, fields, 1, headers)
  const firstRows = Array.isArray(firstPage.data) ? firstPage.data : []
  const totalData = toPositiveNumber(firstPage.total_data, firstRows.length)
  const totalPages = Math.max(
    1,
    toPositiveNumber(firstPage.total_page, Math.ceil(totalData / PAGE_SIZE)),
    Math.ceil(totalData / PAGE_SIZE),
  )

  const allRows = [...firstRows]
  for (let start = 2; start <= totalPages; start += PAGE_BATCH_SIZE) {
    const pageNumbers = Array.from(
      { length: Math.min(PAGE_BATCH_SIZE, totalPages - start + 1) },
      (_, index) => start + index,
    )
    const pageResponses = await Promise.all(
      pageNumbers.map((page) => fetchPscPage(endpoint, fields, page, headers)),
    )
    pageResponses.forEach((pageResponse) => {
      if (Array.isArray(pageResponse.data)) allRows.push(...pageResponse.data)
    })
  }

  // Jangan deduplikasi berdasarkan kode/nama: API dapat mengembalikan lebih
  // dari satu record dengan kode unit yang sama. Setiap baris respons adalah
  // record sumber dan harus dipertahankan.
  const rows = allRows
  if (rows.length < totalData) {
    throw new Error(`Data ${endpoint} tidak lengkap: API melaporkan ${totalData} record, tetapi hanya ${rows.length} record yang diterima.`)
  }

  const result = { rows, totalData, totalPages }
  fullDataCache.set(fullDataCacheKey, { timestamp: Date.now(), result })
  return result
}

async function fetchAllPscPages(
  endpoint: string,
  fields: Record<string, string>,
  headers: Record<string, string>,
) {
  const fullDataCacheKey = `${endpoint}:${JSON.stringify(fields)}`
  const cached = fullDataCache.get(fullDataCacheKey)
  if (cached && Date.now() - cached.timestamp < FULL_DATA_CACHE_TTL_MS) {
    return cached.result
  }

  let pending = fullDataInFlight.get(fullDataCacheKey)
  if (!pending) {
    pending = fetchAllPscPagesUncached(endpoint, fields, headers)
    fullDataInFlight.set(fullDataCacheKey, pending)
  }

  try {
    return await pending
  } finally {
    if (fullDataInFlight.get(fullDataCacheKey) === pending) {
      fullDataInFlight.delete(fullDataCacheKey)
    }
  }
}

const parsePscDate = (value: unknown): Date | null => {
  const text = String(value ?? '').replace(/\s*WIB/gi, '').trim()
  if (!text) return null

  const direct = new Date(text)
  if (!Number.isNaN(direct.getTime())) return direct

  const match = text.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/)
  if (!match) return null
  const months: Record<string, number> = {
    januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
    juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
  }
  const month = months[match[2].toLowerCase()]
  if (month === undefined) return null
  const parsed = new Date(Number(match[3]), month, Number(match[1]))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const callDate = (call: any) => call?.tanggal_panggilan || call?.tgl_pelaporan_panggilan || ''

const normalizeRegionValue = (value: unknown) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/\s*\([^)]*\)/g, '')
  .replace(/^(provinsi|prov\.?|kabupaten|kab\.?|kota|kecamatan|kec\.?|desa|kelurahan|nagari)\s+/i, '')
  .replace(/[^a-z0-9]/g, '')

const matchesRegionFilter = (row: any, requested: string, codeKeys: string[], nameKeys: string[]) => {
  if (!requested) return true
  const requestedText = normalizeRegionValue(requested)
  const requestedIsCode = /^\d+$/.test(String(requested).trim())
  const candidates = requestedIsCode
    ? codeKeys.map((key) => String(row?.[key] ?? '').trim())
    : nameKeys.map((key) => normalizeRegionValue(row?.[key]))
  return candidates.some((candidate) => candidate === (requestedIsCode ? String(requested).trim() : requestedText))
}

const dateKey = (value: unknown) => {
  const parsed = parsePscDate(value)
  if (!parsed) return ''
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tahun = searchParams.get('year') || searchParams.get('tahun') || '2026'
    const month = searchParams.get('month') || searchParams.get('bulan') || ''
    const kode_psc = searchParams.get('kode_psc') || ''
    const province = searchParams.get('province') || ''
    const kabupaten = searchParams.get('kabupaten') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''

    const cacheKey = `${tahun}-${month}-${province}-${kabupaten}-${kode_psc}-${startDate}-${endDate}`
    if (cachedResponse && cachedResponse.key === cacheKey && Date.now() - cachedResponse.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedResponse.data)
    }

    const headers: Record<string, string> = {}
    if (PSC_API_TOKEN) headers['TTOKEN'] = PSC_API_TOKEN

    const callFields: Record<string, string> = { tahun }
    const unitFields: Record<string, string> = {}
    if (kode_psc) {
      callFields.kode_psc = kode_psc
      unitFields.kode_psc = kode_psc
    }
    // Endpoint PSC mengharapkan kode wilayah pada kd_prop/kd_kab. Nama wilayah
    // seperti "JAWA BARAT" atau "BOGOR" dapat memicu HTTP 500, jadi nama
    // difilter setelah seluruh record API diterima.
    if (/^\d+$/.test(province.trim())) callFields.kd_prop = province.trim()
    if (/^\d+$/.test(kabupaten.trim())) callFields.kd_kab = kabupaten.trim()

    // Semua metrik dashboard harus berasal dari record lengkap, bukan halaman
    // pertama atau halaman sampel.
    const callsResult = await fetchAllPscPages('data-pelaporan-panggilan', callFields, headers)
    const [ambulanceResult, hospitalResult, personnelResult, pscResult, jenisAmbulanResult, kategoriAmbulanResult] = await Promise.all([
      fetchAllPscPages('data-ambulan-psc', unitFields, headers),
      fetchAllPscPages('data-rumahsakit-sarana', unitFields, headers),
      fetchAllPscPages('data-personil-psc', unitFields, headers),
      fetchAllPscPages('data-psc', unitFields, headers),
      fetch(`${PSC_API_BASE_URL}/data-jenis-ambulan`, { method: 'GET', headers, cache: 'no-store' })
        .then(async (response) => response.ok ? await response.json() : {}),
      fetch(`${PSC_API_BASE_URL}/data-kategori-ambulan`, { method: 'GET', headers, cache: 'no-store' })
        .then(async (response) => response.ok ? await response.json() : {}),
    ])

    let calls: PscCallItem[] = callsResult.rows as PscCallItem[]
    if (province) {
      calls = calls.filter((call) => matchesRegionFilter(
        call,
        province,
        ['kd_prop', 'kode_prop', 'id_propinsi'],
        ['provinsi', 'nama_prop', 'nama_provinsi'],
      ))
    }
    if (kabupaten) {
      calls = calls.filter((call) => matchesRegionFilter(
        call,
        kabupaten,
        ['kd_kab', 'kode_kab', 'id_kabupaten'],
        ['kabupaten', 'nama_kab', 'nama_kabupaten'],
      ))
    }
    let totalCount = calls.length
    const rawPersonil: any[] = personnelResult.rows
    const totalPersonil = personnelResult.totalData
    let rawAmbulance: any[] = ambulanceResult.rows
    const totalAmbulans = ambulanceResult.totalData

    // Tambahkan label master untuk matriks armada tanpa mengubah nilai ID sumber.
    const ambulanceTypeLabels: Record<string, string> = {}
    const ambulanceCategoryLabels: Record<string, string> = {}
    {
      const json = jenisAmbulanResult
      for (const item of Array.isArray(json?.data) ? json.data : []) {
        if (item?.id_jenis !== undefined && item?.jenis) ambulanceTypeLabels[String(item.id_jenis)] = item.jenis
        if (item?.id_j_ambulan !== undefined && item?.j_ambulan) ambulanceCategoryLabels[String(item.id_j_ambulan)] = item.j_ambulan
      }
    }
    {
      const json = kategoriAmbulanResult
      for (const item of Array.isArray(json?.data) ? json.data : []) {
        if (item?.id_j_ambulan !== undefined && item?.j_ambulan) ambulanceCategoryLabels[String(item.id_j_ambulan)] = item.j_ambulan
      }
    }
    if (Object.keys(ambulanceTypeLabels).length > 0 || Object.keys(ambulanceCategoryLabels).length > 0) {
      rawAmbulance = rawAmbulance.map((item) => ({
        ...item,
        jenis: item.jenis || ambulanceTypeLabels[String(item.id_jenis)] || null,
        j_ambulan: item.j_ambulan || ambulanceCategoryLabels[String(item.id_j_ambulan)] || null,
      }))
    }

    const rawRs: any[] = hospitalResult.rows
    const totalRs = hospitalResult.totalData
    const rawPsc: any[] = pscResult.rows
    const totalPsc = pscResult.totalData

    // Filter panggilan dari seluruh record API berdasarkan periode yang dipilih.
    // Filter ini dilakukan sebelum agregasi agar total dan seluruh grafik memakai
    // himpunan data yang sama.
    if (month && month !== 'all' && month !== 'semua') {
      const monthNum = parseInt(month, 10)
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        calls = calls.filter((c) => parsePscDate(callDate(c))?.getMonth() === monthNum - 1)
      }
    }

    if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00`)
      const end = new Date(`${endDate}T23:59:59.999`)
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        calls = calls.filter((c) => {
          const parsed = parsePscDate(callDate(c))
          return parsed !== null && parsed.getTime() >= start.getTime() && parsed.getTime() <= end.getTime()
        })
      }
    }

    totalCount = calls.length

    let totalEmergency = 0
    let totalNonEmergency = 0
    let totalNonCategory = 0

    // Hitung ambulans hari ini & sedang melayani hari ini (sesuai tanggal panggilan terbaru)
    let totalLayananAmbulanHariIni = 0
    let totalAmbulanSedangMelayaniHariIni = 0
    const todayDateStr = new Date().toISOString().slice(0, 10)

    const kategoriCounts: Record<string, number> = {}
    const wilayahCounts: Record<string, number> = {}
    const extensionCounts: Record<string, number> = {}
    const sumberCounts: Record<string, number> = {}
    const spesifikasiCounts: Record<string, number> = {}
    const icdCounts: Record<string, number> = {}
    const responseTimeList: number[] = []

    // 1. Format Call Records (untuk Matriks Tabel Lengkap)
    const formattedCalls: PscCallRecord[] = calls.map((c, idx) => {
      const serviceCategory = getPscServiceCategory(c)
      const isEmergency = serviceCategory === 'Emergency'
      const isNonEmergency = serviceCategory === 'Non Emergency'
      const isNonCategory = serviceCategory === 'Non Category'

      if (isEmergency) totalEmergency++
      if (isNonEmergency) totalNonEmergency++
      if (isNonCategory) totalNonCategory++

      const hasAmbulance = Boolean(c.nomor_kendaraan || c.nama_petugas_ambulan || c.id_ambulan || (c.layanan_ambulance && c.layanan_ambulance.trim() !== ''))

      const statusLower = (c.status_penanganan_code || c.status_penanganan || '').toLowerCase()
      const isCompleted = statusLower.includes('selesai')

      // Hitung layanan ambulans hari ini
      const callDate = c.tanggal_panggilan || c.tgl_pelaporan_panggilan || ''
      if (hasAmbulance && dateKey(callDate) === todayDateStr) {
        totalLayananAmbulanHariIni++
        if (!isCompleted) {
          totalAmbulanSedangMelayaniHariIni++
        }
      }

      // Hitung durasi waktu respons dispatcher ke status penanganan (menit)
      const callResponseTime = getPscResponseMinutes(c)
      if (callResponseTime !== null) responseTimeList.push(callResponseTime)

      // Resolusi ICD-10 hanya dari diagnosis/keluhan klinis, bukan jenis layanan atau armada.
      const icdName = resolvePscIcd10(c)
      if (icdName) icdCounts[icdName] = (icdCounts[icdName] || 0) + 1

      const kat = c.kategori_layanan || '-'
      kategoriCounts[kat] = (kategoriCounts[kat] || 0) + 1

      const wil = c.provinsi || c.kabupaten || 'Nasional'
      wilayahCounts[wil] = (wilayahCounts[wil] || 0) + 1

      const ext = c.extension || (c.id_extension ? `Ext ${c.id_extension}` : '-')
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1

      const sumber = c.sumber_panggilan || (c.id_sumber_panggilan ? `Sumber ${c.id_sumber_panggilan}` : '-')
      sumberCounts[sumber] = (sumberCounts[sumber] || 0) + 1

      const spesifikasi = c.spesifikasi_layanan || c.kategori_layanan || c.keluhan || '-'
      spesifikasiCounts[spesifikasi] = (spesifikasiCounts[spesifikasi] || 0) + 1

      const rawLat = c.latitude ?? (c as any).lat ?? (c.raw_psc as any)?.latitude
      const rawLng = c.longitude ?? (c as any).lng ?? (c.raw_psc as any)?.longitude
      const lat = rawLat && !isNaN(parseFloat(String(rawLat).trim())) && Math.abs(parseFloat(String(rawLat).trim())) > 0
        ? parseFloat(String(rawLat).trim())
        : null
      const lng = rawLng && !isNaN(parseFloat(String(rawLng).trim())) && Math.abs(parseFloat(String(rawLng).trim())) > 0
        ? parseFloat(String(rawLng).trim())
        : null
      const explicitVictimCount = [
        (c as any).total_korban,
        (c as any).jumlah_korban,
        (c as any).jumlah_korban_terdampak,
      ].map((value) => Number(value)).find((value) => Number.isFinite(value) && value >= 0)

      return {
        kode_trans: c.ticket_id || c.kode_pelaporan_panggilan || '',
        ticket_id: c.ticket_id || c.kode_pelaporan_panggilan || '',
        kode_psc: c.kode_psc || '',
        nama_psc: c.nama_psc || '-',
        status_penanganan_code: c.status_penanganan_code || '-',
        status_penanganan: c.status_penanganan || '-',
        id_jenis_layanan: c.id_jenis_layanan,
        jenis_layanan: c.jenis_layanan || serviceCategory,
        kategori_layanan: c.kategori_layanan || '-',
        spesifikasi_layanan: spesifikasi,
        tanggal_panggilan: c.tanggal_panggilan || c.tgl_pelaporan_panggilan || '',
        jam_pelaporan_panggilan: c.jam_pelaporan_panggilan || '',
        petugas_pelapor: c.petugas_pelapor || '-',
        nama_pelapor: c.nama_pelapor || (c as any).nama || '-',
        korban: c.korban || '-',
        alamat: c.alamat || c.nama_lokasi || '-',
        nama_lokasi: c.nama_lokasi || c.alamat || '-',
        telp: c.telp || (c as any).no_telp || null,
        keterangan: c.keterangan || (c as any).keluhan || null,
        nomor_kendaraan: c.nomor_kendaraan || null,
        nama_petugas_ambulan: c.nama_petugas_ambulan || null,
        nama_petugas_ambulan_lainnya: (c as any).nama_petugas_ambulan_lainnya || null,
        layanan_ambulance: c.layanan_ambulance || null,
        rumahsakit_rujukan: c.rumahsakit_rujukan || null,
        id_rumahsakit_rujukan: (c as any).id_rumahsakit_rujukan || null,
        waktu_respons: c.waktu_respons || null,
        waktu_respons_label: (c as any).waktu_respons_label || (callResponseTime !== null ? `${callResponseTime} menit` : null),
        total_korban: explicitVictimCount ?? 0,
        lat,
        lng,
        response_time_minutes: callResponseTime,
        raw_psc: c,
      }
    })

    // 2. Format record panggilan untuk peta. Record tanpa koordinat tetap
    // dikirim untuk statistik; frontend hanya menggambar yang koordinatnya valid.
    const markers = formattedCalls.map((c) => {
        const isEmergency = getPscServiceCategory(c) === 'Emergency'
        const rawItem = (c.raw_psc as any) || {}
        return {
          marker_type: 'call' as const,
          kode_trans: c.ticket_id,
          ticket_id: c.ticket_id,
          tgl_kejadian: c.tanggal_panggilan,
          jenis_bencana: c.spesifikasi_layanan || c.jenis_layanan,
          // Panggilan PSC bukan data klasifikasi bencana. Jangan memetakan
          // Emergency/Non Emergency menjadi kategori bencana buatan.
          kategori_bencana: rawItem.kategori_bencana || undefined,
          lat: c.lat!,
          lng: c.lng!,
          provinsi: rawItem.provinsi || '',
          kabupaten: rawItem.kabupaten || '',
          nama_desa: c.alamat || rawItem.nama_lokasi || '',
          kecamatan: c.nama_psc,
          is_krisis: isEmergency ? 1 : 0,
          total_korban: c.total_korban || 0,
          icon_file: isEmergency ? 'icon_caller_red.svg' : 'icon_caller_yellow.svg',
          raw_psc: c.raw_psc,
          extension: rawItem.extension || (rawItem.id_extension ? `Ext ${rawItem.id_extension}` : '-'),
          sumber_panggilan: rawItem.sumber_panggilan || (rawItem.id_sumber_panggilan ? `Sumber ${rawItem.id_sumber_panggilan}` : '-'),
          spesifikasi_layanan: c.spesifikasi_layanan,
          jenis_layanan: c.jenis_layanan,
          id_jenis_layanan: c.id_jenis_layanan,
          kategori_layanan: c.kategori_layanan,
          nama_psc: c.nama_psc,
          status_penanganan: c.status_penanganan,
          status_penanganan_code: c.status_penanganan_code,
          nomor_kendaraan: c.nomor_kendaraan,
          nama_petugas_ambulan: c.nama_petugas_ambulan,
          nama_petugas_ambulan_lainnya: c.nama_petugas_ambulan_lainnya || rawItem.nama_petugas_ambulan_lainnya || null,
          layanan_ambulance: c.layanan_ambulance,
          rumahsakit_rujukan: c.rumahsakit_rujukan || rawItem.rumahsakit_rujukan || null,
          id_rumahsakit_rujukan: c.id_rumahsakit_rujukan || rawItem.id_rumahsakit_rujukan || null,
          response_time_minutes: c.response_time_minutes,
          waktu_respons: c.waktu_respons || rawItem.waktu_respons || null,
          waktu_respons_label: c.waktu_respons_label || rawItem.waktu_respons_label || null,
          keterangan: c.keterangan || rawItem.keterangan || null,
          telp: c.telp || rawItem.telp || null,
          nama_lokasi: c.nama_lokasi || rawItem.nama_lokasi || null,
          nama_pelapor: c.nama_pelapor || rawItem.nama_pelapor || null,
        }
      })

    // 3. Format Ambulans Spasial (Ambulance Markers)
    const ambulances: PscAmbulanceItem[] = []
    rawAmbulance.forEach((amb: any) => {
      const rawLat = amb.latitude ? parseFloat(amb.latitude) : null
      const rawLng = amb.longitude ? parseFloat(amb.longitude) : null

      if (rawLat && rawLng && !isNaN(rawLat) && !isNaN(rawLng) && Math.abs(rawLat) > 0) {
        ambulances.push({
          id_ambulan: amb.id_ambulan,
          kode_ambulan: amb.kode_ambulan || '',
          no_kendaraan: amb.no_kendaraan || '',
          nama_psc: amb.nama_psc || amb.kode_psc || '',
          kode_psc: amb.kode_psc || '',
          status_aktif: amb.status_aktif || '',
          vendor_gps: amb.vendor_gps || '',
          latitude: amb.latitude,
          longitude: amb.longitude,
          lat: rawLat,
          lng: rawLng,
          tahun: amb.tahun,
          webservice_api: amb.webservice_api,
          assestment_gawat_darurat: amb.assestment_gawat_darurat,
        })
      }
    })

    // 4. Format Rumah Sakit & Sarana Rujukan Spasial (Hospital Markers)
    const hospitals: PscHospitalItem[] = []
    rawRs.forEach((rs: any) => {
      const rawLat = rs.latitude ? parseFloat(rs.latitude) : null
      const rawLng = rs.longitude ? parseFloat(rs.longitude) : null
      if (rawLat && rawLng && !isNaN(rawLat) && !isNaN(rawLng) && Math.abs(rawLat) > 0) {
        hospitals.push({
          id: rs.id,
          kode_satusehat: rs.kode_satusehat,
          kode_sarana: rs.kode_sarana,
          nama: rs.nama,
          telp: rs.telp,
          email: rs.email,
          website: rs.website,
          alamat: rs.alamat,
          kode_prop: rs.kode_prop,
          nama_prop: rs.nama_prop,
          kode_kab: rs.kode_kab,
          nama_kab: rs.nama_kab,
          kode_subjenis: rs.kode_subjenis,
          nama_subjenis: rs.nama_subjenis,
          status_aktif: rs.status_aktif,
          rujukan: rs.rujukan,
          lat: rawLat,
          lng: rawLng,
        })
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

    const sebaran_icd = Object.entries(icdCounts)
      .map(([nama, jumlah]) => ({ nama, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)

    // Hitung rata-rata waktu respons dari seluruh panggilan yang diterima.
    const avgResponseMin = responseTimeList.length > 0
      ? (responseTimeList.reduce((a, b) => a + b, 0) / responseTimeList.length).toFixed(1)
      : '0.0'
    const waktuResponsNumber = parseFloat(avgResponseMin)

    const payload = {
      success: true,
      summary: {
        total_bencana: totalCount,
        total_krisis: totalEmergency,
        // Endpoint panggilan PSC mengirim nama korban, bukan jumlah korban
        // meninggal/luka/hilang/pengungsi. Jangan mengisi indikator ini dengan
        // jumlah kategori layanan karena akan menghasilkan data palsu.
        total_meninggal: 0,
        total_luka: 0,
        total_hilang: 0,
        total_pengungsi: 0,
        total_terdampak: 0,
        total_emergency: totalEmergency,
        total_non_emergency: totalNonEmergency,
        total_non_category: totalNonCategory,
        total_personil: totalPersonil,
        total_ambulan: totalAmbulans,
        total_rs: totalRs,
        total_psc: totalPsc,
        total_layanan_ambulan_hari_ini: totalLayananAmbulanHariIni,
        total_ambulan_sedang_melayani_hari_ini: totalAmbulanSedangMelayaniHariIni,
        waktu_respons_rata_rata: waktuResponsNumber,
        waktu_respons_label: `${waktuResponsNumber} Menit`,
      },
      jenis_bencana,
      wilayah,
      sebaran_extension,
      sebaran_sumber,
      sebaran_spesifikasi,
      sebaran_icd,
      markers,
      calls: formattedCalls,
      personnel: rawPersonil,
      // Semua record armada untuk card/matriks; `ambulances` tetap khusus marker peta berkoordinat.
      ambulance_records: rawAmbulance,
      ambulances,
      hospitals,
      centers: rawPsc,
      totalPersonnel: totalPersonil,
      totalAmbulance: totalAmbulans,
      totalHospital: totalRs,
      totalPsc,
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
        total_layanan_ambulan_hari_ini: 0,
        total_ambulan_sedang_melayani_hari_ini: 0,
      },
      jenis_bencana: [],
      wilayah: [],
      markers: [],
      calls: [],
      ambulances: [],
      hospitals: [],
    }, { status: 500 })
  }
}
