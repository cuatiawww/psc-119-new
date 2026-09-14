import fs from 'node:fs'
import path from 'node:path'
import Papa from 'papaparse'

export interface MasterFaskesInfo {
  id: string
  jenis_faskes: string
  kode_sarana: string
  kode_satusehat: string
  nama_master: string
  subjenis: string
  alamat: string
  kode_prop: string
  nama_prop: string
  kode_kab: string
  nama_kab: string
  kode_kecamatan: string
  nama_kecamatan: string
  latitude: number | null
  longitude: number | null
  telp: string
  email: string
  website: string
  operasional: string
  status_aktif: string
  alias_collector: string
}

let cachedMasterList: MasterFaskesInfo[] | null = null

export function cleanNttCoordinates(rawLat: any, rawLng: any): { lat: number | null; lng: number | null } {
  let lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat || ''))
  let lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng || ''))

  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    return { lat: null, lng: null }
  }

  // 1. Fix Longitude/Latitude scale typos (e.g. 123624295.18 -> 123.624295)
  if (lng > 1000) lng = lng / 1000000
  if (lat > 1000) lat = lat / 1000000

  // 2. Fix Swapped Coordinates (e.g. lat: 121.64, lng: -8.83)
  if (lat >= 118.0 && lat <= 126.0 && lng <= -7.0 && lng >= -12.0) {
    const temp = lat
    lat = lng
    lng = temp
  }

  // 3. Fix positive latitude for NTT southern hemisphere (e.g. 8.62 -> -8.62)
  if (lat > 7.0 && lat < 12.0) {
    lat = -lat
  }

  // 4. Strict NTT Bounding Box check:
  // NTT Latitude: -11.6 to -7.5 (South of equator)
  // NTT Longitude: 118.5 to 125.5 (East)
  if (lat < -11.6 || lat > -7.5 || lng < 118.5 || lng > 125.5) {
    // Outside NTT bounds (e.g., Jakarta dummy -6.2, Bangka -2.4, Papua, Vietnam/ocean coordinates) -> Hide from map
    return { lat: null, lng: null }
  }

  return { lat, lng }
}

function cleanLookupName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/^(rsud|rs\s*umum\s*daerah|rs\s*umum|rs|puskesmas|pkm|uptd|upt|klinik|pustu)\s+/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Load and cache all master faskes data from user manual mapped CSV and complete master dataset.
 */
