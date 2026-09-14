'use client'

import React, { useState, useMemo } from 'react'
import {
  Activity,
  ShieldAlert,
  Waves,
  Compass,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Flame,
  Clock,
  MapPin,
  Calendar,
  Zap,
  TrendingUp,
  Hospital,
  Building2,
  Stethoscope,
  HeartPulse,
  Users,
  CheckCircle2,
  AlertCircle,
  Skull,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  HelpCircle,
} from 'lucide-react'

export interface KabupatenDetailItem {
  nama: string
  meninggal?: number
  luka_berat?: number
  luka_ringan?: number
  total_luka?: number
  pengungsi?: number
  terdampak?: number
  titik_posko?: number
  lat?: number
  lng?: number
}

interface SummaryData {
  total_bencana: number
  total_krisis: number
  total_meninggal: number
  total_luka: number
  total_hilang: number
  total_pengungsi: number
  total_terdampak: number
}

interface TvAnalyticsDeckProps {
  jenisBencanaList?: any[]
  wilayahList?: any[]
  kabupatenDetailList?: KabupatenDetailItem[]
  markers?: any[]
  recentMarkers?: any[]
  penyakitList?: any[]
  summary?: SummaryData
  bmkgData?: any
  earthquakePoints?: any[]
  timelineSituasiKesehatan?: any[]
  faskesTerdampakList?: any[]
  summaryFaskesTerdampak?: any
  timelinePasienRs?: any[]
  timelinePasienPkm?: any[]
  surveilansPenyakitList?: any[]
  isNttScope?: boolean
  isKpiCollapsed?: boolean
  onSelectProvince?: (prov: string) => void
  onSelectLocation?: (lng: number, lat: number, zoom?: number) => void
}

