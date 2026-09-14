'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import TvTopHud from './TvTopHud'
import TvKpiCards from './TvKpiCards'
import TvDisasterFeedDeck from './TvDisasterFeedDeck'
import TvAnalyticsDeck from './TvAnalyticsDeck'
import TvLayerServicesDrawer, { TvLayerState } from './TvLayerServicesDrawer'
import TvPeringatanDiniDrawer from './TvPeringatanDiniDrawer'
import TvBottomTicker from './TvBottomTicker'
import TvSpotlightCard, { SpotlightItem, RouteInfo } from './TvSpotlightCard'
import type { TvMapEngineRef, MarkerData, FaskesItem, PoskoItem, EarthquakePoint } from './TvMapEngine'

// Dynamically import TvMapEngine to prevent SSR issues
const TvMapEngine = dynamic(() => import('./TvMapEngine'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#fbffff]">
      <div className="text-center space-y-4">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#047D78]" />
        <p className="text-sm font-black tracking-widest text-[#047D78] uppercase">
          Memuat Sistem Video Wall Command Center EOC...
        </p>
      </div>
    </div>
  ),
})

const DEFAULT_LAYERS: TvLayerState = {
  baseMap: 'osm',
  bnpbBanjir: false,
  bnpbGempa: true,
  bnpbLongsor: false,
  bnpbKarhutla: false,
  bnpbHillshade: false,
  bnpbKepadatan: false,
  bnpbAdmin: true,
  showWindy: false,
  showFaskes: true,
  showPosko: false,
  showTck: false,
  showChoropleth: true,
  showMarkers: true,
  faskesRs: true,
  faskesPuskesmas: true,
  faskesKlinik: true,
  faskesPustu: true,
  faskesSiagaOnly: true,
  impactRadiusKm: 1,
}

const REFRESH_INTERVAL_SECONDS = 60
const PROVINCE_CYCLE_SECONDS = 30

const NTT_KAB_COORDS: Record<string, { lat: number; lng: number; kecamatan?: string }> = {
  'manggarai timur': { lat: -8.8033, lng: 120.5982, kecamatan: 'Borong, Lamba Leda, Kota Komba' },
  'manggarai': { lat: -8.6148, lng: 120.4632, kecamatan: 'Ruteng, Reok, Cibal' },
  'ende': { lat: -8.8415, lng: 121.6582, kecamatan: 'Ende, Ndona, Nangapanda' },
  'sikka': { lat: -8.6214, lng: 122.2155, kecamatan: 'Maumere, Alok, Nita' },
  'ngada': { lat: -8.7891, lng: 120.9664, kecamatan: 'Bajawa, Golewa, Aimere' },
  'nagekeo': { lat: -8.6752, lng: 121.2891, kecamatan: 'Aesesa, Mauponggo, Boawae' },
  'manggarai barat': { lat: -8.5142, lng: 119.8924, kecamatan: 'Komodo, Lembor, Kuwus' },
  'flores timur': { lat: -8.3421, lng: 122.9814, kecamatan: 'Larantuka, Tanjung Bunga, Ile Mandiri, Adonara' },
}

const formatYmd = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface TvDashboardContainerProps {
  scopeProvinsi?: string
  scopeEventId?: string
}