export function getNttMasterFaskesList(): MasterFaskesInfo[] {
  if (cachedMasterList && cachedMasterList.length > 0) {
    return cachedMasterList
  }

  const list: MasterFaskesInfo[] = []
  const cwd = process.cwd()

  // 1. Priority 1: User manual mapping CSV ('Data Faskes NTT LENGKAP - Sheet2.csv')
  const userMappedPaths = [
    path.join(cwd, 'data', 'Data Faskes NTT LENGKAP - Sheet2.csv'),
    path.join(cwd, '..', 'dashboard-utama', 'data', 'Data Faskes NTT LENGKAP - Sheet2.csv'),
    path.join(cwd, 'public', 'data', 'Data Faskes NTT LENGKAP - Sheet2.csv'),
  ]

  let userMappedLoaded = false
  for (const p of userMappedPaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8')
        const parsed = Papa.parse<string[]>(content, { header: false, skipEmptyLines: true })
        parsed.data.forEach((r) => {
          if (!r || r.length < 5) return
          const coords = cleanNttCoordinates(r[13], r[14])
          const item: MasterFaskesInfo = {
            id: String(r[0] || '').trim(),
            jenis_faskes: String(r[1] || '').trim(),
            kode_sarana: String(r[2] || '').trim(),
            kode_satusehat: String(r[3] || '').trim(),
            nama_master: String(r[4] || '').trim(),
            subjenis: String(r[5] || '').trim(),
            alamat: String(r[6] || '').trim(),
            kode_prop: String(r[7] || '53').trim(),
            nama_prop: String(r[8] || 'Nusa Tenggara Timur').trim(),
            kode_kab: String(r[9] || '').trim(),
            nama_kab: String(r[10] || '').trim(),
            kode_kecamatan: String(r[11] || '').trim(),
            nama_kecamatan: String(r[12] || '').trim(),
            latitude: coords.lat,
            longitude: coords.lng,
            telp: String(r[15] || '').trim(),
            email: String(r[16] || '').trim(),
            website: String(r[17] || '').trim(),
            operasional: String(r[18] || 'Operasional').trim(),
            status_aktif: String(r[19] || 'Aktif').trim(),
            alias_collector: String(r[20] || r[4] || '').trim(),
          }
          list.push(item)
        })
        userMappedLoaded = true
        break
      } catch (err) {
        console.warn('[nttFaskesMasterMapper] Error parsing user mapped CSV:', err)
      }
    }
  }

  // 2. Priority 2: Supplementary Complete Master Dataset (1,818 faskes se-NTT)
  const completeMasterPaths = [
    path.join(cwd, 'public', 'data', 'export_faskes_ntt', 'master_data_faskes_ntt_lengkap.csv'),
    path.join(cwd, '..', 'export_faskes_ntt', 'master_data_faskes_ntt_lengkap.csv'),
  ]

  for (const p of completeMasterPaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8')
        const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true, delimiter: ';' })
        parsed.data.forEach((r) => {
          if (!r || !r['Nama Fasilitas Kesehatan']) return
          const kodeSarana = String(r['Kode Sarana / Faskes'] || '').trim()
          const exists = list.some((it) => it.kode_sarana === kodeSarana || it.nama_master.toLowerCase() === String(r['Nama Fasilitas Kesehatan']).toLowerCase())
          if (!exists) {
            const coords = cleanNttCoordinates(r['Latitude'], r['Longitude'])
            list.push({
              id: String(r['No'] || '').trim(),
              jenis_faskes: String(r['Jenis Faskes'] || '').trim(),
              kode_sarana: kodeSarana,
              kode_satusehat: String(r['Kode SatuSehat Kemenkes'] || '').trim(),
              nama_master: String(r['Nama Fasilitas Kesehatan'] || '').trim(),
              subjenis: String(r['Kategori / Subjenis'] || '').trim(),
              alamat: String(r['Alamat Lengkap'] || '').trim(),
              kode_prop: String(r['Kode Provinsi'] || '53').trim(),
              nama_prop: String(r['Nama Provinsi'] || 'Nusa Tenggara Timur').trim(),
              kode_kab: String(r['Kode Kab/Kota'] || '').trim(),
              nama_kab: String(r['Nama Kab/Kota'] || '').trim(),
              kode_kecamatan: String(r['Kode Kecamatan'] || '').trim(),
              nama_kecamatan: String(r['Nama Kecamatan'] || '').trim(),
              latitude: coords.lat,
              longitude: coords.lng,
              telp: String(r['No Telepon'] || '').trim(),
              email: String(r['Email'] || '').trim(),
              website: String(r['Website'] || '').trim(),
              operasional: String(r['Status Operasional'] || 'Operasional').trim(),
              status_aktif: String(r['Status Aktif'] || 'Aktif').trim(),
              alias_collector: String(r['Nama Fasilitas Kesehatan'] || '').trim(),
            })
          }
        })
        break
      } catch (err) {
        console.warn('[nttFaskesMasterMapper] Error parsing complete master CSV:', err)
      }
    }
  }

  cachedMasterList = list
  return list
}

/**
 * Match a collector faskes name or row against the master dataset.
 */
export function findMasterFaskes(queryName: string, queryKab?: string, kodeSarana?: string): MasterFaskesInfo | null {
  const masterList = getNttMasterFaskesList()
  if (!masterList || masterList.length === 0) return null

  // 1. Match by Kode Sarana if provided
  if (kodeSarana && kodeSarana.trim() !== '') {
    const found = masterList.find((m) => m.kode_sarana === kodeSarana.trim())
    if (found) return found
  }

  if (!queryName || queryName.trim() === '') return null
  const cleanQ = cleanLookupName(queryName)
  const cleanKab = queryKab ? cleanLookupName(queryKab) : ''

  // 2. Exact match on alias_collector
  let match = masterList.find((m) => cleanLookupName(m.alias_collector) === cleanQ)
  if (match) return match

  // 3. Exact match on nama_master
  match = masterList.find((m) => cleanLookupName(m.nama_master) === cleanQ)
  if (match) return match

  // 4. Match with Kabupaten filter if available
  if (cleanKab) {
    match = masterList.find((m) => {
      const mKab = cleanLookupName(m.nama_kab)
      if (!mKab.includes(cleanKab) && !cleanKab.includes(mKab)) return false
      const mAlias = cleanLookupName(m.alias_collector)
      const mMaster = cleanLookupName(m.nama_master)
      return (
        mAlias.includes(cleanQ) ||
        cleanQ.includes(mAlias) ||
        mMaster.includes(cleanQ) ||
        cleanQ.includes(mMaster)
      )
    })
    if (match) return match
  }

  // 5. Fuzzy Substring match
  if (cleanQ.length >= 3) {
    match = masterList.find((m) => {
      const mAlias = cleanLookupName(m.alias_collector)
      const mMaster = cleanLookupName(m.nama_master)
      return (
        mAlias.includes(cleanQ) ||
        cleanQ.includes(mAlias) ||
        mMaster.includes(cleanQ) ||
        cleanQ.includes(mMaster)
      )
    })
    if (match) return match
  }

  return null
}

