'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  FileText,
  Search,
  Download,
  Eye,
  FileDown,
  Clock,
  Filter,
  X,
  HelpCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Layers,
} from 'lucide-react'

type InfographicItem = {
  id: number
  title: string
  category: string
  description: string
  date: string
  fileSize: string
  pages: number
  pdfUrl: string
  imageCover?: string
}

const INFOGRAPHIC_CATEGORIES = [
  'Laporan Harian EOC',
  'Infografis Bulanan EOC',
  'Infografis Peringatan Dini',
  'Tata Kelola Peta Respon & Renkon',
  'Panduan Krisis Kesehatan',
  'Infografis Bencana/ Krisis Kesehatan',
  'Infografis Risiko Krisis',
  'Infografis Logistik Krisis Kesehatan',
  'Infografis Upaya Krisis Kesehatan',
]

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const MONTH_COVERS: Record<string, string> = {
  januari: '/jan.png',
  februari: '/feb.png',
  maret: '/mar.png',
  april: '/apr.png',
  mei: '/mei.png',
  juni: '/jun.png',
  juli: '/jun.png',
  agustus: '/jun.png',
  september: '/jun.png',
  oktober: '/jun.png',
  november: '/jun.png',
  desember: '/jun.png',
}

const CATEGORY_COVERS: Record<string, string> = {
  'Infografis Peringatan Dini': '/Infografis Peringatan Dini.png',
  'Tata Kelola Peta Respon & Renkon': '/Tatkelola Peta Respon & Renkon.png',
  'Panduan Krisis Kesehatan': '/Panduan Krisis Kesehatan.png',
  'Infografis Bencana/ Krisis Kesehatan': '/Lap_Juni.jpeg',
  'Infografis Risiko Krisis': '/Infografis Risiko Krisis.png',
  'Infografis Logistik Krisis Kesehatan': '/Infografis Logistik Krisis Kesehatan.png',
  'Infografis Upaya Krisis Kesehatan': '/Infografis Upaya Krisis Kesehatan.png',
}

/**
 * Resolver cover image: memastikan gambar selalu valid dan tidak broken
 */
function getCoverSrc(item: InfographicItem): string {
  if (item.imageCover && item.imageCover.trim() !== '') {
    if (item.imageCover.startsWith('http://') || item.imageCover.startsWith('https://')) {
      return item.imageCover
    }
    const clean = item.imageCover.startsWith('/') ? item.imageCover : `/${item.imageCover}`
    return `${basePath}${clean}`
  }

  if (item.category && CATEGORY_COVERS[item.category]) {
    return `${basePath}${CATEGORY_COVERS[item.category]}`
  }

  const dateLower = (item.date || '').toLowerCase()
  for (const [month, file] of Object.entries(MONTH_COVERS)) {
    if (dateLower.includes(month)) {
      return `${basePath}${file}`
    }
  }

  return `${basePath}/jun.png`
}