export default function TvDashboardContainer({ scopeProvinsi, scopeEventId }: TvDashboardContainerProps = {}) {
  const mapEngineRef = useRef<TvMapEngineRef | null>(null)

  const isNttScope = useMemo(() => {
    if (!scopeProvinsi) return false
    const clean = scopeProvinsi.toUpperCase()
    return clean.includes('NUSA TENGGARA TIMUR') || clean.includes('NTT') || clean.includes('FLORES')
  }, [scopeProvinsi])

  const initialCenter: [number, number] | undefined = isNttScope ? [121.8, -8.55] : undefined
  const initialZoom: number | undefined = isNttScope ? 8.5 : undefined

  // ── States ──
  const [isLoading, setIsLoading] = useState(true)
  const [isApiDisconnected, setIsApiDisconnected] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [layers, setLayers] = useState<TvLayerState>(DEFAULT_LAYERS)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_INTERVAL_SECONDS)
  const [autoProvinceTour, setAutoProvinceTour] = useState(!isNttScope)
  const [currentTourProvince, setCurrentTourProvince] = useState<string | null>(isNttScope ? 'NUSA TENGGARA TIMUR' : null)
  const [isKpiCollapsed, setIsKpiCollapsed] = useState(false)
  const tourIndexRef = useRef(0)

  // Data States
  const [summary, setSummary] = useState({
    total_bencana: 0,
    total_krisis: 0,
    total_meninggal: 0,
    total_luka: 0,
    total_hilang: 0,
    total_pengungsi: 0,
    total_terdampak: 0,
  })
  const [markers, setMarkers] = useState<MarkerData[]>([])
  const [jenisBencanaList, setJenisBencanaList] = useState<any[]>([])
  const [wilayahList, setWilayahList] = useState<any[]>([])
  const [penyakitList, setPenyakitList] = useState<any[]>([])
  const [faskesList, setFaskesList] = useState<FaskesItem[]>([])
  const [poskoList, setPoskoList] = useState<PoskoItem[]>([])
  const [earthquakePoints, setEarthquakePoints] = useState<EarthquakePoint[]>([])
  const [kabupatenDetailList, setKabupatenDetailList] = useState<any[]>([])
  const [bmkgData, setBmkgData] = useState<{ autogempa?: any; gempaterkini?: any[]; gempadirasakan?: any[] } | null>(null)
  const [peringatanDiniList, setPeringatanDiniList] = useState<any[]>([])

  // Dynamic API Analytics & Timeline Datasets
  const [timelineSituasiKesehatan, setTimelineSituasiKesehatan] = useState<any[]>([])
  const [timelinePasienRs, setTimelinePasienRs] = useState<any[]>([])
  const [timelinePasienPkm, setTimelinePasienPkm] = useState<any[]>([])
  const [faskesTerdampakList, setFaskesTerdampakList] = useState<any[]>([])
  const [summaryFaskesTerdampak, setSummaryFaskesTerdampak] = useState<any>(null)
  const [surveilansPenyakitList, setSurveilansPenyakitList] = useState<any[]>([])
  const [weatherList, setWeatherList] = useState<any[]>([])
  const [weatherSummary, setWeatherSummary] = useState<any>(null)

  // Faskes Real API Counts for Layer Services Drawer
  const faskesCounts = useMemo(() => {
    const list = Array.isArray(faskesList) ? faskesList : []
    let rs = 0
    let puskesmas = 0
    let klinik = 0
    let pustu = 0
    let siaga = 0

    list.forEach((f) => {
      const nameLower = (f.nama_rs || f.nama_faskes || f.nama || '').toLowerCase()
      const jenisLower = (f.jenis_faskes || f.jenis || f.jenis_sarana || '').toLowerCase()

      const isRS = jenisLower.includes('rs') || jenisLower.includes('rumah sakit') || nameLower.includes('rsud') || nameLower.includes('rumah sakit') || nameLower.startsWith('rs ')
      const isPuskesmas = jenisLower.includes('puskesmas') || nameLower.includes('puskesmas') || nameLower.includes('pkm')
      const isKlinik = jenisLower.includes('klinik') || nameLower.includes('klinik')
      const isPustu = jenisLower.includes('pustu') || jenisLower.includes('pembantu') || nameLower.includes('pustu')

      if (isRS) rs++
      else if (isPuskesmas) puskesmas++
      else if (isKlinik) klinik++
      else if (isPustu) pustu++
      else puskesmas++

      const totalPatients = (f.triase_merah || 0) + (f.triase_kuning || 0) + (f.triase_hijau || 0) + (f.triase_hitam || 0) + (f.total || 0) + (f.total_pasien || 0)
      if (totalPatients > 0) siaga++
    })

    return { rs, puskesmas, klinik, pustu, siaga }
  }, [faskesList])

  const handleBatchUpdateFaskes = (allOn: boolean) => {
    setLayers((prev) => ({
      ...prev,
      faskesRs: allOn,
      faskesPuskesmas: allOn,
      faskesKlinik: allOn,
      faskesPustu: allOn,
    }))
  }

  // Active Spotlight & Tactical Routing State
  const [spotlightItem, setSpotlightItem] = useState<SpotlightItem | null>(null)
  const [routeCoords, setRouteCoords] = useState<number[][]>([])
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)

  // ── Tactical Route Generator (OSRM Routing API) ──
  const handleStartRoute = async (target: SpotlightItem) => {
    if (!target.lat || !target.lng) return

    // Dynamic Origin: Mainshock epicenter from API or first active marker
    const mainshock = earthquakePoints.find((eq) => eq.isMainshock) || earthquakePoints[0]
    const startLat = mainshock?.lat || -8.6
    const startLng = mainshock?.lng || 121.5
    const endLat = target.lat
    const endLng = target.lng

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
      const res = await fetch(url)
      const json = await res.json()

      if (json.code === 'Ok' && json.routes && json.routes.length > 0) {
        const route = json.routes[0]
        setRouteCoords(route.geometry.coordinates)
        setRouteInfo({
          distance: route.distance / 1000, // km
          duration: route.duration / 60,   // minutes
          targetName: target.nama_rs || target.nama_pos || target.nama || 'Tujuan Rute',
          targetType: target.type || 'faskes',
        })
      } else {
        // Fallback straight line
        setRouteCoords([[startLng, startLat], [endLng, endLat]])
        const dLat = (endLat - startLat) * 111
        const dLng = (endLng - startLng) * 111 * Math.cos((startLat * Math.PI) / 180)
        const dist = Math.sqrt(dLat * dLat + dLng * dLng)
        setRouteInfo({
          distance: dist,
          duration: (dist / 40) * 60,
          targetName: target.nama_rs || target.nama_pos || target.nama || 'Tujuan Rute',
          targetType: target.type || 'faskes',
        })
      }

      // Fly to target
      mapEngineRef.current?.flyTo(endLng, endLat, 10.5)
    } catch (e) {
      console.warn('[TV Route] Fallback straight line route:', e)
      setRouteCoords([[startLng, startLat], [endLng, endLat]])
      setRouteInfo({
        distance: 65,
        duration: 90,
        targetName: target.nama_rs || target.nama_pos || target.nama || 'Tujuan Rute',
        targetType: target.type || 'faskes',
      })
    }
  }

  const handleClearRoute = () => {
    setRouteCoords([])
    setRouteInfo(null)
  }

  // ── Data Fetching ──
  const fetchData = useCallback(async () => {
    try {
      const now = new Date()
      const past30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const startDate = formatYmd(past30Days)
      const endDate = formatYmd(now)

      if (isNttScope) {
        // 1. Fetch direct from official Collector API (/api/ntt-data & /dashboard-eoc/api/ntt-data)
        let nttData: any = null
        let nttFullJson: any = null
        try {
          const nttRes = await fetch('/api/ntt-data', { cache: 'no-store' })
          if (nttRes.ok) {
            const nttJson = await nttRes.json()
            if (nttJson.success) {
              nttFullJson = nttJson
              nttData = nttJson.tables || nttJson.data
            }
          }
        } catch {
          // fallback to next endpoint
        }

        if (!nttData || (!nttData.pasien_rs && !nttData.situasi_kesehatan)) {
          try {
            const nttRes2 = await fetch('/dashboard-eoc/api/ntt-data', { cache: 'no-store' })
            if (nttRes2.ok) {
              const nttJson2 = await nttRes2.json()
              if (nttJson2.success) {
                nttFullJson = nttJson2
                nttData = nttJson2.tables || nttJson2.data
              }
            }
          } catch (err2) {
            console.warn('[TV NTT] Failed to fetch /dashboard-eoc/api/ntt-data:', err2)
          }
        }

        // Secondary fallback with explicit active date parameter if main fetch returns empty
        if (!nttData || (!nttData.pasien_rs && !nttData.situasi_kesehatan)) {
          try {
            const nttRes3 = await fetch('/dashboard-eoc/api/ntt-data', { cache: 'no-store' })
            if (nttRes3.ok) {
              const nttJson3 = await nttRes3.json()
              if (nttJson3.success) {
                nttFullJson = nttJson3
                nttData = nttJson3.tables || nttJson3.data
              }
            }
          } catch (err3) {
            console.warn('[TV NTT] Failed fallback fetch with tanggal:', err3)
          }
        }

        setIsApiDisconnected(!nttData)

        // Extract Timeline, Faskes Terdampak, Triase & SKDR datasets
        if (nttFullJson) {
          if (Array.isArray(nttFullJson.timeline_situasi_kesehatan)) {
            setTimelineSituasiKesehatan(nttFullJson.timeline_situasi_kesehatan)
          }
          if (Array.isArray(nttFullJson.timeline_pasien_rs)) {
            setTimelinePasienRs(nttFullJson.timeline_pasien_rs)
          }
          if (Array.isArray(nttFullJson.timeline_pasien_puskesmas)) {
            setTimelinePasienPkm(nttFullJson.timeline_pasien_puskesmas)
          }
          if (Array.isArray(nttFullJson.faskes_terdampak) || Array.isArray(nttFullJson.tables?.faskes_terdampak)) {
            setFaskesTerdampakList(nttFullJson.faskes_terdampak || nttFullJson.tables?.faskes_terdampak || [])
          }
          if (nttFullJson.summary_faskes_terdampak) {
            setSummaryFaskesTerdampak(nttFullJson.summary_faskes_terdampak)
          }
          if (Array.isArray(nttFullJson.tables?.surveilans_penyakit)) {
            setSurveilansPenyakitList(nttFullJson.tables.surveilans_penyakit)
          }
        }

        // Fetch Live NTT Weather for 8 Kabupatens + Kupang
        try {
          const weatherRes = await fetch('/api/weather-ntt', { cache: 'no-store' })
          if (weatherRes.ok) {
            const wJson = await weatherRes.json()
            if (wJson.success && Array.isArray(wJson.data)) {
              setWeatherList(wJson.data)
              setWeatherSummary(wJson.summary)
            }
          }
        } catch (weaErr) {
          console.warn('[TV NTT] Weather fetch error:', weaErr)
        }

        // Fetch live BMKG earthquake parameter for NTT epicenter
        try {
          const bmkgRes = await fetch('/api/bmkg-gempa', { cache: 'no-store' })
          if (bmkgRes.ok) {
            const bmkgJson = await bmkgRes.json()
            if (bmkgJson.success && bmkgJson.data) {
              setBmkgData(bmkgJson.data)
            }
          }
        } catch (e) {
          console.warn('[TV NTT] BMKG fetch warning:', e)
        }

        const situasiList = Array.isArray(nttData?.situasi_kesehatan) ? nttData.situasi_kesehatan : []
        let sumMeninggal = 0
        let sumLukaBerat = 0
        let sumLukaRingan = 0
        let sumLuka = 0
        let sumHilang = 0
        let sumPengungsi = 0
        let sumTerdampak = 0

        const dynamicWilayahList: any[] = []

        if (situasiList.length > 0) {
          situasiList.forEach((s: any) => {
            const m = Number(s.meninggal || s.korban_meninggal || 0)
            const lb = Number(s.luka_berat || s.korban_luka_berat || 0)
            const lr = Number(s.luka_ringan || s.korban_luka_ringan || 0)
            const lk = lb + lr
            const p = Number(s.pengungsi || s.jumlah_pengungsi || 0)
            const ter = Number(s.populasi_terdampak || s.penduduk_terdampak || 0)
            const h = Number(s.hilang || s.korban_hilang || 0)

            sumMeninggal += m
            sumLukaBerat += lb
            sumLukaRingan += lr
            sumLuka += lk
            sumHilang += h
            sumPengungsi += p
            sumTerdampak += ter

            dynamicWilayahList.push({
              provinsi: s.kabupaten,
              count: lk || p || 1,
              total_korban: lk + m,
              meninggal: m,
              luka: lk,
              luka_berat: lb,
              luka_ringan: lr,
              pengungsi: p,
              terdampak: ter,
            })
          })
        }

        // ── 2. SEBARAN TITIK KEJADIAN BENCANA (100% Dynamic from API Collector) ──
        const ntt8KabMarkers: MarkerData[] = situasiList.map((s: any, idx: number) => {
          const kabName = String(s.kabupaten || '').trim()
          const kabKey = kabName.toLowerCase()
          const geo = NTT_KAB_COORDS[kabKey] || {
            lat: Number(s.latitude || s.lat || -8.6),
            lng: Number(s.longitude || s.lng || 121.5),
            kecamatan: String(s.kecamatan || '-'),
          }

          const meninggal = Number(s.meninggal || s.korban_meninggal || 0)
          const lb = Number(s.luka_berat || s.korban_luka_berat || 0)
          const lr = Number(s.luka_ringan || s.korban_luka_ringan || 0)
          const luka = lb + lr
          const pengungsi = Number(s.pengungsi || s.jumlah_pengungsi || 0)
          const terdampak = Number(s.populasi_terdampak || s.penduduk_terdampak || 0)
          const titik_posko = Number(s.titik_pengungsian || s.titik_posko || 0)

          return {
            id: `evt-ntt-${kabKey.replace(/\s+/g, '-') || idx}`,
            kode_trans: `EVT-NTT-${(idx + 1).toString().padStart(2, '0')}`,
            nama: `Dampak Gempa - ${kabName}`,
            jenis_bencana: 'Gempa Bumi',
            provinsi: 'NUSA TENGGARA TIMUR',
            kabupaten: kabName,
            kecamatan: geo.kecamatan || s.kecamatan || '-',
            lat: geo.lat,
            lng: geo.lng,
            meninggal,
            luka_berat: lb,
            luka_ringan: lr,
            luka,
            total_korban: meninggal + luka,
            pengungsi,
            terdampak,
            titik_posko,
            tgl_kejadian: s.tgl_kejadian || '2026-08-15 09:18 WITA',
          }
        })

        setSummary({
          total_bencana: situasiList.length > 0 ? situasiList.length : 0,
          total_krisis: situasiList.length > 0 ? 1 : 0,
          total_meninggal: sumMeninggal,
          total_luka: sumLuka,
          total_hilang: sumHilang,
          total_pengungsi: sumPengungsi,
          total_terdampak: sumTerdampak,
        })

        setMarkers(ntt8KabMarkers)
        setWilayahList(dynamicWilayahList)
        setJenisBencanaList(
          situasiList.length > 0
            ? [{ jenis_bencana: 'Gempa Bumi', count: situasiList.length, total_korban: sumMeninggal + sumLuka }]
            : []
        )

        // ── 3. FASKES SIAGA NTT (Strictly from API Master & Collector) ──
        const rawMasterFaskes = Array.isArray(nttData?.master_faskes) ? nttData.master_faskes : []
        const rawPasienRs = Array.isArray(nttData?.pasien_rs) ? nttData.pasien_rs : []
        const rawPasienPkm = Array.isArray(nttData?.pasien_puskesmas) ? nttData.pasien_puskesmas : []

        const parsedFaskes: FaskesItem[] = []
        const seenFaskesKeys = new Set<string>()

        if (rawMasterFaskes.length > 0) {
          rawMasterFaskes.forEach((f: any, idx: number) => {
            const lat = Number(f.latitude ?? f.lat)
            const lng = Number(f.longitude ?? f.lng)
            if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return

            const name = f.nama_master || f.nama_resmi || f.nama_faskes || f.nama_rs || f.nama || ''
            if (!name) return

            const dedupeKey = f.kode_sarana && f.kode_sarana !== '-' ? `f_${f.kode_sarana}` : `f_${name.toLowerCase().trim()}`
            if (seenFaskesKeys.has(dedupeKey)) return
            seenFaskesKeys.add(dedupeKey)

            const tm = Number(f.triase_merah || 0)
            const tk = Number(f.triase_kuning || 0)
            const th = Number(f.triase_hijau || 0)
            const tht = Number(f.triase_hitam || 0)
            const tot = Number(f.total || f.total_pasien || (tm + tk + th + tht))

            parsedFaskes.push({
              id: f.id || `faskes-${idx + 1}`,
              nama_rs: name,
              nama_faskes: name,
              nama: name,
              jenis_faskes: f.jenis_faskes || f.jenis || f.subjenis || 'Rumah Sakit',
              jenis: f.jenis || f.jenis_faskes || 'RS',
              subjenis: f.subjenis || f.jenis_faskes || '',
              kabupaten: f.nama_kab || f.kabupaten || '',
              kecamatan: f.nama_kecamatan || f.kecamatan || '',
              kode_sarana: f.kode_sarana || '-',
              kode_satusehat: f.kode_satusehat || '-',
              triase_merah: tm,
              triase_kuning: tk,
              triase_hijau: th,
              triase_hitam: tht,
              total: tot,
              total_pasien: tot,
              lat,
              lng,
              status: f.status || '',
              igd: f.igd || '',
            })
          })
        } else {
          if (rawPasienRs.length > 0) {
            rawPasienRs.forEach((r: any, idx: number) => {
              const tm = r.triase_merah !== undefined ? Number(r.triase_merah) : 0
              const tk = r.triase_kuning !== undefined ? Number(r.triase_kuning) : 0
              const th = r.triase_hijau !== undefined ? Number(r.triase_hijau) : 0
              const tht = r.triase_hitam !== undefined ? Number(r.triase_hitam) : 0
              const tot = r.total !== undefined ? Number(r.total) : (tm + tk + th + tht)
              const name = r.nama_master || r.nama_resmi || r.nama_rs || r.rs || r.nama || ''
              if (!name) return

              const lat = Number(r.latitude ?? r.lat)
              const lng = Number(r.longitude ?? r.lng)
              if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return

              const dedupeKey = r.kode_sarana && r.kode_sarana !== '-' ? `rs_${r.kode_sarana}` : `rs_${name.toLowerCase().trim()}`
              if (seenFaskesKeys.has(dedupeKey)) return
              seenFaskesKeys.add(dedupeKey)

              parsedFaskes.push({
                id: `rs-${idx + 1}`,
                nama_rs: name,
                nama_faskes: name,
                nama: name,
                jenis_faskes: 'Rumah Sakit',
                jenis: 'RS',
                kabupaten: r.nama_kab || r.kabupaten || '',
                kecamatan: r.nama_kecamatan || r.kecamatan || '',
                kode_sarana: r.kode_sarana || '-',
                kode_satusehat: r.kode_satusehat || '-',
                triase_merah: tm,
                triase_kuning: tk,
                triase_hijau: th,
                triase_hitam: tht,
                total: tot,
                total_pasien: tot,
                lat,
                lng,
                status: r.status || '',
                igd: r.igd || '',
              })
            })
          }

          if (rawPasienPkm.length > 0) {
            rawPasienPkm.forEach((pkm: any, idx: number) => {
              const tm = pkm.triase_merah !== undefined ? Number(pkm.triase_merah) : 0
              const tk = pkm.triase_kuning !== undefined ? Number(pkm.triase_kuning) : 0
              const th = pkm.triase_hijau !== undefined ? Number(pkm.triase_hijau) : 0
              const tht = pkm.triase_hitam !== undefined ? Number(pkm.triase_hitam) : 0
              const tot = pkm.total !== undefined ? Number(pkm.total) : (tm + tk + th + tht)
              const name = pkm.nama_master ? `Puskesmas ${pkm.nama_master}` : (pkm.nama_puskesmas || pkm.puskesmas || pkm.nama || '')
              if (!name) return

              const lat = Number(pkm.latitude ?? pkm.lat)
              const lng = Number(pkm.longitude ?? pkm.lng)
              if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return

              const dedupeKey = pkm.kode_sarana && pkm.kode_sarana !== '-' ? `pkm_${pkm.kode_sarana}` : `pkm_${name.toLowerCase().trim()}`
              if (seenFaskesKeys.has(dedupeKey)) return
              seenFaskesKeys.add(dedupeKey)

              parsedFaskes.push({
                id: `pkm-${idx + 1}`,
                nama_rs: name,
                nama_faskes: name,
                nama: name,
                jenis_faskes: 'Puskesmas',
                jenis: 'Puskesmas',
                kabupaten: pkm.nama_kab || pkm.kabupaten || '',
                kecamatan: pkm.nama_kecamatan || pkm.kecamatan || '',
                kode_sarana: pkm.kode_sarana || '-',
                kode_satusehat: pkm.kode_satusehat || '-',
                triase_merah: tm,
                triase_kuning: tk,
                triase_hijau: th,
                triase_hitam: tht,
                total: tot,
                total_pasien: tot,
                lat,
                lng,
                status: pkm.status || '',
                igd: pkm.igd || '',
              })
            })
          }
        }

        setFaskesList(parsedFaskes)

        // ── 4. KABUPATEN DETAIL DATA (Strictly from API) ──
        const parsedKabDetail = situasiList.length > 0
          ? situasiList.map((s: any) => {
              const lb = Number(s.luka_berat || s.korban_luka_berat || 0)
              const lr = Number(s.luka_ringan || s.korban_luka_ringan || 0)
              return {
                nama: s.kabupaten,
                meninggal: Number(s.meninggal || s.korban_meninggal || 0),
                luka_berat: lb,
                luka_ringan: lr,
                total_luka: lb + lr,
                pengungsi: Number(s.pengungsi || s.jumlah_pengungsi || 0),
                terdampak: Number(s.populasi_terdampak || s.penduduk_terdampak || 0),
                titik_posko: Number(s.titik_posko || s.titik_pengungsian || 0),
                lat: Number(s.latitude || s.lat || 0),
                lng: Number(s.longitude || s.lng || 0),
              }
            })
          : []

        setKabupatenDetailList(parsedKabDetail)

        // Calculate Triase & Disease breakdown strictly from parsedFaskes
        const totalTriaseMerah = parsedFaskes.reduce((s: number, r: any) => s + (r.triase_merah || 0), 0)
        const totalTriaseKuning = parsedFaskes.reduce((s: number, r: any) => s + (r.triase_kuning || 0), 0)
        const totalTriaseHijau = parsedFaskes.reduce((s: number, r: any) => s + (r.triase_hijau || 0), 0)
        const totalTriaseHitam = parsedFaskes.reduce((s: number, r: any) => s + (r.triase_hitam || 0), 0)

        const triaseItems: any[] = []
        if (totalTriaseMerah > 0) triaseItems.push({ nama_penyakit: 'Triase Merah (Gawat Darurat / Trauma)', count: totalTriaseMerah })
        if (totalTriaseKuning > 0) triaseItems.push({ nama_penyakit: 'Triase Kuning (Rawat Intensif)', count: totalTriaseKuning })
        if (totalTriaseHijau > 0) triaseItems.push({ nama_penyakit: 'Triase Hijau (Rawat Jalan)', count: totalTriaseHijau })
        if (totalTriaseHitam > 0) triaseItems.push({ nama_penyakit: 'Triase Hitam (Meninggal di Faskes)', count: totalTriaseHitam })

        setPenyakitList(triaseItems)

        // ── 5. BMKG & USGS REAL SEISMIC CATALOG POINTS (Kejadian 15 Agustus 2026) ──
        let eqPoints: EarthquakePoint[] = []
        try {
          const [seismicRes, bmkgRes] = await Promise.allSettled([
            fetch('/api/bencana-seismic?lat=-8.3421&lng=122.9814&date=2026-08-15&kabupaten=Flores%20Timur&provinsi=NUSA%20TENGGARA%20TIMUR&magnitudo=7.7&kedalaman=15&mmi=VII-VIII', { cache: 'no-store' }),
            fetch('/api/bmkg-gempa', { cache: 'no-store' }),
          ])

          if (seismicRes.status === 'fulfilled' && seismicRes.value.ok) {
            const seismicJson = await seismicRes.value.json()
            if (seismicJson.success && Array.isArray(seismicJson.data?.earthquakeFeatures)) {
              eqPoints = seismicJson.data.earthquakeFeatures
            }
          }

          if (bmkgRes.status === 'fulfilled' && bmkgRes.value.ok) {
            const bmkgJson = await bmkgRes.value.json()
            if (bmkgJson.success && bmkgJson.data) {
              setBmkgData(bmkgJson.data)
            }
          }
        } catch (e) {
          console.warn('[TV NTT] Failed to fetch seismic / BMKG data:', e)
        }

        setEarthquakePoints(eqPoints)

        // ── 6. POSKO PENGUNGSIAN (Strictly from API) ──
        const parsedPosko: PoskoItem[] = []
        const rawPosko = Array.isArray(nttData?.posko || nttData?.posko_pengungsian)
          ? (nttData.posko || nttData.posko_pengungsian)
          : []

        rawPosko.forEach((p: any, idx: number) => {
          const lat = Number(p.latitude || p.lat)
          const lng = Number(p.longitude || p.lng)
          if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return

          parsedPosko.push({
            id: p.id || `posko-${idx}`,
            nama: p.nama_pos || p.nama || 'Posko Pengungsian',
            nama_pos: p.nama_pos || p.nama || 'Posko Pengungsian',
            kabupaten: p.kabupaten || '',
            kecamatan: p.kecamatan || '',
            latitude: lat,
            longitude: lng,
            lat,
            lng,
            pengungsi: Number(p.pengungsi || p.jiwa || 0),
            jiwa: Number(p.pengungsi || p.jiwa || 0),
            kapasitas: Number(p.kapasitas || 0),
            pj_kontak: p.pj_kontak || '',
          })
        })
        setPoskoList(parsedPosko)

        // ── 7. PERINGATAN DINI CUACA BMKG NOWCAST (CAP) ──
        try {
          const nowcastRes = await fetch('/api/bmkg-nowcast', { cache: 'no-store' })
          if (nowcastRes.ok) {
            const nowcastJson = await nowcastRes.json()
            if (nowcastJson.success && Array.isArray(nowcastJson.data)) {
              setPeringatanDiniList(nowcastJson.data)
            }
          }
        } catch (e) {
          console.warn('[TV NTT] Failed to fetch /api/bmkg-nowcast:', e)
        }

        // Set initial spotlight item if markers exist
        if (ntt8KabMarkers.length > 0) {
          setSpotlightItem(ntt8KabMarkers[0])
        } else {
          setSpotlightItem(null)
        }
      } else {
        // Mode Nasional: 30-day recent disaster feed
        const [dashRes, bmkgRes, alertsRes] = await Promise.allSettled([
          fetch(`/api/dashboard-utama?startDate=${startDate}&endDate=${endDate}`, { cache: 'no-store' }),
          fetch('/api/bmkg-gempa', { cache: 'no-store' }),
          fetch('/api/bmkg-nowcast', { cache: 'no-store' }),
        ])

        if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
          const json = await dashRes.value.json()
          if (json.success && json.data) {
            const d = json.data
            setSummary({
              total_bencana: d.summary?.total_bencana || 0,
              total_krisis: d.summary?.total_krisis || 0,
              total_meninggal: d.summary?.total_meninggal || 0,
              total_luka: d.summary?.total_luka || 0,
              total_hilang: d.summary?.total_hilang || 0,
              total_pengungsi: d.summary?.total_pengungsi || 0,
              total_terdampak: d.summary?.total_terdampak || 0,
            })
            setMarkers(d.markers || [])
            setJenisBencanaList(d.jenis_bencana || [])
            setWilayahList(d.wilayah || [])
            setPenyakitList(d.penyakit || [])
          }
        }

        if (bmkgRes.status === 'fulfilled' && bmkgRes.value.ok) {
          const json = await bmkgRes.value.json()
          if (json.success && json.data) {
            setBmkgData(json.data)
          }
        }

        if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
          const json = await alertsRes.value.json()
          if (json.success && Array.isArray(json.data)) {
            setPeringatanDiniList(json.data)
          }
        }
      }
    } catch (err) {
      console.error('[TV Dashboard Container] Fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [isNttScope])

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto Refresh Interval
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchData()
          return REFRESH_INTERVAL_SECONDS
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [fetchData])

  // Auto Province Tour (National Mode Only)
  useEffect(() => {
    if (!autoProvinceTour || wilayahList.length === 0 || isNttScope) return
    const interval = setInterval(() => {
      tourIndexRef.current = (tourIndexRef.current + 1) % wilayahList.length
      const prov = wilayahList[tourIndexRef.current]
      if (prov && prov.provinsi) {
        setCurrentTourProvince(prov.provinsi)
        mapEngineRef.current?.focusProvince(prov.provinsi)
      }
    }, PROVINCE_CYCLE_SECONDS * 1000)
    return () => clearInterval(interval)
  }, [autoProvinceTour, wilayahList, isNttScope])

  // ── Interactivity Handlers ──
  const handleSelectFeature = (item: any, type: string = 'disaster') => {
    setSpotlightItem({ ...item, type: (type as any) || item.type || 'disaster' })
    if (item.lat && item.lng) {
      mapEngineRef.current?.flyTo(Number(item.lng), Number(item.lat), 10.5)
    }
  }

  const handleSelectProvince = (provName: string) => {
    mapEngineRef.current?.focusProvince(provName)
  }

  const handleSelectLocation = (lng: number, lat: number, zoom: number = 10.5) => {
    mapEngineRef.current?.flyTo(lng, lat, zoom)
  }

  // ── Sound Alarm Generator ──
  const playAlertSound = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6)
      osc.start()
      osc.stop(ctx.currentTime + 0.6)
    } catch {}
  }, [soundEnabled])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#fbffff] text-slate-800 font-roboto select-none">
      {/* ── 1. FULL-BLEED BACKGROUND MAP ENGINE (Single Unified OpenLayers Engine) ── */}
      <TvMapEngine
        ref={mapEngineRef}
        markers={markers}
        faskesList={faskesList}
        poskoList={poskoList}
        earthquakePoints={earthquakePoints}
        routeCoords={routeCoords}
        wilayahList={wilayahList}
        bmkgGempas={[
          ...(bmkgData?.autogempa ? [bmkgData.autogempa] : []),
          ...(Array.isArray(bmkgData?.gempaterkini) ? bmkgData.gempaterkini : []),
          ...(Array.isArray(bmkgData?.gempadirasakan) ? bmkgData.gempadirasakan : []),
        ]}
        layers={layers}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        onSelectMarker={handleSelectFeature}
      />

      {/* ── 2. TOP FLOATING HUD & CONTROLS ── */}
      <TvTopHud
        onToggleLayers={() => setLayersOpen(!layersOpen)}
        isLayersOpen={layersOpen}
        onToggleAlerts={() => setAlertsOpen(!alertsOpen)}
        isAlertsOpen={alertsOpen}
        alertsCount={peringatanDiniList.length}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          setSoundEnabled(!soundEnabled)
          if (!soundEnabled) playAlertSound()
        }}
        refreshCountdown={refreshCountdown}
        refreshInterval={REFRESH_INTERVAL_SECONDS}
        onManualRefresh={() => {
          setIsLoading(true)
          fetchData()
          setRefreshCountdown(REFRESH_INTERVAL_SECONDS)
        }}
        isLoading={isLoading}
        activeSpotlightName={
          spotlightItem ? [spotlightItem.kabupaten, spotlightItem.provinsi].filter(Boolean).join(', ') : null
        }
        currentTourProvince={currentTourProvince}
        autoProvinceTour={autoProvinceTour}
        onToggleProvinceTour={() => setAutoProvinceTour(!autoProvinceTour)}
      />

      {/* ── 2.5 API DISCONNECTED ALERT BANNER (No Dummy Data Used) ── */}
      {isApiDisconnected && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-600/95 backdrop-blur-md text-white font-extrabold text-xs rounded-full shadow-lg border border-red-400 flex items-center gap-2 animate-pulse">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <span>DATA API TERPUTUS — MENUNGGU RESPON /api/ntt-data (TIDAK MENGGUNAKAN DATA DUMMY)</span>
        </div>
      )}

      {/* ── 3. TOP FLOATING KPI STAT CARDS ── */}
      <TvKpiCards
        summary={summary}
        isLoading={isLoading}
        isCollapsed={isKpiCollapsed}
        onToggleCollapse={() => setIsKpiCollapsed(!isKpiCollapsed)}
      />

      {/* ── 4. LEFT FLOATING KEJADIAN BENCANA WILAYAH / DAERAH DECK ── */}
      <TvDisasterFeedDeck
        markers={markers}
        kabupatenDetailList={kabupatenDetailList}
        wilayahList={wilayahList}
        earthquakePoints={earthquakePoints}
        poskoList={poskoList}
        weatherList={weatherList}
        weatherSummary={weatherSummary}
        peringatanDiniList={peringatanDiniList}
        summary={summary}
        isNttScope={isNttScope}
        isKpiCollapsed={isKpiCollapsed}
        onSelectDisaster={handleSelectFeature}
        onSelectLocation={handleSelectLocation}
        onSelectProvince={handleSelectProvince}
      />

      {/* ── 5. RIGHT FLOATING KARAKTERISTIK BENCANA & ANALITIK DECK ── */}
      <TvAnalyticsDeck
        jenisBencanaList={jenisBencanaList}
        wilayahList={wilayahList}
        kabupatenDetailList={kabupatenDetailList}
        markers={markers}
        recentMarkers={markers}
        penyakitList={penyakitList}
        summary={summary}
        bmkgData={bmkgData}
        earthquakePoints={earthquakePoints}
        timelineSituasiKesehatan={timelineSituasiKesehatan}
        faskesTerdampakList={faskesTerdampakList}
        summaryFaskesTerdampak={summaryFaskesTerdampak}
        timelinePasienRs={timelinePasienRs}
        timelinePasienPkm={timelinePasienPkm}
        surveilansPenyakitList={surveilansPenyakitList}
        isNttScope={isNttScope}
        isKpiCollapsed={isKpiCollapsed}
        onSelectProvince={handleSelectProvince}
        onSelectLocation={handleSelectLocation}
      />

      {/* ── 6. PENGATURAN PETA DRAWER ── */}
      <TvLayerServicesDrawer
        isOpen={layersOpen}
        onClose={() => setLayersOpen(false)}
        layers={layers}
        onUpdateLayer={(key, val) => setLayers((prev) => ({ ...prev, [key]: val }))}
        onBatchUpdateFaskes={handleBatchUpdateFaskes}
        onResetLayers={() => setLayers(DEFAULT_LAYERS)}
        faskesCounts={faskesCounts}
      />

      {/* ── 6.5 PERINGATAN DINI CUACA & BENCANA DRAWER ── */}
      <TvPeringatanDiniDrawer
        isOpen={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        peringatanDiniList={peringatanDiniList}
        onSelectProvince={handleSelectProvince}
        onSelectLocation={handleSelectLocation}
      />

      {/* ── 7. BOTTOM CENTER FLOATING SPOTLIGHT & TACTICAL ROUTE BANNER ── */}
      <TvSpotlightCard
        item={spotlightItem}
        routeInfo={routeInfo}
        onClose={() => {
          setSpotlightItem(null)
          mapEngineRef.current?.resetView()
        }}
        onStartRoute={handleStartRoute}
        onClearRoute={handleClearRoute}
      />

      {/* ── 8. BOTTOM LIVE RUNNING TICKER ── */}
      <TvBottomTicker
        markers={markers}
        bmkgLatest={bmkgData?.autogempa}
        summaryTotal={summary.total_bencana}
      />
    </div>
  )
}