/**
 * Enrich a collector faskes row with official master data coordinates, official names, and wilayah codes.
 */
export function enrichNttFaskesRow(row: any, type: 'rs' | 'puskesmas' | 'faskes' = 'faskes'): any {
  if (!row || typeof row !== 'object') return row

  const rawName = String(
    row.nama_rs ||
    row.nama_puskesmas ||
    row.nama_faskes ||
    row.nama_lengkap ||
    row.nama ||
    row.rs ||
    row.puskesmas ||
    ''
  ).trim()

  const rawKab = String(row.kabupaten || row.nama_kab || '').trim()
  const rawKode = String(row.kode_sarana || row.kode || '').trim()

  const master = findMasterFaskes(rawName, rawKab, rawKode)

  const out = { ...row }

  if (master) {
    out.master_matched = true
    out.id_master = master.id
    out.kode_sarana = master.kode_sarana
    out.kode_satusehat = master.kode_satusehat
    out.nama_master = master.nama_master
    out.nama_resmi = master.nama_master
    out.nama_faskes = rawName ? rawName : master.nama_master
    out.subjenis = master.subjenis
    out.alamat = master.alamat
    out.kode_prop = master.kode_prop
    out.nama_prop = master.nama_prop
    out.kode_kab = master.kode_kab
    out.nama_kab = master.nama_kab
    out.kabupaten = master.nama_kab || out.kabupaten
    out.kode_kecamatan = master.kode_kecamatan
    out.nama_kecamatan = master.nama_kecamatan
    out.kecamatan = master.nama_kecamatan || out.kecamatan
    // Ensure accurate master coordinates
    out.latitude = master.latitude !== null ? master.latitude : out.latitude
    out.longitude = master.longitude !== null ? master.longitude : out.longitude
    out.lat = out.latitude
    out.lng = out.longitude
    out.telp = master.telp || out.telp
    out.email = master.email || out.email
    out.website = master.website || out.website
    out.status_operasional = master.operasional || out.status_operasional || 'Operasional'
    out.status_aktif = master.status_aktif || out.status_aktif || 'Aktif'
  }

  return out
}

/**
 * Batch enrich an array of collector rows and deduplicate by unique facility identity.
 */
export function enrichNttFaskesTable(rows: any[], type: 'rs' | 'puskesmas' | 'faskes' = 'faskes'): any[] {
  if (!Array.isArray(rows)) return []
  const enriched = rows.map((r) => enrichNttFaskesRow(r, type))

  // Deduplicate by unique faskes identity (latest entry wins if multiple dates exist)
  const uniqueMap = new Map<string, any>()
  enriched.forEach((item) => {
    const key = (
      item.kode_sarana && item.kode_sarana !== '-'
        ? `sarana_${item.kode_sarana}`
        : item.id_master
        ? `master_${item.id_master}`
        : cleanLookupName(item.nama_master || item.nama_rs || item.nama_puskesmas || item.nama || '')
    )
    if (key) {
      uniqueMap.set(key, item)
    }
  })

  return Array.from(uniqueMap.values())
}

/**
 * Returns the entire Master Data Faskes NTT (1,818+ RS, Puskesmas, Klinik, Pustu se-NTT)
 * overlaid with active patient situation & triage from Collector data.
 */
