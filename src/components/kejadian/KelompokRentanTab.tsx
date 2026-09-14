'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Baby,
  Heart,
  Sparkles,
  UserCheck,
  Accessibility,
  Brain,
  ShieldAlert,
  Search,
  Download,
  RotateCw,
  Filter,
  Calendar,
  MapPin,
  TrendingUp,
  BarChart3,
  PieChart,
  Table as TableIcon,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Info
} from 'lucide-react'

interface KelompokRentanTabProps {
  isNttEvent?: boolean
  selectedDate?: string
}

export default function KelompokRentanTab({ isNttEvent = true, selectedDate }: KelompokRentanTabProps) {
  const [loading, setLoading] = useState<boolean>(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  // View state
  const [viewMode, setViewMode] = useState<'ringkasan' | 'matriks_harian'>('ringkasan')
  const [selectedKabupaten, setSelectedKabupaten] = useState<string>('all')
  const [selectedVariabel, setSelectedVariabel] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const fetchData = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
      const res = await fetch(`${basePath}/api/kelompok-rentan${forceRefresh ? '?nocache=true' : ''}`, {
        cache: 'no-store'
      })

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`)
      const json = await res.json()
      if (json && json.success) {
        setData(json)
      } else {
        throw new Error(json?.error || 'Gagal memuat data kelompok rentan.')
      }
    } catch (err: any) {
      console.error('[KelompokRentanTab] Fetch error:', err)
      setError('Gagal memuat data live kelompok rentan dari Spreadsheet.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData(false)
  }, [])

  const summaryRaw = data?.summary || {}
  const byKabupaten = data?.by_kabupaten || {}
  const byVariabelRaw = data?.by_variabel || {}
  const daftarTanggal: string[] = data?.daftar_tanggal || []
  const daftarKabupaten: string[] = data?.daftar_kabupaten || Object.keys(byKabupaten)

  // Format angka Indonesia
  const formatNum = (n: number | undefined | null): string => {
    if (n === undefined || n === null || isNaN(n)) return '0'
    return Number(n).toLocaleString('id-ID')
  }

  // ─── Recalculate totals dari bawah ke atas agar konsisten ────────────────
  // Hitung total per kabupaten dari penjumlahan semua variabel
  const recomputedByKab: Record<string, number> = {}
  const VAR_KEYS = ['Bayi', 'Balita', 'Ibu Hamil', 'Ibu Menyusui/Nifas', 'Lansia', 'Disabilitas', 'ODGJ']

  // Hitung total per variabel dari penjumlahan semua kabupaten
  const recomputedByVar: Record<string, number> = {}
  VAR_KEYS.forEach(vk => { recomputedByVar[vk] = 0 })

  Object.keys(byKabupaten).forEach((kab) => {
    const vars = byKabupaten[kab]?.variabel || {}
    let kabTotal = 0
    VAR_KEYS.forEach((vk) => {
      const varTotal = Math.max(0, Number(vars[vk]?.total || 0))
      kabTotal += varTotal
      recomputedByVar[vk] = (recomputedByVar[vk] || 0) + varTotal
    })
    recomputedByKab[kab] = kabTotal
  })

  // Grand total = sum semua kabupaten
  const grandTotal = Object.values(recomputedByKab).reduce((a, b) => a + b, 0)

  // Gabungkan byVariabel: pakai total recomputed, tapi pakai persentase dari grand total
  const byVariabel: Record<string, any> = {}
  VAR_KEYS.forEach((vk) => {
    const varTotal = recomputedByVar[vk] || 0
    const pct = grandTotal > 0 ? (varTotal / grandTotal) * 100 : 0
    byVariabel[vk] = {
      ...(byVariabelRaw[vk] || {}),
      variabel: vk,
      total: varTotal,
      persentase: Math.round(pct),
      persentase_formatted: `${Math.round(pct)}%`,
    }
  })

  // Summary akhir: pakai grand total recomputed, fields lain tetap dari raw
  const summary = {
    ...summaryRaw,
    total_seluruh_rentan: grandTotal,
    total_bayi: recomputedByVar['Bayi'] || 0,
    total_balita: recomputedByVar['Balita'] || 0,
    total_ibu_hamil: recomputedByVar['Ibu Hamil'] || 0,
    total_ibu_menyusui: recomputedByVar['Ibu Menyusui/Nifas'] || 0,
    total_lansia: recomputedByVar['Lansia'] || 0,
    total_disabilitas: recomputedByVar['Disabilitas'] || 0,
    total_odgj: recomputedByVar['ODGJ'] || 0,
  }

  // 7 Variabel Konfigurasi Visual
  const VARIABLE_CONFIGS = [
    {
      key: 'Bayi',
      label: 'Bayi',
      sublabel: 'Usia 0 - 12 Bulan',
      icon: Baby,
      colorClass: 'from-rose-500 to-pink-600',
      lightBg: 'bg-rose-50',
      borderClass: 'border-rose-200',
      badgeClass: 'bg-rose-100 text-rose-800',
      textClass: 'text-rose-700',
      kebutuhan: 'MP-ASI, Imunisasi, Susu Bayi, Popok'
    },
    {
      key: 'Balita',
      label: 'Balita',
      sublabel: 'Usia 1 - 5 Tahun',
      icon: Sparkles,
      colorClass: 'from-amber-500 to-orange-600',
      lightBg: 'bg-amber-50',
      borderClass: 'border-amber-200',
      badgeClass: 'bg-amber-100 text-amber-800',
      textClass: 'text-amber-700',
      kebutuhan: 'Makanan Tambahan (PMT), Vitamin A, Selimut'
    },
    {
      key: 'Ibu Hamil',
      label: 'Ibu Hamil',
      sublabel: 'Pemeriksaan ANC & Risti',
      icon: Heart,
      colorClass: 'from-purple-500 to-violet-600',
      lightBg: 'bg-purple-50',
      borderClass: 'border-purple-200',
      badgeClass: 'bg-purple-100 text-purple-800',
      textClass: 'text-purple-700',
      kebutuhan: 'Biskuit Bumil, Tablet Fe, Kit Persalinan'
    },
    {
      key: 'Ibu Menyusui/Nifas',
      label: 'Ibu Menyusui/Nifas',
      sublabel: 'Layanan PNC & Konseling ASI',
      icon: Users,
      colorClass: 'from-fuchsia-500 to-pink-600',
      lightBg: 'bg-fuchsia-50',
      borderClass: 'border-fuchsia-200',
      badgeClass: 'bg-fuchsia-100 text-fuchsia-800',
      textClass: 'text-fuchsia-700',
      kebutuhan: 'Ruang Laktasi, Suplemen ASI, Konseling'
    },
    {
      key: 'Lansia',
      label: 'Lansia',
      sublabel: 'Usia ≥ 60 Tahun',
      icon: UserCheck,
      colorClass: 'from-blue-600 to-indigo-700',
      lightBg: 'bg-blue-50',
      borderClass: 'border-blue-200',
      badgeClass: 'bg-blue-100 text-blue-800',
      textClass: 'text-blue-700',
      kebutuhan: 'Obat Penyakit Kronis (HT/DM), Matras Hangat'
    },
    {
      key: 'Disabilitas',
      label: 'Penyandang Disabilitas',
      sublabel: 'Fisik, Sensorik, Intelektual',
      icon: Accessibility,
      colorClass: 'from-teal-500 to-emerald-600',
      lightBg: 'bg-teal-50',
      borderClass: 'border-teal-200',
      badgeClass: 'bg-teal-100 text-teal-800',
      textClass: 'text-teal-700',
      kebutuhan: 'Kursi Roda, Tongkat Ketiak, Akses Ramah'
    },
    {
      key: 'ODGJ',
      label: 'ODGJ (Kesehatan Jiwa)',
      sublabel: 'Dukungan Psikofarmaka',
      icon: Brain,
      colorClass: 'from-cyan-600 to-sky-700',
      lightBg: 'bg-cyan-50',
      borderClass: 'border-cyan-200',
      badgeClass: 'bg-cyan-100 text-cyan-800',
      textClass: 'text-cyan-700',
      kebutuhan: 'Obat Jiwa Rutin, Trauma Healing, Pendamping'
    }
  ]

  // Data baris tabel matriks harian
  const filteredDetailRows = useMemo(() => {
    const list: any[] = []
    const detailList = data?.data_detail || []

    if (detailList.length > 0) {
      detailList.forEach((r: any) => {
        if (selectedKabupaten !== 'all' && !r.kabupaten.toLowerCase().includes(selectedKabupaten.toLowerCase())) {
          return
        }
        if (selectedVariabel !== 'all' && r.variabel !== selectedVariabel) {
          return
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          if (!r.kabupaten.toLowerCase().includes(q) && !r.variabel.toLowerCase().includes(q)) {
            return
          }
        }
        list.push(r)
      })
      return list
    }

    // Fallback rekonstruksi dari byKabupaten
    Object.keys(byKabupaten).forEach((kab) => {
      if (selectedKabupaten !== 'all' && !kab.toLowerCase().includes(selectedKabupaten.toLowerCase())) {
        return
      }
      const vars = byKabupaten[kab]?.variabel || {}
      Object.keys(vars).forEach((vk) => {
        if (selectedVariabel !== 'all' && vk !== selectedVariabel) {
          return
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          if (!kab.toLowerCase().includes(q) && !vk.toLowerCase().includes(q)) {
            return
          }
        }
        list.push({
          kabupaten: kab,
          variabel: vk,
          total: vars[vk]?.total || 0,
          harian: vars[vk]?.harian || {},
          kumulatif_harian: vars[vk]?.kumulatif_harian || {}
        })
      })
    })

    return list
  }, [data, byKabupaten, selectedKabupaten, selectedVariabel, searchQuery])

  // Ekspor CSV
  const handleExportCsv = () => {
    if (filteredDetailRows.length === 0) return

    const headers = ['No', 'Kabupaten', 'Variabel', 'Total Terkini', ...daftarTanggal]
    const csvLines = [headers.join(',')]

    filteredDetailRows.forEach((row, idx) => {
      const line = [
        idx + 1,
        `"${row.kabupaten}"`,
        `"${row.variabel}"`,
        row.total || 0,
        ...daftarTanggal.map((tgl) => row.harian?.[tgl] ?? 0)
      ]
      csvLines.push(line.join(','))
    })

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `data_kelompok_rentan_ntt_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-rose-500 to-purple-600 text-white shadow-xs">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h4 className="text-xl sm:text-2xl font-black text-slate-900 m-0 tracking-tight">
                Data Kelompok Rentan Terdampak
              </h4>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                Prioritas Penanganan Khusus
              </span>
            </div>
            <p className="text-sm text-slate-600 font-normal mt-2 mb-0 leading-relaxed max-w-4xl">
              Pemantauan spesifik populasi berisiko tinggi (Bayi, Balita, Ibu Hamil, Ibu Menyusui, Lansia, Disabilitas, dan ODGJ) untuk penentuan kebutuhan intervensi gizi darurat, pemenuhan logistik medis, dan perlindungan sosial di pengungsian.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition shadow-2xs cursor-pointer disabled:opacity-50"
              title="Perbarui data langsung dari Google Spreadsheet"
            >
              <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-rose-600' : ''}`} />
              <span>{refreshing ? 'Memuat Ulang...' : 'Sinkron Sheet'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition shadow-2xs cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Total Grand Summary Banner */}
      <div className="rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-50/60 via-purple-50/40 to-blue-50/50 p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-purple-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <span className="text-xs font-black text-rose-900/80 uppercase tracking-wider block">
                Total Seluruh Populasi Rentan Terdata
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
                  {formatNum(summary.total_seluruh_rentan || 0)}
                </span>
                <span className="text-sm font-bold text-slate-600">Jiwa</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
            <div className="bg-white/90 border border-slate-200/80 px-4 py-2 rounded-xl shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Wilayah Terdata</span>
              <span className="text-sm font-black text-slate-900">
                {summary.total_kabupaten || daftarKabupaten.length} Kabupaten
              </span>
            </div>
            <div className="bg-white/90 border border-slate-200/80 px-4 py-2 rounded-xl shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Kategori Variabel</span>
              <span className="text-sm font-black text-slate-900">7 Kelompok Spesifik</span>
            </div>
            <div className="bg-white/90 border border-slate-200/80 px-4 py-2 rounded-xl shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Update Terakhir</span>
              <span className="text-sm font-black text-rose-700">
                {summary.tanggal_terbaru || 'Terbaru'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Grid 7 KPI Cards (1 per variabel) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {VARIABLE_CONFIGS.map((cfg) => {
          const IconComponent = cfg.icon
          const varData = byVariabel[cfg.key]
          const totalVal = varData ? varData.total : 0
          const pctVal = varData ? varData.persentase_formatted : '0%'

          return (
            <div
              key={cfg.key}
              onClick={() => setSelectedVariabel(selectedVariabel === cfg.key ? 'all' : cfg.key)}
              className={`rounded-2xl border ${cfg.borderClass} ${cfg.lightBg} p-4 transition-all duration-200 cursor-pointer hover:shadow-xs flex flex-col justify-between ${
                selectedVariabel === cfg.key ? 'ring-2 ring-slate-900 shadow-xs' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg bg-gradient-to-tr ${cfg.colorClass} text-white shadow-2xs`}>
                      <IconComponent className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-black text-slate-900 truncate">
                      {cfg.label}
                    </span>
                  </div>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${cfg.badgeClass}`}>
                    {pctVal}
                  </span>
                </div>

                <div className="mt-2.5">
                  <div className="text-2xl font-black text-slate-950 tracking-tight">
                    {formatNum(totalVal)}
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                    {cfg.sublabel}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/60">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Fokus Kebutuhan:</span>
                <p className="text-[10px] font-medium text-slate-700 leading-snug m-0 mt-0.5 line-clamp-2">
                  {cfg.kebutuhan}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* 4. Analisis Komposisi & Sebaran Wilayah */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Panel Kiri: Distribusi & Proporsi Kelompok Rentan */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-purple-600" />
              <h5 className="text-sm font-black uppercase tracking-wider text-slate-900 m-0">
                Proporsi Kelompok Rentan
              </h5>
            </div>
            <span className="text-xs text-slate-500 font-semibold">Persentase Akumulatif</span>
          </div>

          <div className="space-y-3">
            {VARIABLE_CONFIGS.map((cfg) => {
              const varData = byVariabel[cfg.key]
              const totalVal = varData ? varData.total : 0
              const pct = varData ? varData.persentase : 0
              const pctFormatted = varData ? varData.persentase_formatted : '0%'

              return (
                <div key={cfg.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-800">{cfg.label}</span>
                    <span className="text-slate-600">
                      {formatNum(totalVal)} jiwa ({pctFormatted})
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${cfg.colorClass} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl text-xs text-purple-900 flex items-start gap-2">
            <Info className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              <strong className="font-bold">Insight Kemenkes:</strong> Lansia (&ge;60 thn) dan Balita (1-5 thn) mendominasi lebih dari 80% total kelompok rentan. Prioritaskan ketersediaan makanan balita (PMT) serta pemeriksaan tensi/gula darah dan obat rutin bagi lansia di posko pengungsian.
            </span>
          </div>
        </div>

        {/* Panel Kanan: Sebaran Per Kabupaten */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <h5 className="text-sm font-black uppercase tracking-wider text-slate-900 m-0">
                Sebaran per Kabupaten Terdampak
              </h5>
            </div>
            <span className="text-xs text-slate-500 font-semibold">{daftarKabupaten.length} Kabupaten</span>
          </div>

          <div className="space-y-3">
            {daftarKabupaten.map((kab) => {
              const kabData = byKabupaten[kab] || {}
              // Gunakan total recomputed agar sinkron dengan grand total
              const totalKab = recomputedByKab[kab] || kabData.total_rentan || 0
              const maxTotal = summary.total_seluruh_rentan || 1
              const pctOfTotal = Math.round((totalKab / maxTotal) * 100)

              return (
                <div
                  key={kab}
                  onClick={() => setSelectedKabupaten(selectedKabupaten === kab ? 'all' : kab)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedKabupaten === kab
                      ? 'border-blue-500 bg-blue-50/40 shadow-xs'
                      : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-slate-900">{kab}</span>
                    </div>
                    <span className="text-blue-900 font-black">
                      {formatNum(totalKab)} jiwa ({pctOfTotal}%)
                    </span>
                  </div>

                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(3, pctOfTotal * 2))}%` }}
                    />
                  </div>

                  {/* Micro Breakdown */}
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-slate-500 font-medium">
                    <span>Lansia: <strong>{formatNum(kabData.variabel?.['Lansia']?.total || 0)}</strong></span>
                    <span>•</span>
                    <span>Balita: <strong>{formatNum(kabData.variabel?.['Balita']?.total || 0)}</strong></span>
                    <span>•</span>
                    <span>Bumil: <strong>{formatNum(kabData.variabel?.['Ibu Hamil']?.total || 0)}</strong></span>
                    <span>•</span>
                    <span>Bayi: <strong>{formatNum(kabData.variabel?.['Bayi']?.total || 0)}</strong></span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 5. Tabel Matriks Dinamis & Detail Data */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        {/* Table Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('ringkasan')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'ringkasan'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Ringkasan Kumulatif</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matriks_harian')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'matriks_harian'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Matriks Harian Tanggal (Sheet Format)</span>
            </button>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Kabupaten */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedKabupaten}
                onChange={(e) => setSelectedKabupaten(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">Semua Kabupaten</option>
                {daftarKabupaten.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            {/* Filter Variabel */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold">
              <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedVariabel}
                onChange={(e) => setSelectedVariabel(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">Semua Variabel</option>
                {VARIABLE_CONFIGS.map((cfg) => (
                  <option key={cfg.key} value={cfg.key}>{cfg.label}</option>
                ))}
              </select>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[180px]">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari wilayah / variabel..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Tabel Tampilan 1: Ringkasan Kumulatif */}
        {viewMode === 'ringkasan' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 uppercase font-black tracking-wider text-[10px]">
                  <th className="py-3 px-3.5">Wilayah Kabupaten</th>
                  <th className="py-3 px-3 text-right">Bayi</th>
                  <th className="py-3 px-3 text-right">Balita</th>
                  <th className="py-3 px-3 text-right">Ibu Hamil</th>
                  <th className="py-3 px-3 text-right">Ibu Nifas/Menyusui</th>
                  <th className="py-3 px-3 text-right">Lansia</th>
                  <th className="py-3 px-3 text-right">Disabilitas</th>
                  <th className="py-3 px-3 text-right">ODGJ</th>
                  <th className="py-3 px-3.5 text-right font-black text-rose-900 bg-rose-50/50">Total Rentan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daftarKabupaten
                  .filter((k) => selectedKabupaten === 'all' || k.toLowerCase().includes(selectedKabupaten.toLowerCase()))
                  .map((kab) => {
                    const kabData = byKabupaten[kab] || {}
                    const vMap = kabData.variabel || {}

                    return (
                      <tr key={kab} className="hover:bg-slate-50/80 transition font-medium text-slate-700">
                        <td className="py-3 px-3.5 font-bold text-slate-900 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>{kab}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold">{formatNum(vMap['Bayi']?.total || 0)}</td>
                        <td className="py-3 px-3 text-right font-semibold">{formatNum(vMap['Balita']?.total || 0)}</td>
                        <td className="py-3 px-3 text-right font-semibold">{formatNum(vMap['Ibu Hamil']?.total || 0)}</td>
                        <td className="py-3 px-3 text-right font-semibold">{formatNum(vMap['Ibu Menyusui/Nifas']?.total || 0)}</td>
                        <td className="py-3 px-3 text-right font-semibold text-blue-900">{formatNum(vMap['Lansia']?.total || 0)}</td>
                        <td className="py-3 px-3 text-right font-semibold">{formatNum(vMap['Disabilitas']?.total || 0)}</td>
                        <td className="py-3 px-3 text-right font-semibold">{formatNum(vMap['ODGJ']?.total || 0)}</td>
                        <td className="py-3 px-3.5 text-right font-black text-rose-700 bg-rose-50/30 text-sm">
                          {/* Gunakan recomputedByKab agar sinkron dengan total banner */}
                          {formatNum(recomputedByKab[kab] || kabData.total_rentan || 0)}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-100/80 text-slate-900 font-black text-xs">
                  <td className="py-3 px-3.5">TOTAL PROVINSI NTT</td>
                  <td className="py-3 px-3 text-right">{formatNum(summary.total_bayi || 0)}</td>
                  <td className="py-3 px-3 text-right">{formatNum(summary.total_balita || 0)}</td>
                  <td className="py-3 px-3 text-right">{formatNum(summary.total_ibu_hamil || 0)}</td>
                  <td className="py-3 px-3 text-right">{formatNum(summary.total_ibu_menyusui || 0)}</td>
                  <td className="py-3 px-3 text-right text-blue-900">{formatNum(summary.total_lansia || 0)}</td>
                  <td className="py-3 px-3 text-right">{formatNum(summary.total_disabilitas || 0)}</td>
                  <td className="py-3 px-3 text-right">{formatNum(summary.total_odgj || 0)}</td>
                  <td className="py-3 px-3.5 text-right font-black text-rose-800 bg-rose-100/50 text-sm">
                    {formatNum(summary.total_seluruh_rentan || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* Tabel Tampilan 2: Matriks Harian Tanggal (Persis Google Sheet) */
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 uppercase font-black tracking-wider text-[10px]">
                  <th className="py-3 px-3 sticky left-0 bg-slate-50 z-10 min-w-[130px]">Kabupaten/Kota</th>
                  <th className="py-3 px-3 sticky left-[130px] bg-slate-50 z-10 min-w-[110px]">Variabel</th>
                  <th className="py-3 px-3 text-right min-w-[90px] font-black text-rose-900 bg-rose-50/40">Total</th>
                  {daftarTanggal.map((dt) => {
                    const parts = dt.split('-')
                    const shortDate = parts.length === 3 ? `${parseInt(parts[1])}/${parseInt(parts[2])}` : dt
                    return (
                      <th key={dt} className="py-3 px-2.5 text-right min-w-[70px] whitespace-nowrap">
                        {shortDate}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredDetailRows.map((row, rIdx) => {
                  return (
                    <tr key={rIdx} className="hover:bg-slate-50/90 transition text-slate-700">
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 sticky left-0 bg-white truncate">
                        {row.kabupaten}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-800 sticky left-[130px] bg-white">
                        <span className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700">
                          {row.variabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-rose-700 bg-rose-50/20">
                        {formatNum(row.total || 0)}
                      </td>
                      {daftarTanggal.map((dt) => {
                        const val = row.harian?.[dt] ?? 0
                        const isNonZero = val !== 0
                        const isNegative = val < 0

                        return (
                          <td
                            key={dt}
                            className={`py-2.5 px-2.5 text-right font-medium text-[11px] ${
                              isNegative
                                ? 'text-amber-700 bg-amber-50/50 font-bold'
                                : isNonZero
                                ? 'text-slate-900 font-bold bg-slate-50/50'
                                : 'text-slate-300'
                            }`}
                          >
                            {isNonZero ? formatNum(val) : '0'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