const fallbackInfographics: InfographicItem[] = [
  {
    id: 101,
    title: 'Laporan Harian EOC Kemenkes RI: Eksekutif Krisis Kesehatan Kebencanaan',
    category: 'Laporan Harian EOC',
    description: 'Evaluasi harian intelijen krisis kesehatan kebencanaan, pemetaan spasial hotspot 38 provinsi, kesiapsiagaan fasyankes, dan rekomendasi taktis mobilisasi Tim Medis Darurat (EMT).',
    date: '15 Agustus 2026',
    fileSize: '3.0 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
  },
  {
    id: 102,
    title: 'Laporan Harian EOC Kemenkes RI: Intelijen Situasi Krisis Kesehatan',
    category: 'Laporan Harian EOC',
    description: 'Laporan harian evaluasi kejadian bencana alam nasional, surveilans penyakit potensial KLB di pengungsian, dan kapasitas tempat tidur RS Siaga.',
    date: '11 Agustus 2026',
    fileSize: '2.8 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
  },
  {
    id: 1,
    title: 'Laporan Bulanan EOC - Juni 2026',
    category: 'Infografis Bulanan EOC',
    description: 'Laporan infografis bulanan analisis kejadian bencana, dampak krisis kesehatan, dan mobilisasi Tim Medis Darurat (EMT) Kemenkes RI periode Juni 2026.',
    date: '30 Juni 2026',
    fileSize: '3.5 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
    imageCover: '/jun.png',
  },
  {
    id: 2,
    title: 'Laporan Bulanan EOC - Mei 2026',
    category: 'Infografis Bulanan EOC',
    description: 'Laporan infografis bulanan analisis kejadian bencana, penanganan krisis kesehatan, serta kesiapsiagaan posko darurat periode Mei 2026.',
    date: '31 Mei 2026',
    fileSize: '3.2 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
    imageCover: '/mei.png',
  },
  {
    id: 3,
    title: 'Laporan Bulanan EOC - April 2026',
    category: 'Infografis Bulanan EOC',
    description: 'Laporan infografis eksekutif tren bencana alam nasional, distribusi logistik kesehatan, dan evaluasi CFR periode April 2026.',
    date: '30 April 2026',
    fileSize: '2.9 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
    imageCover: '/apr.png',
  },
  {
    id: 4,
    title: 'Laporan Bulanan EOC - Maret 2026',
    category: 'Infografis Bulanan EOC',
    description: 'Ringkasan infografis bulanan pemantauan krisis kesehatan, kesiapsiagaan faskes, dan mitigasi risiko bencana periode Maret 2026.',
    date: '31 Maret 2026',
    fileSize: '3.1 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
    imageCover: '/mar.png',
  },
  {
    id: 5,
    title: 'Laporan Bulanan EOC - Februari 2026',
    category: 'Infografis Bulanan EOC',
    description: 'Laporan infografis bulanan evaluasi kejadian bencana, kesiapsiagaan tim kesehatan, dan dukungan logistik darurat periode Februari 2026.',
    date: '28 Februari 2026',
    fileSize: '2.8 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
    imageCover: '/feb.png',
  },
  {
    id: 6,
    title: 'Laporan Bulanan EOC - Januari 2026',
    category: 'Infografis Bulanan EOC',
    description: 'Laporan infografis pembuka tahun analisis tren bencana nasional, respon cepat EOC, dan peta risiko krisis kesehatan periode Januari 2026.',
    date: '31 Januari 2026',
    fileSize: '3.4 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
    imageCover: '/jan.png',
  },
  {
    id: 7,
    title: 'Peringatan Dini & Antisipasi Cuaca Ekstrem Nasional',
    category: 'Infografis Peringatan Dini',
    description: 'Peta peringatan dini potensi bencana hidrometeorologi, siaga banjir bandang, dan mitigasi dini posko darurat.',
    date: '20 Juli 2026',
    fileSize: '2.7 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
    imageCover: '/Infografis Peringatan Dini.png',
  },
  {
    id: 8,
    title: 'Pedoman Tata Kelola Peta Respon & Renkon Kesehatan',
    category: 'Tata Kelola Peta Respon & Renkon',
    description: 'Dokumen taktis perancangan peta rencana kontinjensi (Renkon), alur komando EOC, dan peta respon darurat faskes.',
    date: '18 Juli 2026',
    fileSize: '3.1 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
    imageCover: '/Tatkelola Peta Respon & Renkon.png',
  },
  {
    id: 9,
    title: 'Panduan Taktis Penanganan Krisis Kesehatan Darurat',
    category: 'Panduan Krisis Kesehatan',
    description: 'Panduan standar operasional prosedur penanganan korban massal, triase posko darurat, dan sanitasi pengungsian.',
    date: '15 Juli 2026',
    fileSize: '4.2 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
    imageCover: '/Panduan Krisis Kesehatan.png',
  },
  {
    id: 10,
    title: 'Laporan Khusus Kejadian Bencana & Krisis Kesehatan',
    category: 'Infografis Bencana/ Krisis Kesehatan',
    description: 'Ringkasan komparatif kejadian bencana alam nasional, dampak kerusakan faskes, dan penanganan korban darurat.',
    date: '12 Juli 2026',
    fileSize: '3.8 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
    imageCover: '/Lap_Juni.jpeg',
  },
  {
    id: 11,
    title: 'Peta Pemetaan & Analisis Risiko Krisis Kesehatan',
    category: 'Infografis Risiko Krisis',
    description: 'Infografis matriks pemetaan daerah rawan bencana, indeks kerentanan wilayah, dan kapasitas respon kesehatan.',
    date: '10 Juli 2026',
    fileSize: '2.9 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
    imageCover: '/Infografis Risiko Krisis.png',
  },
  {
    id: 12,
    title: 'Laporan Ketersediaan & Distribusi Logistik Krisis',
    category: 'Infografis Logistik Krisis Kesehatan',
    description: 'Infografis pemantauan buffer stock obat-obatan darurat, kit medis EMT, dan distribusi bantuan kesehatan nasional.',
    date: '08 Juli 2026',
    fileSize: '2.5 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
    imageCover: '/Infografis Logistik Krisis Kesehatan.png',
  },
  {
    id: 13,
    title: 'Laporan Evaluasi Upaya Penanganan Krisis Kesehatan',
    category: 'Infografis Upaya Krisis Kesehatan',
    description: 'Laporan infografis capaian mobilisasi tenaga kesehatan, pelayanan medis lapangan, dan pemulihan faskes.',
    date: '05 Juli 2026',
    fileSize: '3.0 MB',
    pages: 3,
    pdfUrl: '/laporan_eoc_kemenkes.pdf',
    imageCover: '/Infografis Upaya Krisis Kesehatan.png',
  },
]