export function getAllNttMasterFaskesWithCollectorOverlay(
  collectorPasienRs: any[] = [],
  collectorPasienPkm: any[] = []
): any[] {
  const masterList = getNttMasterFaskesList()
  if (!masterList || masterList.length === 0) return []

  // Build lookup index from collector RS & PKM
  const collectorMap = new Map<string, any>()
  const matchedCollectorKeys = new Set<string>()

  const registerCollectorItem = (item: any, defaultJenis: string, itemIdx: number) => {
    if (!item) return
    const rawName = String(
      item.nama_rs ||
      item.nama_puskesmas ||
      item.nama_faskes ||
      item.nama ||
      ''
    ).trim()
    const rawKab = String(item.kabupaten || item.nama_kab || '').trim()
    const rawKode = String(item.kode_sarana || item.kode || '').trim()
    const itemKey = `${defaultJenis}_${itemIdx}_${rawName}_${rawKab}`

    // Enrich with master match first
    const matchedMaster = findMasterFaskes(rawName, rawKab, rawKode)

    const dataObj = {
      itemKey,
      rawItem: item,
      defaultJenis,
      has_collector_data: true,
      triase_merah: Number(item.triase_merah || item.merah || 0),
      triase_kuning: Number(item.triase_kuning || item.kuning || 0),
      triase_hijau: Number(item.triase_hijau || item.hijau || 0),
      triase_hitam: Number(item.triase_hitam || item.hitam || 0),
      total_pasien: Number(item.total || item.total_pasien || 0),
      kapasitas_tersedia: item.kapasitas_tersedia || '-',
      stok_darah: item.stok_darah || '-',
      listrik: item.listrik || 'PLN / Genset Siaga',
      pj_medis: item.pj_medis || '-',
      catatan_medis: item.catatan || item.catatan_khusus || '',
      status_bencana: 'Merawat Pasien Bencana (Terdata Collector)',
      kondisi_bangunan: item.kondisi_bangunan || 'Normal / Siaga',
    }

    if (rawKode && rawKode !== '-') {
      collectorMap.set(`code_${rawKode}`, dataObj)
    }
    if (rawName) {
      collectorMap.set(`name_${cleanLookupName(rawName)}`, dataObj)
      if (rawKab) {
        collectorMap.set(`kab_${cleanLookupName(rawKab)}_${cleanLookupName(rawName)}`, dataObj)
      }
    }
    if (matchedMaster) {
      if (matchedMaster.id) collectorMap.set(`id_${matchedMaster.id}`, dataObj)
      if (matchedMaster.kode_sarana && matchedMaster.kode_sarana !== '-') collectorMap.set(`code_${matchedMaster.kode_sarana}`, dataObj)
      if (matchedMaster.nama_master) {
        collectorMap.set(`master_${matchedMaster.nama_master.toLowerCase()}`, dataObj)
        collectorMap.set(`name_${cleanLookupName(matchedMaster.nama_master)}`, dataObj)
      }
      if (matchedMaster.alias_collector) collectorMap.set(`name_${cleanLookupName(matchedMaster.alias_collector)}`, dataObj)
    }
  }

  if (Array.isArray(collectorPasienRs)) {
    collectorPasienRs.forEach((r, idx) => registerCollectorItem(r, 'Rumah Sakit', idx))
  }
  if (Array.isArray(collectorPasienPkm)) {
    collectorPasienPkm.forEach((p, idx) => registerCollectorItem(p, 'Puskesmas', idx))
  }

  const result: any[] = masterList.map((m, idx) => {
    // Find matching collector situation
    let coll = (
      (m.id && collectorMap.get(`id_${m.id}`)) ||
      (m.kode_sarana && m.kode_sarana !== '-' && collectorMap.get(`code_${m.kode_sarana}`)) ||
      (m.nama_kab && collectorMap.get(`kab_${cleanLookupName(m.nama_kab)}_${cleanLookupName(m.nama_master)}`)) ||
      collectorMap.get(`master_${m.nama_master.toLowerCase()}`) ||
      collectorMap.get(`name_${cleanLookupName(m.nama_master)}`) ||
      collectorMap.get(`name_${cleanLookupName(m.alias_collector)}`)
    )

    if (coll?.itemKey) {
      matchedCollectorKeys.add(coll.itemKey)
    }

    const prefix = m.jenis_faskes === 'Rumah Sakit' ? 'rs' : m.jenis_faskes === 'Puskesmas' ? 'pkm' : m.jenis_faskes === 'Klinik' ? 'klinik' : 'pustu'
    const id = m.id ? `${prefix}-${m.id}` : `${prefix}-${idx + 1}`

    const hasCollector = Boolean(coll)
    const triaseMerah = coll ? coll.triase_merah : 0
    const triaseKuning = coll ? coll.triase_kuning : 0
    const triaseHijau = coll ? coll.triase_hijau : 0
    const triaseHitam = coll ? coll.triase_hitam : 0
    const totalPasien = coll ? coll.total_pasien : 0

    return {
      id,
      nama: m.nama_master,
      nama_faskes: m.nama_master,
      nama_master: m.nama_master,
      kode_sarana: m.kode_sarana || '-',
      kode_satusehat: m.kode_satusehat || '-',
      jenis: m.jenis_faskes,
      jenis_faskes: m.jenis_faskes,
      subjenis: m.subjenis || m.jenis_faskes,
      alamat: m.alamat || '-',
      kode_prop: m.kode_prop || '53',
      nama_prop: m.nama_prop || 'Nusa Tenggara Timur',
      kode_kab: m.kode_kab || '',
      nama_kab: m.nama_kab || '',
      kabupaten: m.nama_kab || '',
      kode_kecamatan: m.kode_kecamatan || '',
      nama_kecamatan: m.nama_kecamatan || '',
      kecamatan: m.nama_kecamatan || '-',
      latitude: m.latitude,
      longitude: m.longitude,
      lat: m.latitude,
      lng: m.longitude,
      telp: m.telp || '-',
      email: m.email || '-',
      website: m.website || '-',
      status: m.operasional || 'Operasional',
      status_operasional: m.operasional || 'Operasional',
      status_aktif: m.status_aktif || 'Aktif',
      kondisi_bangunan: coll?.kondisi_bangunan || 'Normal / Siaga',
      
      // Patient Situation Attributes (Overlay from Collector)
      has_collector_data: hasCollector,
      status_bencana: hasCollector ? coll.status_bencana : 'Siaga Bencana (Standby)',
      triase_merah: triaseMerah,
      triase_kuning: triaseKuning,
      triase_hijau: triaseHijau,
      triase_hitam: triaseHitam,
      total_pasien: totalPasien || (triaseMerah + triaseKuning + triaseHijau + triaseHitam),
      kapasitas_tersedia: coll?.kapasitas_tersedia || '-',
      stok_darah: coll?.stok_darah || '-',
      listrik: coll?.listrik || 'PLN / Genset Siaga',
      pj_medis: coll?.pj_medis || '-',
      catatan_medis: coll?.catatan_medis || '',
    }
  })

  // Append any collector items that did not match master so no reported faskes is ever omitted
  const allCollectorItems = [
    ...(Array.isArray(collectorPasienRs) ? collectorPasienRs.map((r, idx) => ({ item: r, type: 'Rumah Sakit', key: `Rumah Sakit_${idx}_${r.nama_rs || r.nama || ''}_${r.kabupaten || ''}` })) : []),
    ...(Array.isArray(collectorPasienPkm) ? collectorPasienPkm.map((p, idx) => ({ item: p, type: 'Puskesmas', key: `Puskesmas_${idx}_${p.nama_puskesmas || p.nama || ''}_${p.kabupaten || ''}` })) : []),
  ]

  allCollectorItems.forEach(({ item, type, key }, cIdx) => {
    if (!matchedCollectorKeys.has(key)) {
      const rawName = String(item.nama_rs || item.nama_puskesmas || item.nama_faskes || item.nama || `${type} Siaga`).trim()
      const rawKab = String(item.kabupaten || item.nama_kab || '').trim()
      const rawKec = String(item.kecamatan || item.nama_kecamatan || '-').trim()
      const rawKode = String(item.kode_sarana || item.kode || '-').trim()
      const coords = cleanNttCoordinates(item.latitude, item.longitude)

      const m = Number(item.triase_merah || item.merah || 0)
      const k = Number(item.triase_kuning || item.kuning || 0)
      const h = Number(item.triase_hijau || item.hijau || 0)
      const d = Number(item.triase_hitam || item.hitam || 0)
      const tot = Number(item.total || item.total_pasien || 0) || (m + k + h + d)

      result.push({
        id: `coll-${type === 'Rumah Sakit' ? 'rs' : 'pkm'}-${cIdx + 1}`,
        nama: rawName,
        nama_faskes: rawName,
        nama_master: rawName,
        kode_sarana: rawKode,
        kode_satusehat: item.kode_satusehat || '-',
        jenis: type,
        jenis_faskes: type,
        subjenis: type,
        alamat: item.alamat || '-',
        kode_prop: '53',
        nama_prop: 'Nusa Tenggara Timur',
        kode_kab: '',
        nama_kab: rawKab,
        kabupaten: rawKab,
        kode_kecamatan: '',
        nama_kecamatan: rawKec,
        kecamatan: rawKec,
        latitude: coords.lat,
        longitude: coords.lng,
        lat: coords.lat,
        lng: coords.lng,
        telp: item.telp || '-',
        email: item.email || '-',
        website: '-',
        status: item.status || 'Beroperasi',
        status_operasional: item.status || 'Beroperasi',
        status_aktif: 'Aktif',
        kondisi_bangunan: item.kondisi_bangunan || 'Normal / Siaga',
        has_collector_data: true,
        status_bencana: 'Merawat Pasien Bencana (Terdata Collector)',
        triase_merah: m,
        triase_kuning: k,
        triase_hijau: h,
        triase_hitam: d,
        total_pasien: tot,
        kapasitas_tersedia: item.kapasitas_tersedia || '-',
        stok_darah: item.stok_darah || '-',
        listrik: item.listrik || 'PLN / Genset Siaga',
        pj_medis: item.pj_medis || '-',
        catatan_medis: item.catatan || '',
      })
    }
  })

  return result
}

