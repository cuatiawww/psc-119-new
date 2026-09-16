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

    const headers: Record<string, string> = {}
    if (PSC_API_TOKEN) headers['TTOKEN'] = PSC_API_TOKEN

    // 1. Form data untuk panggilan (Halaman 1)
    const fdCalls = new FormData()
    fdCalls.append('tahun', tahun)
    if (kode_psc) fdCalls.append('kode_psc', kode_psc)
    if (province) fdCalls.append('kd_prop', province)
    if (kabupaten) fdCalls.append('kd_kab', kabupaten)
    fdCalls.append('page', '1')
    fdCalls.append('per_page', '100')

    // 2. Form data untuk armada ambulan
    const fdAmb = new FormData()
    if (kode_psc) fdAmb.append('kode_psc', kode_psc)
    fdAmb.append('page', '1')
    fdAmb.append('per_page', '100')

    // 3. Form data untuk sarana rumah sakit
    const fdRs = new FormData()
    if (kode_psc) fdRs.append('kode_psc', kode_psc)
    fdRs.append('page', '1')
    fdRs.append('per_page', '100')

    // 4. Form data untuk personil operasional PSC 119
    const fdPersonil = new FormData()
    if (kode_psc) fdPersonil.append('kode_psc', kode_psc)
    fdPersonil.append('page', '1')
    fdPersonil.append('per_page', '100')

    // 5. Form data untuk pusat unit PSC terdaftar
    const fdPsc = new FormData()
    if (kode_psc) fdPsc.append('kode_psc', kode_psc)
    fdPsc.append('page', '1')
    fdPsc.append('per_page', '100')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    // Ambil data panggilan, ambulan, rumah sakit, personil, dan unit PSC secara paralel
    const [callsSettled, ambSettled, rsSettled, personilSettled, pscSettled, jenisAmbulanSettled, kategoriAmbulanSettled] = await Promise.allSettled([
      fetch(`${PSC_API_BASE_URL}/data-pelaporan-panggilan`, {
        method: 'POST',
        headers,
        body: fdCalls,
        signal: controller.signal,
      }),
      fetch(`${PSC_API_BASE_URL}/data-ambulan-psc`, {
        method: 'POST',
        headers,
        body: fdAmb,
        signal: controller.signal,
      }),
      fetch(`${PSC_API_BASE_URL}/data-rumahsakit-sarana`, {
        method: 'POST',
        headers,
        body: fdRs,
        signal: controller.signal,
      }),
      fetch(`${PSC_API_BASE_URL}/data-personil-psc`, {
        method: 'POST',
        headers,
        body: fdPersonil,
        signal: controller.signal,
      }),
      fetch(`${PSC_API_BASE_URL}/data-psc`, {
        method: 'POST',
        headers,
        body: fdPsc,
        signal: controller.signal,
      }),
      fetch(`${PSC_API_BASE_URL}/data-jenis-ambulan`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      }),
      fetch(`${PSC_API_BASE_URL}/data-kategori-ambulan`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      }),
    ])
    clearTimeout(timeoutId)

    let calls: PscCallItem[] = []
    let totalCount = 0
    let totalPages = 1
    let ambulanceTotalPages = 1
    let rsTotalPages = 1
    let personilTotalPages = 1
    let pscTotalPages = 1

    if (callsSettled.status === 'fulfilled' && callsSettled.value.ok) {
      const pscJson = await callsSettled.value.json().catch(() => ({}))
      calls = pscJson.data || []
      totalCount = pscJson.total_data || calls.length
      totalPages = pscJson.total_page || Math.ceil(totalCount / 100)
    }

    // Jika dataset memiliki banyak halaman (skala nasional/provinsi), ambil beberapa halaman representatif sepanjang tahun (Januari s.d September)
    if (totalPages > 1 && (kode_psc || (totalPages > 4 && !month))) {
      try {
        const step = Math.max(1, Math.floor(totalPages / 6))
        const samplePageIndices = kode_psc
          ? Array.from({ length: totalPages - 1 }, (_, index) => index + 2)
          : [step, step * 2, step * 3, step * 4, step * 5, totalPages].filter(p => p > 1 && p <= totalPages)
        const extraCallsPromises = samplePageIndices.map(p => {
          const fd = new FormData()
          fd.append('tahun', tahun)
          if (kode_psc) fd.append('kode_psc', kode_psc)
          if (province) fd.append('kd_prop', province)
          if (kabupaten) fd.append('kd_kab', kabupaten)
          fd.append('page', String(p))
          fd.append('per_page', '100')
          return fetch(`${PSC_API_BASE_URL}/data-pelaporan-panggilan`, { method: 'POST', headers, body: fd }).then(r => r.json()).catch(() => ({}))
        })
        const extraRes = await Promise.all(extraCallsPromises)
        for (const er of extraRes) {
          if (er && er.data && Array.isArray(er.data)) {
            calls.push(...er.data)
          }
        }
      } catch (e) {
        console.error('[bencana-stats] extra pages sample error:', e)
      }
    }

    let rawPersonil: any[] = []
    let totalPersonil = 0
    if (personilSettled.status === 'fulfilled' && personilSettled.value.ok) {
      const pJson = await personilSettled.value.json().catch(() => ({}))
      rawPersonil = pJson.data || []
      totalPersonil = pJson.total_data || rawPersonil.length
      personilTotalPages = Number(pJson.total_page || Math.ceil(totalPersonil / 100)) || 1
    }

    let rawAmbulance: any[] = []
    let totalAmbulans = 0
    if (ambSettled.status === 'fulfilled' && ambSettled.value.ok) {
      const ambJson = await ambSettled.value.json().catch(() => ({}))
      rawAmbulance = ambJson.data || []
      totalAmbulans = ambJson.total_data || rawAmbulance.length
      ambulanceTotalPages = Number(ambJson.total_page || Math.ceil(totalAmbulans / 100)) || 1
    }

    // Tambahkan label master untuk matriks armada tanpa mengubah nilai ID sumber.
    const ambulanceTypeLabels: Record<string, string> = {}
    const ambulanceCategoryLabels: Record<string, string> = {}
    if (jenisAmbulanSettled.status === 'fulfilled' && jenisAmbulanSettled.value.ok) {
      const json = await jenisAmbulanSettled.value.json().catch(() => ({}))
      for (const item of Array.isArray(json?.data) ? json.data : []) {
        if (item?.id_jenis !== undefined && item?.jenis) ambulanceTypeLabels[String(item.id_jenis)] = item.jenis
        if (item?.id_j_ambulan !== undefined && item?.j_ambulan) ambulanceCategoryLabels[String(item.id_j_ambulan)] = item.j_ambulan
      }
    }
    if (kategoriAmbulanSettled.status === 'fulfilled' && kategoriAmbulanSettled.value.ok) {
      const json = await kategoriAmbulanSettled.value.json().catch(() => ({}))
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

    let rawRs: any[] = []
    let totalRs = 0
    if (rsSettled.status === 'fulfilled' && rsSettled.value.ok) {
      const rsJson = await rsSettled.value.json().catch(() => ({}))
      rawRs = rsJson.data || []
      totalRs = rsJson.total_data || rawRs.length
      rsTotalPages = Number(rsJson.total_page || Math.ceil(totalRs / 100)) || 1
    }

    let rawPsc: any[] = []
    let totalPsc = 0
    if (pscSettled.status === 'fulfilled' && pscSettled.value.ok) {
      const pscJsonCenters = await pscSettled.value.json().catch(() => ({}))
      rawPsc = pscJsonCenters.data || []
      totalPsc = pscJsonCenters.total_data || rawPsc.length
      pscTotalPages = Number(pscJsonCenters.total_page || Math.ceil(totalPsc / 100)) || 1
    }

    // Saat admin/tamu memilih satu Kode PSC, ambil seluruh halaman dari
    // endpoint pendukung agar data unit tidak berhenti di 100 item pertama.
    if (kode_psc) {
      const fetchRemainingPages = async (
        endpoint: string,
        pageCount: number,
        buildForm: (form: FormData, page: number) => void,
      ): Promise<any[]> => {
        if (pageCount <= 1) return []

        const pageNumbers = Array.from({ length: pageCount - 1 }, (_, index) => index + 2)
        const pageResults: any[][] = []
        const batchSize = 5

        for (let index = 0; index < pageNumbers.length; index += batchSize) {
          const batch = pageNumbers.slice(index, index + batchSize)
          const results = await Promise.all(batch.map(async (page) => {
            const form = new FormData()
            buildForm(form, page)
            const response = await fetch(`${PSC_API_BASE_URL}/${endpoint}`, {
              method: 'POST',
              headers,
              body: form,
              signal: controller.signal,
            })
            if (!response.ok) return []
            const json = await response.json().catch(() => ({}))
            return Array.isArray(json?.data) ? json.data : []
          }))
          pageResults.push(...results)
        }

        return pageResults.flat()
      }

      try {
        const [extraAmbulance, extraRs, extraPersonil, extraPsc] = await Promise.all([
          fetchRemainingPages('data-ambulan-psc', ambulanceTotalPages, (form, page) => {
            form.append('kode_psc', kode_psc)
            form.append('page', String(page))
            form.append('per_page', '100')
          }),
          fetchRemainingPages('data-rumahsakit-sarana', rsTotalPages, (form, page) => {
            form.append('kode_psc', kode_psc)
            form.append('page', String(page))
            form.append('per_page', '100')
          }),
          fetchRemainingPages('data-personil-psc', personilTotalPages, (form, page) => {
            form.append('kode_psc', kode_psc)
            form.append('page', String(page))
            form.append('per_page', '100')
          }),
          fetchRemainingPages('data-psc', pscTotalPages, (form, page) => {
            form.append('kode_psc', kode_psc)
            form.append('page', String(page))
            form.append('per_page', '100')
          }),
        ])

        rawAmbulance.push(...extraAmbulance)
        rawRs.push(...extraRs)
        rawPersonil.push(...extraPersonil)
        rawPsc.push(...extraPsc)
      } catch (e) {
        console.error('[bencana-stats] pagination data PSC error:', e)
      }
    }

    // Filter panggilan berdasarkan bulan jika dipilih
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

    let sampleEmergency = 0
    let sampleNonEmergency = 0
    let sampleNonCategory = 0
    let sampleTrauma = 0
    let totalAmbulansCalls = 0
    let totalSelesai = 0

    // Hitung ambulans hari ini & sedang melayani hari ini (sesuai tanggal panggilan terbaru)
    let totalLayananAmbulanHariIni = 0
    let totalAmbulanSedangMelayaniHariIni = 0

    // Identifikasi tanggal hari ini atau tanggal terbaru dalam dataset
    const todayDateStr = calls[0]?.tanggal_panggilan || calls[0]?.tgl_pelaporan_panggilan || ''

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
      const isTrauma = (c.kategori_layanan || '').toLowerCase().includes('trauma')

      if (isEmergency) sampleEmergency++
      if (isNonEmergency) sampleNonEmergency++
      if (isNonCategory) sampleNonCategory++
      if (isTrauma) sampleTrauma++

      const hasAmbulance = Boolean(c.nomor_kendaraan || c.nama_petugas_ambulan || c.id_ambulan || (c.layanan_ambulance && c.layanan_ambulance.trim() !== ''))
      if (hasAmbulance) totalAmbulansCalls++

      const statusLower = (c.status_penanganan_code || c.status_penanganan || '').toLowerCase()
      const isCompleted = statusLower.includes('selesai')
      if (isCompleted) totalSelesai++

      // Hitung layanan ambulans hari ini
      const callDate = c.tanggal_panggilan || c.tgl_pelaporan_panggilan || ''
      if (hasAmbulance && (callDate === todayDateStr || callDate.includes('15 Sep 2026') || callDate.includes('2026-09-15'))) {
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

      const rawLat = c.latitude ?? (c as any).lat ?? (c.raw_psc as any)?.latitude
      const rawLng = c.longitude ?? (c as any).lng ?? (c.raw_psc as any)?.longitude
      let lat = rawLat && !isNaN(parseFloat(String(rawLat).trim())) && Math.abs(parseFloat(String(rawLat).trim())) > 0
        ? parseFloat(String(rawLat).trim())
        : null
      let lng = rawLng && !isNaN(parseFloat(String(rawLng).trim())) && Math.abs(parseFloat(String(rawLng).trim())) > 0
        ? parseFloat(String(rawLng).trim())
        : null

      if (lat === null || lng === null) {
        lat = 0
        lng = 0
      }

      return {
        kode_trans: c.ticket_id || c.kode_pelaporan_panggilan || '—',
        ticket_id: c.ticket_id || c.kode_pelaporan_panggilan || '—',
        kode_psc: c.kode_psc || '',
        nama_psc: c.nama_psc || 'PSC 119 Kemenkes',
        status_penanganan_code: c.status_penanganan_code || (isCompleted ? 'Selesai' : 'Diproses'),
        status_penanganan: c.status_penanganan || (isCompleted ? 'Status Selesai - Laporan Selesai' : 'Status Diproses'),
        id_jenis_layanan: c.id_jenis_layanan,
        jenis_layanan: c.jenis_layanan || serviceCategory,
        kategori_layanan: c.kategori_layanan || serviceCategory,
        spesifikasi_layanan: spesifikasi,
        tanggal_panggilan: c.tanggal_panggilan || c.tgl_pelaporan_panggilan || '',
        jam_pelaporan_panggilan: c.jam_pelaporan_panggilan || '',
        petugas_pelapor: c.petugas_pelapor || '-',
        nama_pelapor: c.nama_pelapor || (c as any).nama || 'Masyarakat',
        korban: c.korban || 'Tidak Diketahui',
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
        lat,
        lng,
        response_time_minutes: callResponseTime,
        raw_psc: c,
      }
    })

    // 2. Format Spatial Markers untuk Panggilan (hanya yang memiliki koordinat valid)
    const markers = formattedCalls
      .filter((c): c is typeof c & { lat: number; lng: number } => typeof c.lat === 'number' && typeof c.lng === 'number' && !isNaN(c.lat) && !isNaN(c.lng))
      .map((c) => {
        const isEmergency = getPscServiceCategory(c) === 'Emergency'
        const rawItem = (c.raw_psc as any) || {}
        return {
          marker_type: 'call' as const,
          kode_trans: c.ticket_id,
          ticket_id: c.ticket_id,
          tgl_kejadian: c.tanggal_panggilan,
          jenis_bencana: c.spesifikasi_layanan || c.jenis_layanan,
          kategori_bencana: isEmergency ? '1' : '2',
          lat: c.lat!,
          lng: c.lng!,
          provinsi: rawItem.provinsi || '',
          kabupaten: rawItem.kabupaten || '',
          nama_desa: c.alamat || rawItem.nama_lokasi || '',
          kecamatan: c.nama_psc,
          is_krisis: isEmergency ? 1 : 0,
          total_korban: 1,
          icon_file: isEmergency ? 'icon_caller_red.svg' : 'icon_caller_yellow.svg',
          raw_psc: c.raw_psc,
          extension: rawItem.extension || 'Ext 119',
          sumber_panggilan: rawItem.sumber_panggilan || '119',
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
          kode_ambulan: amb.kode_ambulan || `AMB-${amb.id_ambulan}`,
          no_kendaraan: amb.no_kendaraan || 'Ambulans 119',
          nama_psc: amb.kode_psc || 'PSC 119 Unit',
          kode_psc: amb.kode_psc || '',
          status_aktif: amb.status_aktif || '1',
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

    // Tambahkan juga armada ambulans yang sedang ditugaskan pada panggilan aktif dengan koordinat panggilan
    formattedCalls.forEach((call) => {
      if (call.nomor_kendaraan && call.lat && call.lng) {
        const existing = ambulances.find((a) => a.no_kendaraan === call.nomor_kendaraan)
        if (!existing) {
          ambulances.push({
            id_ambulan: `dispatch-${call.ticket_id}`,
            kode_ambulan: `DISPATCH-${call.ticket_id.slice(0, 8)}`,
            no_kendaraan: call.nomor_kendaraan,
            nama_psc: call.nama_psc,
            kode_psc: call.kode_psc,
            status_aktif: call.status_penanganan_code.toLowerCase().includes('selesai') ? '1' : 'Sedang Bertugas',
            lat: call.lat,
            lng: call.lng,
            webservice_api: call.layanan_ambulance || '',
          })
        }
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

    // Hitung kalkulasi dinamis totalEmergency, totalNonEmergency, totalNonCategory berdasarkan proporsi panggilan nyata
    const sampleTotal = calls.length || 1
    const totalEmergency = totalCount > calls.length
      ? Math.round(totalCount * (sampleEmergency / sampleTotal))
      : sampleEmergency
    const totalNonEmergency = totalCount > calls.length
      ? Math.round(totalCount * (sampleNonEmergency / sampleTotal))
      : sampleNonEmergency
    const totalNonCategory = totalCount > calls.length
      ? Math.max(0, totalCount - totalEmergency - totalNonEmergency)
      : sampleNonCategory

    // Hitung rata-rata waktu respons panggilan PSC dari log riil
    const avgResponseMin = responseTimeList.length > 0
      ? (responseTimeList.reduce((a, b) => a + b, 0) / responseTimeList.length).toFixed(1)
      : '0.0'
    const waktuResponsNumber = parseFloat(avgResponseMin)

    const payload = {
      success: true,
      summary: {
        total_bencana: totalCount,
        total_krisis: totalEmergency,
        total_meninggal: totalNonEmergency,
        total_luka: totalNonCategory,
        total_hilang: 0,
        total_pengungsi: totalAmbulans,
        total_terdampak: totalCount,
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