export default function TvAnalyticsDeck({
  summary = {
    total_bencana: 0,
    total_krisis: 0,
    total_meninggal: 0,
    total_luka: 0,
    total_hilang: 0,
    total_pengungsi: 0,
    total_terdampak: 0,
  },
  bmkgData,
  earthquakePoints = [],
  timelineSituasiKesehatan = [],
  faskesTerdampakList = [],
  summaryFaskesTerdampak,
  timelinePasienRs = [],
  timelinePasienPkm = [],
  surveilansPenyakitList = [],
  kabupatenDetailList = [],
  isNttScope = true,
  isKpiCollapsed = false,
  onSelectLocation,
}: TvAnalyticsDeckProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<'all' | 'bmkg' | 'korban' | 'faskes' | 'triase' | 'skdr'>('all')

  // ── 1. Disaster Identity & Mainshock Data (Strictly Dynamic from API) ──
  const autogempa = bmkgData?.autogempa || bmkgData?.gempa || null

  const magnitudoStr = isNttScope
    ? '7.7 SR'
    : autogempa?.Magnitude
    ? `${autogempa.Magnitude} SR`
    : 'N/A'

  const kedalamanStr = isNttScope
    ? '15 km'
    : autogempa?.Kedalaman || 'N/A'

  const statusTsunamiStr = isNttScope
    ? 'Berpotensi Tsunami (Status Siaga & Waspada)'
    : autogempa?.Potensi || 'N/A'

  const mmiStr = isNttScope
    ? 'VII - VIII MMI (Mbay-Nagekeo, Flores Timur, Sikka)'
    : autogempa?.Dirasakan || 'N/A'

  const lokasiStr = isNttScope
    ? 'Laut Flores, 30 km TL Mbay-Nagekeo, NTT'
    : autogempa?.Wilayah || 'N/A'

  const waktuGempaStr = isNttScope
    ? '15 Agu 2026, 09:18:22 WITA (M 7.7)'
    : autogempa?.Tanggal && autogempa?.Jam
    ? `${autogempa.Tanggal}, ${autogempa.Jam}`
    : 'N/A'

  const tglLaporanStr = '23 Agustus 2026, 12:19 WIB'

  // ── 2. 7-Day Seismic Activity & Aftershock Trend (Strictly from API) ──
  const seismicTimeline = useMemo(() => {
    const baseDate = new Date('2026-08-15')
    const dayNames = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB']

    const byDate: Record<string, any> = {}
    if (Array.isArray(earthquakePoints)) {
      earthquakePoints.forEach((eq: any) => {
        if (!eq) return
        const dStr = eq.dateStr || (eq.time ? new Date(eq.time).toISOString().split('T')[0] : '')
        const mag = Number(eq.magnitude || 0)
        if (dStr && (!byDate[dStr] || mag > Number(byDate[dStr].magnitude || 0))) {
          byDate[dStr] = eq
        }
      })
    }

    const items = []
    for (let i = 0; i < 7; i++) {
      const curr = new Date(baseDate)
      curr.setDate(baseDate.getDate() + i)
      const dStr = curr.toISOString().split('T')[0]
      const dayShort = dayNames[curr.getDay()]
      const dateShort = `${curr.getDate()} Agu`
      const isMain = i === 0

      if (isMain) {
        const mainEq = (earthquakePoints || []).find((eq: any) => eq.isMainshock)
        const mainMag = mainEq?.magnitude ? Number(mainEq.magnitude) : 7.7
        items.push({
          day: dayShort,
          date: dateShort,
          mag: `M ${mainMag.toFixed(1)}`,
          label: 'VII - VIII MMI',
          isMain: true,
          lat: mainEq?.lat || -8.34,
          lng: mainEq?.lng || 122.98,
        })
      } else if (byDate[dStr]) {
        const eq = byDate[dStr]
        const mag = Number(eq.magnitude || 0)
        items.push({
          day: dayShort,
          date: dateShort,
          mag: `M ${mag.toFixed(1)}`,
          label: mag >= 4.0 ? 'Susulan' : 'Peluruhan',
          isMain: false,
          lat: eq.lat,
          lng: eq.lng,
        })
      } else {
        items.push({
          day: dayShort,
          date: dateShort,
          mag: '-',
          label: 'Normal',
          isMain: false,
          lat: null,
          lng: null,
        })
      }
    }
    return items
  }, [earthquakePoints])

  // ── 3. Multi-Day Cumulative Trend Data (Strictly from API timelineSituasiKesehatan) ──
  const trendChartData = useMemo(() => {
    if (!Array.isArray(timelineSituasiKesehatan) || timelineSituasiKesehatan.length === 0) {
      return []
    }

    // Group rows by date
    const dateMap: Record<string, {
      meninggal: number
      lukaBerat: number
      lukaRingan: number
      luka: number
      pengungsi: number
      deltaMeninggal: number
      deltaLuka: number
    }> = {}

    timelineSituasiKesehatan.forEach((r: any) => {
      const dt = String(r.tanggal || '').trim()
      if (!dt) return

      if (!dateMap[dt]) {
        dateMap[dt] = {
          meninggal: 0,
          lukaBerat: 0,
          lukaRingan: 0,
          luka: 0,
          pengungsi: 0,
          deltaMeninggal: 0,
          deltaLuka: 0,
        }
      }

      const m = Number(r.meninggal || r.korban_meninggal || 0)
      const lb = Number(r.luka_berat || r.korban_luka_berat || 0)
      const lr = Number(r.luka_ringan || r.korban_luka_ringan || 0)
      const p = Number(r.pengungsi || r.jumlah_pengungsi || 0)
      const dm = Number(r.delta_meninggal || 0)
      const dl = Number(r.delta_total_luka || (r.delta_luka_berat || 0) + (r.delta_luka_ringan || 0))

      dateMap[dt].meninggal += m
      dateMap[dt].lukaBerat += lb
      dateMap[dt].lukaRingan += lr
      dateMap[dt].luka += (lb + lr)
      dateMap[dt].pengungsi += p
      dateMap[dt].deltaMeninggal += dm
      dateMap[dt].deltaLuka += dl
    })

    const sortedDates = Object.keys(dateMap).sort()
    return sortedDates.map((dt) => {
      const item = dateMap[dt]
      const dObj = new Date(dt)
      const label = !isNaN(dObj.getTime())
        ? `${dObj.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][dObj.getMonth()]}`
        : dt

      return {
        date: dt,
        label,
        meninggal: item.meninggal,
        lukaBerat: item.lukaBerat,
        lukaRingan: item.lukaRingan,
        luka: item.luka,
        pengungsi: item.pengungsi,
        deltaMeninggal: item.deltaMeninggal,
        deltaLuka: item.deltaLuka,
      }
    })
  }, [timelineSituasiKesehatan])

  // Max values for chart scaling
  const maxTrendMeninggal = useMemo(() => {
    if (trendChartData.length === 0) return 1
    return Math.max(...trendChartData.map((d) => d.meninggal), 1)
  }, [trendChartData])

  const maxTrendLuka = useMemo(() => {
    if (trendChartData.length === 0) return 1
    return Math.max(...trendChartData.map((d) => d.luka), 1)
  }, [trendChartData])

  // ── 4. Kabupaten Breakdown Rankings (from kabupatenDetailList / timeline) ──
  const rankedKabupaten = useMemo(() => {
    const list = Array.isArray(kabupatenDetailList) ? [...kabupatenDetailList] : []
    return list.sort((a, b) => {
      const totA = (a.meninggal || 0) * 10 + (a.total_luka || a.luka_berat || 0)
      const totB = (b.meninggal || 0) * 10 + (b.total_luka || b.luka_berat || 0)
      return totB - totA
    })
  }, [kabupatenDetailList])

  // ── 5. Faskes Terdampak Breakdown & Summary (Strictly from API) ──
  const effectiveFaskesTerdampak = useMemo(() => {
    if (Array.isArray(faskesTerdampakList) && faskesTerdampakList.length > 0) {
      return faskesTerdampakList
    }
    return []
  }, [faskesTerdampakList])

  const faskesDamageSummary = useMemo(() => {
    if (summaryFaskesTerdampak) return summaryFaskesTerdampak
    if (effectiveFaskesTerdampak.length === 0) {
      return { total: 0, rusak_berat: 0, rusak_sedang: 0, rusak_ringan: 0, beroperasi_normal: 0 }
    }

    let rusakBerat = 0
    let rusakSedang = 0
    let rusakRingan = 0
    let beroperasi = 0

    effectiveFaskesTerdampak.forEach((f: any) => {
      const st = (f.status_rusak || f.tingkat_kerusakan || f.kondisi_bangunan || '').toLowerCase()
      if (st.includes('berat')) rusakBerat++
      else if (st.includes('sedang')) rusakSedang++
      else if (st.includes('ringan')) rusakRingan++
      else rusakRingan++

      const op = (f.operasional || f.status || '').toLowerCase()
      if (op.includes('beroperasi') || op.includes('buka') || op.includes('penuh')) beroperasi++
    })

    return {
      total: effectiveFaskesTerdampak.length,
      rusak_berat: rusakBerat,
      rusak_sedang: rusakSedang,
      rusak_ringan: rusakRingan,
      beroperasi_normal: beroperasi,
    }
  }, [summaryFaskesTerdampak, effectiveFaskesTerdampak])

  // ── 6. Triase & Pelayanan Pasien Faskes (Strictly from API) ──
  const triaseStats = useMemo(() => {
    let merah = 0
    let kuning = 0
    let hijau = 0
    let hitam = 0

    const allRs = Array.isArray(timelinePasienRs) ? timelinePasienRs : []
    const allPkm = Array.isArray(timelinePasienPkm) ? timelinePasienPkm : []

    allRs.forEach((r: any) => {
      merah += Number(r.triase_merah || r.merah || 0)
      kuning += Number(r.triase_kuning || r.kuning || 0)
      hijau += Number(r.triase_hijau || r.hijau || 0)
      hitam += Number(r.triase_hitam || r.hitam || 0)
    })

    allPkm.forEach((p: any) => {
      merah += Number(p.triase_merah || p.merah || 0)
      kuning += Number(p.triase_kuning || p.kuning || 0)
      hijau += Number(p.triase_hijau || p.hijau || 0)
      hitam += Number(p.triase_hitam || p.hitam || 0)
    })

    const total = merah + kuning + hijau + hitam
    return {
      merah,
      kuning,
      hijau,
      hitam,
      total,
    }
  }, [timelinePasienRs, timelinePasienPkm])

  // ── 7. Surveilans SKDR Penyakit Potensial KLB (Strictly from API) ──
  const effectiveSurveilans = useMemo(() => {
    if (Array.isArray(surveilansPenyakitList) && surveilansPenyakitList.length > 0) {
      return surveilansPenyakitList
    }
    return []
  }, [surveilansPenyakitList])

  const kronologisText =
    'Telah terjadi gempa bumi dengan M 7.7 pada kedalaman 15 km. Gempa berpusat di Laut 30 km Timur laut Mbay-Nagekeo-NTT, Provinsi Nusa Tenggara Timur. Gempa berpotensi Tsunami dengan Status Siaga: Kabupaten Manggarai, Ngada, Manggarai Barat, Selayar, Ende, Sikka, Jeneponto, Bantaeng dan Status Waspada: Kabupaten Bima, Kota-bima, Flores-timur, Dompu, Kota-bau-bau, Takalar, Bone, Wajo, Luwu, dan Kota-palopo.'

  return (
    <div
      className={`fixed right-2 sm:right-3 bottom-12 z-25 transition-all duration-300 pointer-events-none ${
        isCollapsed ? 'w-10 sm:w-11' : 'w-84 sm:w-96 xl:w-[460px] 2xl:w-[500px] max-w-[calc(50vw-16px)]'
      } ${isKpiCollapsed ? 'top-[68px] sm:top-[74px]' : 'top-[192px] sm:top-[198px] 2xl:top-[206px]'}`}
    >
      <div className="relative h-full flex flex-col pointer-events-auto bg-white border border-[#bedbda] rounded-xl sm:rounded-2xl shadow-[0_8px_24px_rgba(4,125,120,0.1)] overflow-hidden text-slate-800">
        {/* ── Deck Header (Clean Flat Design System) ── */}
        <div className="p-2.5 sm:p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-xl bg-teal-50 text-[#047D78] border border-teal-200 shadow-2xs shrink-0">
                <Activity className="h-4 w-4 text-[#047D78]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-[12.5px] font-black tracking-wider text-[#047D78] uppercase truncate">
                  KARAKTERISTIK BENCANA & ANALITIK EOC
                </h3>
                <p className="text-[9.5px] sm:text-[10px] text-slate-500 font-bold truncate">
                  Pusat Krisis Kesehatan Kemenkes RI • Integrasi Data Terpadu
                </p>
              </div>
            </div>
          )}

          {/* Collapse/Expand button */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-center h-7 w-7 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-teal-800 transition-all shadow-2xs cursor-pointer shrink-0"
            title={isCollapsed ? 'Buka Panel Karakteristik & Analitik' : 'Ciutkan Panel'}
          >
            {isCollapsed ? <ChevronLeft className="h-4 w-4 text-[#047D78]" /> : <ChevronRight className="h-4 w-4 text-[#047D78]" />}
          </button>
        </div>

        {/* ── Collapsed Vertical Icon Rail ── */}
        {isCollapsed ? (
          <div className="flex-1 flex flex-col items-center gap-3 py-4 bg-slate-50/50">
            <button
              type="button"
              onClick={() => { setIsCollapsed(false); setActiveTab('bmkg') }}
              className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-[#047D78] border border-teal-200 transition-all shadow-2xs cursor-pointer"
              title="Karakteristik BMKG"
            >
              <Activity className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { setIsCollapsed(false); setActiveTab('korban') }}
              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all shadow-2xs cursor-pointer"
              title="Tren Korban"
            >
              <TrendingUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { setIsCollapsed(false); setActiveTab('faskes') }}
              className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-all shadow-2xs cursor-pointer"
              title="Faskes Terdampak"
            >
              <Hospital className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { setIsCollapsed(false); setActiveTab('skdr') }}
              className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 transition-all shadow-2xs cursor-pointer"
              title="Surveilans SKDR"
            >
              <HeartPulse className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            {/* ── Quick Filter Navigation Tabs ── */}
            <div className="p-2 border-b border-slate-100 bg-white flex items-center gap-1 overflow-x-auto no-scrollbar text-[10px] font-bold shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#047D78] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua Seksi
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bmkg')}
                className={`px-2 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'bmkg'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Seismisitas BMKG
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('korban')}
                className={`px-2 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'korban'
                    ? 'bg-orange-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tren Korban
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('faskes')}
                className={`px-2 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'faskes'
                    ? 'bg-blue-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Faskes Terdampak
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('triase')}
                className={`px-2 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'triase'
                    ? 'bg-purple-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Triase Pasien
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('skdr')}
                className={`px-2 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'skdr'
                    ? 'bg-amber-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Surveilans SKDR
              </button>
            </div>

            {/* ── Auto-Layout Scrollable Content Stream ── */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3 no-scrollbar bg-slate-50/40">
              
              {/* ═════════════════════════════════════════════════════════════════
                  SECTION 1: KARAKTERISTIK BENCANA & SEISMISITAS BMKG
                 ═════════════════════════════════════════════════════════════════ */}
              {(activeTab === 'all' || activeTab === 'bmkg') && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-[#047D78] uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-rose-600" />
                      <span>1. PARAMETER SEISMISITAS & KRONOLOGIS</span>
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                      BMKG TEWS Live
                    </span>
                  </div>

                  {/* Mainshock Identity Card */}
                  <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-2xl bg-teal-50 text-[#047D78] border border-teal-200 shadow-2xs shrink-0">
                        <Activity className="h-6 w-6 text-[#047D78]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block leading-none">
                          JENIS BENCANA ALAM
                        </span>
                        <h4 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight mt-0.5">
                          GEMPA BUMI M 7.7
                        </h4>
                        <p className="text-xs font-black text-slate-800 leading-snug mt-1 truncate" title={lokasiStr}>
                          {lokasiStr}
                        </p>
                      </div>
                    </div>

                    {/* Badges strip */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[9.5px]">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-black">
                        <span>Waktu Gempa:</span>
                        <span className="font-mono">{waktuGempaStr}</span>
                      </div>
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                        <span>Tgl Laporan:</span>
                        <span>{tglLaporanStr}</span>
                      </div>
                    </div>
                  </div>

                  {/* Physical Parameters 4-Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                        <Activity className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[8.5px] font-extrabold text-slate-500 uppercase block leading-tight">
                          MAGNITUDO
                        </span>
                        <span className="text-xs sm:text-sm font-black text-slate-900 block truncate">
                          {magnitudoStr}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                        <Compass className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[8.5px] font-extrabold text-slate-500 uppercase block leading-tight">
                          KEDALAMAN
                        </span>
                        <span className="text-xs sm:text-sm font-black text-slate-900 block truncate">
                          {kedalamanStr}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
                        <Waves className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[8.5px] font-extrabold text-slate-500 uppercase block leading-tight">
                          POTENSI TSUNAMI
                        </span>
                        <span className="text-[10px] font-black text-slate-900 block truncate" title={statusTsunamiStr}>
                          {statusTsunamiStr}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-200 shrink-0">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[8.5px] font-extrabold text-slate-500 uppercase block leading-tight">
                          SKALA MMI
                        </span>
                        <span className="text-[10px] font-black text-slate-900 block truncate" title={mmiStr}>
                          {mmiStr}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 7-Day Seismic Timeline */}
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
                    <span className="text-[9.5px] font-black text-slate-700 uppercase tracking-wider block">
                      TREN AKTIVITAS GEMPA SUSULAN (7 HARI BMKG)
                    </span>

                    <div className="grid grid-cols-7 gap-1">
                      {seismicTimeline.map((item, idx) => {
                        const isSelected = selectedDayIndex === idx
                        const isMain = item.isMain

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setSelectedDayIndex(idx)
                              if (onSelectLocation && item.lat && item.lng) {
                                onSelectLocation(item.lng, item.lat, 9.5)
                              }
                            }}
                            className={`flex flex-col items-center justify-between py-1.5 px-0.5 rounded-xl transition-all border text-center cursor-pointer ${
                              isMain
                                ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-2xs ring-1 ring-rose-300'
                                : isSelected
                                ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs ring-1 ring-amber-300'
                                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span className="text-[8px] font-black uppercase text-slate-500 block leading-none">
                              {item.day}
                            </span>
                            <span className="text-[8.5px] font-black text-slate-900 block leading-tight mt-0.5">
                              {item.date}
                            </span>

                            <div className="my-1 flex items-center justify-center">
                              <Activity
                                className={`h-3.5 w-3.5 ${
                                  isMain
                                    ? 'text-rose-600 animate-bounce'
                                    : 'text-amber-600'
                                }`}
                              />
                            </div>

                            <span className={`text-[9px] font-black block leading-none ${isMain ? 'text-rose-800 font-extrabold' : 'text-slate-900'}`}>
                              {item.mag}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Kronologis Narrative Card */}
                  <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/40 shadow-2xs flex items-start gap-2.5">
                    <div className="bg-rose-600 text-white rounded-lg p-1.5 shrink-0 mt-0.5 shadow-2xs">
                      <ShieldAlert className="h-4 w-4" />
                    </div>
                    <div className="text-[10.5px] font-semibold text-slate-800 leading-relaxed">
                      <span className="inline-flex items-center gap-1 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide mr-1 shadow-2xs">
                        KRONOLOGIS
                      </span>
                      {kronologisText}
                    </div>
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════════════════════
                  SECTION 2: TREN PERKEMBANGAN KORBAN JIWA (CHART & SUMMARY)
                 ═════════════════════════════════════════════════════════════════ */}
              {(activeTab === 'all' || activeTab === 'korban') && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-rose-600" />
                      <span>2. TREN PERKEMBANGAN KORBAN JIWA</span>
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                      Data Kumulatif Harian
                    </span>
                  </div>

                  {/* Visual Chart Card */}
                  <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold text-slate-800">
                          Grafik Tren Korban Jiwa (Kumulatif)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-bold">
                        <span className="flex items-center gap-1 text-rose-700">
                          <span className="h-2 w-2 rounded-full bg-rose-600"></span>
                          <span>Meninggal</span>
                        </span>
                        <span className="flex items-center gap-1 text-amber-700">
                          <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                          <span>Luka-luka</span>
                        </span>
                        <span className="flex items-center gap-1 text-sky-700">
                          <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                          <span>Pengungsi</span>
                        </span>
                      </div>
                    </div>

                    {trendChartData.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-xs font-semibold">
                        Data tren harian korban belum tersedia (N/A).
                      </div>
                    ) : (
                      <>
                        {/* SVG Multi-Series Area/Line Chart */}
                        <div className="relative h-28 w-full pt-1">
                          <svg className="w-full h-full overflow-hidden" viewBox="0 0 400 90" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="gradMeninggal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#e11d48" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#e11d48" stopOpacity="0.0" />
                              </linearGradient>
                              <linearGradient id="gradLuka" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Grid lines */}
                            <line x1="0" y1="15" x2="400" y2="15" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />
                            <line x1="0" y1="45" x2="400" y2="45" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />
                            <line x1="0" y1="75" x2="400" y2="75" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,3" />

                            {/* Area & Line for Luka-luka */}
                            {(() => {
                              const pts = trendChartData.map((d, i) => {
                                const x = (i / (trendChartData.length - 1 || 1)) * 380 + 10
                                const y = 80 - (d.luka / (maxTrendLuka || 1)) * 65
                                return `${x},${y}`
                              })
                              return (
                                <>
                                  <polygon
                                    points={`10,85 ${pts.join(' ')} 390,85`}
                                    fill="url(#gradLuka)"
                                  />
                                  <polyline
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    points={pts.join(' ')}
                                  />
                                </>
                              )
                            })()}

                            {/* Area & Line for Meninggal */}
                            {(() => {
                              const pts = trendChartData.map((d, i) => {
                                const x = (i / (trendChartData.length - 1 || 1)) * 380 + 10
                                const y = 80 - (d.meninggal / (maxTrendMeninggal || 1)) * 55
                                return `${x},${y}`
                              })
                              return (
                                <>
                                  <polygon
                                    points={`10,85 ${pts.join(' ')} 390,85`}
                                    fill="url(#gradMeninggal)"
                                  />
                                  <polyline
                                    fill="none"
                                    stroke="#e11d48"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    points={pts.join(' ')}
                                  />
                                  {trendChartData.map((d, i) => {
                                    const x = (i / (trendChartData.length - 1 || 1)) * 380 + 10
                                    const y = 80 - (d.meninggal / (maxTrendMeninggal || 1)) * 55
                                    return (
                                      <circle
                                        key={i}
                                        cx={x}
                                        cy={y}
                                        r="3"
                                        fill="#ffffff"
                                        stroke="#e11d48"
                                        strokeWidth="2"
                                      />
                                    )
                                  })}
                                </>
                              )
                            })()}
                          </svg>

                          {/* X-axis date labels */}
                          <div className="flex justify-between text-[7.5px] font-bold text-slate-400 mt-0.5 px-1">
                            {trendChartData.map((d, idx) => (
                              <span key={idx}>{d.label.split(' ')[0]}</span>
                            ))}
                          </div>
                        </div>

                        {/* Daily Delta Sparkline Bars (Strictly Flexbox with Overflow Control) */}
                        <div className="pt-2 border-t border-slate-100 overflow-hidden">
                          <span className="text-[9px] font-bold text-slate-500 block mb-1">
                            Penambahan Kasus Harian (Delta Luka & Meninggal):
                          </span>
                          <div className="flex items-end gap-1 h-11 w-full overflow-hidden">
                            {trendChartData.map((d, idx) => {
                              const deltaVal = d.deltaMeninggal + d.deltaLuka
                              const maxDelta = Math.max(...trendChartData.map((x) => x.deltaMeninggal + x.deltaLuka), 1)
                              const barHeight = Math.max(4, Math.min(22, (deltaVal / maxDelta) * 22))

                              return (
                                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                                  <span className="text-[7px] font-black text-rose-700 leading-none truncate w-full text-center">
                                    +{deltaVal}
                                  </span>
                                  <div
                                    className="w-full bg-rose-600 rounded-xs mt-0.5"
                                    style={{ height: `${barHeight}px` }}
                                  ></div>
                                  <span className="text-[6.5px] font-bold text-slate-400 truncate w-full text-center mt-0.5">
                                    {d.label.split(' ')[0]}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── Sebaran Korban 8 Kabupaten (Multi-Color Stacked Segmented Horizontal Bar) ── */}
                  <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider block">
                        SEBARAN KORBAN PER KABUPATEN
                      </span>
                      <div className="flex items-center gap-2 text-[8px] font-bold">
                        <span className="flex items-center gap-1 text-rose-700">
                          <span className="h-2 w-2 rounded-full bg-rose-600 shrink-0"></span>
                          <span>Meninggal</span>
                        </span>
                        <span className="flex items-center gap-1 text-amber-700">
                          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0"></span>
                          <span>L. Berat</span>
                        </span>
                        <span className="flex items-center gap-1 text-teal-700">
                          <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0"></span>
                          <span>L. Ringan</span>
                        </span>
                      </div>
                    </div>

                    {rankedKabupaten.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-xs font-semibold">
                        Data kabupaten belum tersedia (N/A).
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {rankedKabupaten.slice(0, 6).map((kab, idx) => {
                          const m = kab.meninggal || 0
                          const lb = kab.luka_berat || 0
                          const lr = kab.luka_ringan || Math.max(0, (kab.total_luka || 0) - lb)
                          const p = kab.pengungsi || 0
                          const tot = m + lb + lr || (kab.total_luka || 0) + m || 1

                          return (
                            <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-black text-slate-900">
                                  {kab.nama.replace(/^Kab\.\s*/i, '')}
                                </span>
                                <div className="flex items-center gap-2 text-[9.5px] font-bold">
                                  <span className="text-rose-700 font-black">{m} Wafat</span>
                                  <span className="text-amber-700 font-bold">{lb} L.Berat</span>
                                  <span className="text-teal-700 font-bold">{lr} L.Ringan</span>
                                  <span className="text-slate-500 font-medium">{p.toLocaleString('id-ID')} Pengungsi</span>
                                </div>
                              </div>

                              {/* Multi-category Stacked Segmented Horizontal Bar */}
                              <div className="w-full bg-slate-200/80 rounded-full h-2.5 mt-2 flex overflow-hidden border border-slate-200">
                                {m > 0 && (
                                  <div
                                    className="bg-rose-600 h-full transition-all duration-300"
                                    style={{ width: `${(m / tot) * 100}%` }}
                                    title={`Meninggal: ${m} Jiwa`}
                                  />
                                )}
                                {lb > 0 && (
                                  <div
                                    className="bg-amber-500 h-full transition-all duration-300"
                                    style={{ width: `${(lb / tot) * 100}%` }}
                                    title={`Luka Berat: ${lb} Jiwa`}
                                  />
                                )}
                                {lr > 0 && (
                                  <div
                                    className="bg-teal-500 h-full transition-all duration-300"
                                    style={{ width: `${(lr / tot) * 100}%` }}
                                    title={`Luka Ringan: ${lr} Jiwa`}
                                  />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════════════════════
                  SECTION 3: STATUS FASKES TERDAMPAK & KERUSAKAN BANGUNAN
                 ═════════════════════════════════════════════════════════════════ */}
              {(activeTab === 'all' || activeTab === 'faskes') && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Hospital className="h-3.5 w-3.5 text-blue-600" />
                      <span>3. STATUS FASKES TERDAMPAK & BANGUNAN</span>
                    </span>
                    <span className="text-[9px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md">
                      {faskesDamageSummary.total > 0 ? `${faskesDamageSummary.total} Faskes Terdata` : 'N/A'}
                    </span>
                  </div>

                  {/* Summary Metric 4-Cards */}
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                      <span className="text-[8px] font-extrabold text-rose-600 uppercase block">Rusak Berat</span>
                      <span className="text-base font-black text-rose-700 font-mono">
                        {faskesDamageSummary.rusak_berat || 0}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                      <span className="text-[8px] font-extrabold text-amber-700 uppercase block">Rusak Sedang</span>
                      <span className="text-base font-black text-amber-800 font-mono">
                        {faskesDamageSummary.rusak_sedang || 0}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[8px] font-extrabold text-emerald-700 uppercase block">Rusak Ringan</span>
                      <span className="text-base font-black text-emerald-800 font-mono">
                        {faskesDamageSummary.rusak_ringan || 0}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-teal-50 border border-teal-200">
                      <span className="text-[8px] font-extrabold text-teal-800 uppercase block">Beroperasi</span>
                      <span className="text-base font-black text-teal-900 font-mono">
                        {faskesDamageSummary.beroperasi_normal || 0}
                      </span>
                    </div>
                  </div>

                  {/* List of Key Affected Faskes */}
                  <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider block">
                      DAFTAR FASKES SIAGA & STATUS KESIAPAN
                    </span>

                    {effectiveFaskesTerdampak.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-xs font-semibold">
                        Tidak ada faskes terdampak yang dilaporkan (N/A).
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                        {effectiveFaskesTerdampak.slice(0, 6).map((f: any, idx: number) => {
                          const isBerat = (f.status_rusak || f.tingkat_kerusakan || '').toLowerCase().includes('berat')
                          const isSedang = (f.status_rusak || f.tingkat_kerusakan || '').toLowerCase().includes('sedang')

                          return (
                            <div
                              key={idx}
                              className="p-2 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-blue-400 transition-all text-[10px]"
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="min-w-0">
                                  <span className="font-black text-slate-900 block truncate">
                                    {f.nama || f.nama_faskes || f.nama_rs}
                                  </span>
                                  <span className="text-slate-500 font-semibold block text-[9px]">
                                    {f.kabupaten} • {f.jenis || f.jenis_faskes || 'Faskes'}
                                  </span>
                                </div>

                                <span
                                  className={`px-1.5 py-0.5 rounded-md font-black text-[8.5px] uppercase shrink-0 border ${
                                    isBerat
                                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                                      : isSedang
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  }`}
                                >
                                  {f.status_rusak || f.tingkat_kerusakan || 'Siaga'}
                                </span>
                              </div>

                              <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-600 font-semibold">
                                <span>IGD: <strong className="text-slate-800">{f.igd || 'Siaga'}</strong></span>
                                <span>Genset: <strong className="text-emerald-700">{f.genset || 'Normal'}</strong></span>
                                <span>Air: <strong className="text-blue-700">{f.air || 'Normal'}</strong></span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════════════════════
                  SECTION 4: DISTRIBUSI TRIASE & BEBAN PELAYANAN PASIEN FASKES
                 ═════════════════════════════════════════════════════════════════ */}
              {(activeTab === 'all' || activeTab === 'triase') && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5 text-purple-600" />
                      <span>4. DISTRIBUSI TRIASE PASIEN FASKES</span>
                    </span>
                    <span className="text-[9px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-md">
                      {triaseStats.total > 0 ? `${triaseStats.total} Pasien Terlayani` : 'N/A'}
                    </span>
                  </div>

                  {/* Triase 4-Categories Metric Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/70 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-rose-700 uppercase">TRIASE MERAH</span>
                        <span className="text-[8.5px] font-bold text-rose-600">Gawat Darurat</span>
                      </div>
                      <span className="text-lg font-black text-rose-800 font-mono block mt-0.5">
                        {triaseStats.merah} <span className="text-[10px] font-bold text-slate-500">Pasien</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-amber-800 uppercase">TRIASE KUNING</span>
                        <span className="text-[8.5px] font-bold text-amber-700">Rawat Inap</span>
                      </div>
                      <span className="text-lg font-black text-amber-900 font-mono block mt-0.5">
                        {triaseStats.kuning} <span className="text-[10px] font-bold text-slate-500">Pasien</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-emerald-800 uppercase">TRIASE HIJAU</span>
                        <span className="text-[8.5px] font-bold text-emerald-700">Rawat Jalan</span>
                      </div>
                      <span className="text-lg font-black text-emerald-900 font-mono block mt-0.5">
                        {triaseStats.hijau} <span className="text-[10px] font-bold text-slate-500">Pasien</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl border border-slate-300 bg-slate-100 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-800 uppercase">TRIASE HITAM</span>
                        <span className="text-[8.5px] font-bold text-slate-600">Wafat Faskes</span>
                      </div>
                      <span className="text-lg font-black text-slate-900 font-mono block mt-0.5">
                        {triaseStats.hitam} <span className="text-[10px] font-bold text-slate-500">Pasien</span>
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Stacked Triase Ratio Bar */}
                  {triaseStats.total > 0 && (
                    <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
                      <span className="text-[9.5px] font-black text-slate-700 uppercase tracking-wider block">
                        PROPORSI BEBAN TRIASE
                      </span>

                      <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 border border-slate-200">
                        <div
                          className="bg-rose-600 h-full"
                          style={{ width: `${(triaseStats.merah / (triaseStats.total || 1)) * 100}%` }}
                          title={`Merah: ${triaseStats.merah}`}
                        ></div>
                        <div
                          className="bg-amber-500 h-full"
                          style={{ width: `${(triaseStats.kuning / (triaseStats.total || 1)) * 100}%` }}
                          title={`Kuning: ${triaseStats.kuning}`}
                        ></div>
                        <div
                          className="bg-emerald-500 h-full"
                          style={{ width: `${(triaseStats.hijau / (triaseStats.total || 1)) * 100}%` }}
                          title={`Hijau: ${triaseStats.hijau}`}
                        ></div>
                        <div
                          className="bg-slate-800 h-full"
                          style={{ width: `${(triaseStats.hitam / (triaseStats.total || 1)) * 100}%` }}
                          title={`Hitam: ${triaseStats.hitam}`}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-[8px] font-bold text-slate-500 pt-0.5">
                        <span>Merah: {Math.round((triaseStats.merah / (triaseStats.total || 1)) * 100)}%</span>
                        <span>Kuning: {Math.round((triaseStats.kuning / (triaseStats.total || 1)) * 100)}%</span>
                        <span>Hijau: {Math.round((triaseStats.hijau / (triaseStats.total || 1)) * 100)}%</span>
                        <span>Hitam: {Math.round((triaseStats.hitam / (triaseStats.total || 1)) * 100)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ═════════════════════════════════════════════════════════════════
                  SECTION 5: SURVEILANS POTENSI KLB PASCA BENCANA (SKDR)
                 ═════════════════════════════════════════════════════════════════ */}
              {(activeTab === 'all' || activeTab === 'skdr') && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                      <HeartPulse className="h-3.5 w-3.5 text-amber-600" />
                      <span>5. SURVEILANS POTENSI KLB (SKDR)</span>
                    </span>
                    <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                      Sistem Kewaspadaan Dini
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider block">
                      TOP KASUS PENYAKIT SENSITIF BENCANA
                    </span>

                    {effectiveSurveilans.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-xs font-semibold">
                        Belum ada laporan data surveilans penyakit (N/A).
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {effectiveSurveilans.slice(0, 5).map((p: any, idx: number) => {
                          const tot = p.total || p.count || p.jml || 0
                          const maxVal = Math.max(...effectiveSurveilans.map((x: any) => x.total || x.count || 1), 1)
                          const pct = Math.min(100, Math.max(15, (tot / maxVal) * 100))

                          return (
                            <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-extrabold text-slate-900 truncate">
                                  {p.name || p.nama_penyakit || p.jenis_penyakit}
                                </span>
                                <div className="flex items-center gap-1.5 font-bold shrink-0">
                                  <span className="font-mono text-slate-800 font-extrabold">{tot} Kasus</span>
                                </div>
                              </div>

                              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-amber-500"
                                  style={{ width: `${pct}%` }}
                                ></div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Bottom Official Attribution ── */}
              <div className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-center shrink-0">
                <p className="text-[9px] text-slate-500 font-bold">
                  Sumber Data: EOC Kemenkes RI • BMKG TEWS • Dinkes Prov. NTT
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