export default function InfografisPage() {
  const [infographics, setInfographics] = useState<InfographicItem[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Semua')
  const [activePreview, setActivePreview] = useState<InfographicItem | null>(null)

  // Download PDF handler
  const handleDownloadPdf = async (e: React.MouseEvent, item?: InfographicItem | string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!item) return

    const targetItem: Partial<InfographicItem> = typeof item === 'string'
      ? { title: item, pdfUrl: '/laporan_eoc_kemenkes.pdf' }
      : item

    const url = targetItem.pdfUrl || '/laporan_eoc_kemenkes.pdf'
    const fileName = targetItem.title
      ? `${targetItem.title.replace(/[^a-zA-Z0-9_\-]/g, '_')}.pdf`
      : 'Laporan_Infografis_EOC_Kemenkes.pdf'

    try {
      const res = await fetch(url)
      if (res.ok) {
        const blob = await res.blob()
        const blobUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(blobUrl)
        return
      }
    } catch {
      // fallback window.open
    }

    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function loadInfographics(showRefreshingState = false) {
    if (showRefreshingState) setIsRefreshing(true)
    else setIsLoadingData(true)

    try {
      const res = await fetch('/api/infografis-list', { cache: 'no-store' })
      const json = await res.json()
      if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
        setInfographics(json.data)
      } else {
        setInfographics(fallbackInfographics)
      }
    } catch {
      setInfographics(fallbackInfographics)
    } finally {
      setIsLoadingData(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadInfographics()
  }, [])

  // Categories list
  const categories = useMemo(() => {
    return ['Semua', ...INFOGRAPHIC_CATEGORIES]
  }, [])

  // Filtered items
  const filteredItems = useMemo(() => {
    return infographics.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory =
        selectedCategory === 'Semua' || item.category === selectedCategory

      return matchesSearch && matchesCategory
    })
  }, [infographics, searchQuery, selectedCategory])

  return (
    <div className="relative w-full space-y-5 px-4 py-5 sm:px-6 lg:px-8 bg-[#fbffff] min-h-[calc(100vh-140px)] animate-in fade-in duration-200">

      {/* Header bar matching Detail Kejadian layout with Back Arrow & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition shrink-0"
            title="Kembali ke Dashboard Utama"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Galeri Infografis & Dokumen AI</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-[#047D78] border border-teal-200">
                EOC Kemenkes RI
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 font-normal mt-1">
              Kumpulan dokumen laporan resmi dan infografis hasil evaluasi AI EOC Kemenkes RI.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => loadInfographics(true)}
            disabled={isRefreshing || isLoadingData}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Muat ulang data dokumen terbaru"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#047D78] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Memuat...' : 'Muat Ulang'}</span>
          </button>
        </div>
      </div>

      {/* Clean Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul infografis atau dokumen..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 placeholder-slate-400 focus:border-teal-500 focus:outline-none bg-slate-50/50"
          />
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <Filter className="h-4 w-4 text-slate-400 shrink-0 me-1" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition shrink-0 ${
                selectedCategory === cat
                  ? 'bg-[#047D78] text-white border-[#047D78] shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-650 border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Compact Grid Layout (6 columns on XL, 5 on LG, 4 on MD, 3 on SM, 2 on Mobile) */}
      {isLoadingData ? (
        <div className="w-full min-h-[300px] flex flex-col items-center justify-center space-y-3 bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
          <Loader2 className="h-8 w-8 animate-spin text-[#047D78]" />
          <p className="text-xs sm:text-sm font-semibold text-slate-500">Memuat berkas infografis dari database...</p>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 group"
            >
              {/* Real Image Cover or Executive PDF Document Placeholder */}
              <div className="relative aspect-[4/5] w-full bg-slate-100 border-b border-slate-200 overflow-hidden select-none group">
                {item.imageCover && item.imageCover.trim() !== '' && !item.imageCover.includes('jun.png') && item.category !== 'Laporan Harian EOC' ? (
                  <img
                    src={getCoverSrc(item)}
                    alt={item.title}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-all duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-3.5 bg-gradient-to-b from-slate-50 to-slate-100 text-center select-none">
                    <div className="w-12 h-14 bg-white border border-red-200 rounded-lg shadow-xs flex flex-col items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <FileDown className="h-6 w-6 text-red-600" />
                      <span className="text-[7.5px] font-black text-red-600 tracking-wider">PDF</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-800 line-clamp-2 px-1 leading-snug">
                      {item.title}
                    </span>
                    <span className="text-[8.5px] font-medium text-slate-400 mt-1">
                      {item.date || 'Laporan Resmi EOC'}
                    </span>
                  </div>
                )}

                {/* Top Category Badge */}
                <div className="absolute top-2 left-2 z-10">
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold border border-slate-200/80 bg-white/95 text-slate-800 shadow-sm backdrop-blur-xs">
                    {item.category}
                  </span>
                </div>

                {/* Hover Quick Action Screen */}
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-opacity duration-200 z-20">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      setActivePreview(item)
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-800 shadow-md hover:scale-105 transition"
                    title="Pratinjau"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDownloadPdf(e, item)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:scale-105 transition"
                    title="Unduh PDF"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Compact Card Details */}
              <div className="p-2.5 flex flex-col flex-grow justify-between gap-2 bg-white">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {item.date}
                    </span>
                    <span>{item.fileSize}</span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug" title={item.title}>
                    {item.title}
                  </h3>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-1.5 pt-1.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      setActivePreview(item)
                    }}
                    className="flex-1 flex items-center justify-center gap-1 py-1 border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-semibold rounded-md transition"
                  >
                    <Eye className="h-3 w-3" />
                    <span>Lihat</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDownloadPdf(e, item)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold rounded-md transition shadow-2xs"
                  >
                    <FileDown className="h-3 w-3" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 text-center border border-slate-200 rounded-2xl shadow-sm space-y-3">
          <div className="mx-auto w-10 h-10 bg-slate-100 flex items-center justify-center rounded-xl text-slate-400">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">Tidak ada hasil ditemukan</h3>
            <p className="text-xs text-slate-500">Coba ubah pencarian atau filter kategori.</p>
          </div>
        </div>
      )}

      {/* ── Preview Modal Overlay ── */}
      {activePreview && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/70 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-[95vw] max-w-5xl lg:max-w-6xl bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[90vh] max-h-[92vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-[#047D78] uppercase tracking-wider">
                  {activePreview.category}
                </span>
                <h3 className="text-base font-bold text-slate-800">{activePreview.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={activePreview.pdfUrl || '/laporan_eoc_kemenkes.pdf'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition shadow-2xs"
                  title="Buka PDF di Tab Baru"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Buka Tab Baru</span>
                </a>
                <button
                  onClick={() => setActivePreview(null)}
                  className="text-slate-400 hover:bg-slate-200 p-1.5 rounded-xl transition"
                  title="Tutup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col space-y-4">
              <div className="w-full flex-1 min-h-[480px] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative flex items-center justify-center shadow-inner">
                <iframe
                  src={activePreview.pdfUrl || '/laporan_eoc_kemenkes.pdf'}
                  className="w-full h-full border-0 rounded-xl"
                  title="Pratinjau Dokumen PDF Infografis EOC"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 shrink-0">
                <div className="space-y-0.5 max-w-2xl">
                  <h4 className="text-xs font-bold text-slate-700">Ringkasan Infografis</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {activePreview.description}
                  </p>
                  <div className="flex gap-4 text-[11px] text-slate-400 font-medium pt-1">
                    <span>Tanggal: {activePreview.date}</span>
                    <span>Ukuran: {activePreview.fileSize} ({activePreview.pages} Hlm)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                  <button
                    onClick={() => setActivePreview(null)}
                    className="flex-1 sm:flex-initial px-5 py-2.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition"
                  >
                    Tutup
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDownloadPdf(e, activePreview ?? undefined)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition shadow-md"
                  >
                    <FileDown className="h-4 w-4" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