/**
 * Generates aggregated summary of all Master Data Faskes in NTT.
 */
export function getNttMasterFaskesSummary(masterWithOverlay: any[]): {
  total: number
  rs_count: number
  puskesmas_count: number
  klinik_count: number
  pustu_count: number
  total_merawat_pasien: number
  total_pasien_terlayani: number
  rekap_per_kabupaten: Record<string, {
    nama_kab: string
    rs: number
    puskesmas: number
    klinik: number
    pustu: number
    total: number
    total_pasien: number
  }>
} {
  const list = masterWithOverlay || []
  let rsCount = 0
  let pkmCount = 0
  let klinikCount = 0
  let pustuCount = 0
  let totalMerawat = 0
  let totalPasien = 0
  const rekapKab: Record<string, any> = {}

  list.forEach((f) => {
    const j = String(f.jenis_faskes || '').toLowerCase()
    if (j.includes('rumah sakit') || j.includes('rs')) {
      rsCount++
    } else if (j.includes('puskesmas pembantu') || j.includes('pustu')) {
      pustuCount++
    } else if (j.includes('puskesmas') || j.includes('pkm')) {
      pkmCount++
    } else if (j.includes('klinik')) {
      klinikCount++
    } else {
      pustuCount++
    }

    if (f.has_collector_data || f.total_pasien > 0) {
      totalMerawat++
      totalPasien += Number(f.total_pasien || 0)
    }

    const kab = f.nama_kab || 'Kabupaten Lainnya'
    if (!rekapKab[kab]) {
      rekapKab[kab] = {
        nama_kab: kab,
        rs: 0,
        puskesmas: 0,
        klinik: 0,
        pustu: 0,
        total: 0,
        total_pasien: 0,
      }
    }

    if (j.includes('rumah sakit') || j.includes('rs')) rekapKab[kab].rs++
    else if (j.includes('puskesmas pembantu') || j.includes('pustu')) rekapKab[kab].pustu++
    else if (j.includes('puskesmas') || j.includes('pkm')) rekapKab[kab].puskesmas++
    else if (j.includes('klinik')) rekapKab[kab].klinik++
    else rekapKab[kab].pustu++

    rekapKab[kab].total++
    rekapKab[kab].total_pasien += Number(f.total_pasien || 0)
  })

  return {
    total: list.length,
    rs_count: rsCount,
    puskesmas_count: pkmCount,
    klinik_count: klinikCount,
    pustu_count: pustuCount,
    total_merawat_pasien: totalMerawat,
    total_pasien_terlayani: totalPasien,
    rekap_per_kabupaten: rekapKab,
  }
}

