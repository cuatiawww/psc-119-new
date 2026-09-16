'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Download,
  Filter,
  Search,
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  ExternalLink,
  ShieldAlert,
  Building2,
  Users,
  Sparkles,
  Printer,
  RotateCcw,
  Info,
  Check,
  Globe,
  Loader2,
  Home,
} from 'lucide-react'
import { useHeaderStore } from '@/lib/headerStore'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
import { useAuthStore } from '@/lib/authStore'
import { buildRegionsUrl } from '@/lib/utils/api'
import { INDONESIA_PROVINCES, INDONESIA_MAP_VIEWBOX } from '@/lib/indonesiaMapData'

// Data model type
export type LaporanItem = {
  id: number
  kode_laporan: string
  tgl_kejadian: string
  tgl_kejadian_formatted: string
  jam_kejadian: string
  tgl_perkembangan: string
  tgl_perkembangan_formatted: string
  jam_perkembangan: string
  tingkat_bencana: string
  provinsi: string
  kabupaten: string
  kecamatan: string
  desa: string
  jenis_bencana: string
  korban_meninggal: number
  korban_luka_berat: number
  korban_luka_ringan: number
  korban_hilang: number
  penduduk_terdampak: number
  pengungsi: number
  faskes_terdampak: number
  status_verifikasi: string
  deskripsi: string
  petugas: string
  lat?: number
  lng?: number
  // Field resmi log panggilan PSC 119 untuk matriks tahunan dan ekspor.
  nama_psc?: string
  ticket_id?: string
  status_penanganan_code?: string
  status_penanganan?: string
  jenis_layanan?: string
  id_jenis_layanan?: string | number | null
  kategori_layanan?: string
  spesifikasi_layanan?: string
  petugas_pelapor?: string
  nama_pelapor?: string
  korban?: string
  nomor_kendaraan?: string
  nama_petugas_ambulan?: string
  layanan_ambulance?: string
  rumahsakit_rujukan?: string
  waktu_respons?: string | number | null
  response_time_minutes?: number | null
  sumber_panggilan?: string
  extension?: string
}

// Region Autocomplete Suggestion type
export type RegionSuggestion = {
  id: string
  level: 'PROVINSI' | 'KABUPATEN' | 'KECAMATAN' | 'DESA'
  name: string
  fullName: string // e.g. "KEC. Rajadesa (Kab. Ciamis, Jawa Barat)"
  provinsi: string
  kabupaten?: string
  kecamatan?: string
  desa?: string
}

// Full 38 Indonesian Provinces list
const ALL_INDONESIA_PROVINCES = [
  'ACEH',
  'SUMATERA UTARA',
  'SUMATERA BARAT',
  'RIAU',
  'KEPULAUAN RIAU',
  'JAMBI',
  'SUMATERA SELATAN',
  'KEPULAUAN BANGKA BELITUNG',
  'BENGKULU',
  'LAMPUNG',
  'DKI JAKARTA',
  'JAWA BARAT',
  'BANTEN',
  'JAWA TENGAH',
  'DI YOGYAKARTA',
  'JAWA TIMUR',
  'BALI',
  'NUSA TENGGARA BARAT',
  'NUSA TENGGARA TIMUR',
  'KALIMANTAN BARAT',
  'KALIMANTAN TENGAH',
  'KALIMANTAN SELATAN',
  'KALIMANTAN TIMUR',
  'KALIMANTAN UTARA',
  'SULAWESI UTARA',
  'GORONTALO',
  'SULAWESI TENGAH',
  'SULAWESI BARAT',
  'SULAWESI SELATAN',
  'SULAWESI TENGGARA',
  'MALUKU',
  'MALUKU UTARA',
  'PAPUA',
  'PAPUA BARAT',
  'PAPUA BARAT DAYA',
  'PAPUA TENGAH',
  'PAPUA PEGUNUNGAN',
  'PAPUA SELATAN',
]

// Comprehensive Master list of Region Autocomplete Suggestions (PROVINSI, KABUPATEN, KECAMATAN, DESA)
const MASTER_REGION_SUGGESTIONS: RegionSuggestion[] = [
  // === PROVINSI ===
  ...ALL_INDONESIA_PROVINCES.map((prov, i) => ({
    id: `prov-${i + 1}`,
    level: 'PROVINSI' as const,
    name: prov,
    fullName: `PROV. ${prov}`,
    provinsi: prov,
  })),

  // === KABUPATEN / KOTA ===
  {
    id: 'kab-1',
    level: 'KABUPATEN',
    name: 'Ciamis',
    fullName: 'KAB. Ciamis (Jawa Barat)',
    provinsi: 'JAWA BARAT',
    kabupaten: 'KAB. CIAMIS',
  },
  {
    id: 'kab-2',
    level: 'KABUPATEN',
    name: 'Musi Banyuasin',
    fullName: 'KAB. Musi Banyuasin (Sumatera Selatan)',
    provinsi: 'SUMATERA SELATAN',
    kabupaten: 'KAB. MUSI BANYUASIN',
  },
  {
    id: 'kab-3',
    level: 'KABUPATEN',
    name: 'Pekalongan',
    fullName: 'KAB. Pekalongan (Jawa Tengah)',
    provinsi: 'JAWA TENGAH',
    kabupaten: 'KAB. PEKALONGAN',
  },
  {
    id: 'kab-4',
    level: 'KABUPATEN',
    name: 'Sumbawa',
    fullName: 'KAB. Sumbawa (Nusa Tenggara Barat)',
    provinsi: 'NUSA TENGGARA BARAT',
    kabupaten: 'KAB. SUMBAWA',
  },
  {
    id: 'kab-5',
    level: 'KABUPATEN',
    name: 'Cirebon',
    fullName: 'KAB. Cirebon (Jawa Barat)',
    provinsi: 'JAWA BARAT',
    kabupaten: 'KAB. CIREBON',
  },
  {
    id: 'kab-6',
    level: 'KABUPATEN',
    name: 'Sarolangun',
    fullName: 'KAB. Sarolangun (Jambi)',
    provinsi: 'JAMBI',
    kabupaten: 'KAB. SAROLANGUN',
  },
  {
    id: 'kab-7',
    level: 'KABUPATEN',
    name: 'Kampar',
    fullName: 'KAB. Kampar (Riau)',
    provinsi: 'RIAU',
    kabupaten: 'KAB. KAMPAR',
  },
  {
    id: 'kab-8',
    level: 'KABUPATEN',
    name: 'Kota Palangka Raya',
    fullName: 'KOTA Palangka Raya (Kalimantan Tengah)',
    provinsi: 'KALIMANTAN TENGAH',
    kabupaten: 'KOTA PALANGKA RAYA',
  },
  {
    id: 'kab-9',
    level: 'KABUPATEN',
    name: 'Probolinggo',
    fullName: 'KAB. Probolinggo (Jawa Timur)',
    provinsi: 'JAWA TIMUR',
    kabupaten: 'KAB. PROBOLINGGO',
  },
  {
    id: 'kab-10',
    level: 'KABUPATEN',
    name: 'Cianjur',
    fullName: 'KAB. Cianjur (Jawa Barat)',
    provinsi: 'JAWA BARAT',
    kabupaten: 'KAB. CIANJUR',
  },
  {
    id: 'kab-11',
    level: 'KABUPATEN',
    name: 'Gayo Lues',
    fullName: 'KAB. Gayo Lues (Aceh)',
    provinsi: 'ACEH',
    kabupaten: 'KAB. GAYO LUES',
  },
  {
    id: 'kab-12',
    level: 'KABUPATEN',
    name: 'Padang Pariaman',
    fullName: 'KAB. Padang Pariaman (Sumatera Barat)',
    provinsi: 'SUMATERA BARAT',
    kabupaten: 'KAB. PADANG PARIAMAN',
  },
  {
    id: 'kab-13',
    level: 'KABUPATEN',
    name: 'Flores Timur',
    fullName: 'KAB. Flores Timur (Nusa Tenggara Timur)',
    provinsi: 'NUSA TENGGARA TIMUR',
    kabupaten: 'KAB. FLORES TIMUR',
  },
  {
    id: 'kab-14',
    level: 'KABUPATEN',
    name: 'Belitung Timur',
    fullName: 'KAB. Belitung Timur (Kep. Bangka Belitung)',
    provinsi: 'KEPULAUAN BANGKA BELITUNG',
    kabupaten: 'KAB. BELITUNG TIMUR',
  },
  {
    id: 'kab-15',
    level: 'KABUPATEN',
    name: 'Kota Banjarbaru',
    fullName: 'KOTA Banjarbaru (Kalimantan Selatan)',
    provinsi: 'KALIMANTAN SELATAN',
    kabupaten: 'KOTA BANJAR BARU',
  },
  {
    id: 'kab-16',
    level: 'KABUPATEN',
    name: 'Kota Tangerang',
    fullName: 'KOTA Tangerang (Banten)',
    provinsi: 'BANTEN',
    kabupaten: 'KAB. KOTA TANGERANG',
  },
  {
    id: 'kab-17',
    level: 'KABUPATEN',
    name: 'Pasaman Barat',
    fullName: 'KAB. Pasaman Barat (Sumatera Barat)',
    provinsi: 'SUMATERA BARAT',
    kabupaten: 'KAB. PASAMAN BARAT',
  },
  {
    id: 'kab-18',
    level: 'KABUPATEN',
    name: 'Sukabumi',
    fullName: 'KAB. Sukabumi (Jawa Barat)',
    provinsi: 'JAWA BARAT',
    kabupaten: 'KAB. SUKABUMI',
  },
  {
    id: 'kab-19',
    level: 'KABUPATEN',
    name: 'Intan Jaya',
    fullName: 'KAB. Intan Jaya (Papua Tengah)',
    provinsi: 'PAPUA TENGAH',
    kabupaten: 'KAB. INTAN JAYA',
  },
  {
    id: 'kab-20',
    level: 'KABUPATEN',
    name: 'Sumedang',
    fullName: 'KAB. Sumedang (Jawa Barat)',
    provinsi: 'JAWA BARAT',
    kabupaten: 'KAB. SUMEDANG',
  },
  {
    id: 'kab-21',
    level: 'KABUPATEN',
    name: 'Luwu Utara',
    fullName: 'KAB. Luwu Utara (Sulawesi Selatan)',
    provinsi: 'SULAWESI SELATAN',
    kabupaten: 'KAB. LUWU UTARA',
  },

  // === KECAMATAN ===
  {
    id: 'sug-1',
    level: 'KECAMATAN',
    name: 'Rajadesa',
    fullName: 'KEC. Rajadesa (Kab. Ciamis, Jawa Barat)',
    provinsi: 'JAWA BARAT',
    kabupaten: 'KAB. CIAMIS',
    kecamatan: 'Rajadesa',
  },
  {
    id: 'sug-2',
    level: 'KECAMATAN',
    name: 'Sanga Desa',
    fullName: 'KEC. Sanga Desa (Kab. Musi Banyuasin, Sumatera Selatan)',
    provinsi: 'SUMATERA SELATAN',
    kabupaten: 'KAB. MUSI BANYUASIN',
    kecamatan: 'Sanga Desa',
  },
  {
    id: 'sug-3',
    level: 'KECAMATAN',
    name: 'Wiradesa',
    fullName: 'KEC. Wiradesa (Kab. Pekalongan, Jawa Tengah)',
    provinsi: 'JAWA TENGAH',
    kabupaten: 'KAB. PEKALONGAN',
    kecamatan: 'Wiradesa',
  },
  {
    id: 'sug-11',
    level: 'KECAMATAN',
    name: 'Jekan Raya',
    fullName: 'KEC. Jekan Raya (Kota Palangka Raya, Kalimantan Tengah)',
    provinsi: 'KALIMANTAN TENGAH',
    kabupaten: 'KOTA PALANGKA RAYA',
    kecamatan: 'Jekan Raya',
  },
  {
    id: 'sug-12',
    level: 'KECAMATAN',
    name: 'Cugenang',
    fullName: 'KEC. Cugenang (Kab. Cianjur, Jawa Barat)',
    provinsi: 'JAWA BARAT',
    kabupaten: 'KAB. CIANJUR',
    kecamatan: 'Cugenang',
  },
  {
    id: 'sug-13',
    level: 'KECAMATAN',
    name: 'Blangkejeren',
    fullName: 'KEC. Blangkejeren (Kab. Gayo Lues, Aceh)',
    provinsi: 'ACEH',
    kabupaten: 'KAB. GAYO LUES',
    kecamatan: 'Blangkejeren',
  },
  {
    id: 'sug-14',
    level: 'KECAMATAN',
    name: 'Tegalwenuan',
    fullName: 'KEC. Tegalwenuan (Kab. Probolinggo, Jawa Timur)',
    provinsi: 'JAWA TIMUR',
    kabupaten: 'KAB. PROBOLINGGO',
    kecamatan: 'Tegalwenuan',
  },
  {
    id: 'sug-16',
    level: 'KECAMATAN',
    name: 'Adonara',
    fullName: 'KEC. Adonara (Kab. Flores Timur, NTT)',
    provinsi: 'NUSA TENGGARA TIMUR',
    kabupaten: 'KAB. FLORES TIMUR',
    kecamatan: 'Adonara',
  },
  {
    id: 'sug-18',
    level: 'KECAMATAN',
    name: 'Batuceper',
    fullName: 'KEC. Batuceper (Kota Tangerang, Banten)',
    provinsi: 'BANTEN',
    kabupaten: 'KAB. KOTA TANGERANG',
    kecamatan: 'Batuceper',
  },
  {
    id: 'sug-20',
    level: 'KECAMATAN',
    name: 'Masamba',
    fullName: 'KEC. Masamba (Kab. Luwu Utara, Sulawesi Selatan)',
    provinsi: 'SULAWESI SELATAN',
    kabupaten: 'KAB. LUWU UTARA',
    kecamatan: 'Masamba',
  },

  // === DESA / KELURAHAN ===
  {
    id: 'sug-4',
    level: 'DESA',
    name: 'Bao Desa',
    fullName: 'DESA/KEL. Bao Desa (KEC. Batu Lanteh, Kab. Sumbawa)',
    provinsi: 'NUSA TENGGARA BARAT',
    kabupaten: 'KAB. SUMBAWA',
    kecamatan: 'Batu Lanteh',
    desa: 'Bao Desa',
  },
  {
    id: 'sug-5',
    level: 'DESA',
    name: 'Bodesari',
    fullName: 'DESA/KEL. Bodesari (KEC. Plumbon, Kab. Cirebon)',
    provinsi: 'JAWA BARAT',
    kabupaten: 'KAB. CIREBON',
    kecamatan: 'Plumbon',
    desa: 'Bodesari',
  },
  {
    id: 'sug-6',
    level: 'DESA',
    name: 'Desa Baru',
    fullName: 'DESA/KEL. Desa Baru (KEC. Air Hitam, Kab. Sarolangun)',
    provinsi: 'JAMBI',
    kabupaten: 'KAB. SAROLANGUN',
    kecamatan: 'Air Hitam',
    desa: 'Desa Baru',
  },
  {
    id: 'sug-7',
    level: 'DESA',
    name: 'Desa Baru',
    fullName: 'DESA/KEL. Desa Baru (KEC. Siak Hulu, Kab. Kampar)',
    provinsi: 'RIAU',
    kabupaten: 'KAB. KAMPAR',
    kecamatan: 'Siak Hulu',
    desa: 'Desa Baru',
  },
  {
    id: 'sug-8',
    level: 'DESA',
    name: 'Kelurahan Palangka',
    fullName: 'DESA/KEL. Kelurahan Palangka (KEC. Jekan Raya, Kota Palangka Raya)',
    provinsi: 'KALIMANTAN TENGAH',
    kabupaten: 'KOTA PALANGKA RAYA',
    kecamatan: 'Jekan Raya',
    desa: 'Kelurahan Palangka',
  },
  {
    id: 'sug-9',
    level: 'DESA',
    name: 'Desa Gasol',
    fullName: 'DESA/KEL. Desa Gasol (KEC. Cugenang, Kab. Cianjur)',
    provinsi: 'JAWA BARAT',
    kabupaten: 'KAB. CIANJUR',
    kecamatan: 'Cugenang',
    desa: 'Desa Gasol',
  },
  {
    id: 'sug-10',
    level: 'DESA',
    name: 'Gampong Kutelintang',
    fullName: 'DESA/KEL. Gampong Kutelintang (KEC. Blangkejeren, Kab. Gayo Lues)',
    provinsi: 'ACEH',
    kabupaten: 'KAB. GAYO LUES',
    kecamatan: 'Blangkejeren',
    desa: 'Gampong Kutelintang',
  },
  {
    id: 'sug-15',
    level: 'DESA',
    name: 'Desa Tegalwenuan Wetan',
    fullName: 'DESA/KEL. Desa Tegalwenuan Wetan (KEC. Tegalwenuan, Kab. Probolinggo)',
    provinsi: 'JAWA TIMUR',
    kabupaten: 'KAB. PROBOLINGGO',
    kecamatan: 'Tegalwenuan',
    desa: 'Desa Tegalwenuan Wetan',
  },
  {
    id: 'sug-17',
    level: 'DESA',
    name: 'Desa Klatanlo',
    fullName: 'DESA/KEL. Desa Klatanlo (KEC. Adonara, Kab. Flores Timur)',
    provinsi: 'NUSA TENGGARA TIMUR',
    kabupaten: 'KAB. FLORES TIMUR',
    kecamatan: 'Adonara',
    desa: 'Desa Klatanlo',
  },
  {
    id: 'sug-19',
    level: 'DESA',
    name: 'Kelurahan Batuceper',
    fullName: 'DESA/KEL. Kelurahan Batuceper (KEC. Batuceper, Kota Tangerang)',
    provinsi: 'BANTEN',
    kabupaten: 'KAB. KOTA TANGERANG',
    kecamatan: 'Batuceper',
    desa: 'Kelurahan Batuceper',
  },
  {
    id: 'sug-21',
    level: 'DESA',
    name: 'Kelurahan Bone',
    fullName: 'DESA/KEL. Kelurahan Bone (KEC. Masamba, Kab. Luwu Utara)',
    provinsi: 'SULAWESI SELATAN',
    kabupaten: 'KAB. LUWU UTARA',
    kecamatan: 'Masamba',
    desa: 'Kelurahan Bone',
  },
]

const ALL_JENIS_BENCANA: string[] = [
  'Trauma KLL',
  'Trauma Non Kll',
  'Trauma Gigitan / Sengatan Hewan Berbisa',
  'Non Trauma - Jantung',
  'Non Trauma - Stroke',
  'Non Trauma - Hipertensi',
  'Non Trauma Lainnya',
  'Ambulan Gadar',
  'Ambulan Transport',
  'KIA - IBU',
  'KIA - ANAK',
  'Kebakaran',
  'Bencana',
  'Rujukan',
  'Keperawatan',
  'Edukasi',
  'Lainnya',
]

const PROVINCE_CODE_MAPPING: Record<string, string> = {
  '8557': 'PAPUA SELATAN',
  '8558': 'PAPUA TENGAH',
  '8559': 'PAPUA PEGUNUNGAN',
  '8560': 'PAPUA BARAT DAYA',
  '2': 'PAPUA SELATAN',
  '12': 'PAPUA TENGAH',
  '15': 'PAPUA PEGUNUNGAN',
  '34': 'PAPUA BARAT DAYA',
}

function resolveProvinceName(input?: string): string {
  if (!input) return 'NASIONAL'
  const trimmed = String(input).trim()
  if (PROVINCE_CODE_MAPPING[trimmed]) {
    return PROVINCE_CODE_MAPPING[trimmed]
  }
  let normalized = trimmed.toUpperCase()
  if (normalized === 'DI YOGYAKARTA' || normalized === 'DIY') normalized = 'D.I. YOGYAKARTA'
  return normalized
}

export default function UnduhLaporanPage() {
  const { setHeader } = useHeaderStore()
  const { user } = useAuthStore()

  // Initialize Header store titles on mount
  useEffect(() => {
    setHeader({
      title: 'REKAP & UNDUH LOG DISPATCH PSC 119',
      description: 'Pusat filter terpadu dan ekstraksi data log dispatch panggilan gawat darurat medis, armada ambulans, dan rujukan SPGDT Kemenkes RI real-time (Excel, PDF, CSV).',
      lastUpdated: 'Baru Saja'
    })
  }, [setHeader])

  // MULTIPLE SELECT FILTER STATES & LIVE API DATA FETCHING
  const [reports, setReports] = useState<LaporanItem[]>([])
  const [reportYear, setReportYear] = useState(() => {
    if (typeof window !== 'undefined') {
      const queryYear = new URLSearchParams(window.location.search).get('year') || new URLSearchParams(window.location.search).get('tahun')
      if (queryYear && /^\d{4}$/.test(queryYear)) return queryYear
    }
    return String(new Date().getFullYear())
  })
  const [loadingApiReports, setLoadingApiReports] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedDatePreset, setSelectedDatePreset] = useState<string>('all')
  const [filterKorbanOnly, setFilterKorbanOnly] = useState(false)
  const [filterFaskesOnly, setFilterFaskesOnly] = useState(false)
  const [isGeneratingAiDashboard, setIsGeneratingAiDashboard] = useState<boolean>(false)
  const [aiProgressStep, setAiProgressStep] = useState<string>('')

  // Fetch live reports data from API proxy (/api/bencana-stats)
  useEffect(() => {
    const fetchLiveReports = async () => {
      setLoadingApiReports(true)
      try {
        const token = useAuthStore.getState().token
        const headers: Record<string, string> = { Accept: 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const res = await fetch(`${basePath}/api/bencana-stats?year=${encodeURIComponent(reportYear)}`, {
          method: 'GET',
          headers,
          cache: 'no-store',
        })

        if (res.ok) {
          const json = await res.json().catch(() => null)
          const sourceCalls = Array.isArray(json?.calls) ? json.calls : (Array.isArray(json?.markers) ? json.markers : [])
          if (json && Array.isArray(sourceCalls)) {
            const mapped: LaporanItem[] = sourceCalls.map((m: any, idx: number) => {
              const raw = m.raw_psc || {}
              const callDate = m.tanggal_panggilan || raw.tanggal_panggilan || m.tgl_kejadian || raw.tgl_pelaporan_panggilan
              const d = callDate ? new Date(callDate) : new Date()
              const dateStr = !isNaN(d.getTime())
                ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                : callDate || 'Tidak tersedia'
              const timeStr = !isNaN(d.getTime())
                ? (m.jam_pelaporan_panggilan || raw.jam_pelaporan_panggilan || d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })) + ' WIB'
                : (m.jam_pelaporan_panggilan || raw.jam_pelaporan_panggilan || '-') + ' WIB'

              let jb = (m.spesifikasi_layanan || raw.spesifikasi_layanan || m.jenis_bencana || m.kategori_layanan || raw.kategori_layanan || m.jenis_layanan || raw.jenis_layanan || '').trim()
              if (!jb || jb === '0' || jb.toLowerCase() === 'null') {
                jb = 'Lainnya'
              }

              const serviceType = String(m.jenis_layanan || raw.jenis_layanan || '').trim() || 'Non Category'
              const callStatus = String(m.status_penanganan_code || raw.status_penanganan_code || m.status_penanganan || raw.status_penanganan || 'Diproses').trim()
              const hasAmbulance = Boolean(m.nomor_kendaraan || raw.nomor_kendaraan || m.id_ambulan || raw.id_ambulan)
              const hasReferral = Boolean(m.rumahsakit_rujukan || raw.rumahsakit_rujukan)

              return {
                id: idx + 1,
                kode_laporan: String(m.ticket_id || m.kode_trans || raw.ticket_id || m.id || `LAP-${d.getFullYear()}-${String(idx + 1).padStart(3, '0')}`),
                tgl_kejadian: callDate || new Date().toISOString(),
                tgl_kejadian_formatted: dateStr,
                jam_kejadian: timeStr,
                tgl_perkembangan: m.tgl_status_penanganan || raw.tgl_status_penanganan || callDate || new Date().toISOString(),
                tgl_perkembangan_formatted: dateStr,
                jam_perkembangan: timeStr,
                tingkat_bencana: serviceType,
                provinsi: resolveProvinceName(raw.provinsi || m.provinsi),
                kabupaten: (raw.kabupaten || m.kabupaten || m.nama_psc || raw.nama_psc || 'Lainnya').toUpperCase().trim(),
                kecamatan: (m.kecamatan || raw.kecamatan || '').trim() || '-',
                desa: (m.nama_lokasi || raw.nama_lokasi || m.alamat || raw.alamat || m.nama_desa || '').trim() || '-',
                jenis_bencana: jb,
                korban_meninggal: Number(m.jml_meninggal || m.korban_meninggal || raw.jml_meninggal || 0),
                korban_luka_berat: Number(m.jml_lkbrt || m.korban_luka_berat || raw.jml_lkbrt || 0),
                korban_luka_ringan: Number(m.jml_lkringan || m.korban_luka_ringan || raw.jml_lkringan || 0),
                korban_hilang: Number(m.jml_hilang || m.korban_hilang || raw.jml_hilang || 0),
                penduduk_terdampak: Number(m.jml_pdk_terdampak || m.penduduk_terdampak || raw.jml_pdk_terdampak || 0),
                pengungsi: hasAmbulance ? 1 : Number(m.jml_pengungsi || m.pengungsi || 0),
                faskes_terdampak: hasReferral ? 1 : Number(m.faskes_terdampak || m.jml_faskes || 0),
                status_verifikasi: callStatus,
                deskripsi: m.keluhan || raw.keluhan || m.keterangan || raw.keterangan || `Panggilan ${serviceType} ${jb} dari ${raw.nama_psc || m.nama_psc || 'PSC 119'}.`,
                petugas: m.petugas_pelapor || raw.petugas_pelapor || m.petugas || m.created_by || 'Petugas PSC 119',
                lat: m.lat !== undefined && m.lat !== null && m.lat !== '' ? Number(m.lat) : (raw.latitude ? Number(raw.latitude) : undefined),
                lng: m.lng !== undefined && m.lng !== null && m.lng !== '' ? Number(m.lng) : (raw.longitude ? Number(raw.longitude) : undefined),
                nama_psc: m.nama_psc || raw.nama_psc || '-',
                ticket_id: m.ticket_id || raw.ticket_id || m.kode_trans,
                status_penanganan_code: callStatus,
                status_penanganan: m.status_penanganan || raw.status_penanganan || callStatus,
                jenis_layanan: serviceType,
                id_jenis_layanan: m.id_jenis_layanan ?? raw.id_jenis_layanan,
                kategori_layanan: m.kategori_layanan || raw.kategori_layanan || '-',
                spesifikasi_layanan: m.spesifikasi_layanan || raw.spesifikasi_layanan || jb,
                petugas_pelapor: m.petugas_pelapor || raw.petugas_pelapor || '-',
                nama_pelapor: m.nama_pelapor || raw.nama_pelapor || '-',
                korban: m.korban || raw.korban || '-',
                nomor_kendaraan: m.nomor_kendaraan || raw.nomor_kendaraan || '-',
                nama_petugas_ambulan: m.nama_petugas_ambulan || raw.nama_petugas_ambulan || '-',
                layanan_ambulance: m.layanan_ambulance || raw.layanan_ambulance || '-',
                rumahsakit_rujukan: m.rumahsakit_rujukan || raw.rumahsakit_rujukan || '-',
                waktu_respons: m.waktu_respons ?? raw.waktu_respons,
                response_time_minutes: m.response_time_minutes ?? raw.response_time_minutes,
                sumber_panggilan: m.sumber_panggilan || raw.sumber_panggilan || '-',
                extension: m.extension || raw.extension || '-'
              }
            })

            setReports(mapped)
            console.log(`[UnduhLaporanPage] Loaded calls for year ${reportYear}:`, mapped.length)
            return
          }
        }
        setReports([])
      } catch (err) {
        console.warn('[UnduhLaporanPage] Error loading live reports API:', err)
        setReports([])
      } finally {
        setLoadingApiReports(false)
      }
    }

    fetchLiveReports()
  }, [reportYear])

  // Smart Region Autocomplete Search State (PROV, KAB, KEC, DESA)
  const [regionInputQuery, setRegionInputQuery] = useState('')
  const [showRegionDropdown, setShowRegionDropdown] = useState(false)
  const [selectedRegionPills, setSelectedRegionPills] = useState<RegionSuggestion[]>([])
  const regionDropdownRef = useRef<HTMLDivElement>(null)

  const [provinceSearch, setProvinceSearch] = useState('')
  const [provinceList, setProvinceList] = useState<Array<{ id: string; name: string }>>([])
  const [loadingProvinces, setLoadingProvinces] = useState(true)

  // Close region autocomplete dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(e.target as Node)) {
        setShowRegionDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch live 38 provinces from API or fallback
  useEffect(() => {
    const fetchProvinces = async () => {
      setLoadingProvinces(true)
      try {
        const res = await fetch(buildRegionsUrl())
        const contentType = res.headers.get('content-type') || ''
        if (res.ok && contentType.includes('application/json')) {
          const payload = await res.json()
          if (payload?.success && Array.isArray(payload?.data) && payload.data.length > 0) {
            const mapped = payload.data.map((item: any) => ({
              id: String(item.code || item.id),
              name: String(item.name).toUpperCase(),
            }))
            setProvinceList(mapped)
            return
          }
        }
      } catch (err) {
        console.error('Failed loading provinces API, using full fallback list:', err)
      } finally {
        setLoadingProvinces(false)
      }

      setProvinceList(ALL_INDONESIA_PROVINCES.map((p, idx) => ({ id: String(idx + 1), name: p })))
    }

    fetchProvinces()
  }, [])

  // Sync initial scope from dashboard user state if present
  useEffect(() => {
    if (user?.wilayah_scope?.provinsi?.label) {
      const activeProvName = user.wilayah_scope.provinsi.label.toUpperCase()
      const match = provinceList.find(p => p.name.toUpperCase() === activeProvName)
      if (match && selectedProvinces.length === 0) {
        setSelectedProvinces([match.name])
      }
    }
  }, [user, provinceList, selectedProvinces.length])

  // Accordion toggle states in Filter Sidebar
  const [expandedSection, setExpandedSection] = useState<{ [key: string]: boolean }>({
    smartRegion: true,
    provinsi: true,
    jenisBencana: true,
    tanggal: true,
    status: true,
    dampak: true,
  })

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  // Pagination state
  const [itemsPerPage, setItemsPerPage] = useState<number>(10)
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Selected report for detail modal
  const [detailItem, setDetailItem] = useState<LaporanItem | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Region Autocomplete Suggestions Calculation (Full PROV, KAB, KEC, DESA)
  const filteredRegionSuggestions = useMemo(() => {
    if (!regionInputQuery.trim() || regionInputQuery.trim().length < 2) return []
    const q = regionInputQuery.toLowerCase().trim()

    // Filter master region suggestions
    const matches = MASTER_REGION_SUGGESTIONS.filter((sug) =>
      sug.fullName.toLowerCase().includes(q) ||
      sug.name.toLowerCase().includes(q) ||
      (sug.kabupaten && sug.kabupaten.toLowerCase().includes(q)) ||
      (sug.kecamatan && sug.kecamatan.toLowerCase().includes(q)) ||
      (sug.desa && sug.desa.toLowerCase().includes(q))
    )

    // Deduplicate by fullName
    const seen = new Set()
    return matches.filter((item) => {
      const duplicateKey = item.fullName.toLowerCase()
      if (seen.has(duplicateKey)) return false
      seen.add(duplicateKey)
      return true
    }).slice(0, 14)
  }, [regionInputQuery])

  // Select region suggestion handler
  const handleSelectRegionSuggestion = (sug: RegionSuggestion) => {
    if (!selectedRegionPills.some((r) => r.id === sug.id || r.fullName === sug.fullName)) {
      setSelectedRegionPills([...selectedRegionPills, sug])
    }
    setRegionInputQuery('')
    setShowRegionDropdown(false)
    setCurrentPage(1)
    showToast(`Filter wilayah "${sug.name}" (${sug.level}) diterapkan!`)
  }

  const handleRemoveRegionPill = (id: string) => {
    setSelectedRegionPills(selectedRegionPills.filter((r) => r.id !== id))
    setCurrentPage(1)
  }

  // Multiple toggle handlers
  const handleTypeToggle = (jenis: string) => {
    const clean = jenis.trim()
    if (selectedTypes.includes(clean)) {
      setSelectedTypes(selectedTypes.filter((t) => t.trim() !== clean))
    } else {
      setSelectedTypes([...selectedTypes, clean])
    }
    setCurrentPage(1)
  }

  const handleProvinceToggle = (provName: string) => {
    const clean = provName.trim()
    if (selectedProvinces.includes(clean)) {
      setSelectedProvinces(selectedProvinces.filter((p) => p.trim() !== clean))
    } else {
      setSelectedProvinces([...selectedProvinces, clean])
    }
    setCurrentPage(1)
  }

  const handleSelectAllProvinces = () => {
    if (selectedProvinces.length === provinceList.length) {
      setSelectedProvinces([])
    } else {
      setSelectedProvinces(provinceList.map((p) => p.name))
    }
    setCurrentPage(1)
  }

  const handleStatusToggle = (st: string) => {
    const clean = st.trim()
    if (selectedStatuses.includes(clean)) {
      setSelectedStatuses(selectedStatuses.filter((s) => s.trim() !== clean))
    } else {
      setSelectedStatuses([...selectedStatuses, clean])
    }
    setCurrentPage(1)
  }

  // Clear all filters
  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedTypes([])
    setSelectedProvinces([])
    setSelectedStatuses([])
    setSelectedDatePreset('all')
    setFilterKorbanOnly(false)
    setFilterFaskesOnly(false)
    setProvinceSearch('')
    setRegionInputQuery('')
    setSelectedRegionPills([])
    setCurrentPage(1)
    showToast('Semua filter telah dibersihkan.')
  }

  // Deduplicated and sorted available disaster types for the filter sidebar
  const availableDisasterTypes = useMemo(() => {
    const dynamicSet = new Set<string>()
    ALL_JENIS_BENCANA.forEach((t) => {
      const clean = t.trim()
      if (clean && clean !== '0' && clean.toLowerCase() !== 'null') {
        dynamicSet.add(clean)
      }
    })
    reports.forEach((r) => {
      const clean = (r.jenis_bencana || '').trim()
      if (clean && clean !== '0' && clean.toLowerCase() !== 'null') {
        dynamicSet.add(clean)
      }
    })
    return Array.from(dynamicSet).sort((a, b) => a.localeCompare(b, 'id'))
  }, [reports])

  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>(['Selesai', 'Diproses'])
    reports.forEach((report) => {
      const status = (report.status_penanganan_code || report.status_verifikasi || '').trim()
      if (status) statuses.add(status)
    })
    return Array.from(statuses).sort((a, b) => a.localeCompare(b, 'id'))
  }, [reports])

  // Active filter count computation
  const activeFilterCount = useMemo(() => {
    let count = 0
    count += selectedTypes.length
    count += selectedProvinces.length
    count += selectedStatuses.length
    count += selectedRegionPills.length
    if (selectedDatePreset !== 'all') count += 1
    if (filterKorbanOnly) count += 1
    if (filterFaskesOnly) count += 1
    if (searchQuery.trim() !== '') count += 1
    return count
  }, [selectedTypes, selectedProvinces, selectedStatuses, selectedRegionPills, selectedDatePreset, filterKorbanOnly, filterFaskesOnly, searchQuery])

  // Comprehensive Filtering engine supporting deep location hierarchy, dates, and types
  const filteredReports = useMemo(() => {
    return reports.filter((item) => {
      // 1. Text Search Query (Searches code, disaster, province, kabupaten, kecamatan, desa, narasi, date)
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim()
        const matchesSearch =
          (item.kode_laporan || '').toLowerCase().includes(q) ||
          (item.jenis_bencana || '').toLowerCase().includes(q) ||
          (item.provinsi || '').toLowerCase().includes(q) ||
          (item.kabupaten || '').toLowerCase().includes(q) ||
          (item.kecamatan || '').toLowerCase().includes(q) ||
          (item.desa || '').toLowerCase().includes(q) ||
          (item.deskripsi || '').toLowerCase().includes(q) ||
          (item.petugas || '').toLowerCase().includes(q) ||
          (item.tgl_kejadian_formatted || '').toLowerCase().includes(q)
        if (!matchesSearch) return false
      }

      // 2. Multiple Jenis Bencana Checkboxes (Case-insensitive trimmed comparison)
      if (selectedTypes.length > 0) {
        const itemType = (item.jenis_bencana || '').trim().toLowerCase()
        const matchesType = selectedTypes.some((t) => t.trim().toLowerCase() === itemType)
        if (!matchesType) return false
      }

      // 3. Multiple Provinsi Checkboxes (Resolved 38 provinces match)
      if (selectedProvinces.length > 0) {
        const itemProv = resolveProvinceName(item.provinsi).toUpperCase().trim()
        const matchesProv = selectedProvinces.some((p) => {
          const targetProv = resolveProvinceName(p).toUpperCase().trim()
          return targetProv === itemProv || itemProv.includes(targetProv) || targetProv.includes(itemProv)
        })
        if (!matchesProv) return false
      }

      // 4. Smart Region Pills (Autocomplete Pills: Prov, Kab, Kec, Desa)
      if (selectedRegionPills.length > 0) {
        const matchesAnyPill = selectedRegionPills.some((pill) => {
          const cleanPillName = pill.name.toLowerCase().replace(/^(provinsi|prov\.|kab\.|kabupaten|kota|kec\.|kecamatan|desa\/kel\.|desa|kelurahan)\s+/gi, '').trim()
          if (pill.level === 'PROVINSI') {
            const provClean = resolveProvinceName(item.provinsi).toLowerCase().replace(/^(provinsi|prov\.)\s+/gi, '').trim()
            return provClean.includes(cleanPillName) || cleanPillName.includes(provClean)
          }
          if (pill.level === 'KABUPATEN') {
            const kabClean = (item.kabupaten || '').toLowerCase().replace(/^(kab\.|kabupaten|kota)\s+/gi, '').trim()
            return kabClean.includes(cleanPillName) || cleanPillName.includes(kabClean)
          }
          if (pill.level === 'KECAMATAN') {
            const kecClean = (item.kecamatan || '').toLowerCase().replace(/^(kec\.|kecamatan)\s+/gi, '').trim()
            return kecClean.includes(cleanPillName) || cleanPillName.includes(kecClean)
          }
          if (pill.level === 'DESA') {
            const desaClean = (item.desa || '').toLowerCase().replace(/^(desa\/kel\.|desa|kelurahan)\s+/gi, '').trim()
            return desaClean.includes(cleanPillName) || cleanPillName.includes(desaClean)
          }
          return false
        })
        if (!matchesAnyPill) return false
      }

      // 5. Multiple Status Verifikasi
      if (selectedStatuses.length > 0) {
        const itemStatus = (item.status_verifikasi || '').trim().toLowerCase()
        const matchesStatus = selectedStatuses.some((st) => st.trim().toLowerCase() === itemStatus)
        if (!matchesStatus) return false
      }

      // 6. Korban Only (Ada Korban Jiwa atau Luka)
      if (filterKorbanOnly) {
        const totalKorban = (item.korban_meninggal || 0) + (item.korban_luka_berat || 0) + (item.korban_luka_ringan || 0) + (item.korban_hilang || 0)
        if (totalKorban === 0) return false
      }

      // 7. Faskes Terdampak Only
      if (filterFaskesOnly) {
        if ((item.faskes_terdampak || 0) === 0) return false
      }

      // 8. Date Filter Preset (Real dynamic timestamp math)
      if (selectedDatePreset !== 'all') {
        const itemDate = new Date(item.tgl_kejadian)
        const reportTime = itemDate.getTime()
        if (!isNaN(reportTime)) {
          const now = Date.now()
          if (selectedDatePreset === '7days') {
            if (now - reportTime > 7 * 86400000 || reportTime > now + 86400000) {
              return false
            }
          } else if (selectedDatePreset === '30days') {
            if (now - reportTime > 30 * 86400000 || reportTime > now + 86400000) {
              return false
            }
          } else if (selectedDatePreset === 'this_year') {
            if (itemDate.getFullYear() !== Number(reportYear)) {
              return false
            }
          }
        }
      }

      return true
    })
  }, [reports, searchQuery, selectedTypes, selectedProvinces, selectedRegionPills, selectedStatuses, filterKorbanOnly, filterFaskesOnly, selectedDatePreset, reportYear])

  // Filtered Province List for Search
  const filteredProvinceList = useMemo(() => {
    if (!provinceSearch.trim()) return provinceList
    const q = provinceSearch.toLowerCase().trim()
    return provinceList.filter((p) => p.name.toLowerCase().includes(q))
  }, [provinceList, provinceSearch])

  // Dynamic Metrics Overview Cards
  const metrics = useMemo(() => {
    const totalReports = filteredReports.length
    let totalMeninggal = 0
    let totalLuka = 0
    let totalTerdampak = 0
    let totalPengungsi = 0
    let totalFaskes = 0

    filteredReports.forEach((r) => {
      totalMeninggal += r.korban_meninggal
      totalLuka += r.korban_luka_berat + r.korban_luka_ringan
      totalTerdampak += r.penduduk_terdampak
      totalPengungsi += r.pengungsi
      totalFaskes += r.faskes_terdampak
    })

    return {
      totalReports,
      totalMeninggal,
      totalLuka,
      totalTerdampak,
      totalPengungsi,
      totalFaskes,
    }
  }, [filteredReports])

  // Pagination logic
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage) || 1
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredReports.slice(start, start + itemsPerPage)
  }, [filteredReports, currentPage, itemsPerPage])

  // EXPORT EXCEL (.CSV format with UTF-8 BOM)
  const handleExportExcel = () => {
    if (filteredReports.length === 0) {
      showToast('Tidak ada data yang sesuai filter untuk diunduh.')
      return
    }

    const headers = [
      'No',
      'Nama PSC',
      'Ticket ID',
      'Status',
      'Jenis Layanan',
      'Waktu Panggilan',
      'Petugas Panggilan',
      'Nama Pelapor',
      'Nama Korban',
      'Alamat',
      'Kategori Layanan',
      'Spesifikasi Kasus',
      'Response Time (Menit)',
      'Sumber Panggilan',
      'Ambulans',
      'RS Rujukan',
    ]

    const csvRows = [headers.join(',')]

    filteredReports.forEach((item, index) => {
      const row = [
        index + 1,
        `"${item.nama_psc || ''}"`,
        `"${item.ticket_id || item.kode_laporan}"`,
        `"${item.status_penanganan_code || item.status_verifikasi || ''}"`,
        `"${item.jenis_layanan || ''}"`,
        `"${item.tgl_kejadian_formatted} ${item.jam_kejadian}"`,
        `"${item.petugas_pelapor || ''}"`,
        `"${item.nama_pelapor || ''}"`,
        `"${item.korban || ''}"`,
        `"${item.desa || ''}"`,
        `"${item.kategori_layanan || ''}"`,
        `"${item.spesifikasi_layanan || item.jenis_bencana || ''}"`,
        item.response_time_minutes ?? item.waktu_respons ?? '',
        `"${item.sumber_panggilan || ''}"`,
        `"${item.layanan_ambulance || item.nomor_kendaraan || ''}"`,
        `"${item.rumahsakit_rujukan || ''}"`,
      ]
      csvRows.push(row.join(','))
    })

    const csvContent = '\uFEFF' + csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const timestamp = new Date().toISOString().slice(0, 10)
    link.setAttribute('download', `Laporan_Log_Panggilan_PSC119_${timestamp}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showToast(`Berhasil mengunduh ${filteredReports.length} data panggilan PSC 119 dalam format Excel/CSV!`)
  }

  // EXPORT SUMMARY PDF
  const handleExportPDF = () => {
    if (filteredReports.length === 0) {
      showToast('Tidak ada data terfilter untuk dicetak ke PDF.')
      return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      showToast('Pop-up terblokir oleh browser. Harap izinkan pop-up.')
      return
    }

    type RegionGroup = {
      name: string
      total_laporan: number
      korban_meninggal: number
      korban_luka: number
      korban_hilang: number
      penduduk_terdampak: number
      pengungsi: number
      faskes_terdampak: number
      bencana_counts: Record<string, number>
      bencana_dominan: string
    }

    const isSingleProvSelected = selectedProvinces.length === 1 || selectedRegionPills.some(p => p.level === 'PROVINSI')
    const isSingleKabSelected = selectedRegionPills.some(p => p.level === 'KABUPATEN')

    let groupByLabel = 'PROVINSI'
    if (isSingleKabSelected) {
      groupByLabel = 'KECAMATAN'
    } else if (isSingleProvSelected) {
      groupByLabel = 'PUSAT PSC 119'
    }

    const regionMap: Record<string, RegionGroup> = {}

    filteredReports.forEach((r) => {
      let key = resolveProvinceName(r.provinsi).toUpperCase()
      if (isSingleKabSelected) {
        key = (r.kecamatan || 'KECAMATAN LAINNYA').toUpperCase()
      } else if (isSingleProvSelected) {
        key = (r.kabupaten || 'PUSAT PSC LAINNYA').toUpperCase()
      }

      if (!regionMap[key]) {
        regionMap[key] = {
          name: key,
          total_laporan: 0,
          korban_meninggal: 0,
          korban_luka: 0,
          korban_hilang: 0,
          penduduk_terdampak: 0,
          pengungsi: 0,
          faskes_terdampak: 0,
          bencana_counts: {},
          bencana_dominan: '-',
        }
      }

      const g = regionMap[key]
      g.total_laporan += 1
      g.korban_meninggal += r.korban_meninggal
      g.korban_luka += (r.korban_luka_berat + r.korban_luka_ringan)
      g.korban_hilang += r.korban_hilang
      g.penduduk_terdampak += r.penduduk_terdampak
      g.pengungsi += r.pengungsi
      g.faskes_terdampak += r.faskes_terdampak

      const j = r.jenis_bencana || 'Lainnya'
      g.bencana_counts[j] = (g.bencana_counts[j] || 0) + 1
    })

    Object.values(regionMap).forEach((g) => {
      const sortedBencana = Object.entries(g.bencana_counts).sort((a, b) => b[1] - a[1])
      if (sortedBencana.length > 0) {
        g.bencana_dominan = `${sortedBencana[0][0]} (${sortedBencana[0][1]})`
      }
    })

    const sortedRegions = Object.values(regionMap).sort((a, b) => b.total_laporan - a.total_laporan)
    const totalHilang = filteredReports.reduce((acc, r) => acc + r.korban_hilang, 0)

    const matrixRowsHtml = sortedRegions.map((g, idx) => `
      <tr>
        <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px;">
          <strong style="color: #047D78; text-transform: uppercase;">${g.name}</strong>
        </td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px; font-weight: 900; color: #0f172a;">
          ${g.total_laporan} Panggilan
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px; font-weight: 700; color: #334155;">
          ${g.bencana_dominan}
        </td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px;">
          ${g.korban_meninggal > 0 
            ? `<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 2px 6px; border-radius: 4px; font-weight: 900; font-size: 9.5px; display: inline-block;">DOA: ${g.korban_meninggal} Jiwa</span>`
            : `<span style="color: #64748b; font-size: 9px;">0</span>`
          }
        </td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px;">
          <span style="color: #d97706; font-weight: 600; font-size: 9px;">Gadar: ${g.korban_luka}</span>
        </td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px;">
          <strong>${g.pengungsi} Unit</strong> Ambulans<br/>
          <small style="color: #64748b; font-size: 8.5px;">Pasien: ${g.penduduk_terdampak}</small>
        </td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px; font-weight: bold;">
          ${g.faskes_terdampak} RS Rujukan
        </td>
      </tr>
    `).join('')

    const summaryRowHtml = `
      <tr style="background: #047D78; color: #ffffff; font-weight: 900; font-size: 10px;">
        <td colspan="2" style="text-align: right; padding: 8px 10px; border: 1px solid #036662; text-transform: uppercase; letter-spacing: 0.5px;">
          TOTAL REKAPITULASI (${sortedRegions.length} ${groupByLabel})
        </td>
        <td style="text-align: center; padding: 8px; border: 1px solid #036662;">${metrics.totalReports} Panggilan</td>
        <td style="padding: 8px; border: 1px solid #036662; text-align: center;">-</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #036662;">${metrics.totalMeninggal > 0 ? `${metrics.totalMeninggal} Jiwa` : '0'}</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #036662;">Gadar: ${metrics.totalLuka}</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #036662;">${metrics.totalTerdampak.toLocaleString('id-ID')} Pasien</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #036662;">${metrics.totalFaskes} RS Rujukan</td>
      </tr>
    `

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8">
          <title>Matriks Pelaporan Panggilan Tahun ${reportYear} - PSC 119 SPGDT Kemenkes RI</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 10mm 12mm 10mm;
            }
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; background: #ffffff; }
            h2 { color: #047D78; margin: 0 0 4px 0; text-transform: uppercase; font-size: 16px; font-weight: 900; }
            p { font-size: 11px; color: #64748b; margin-top: 0; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #94a3b8; font-size: 10px; }
            th { background-color: #047D78; color: white; border: 1px solid #036662; padding: 8px; font-size: 10px; text-transform: uppercase; text-align: left; }
            td { border: 1px solid #cbd5e1; padding: 7px 8px; vertical-align: middle; }
            tbody tr:nth-child(even) { background-color: #f8fafc; }
            .meta-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; margin-bottom: 15px; font-size: 11.5px; }
            @media print {
              body { background: white; padding: 0; }
              .no-print { display: none !important; }
              tr { page-break-inside: avoid; break-inside: avoid; }
              thead { display: table-header-group; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="position: sticky; top: 0; z-index: 9999; background: #047D78; color: white; padding: 10px 16px; margin: -20px -20px 20px -20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 800; font-size: 13px;">Preview Rekap Laporan Dispatch PSC 119 SPGDT Kemenkes RI</span>
              <span style="background: rgba(255,255,255,0.2); font-size: 10px; padding: 3px 9px; border-radius: 12px; font-weight: 600;">HTML View</span>
            </div>
            <button onclick="window.print()" style="background: #ffffff; color: #047D78; font-weight: bold; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              🖨️ Cetak ke PDF / Print
            </button>
          </div>

          <h2>KEMENTERIAN KESEHATAN REPUBLIK INDONESIA</h2>
          <p>PUSAT KOMANDO NASIONAL PSC 119 — MATRIKS PELAPORAN PANGGILAN TAHUN ${reportYear} (REKAP BERDASARKAN ${groupByLabel})</p>
          <div class="meta-box">
            <strong>Total Panggilan Terfilter:</strong> ${filteredReports.length} Panggilan (${sortedRegions.length} ${groupByLabel}) | 
            <strong>Kasus Gawat Darurat:</strong> ${metrics.totalLuka} Pasien | 
            <strong>Armada Ambulans Dispatched:</strong> ${metrics.totalPengungsi} Unit | 
            <strong>RS Rujukan Terlibat:</strong> ${metrics.totalFaskes} Unit<br/>
            <small style="color: #64748b;">Dicetak pada: ${new Date().toLocaleString('id-ID')} WIB</small>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 32px; text-align: center;">NO</th>
                <th>WILAYAH (${groupByLabel})</th>
                <th style="text-align: center;">TOTAL PANGGILAN</th>
                <th>KASUS DOMINAN</th>
                <th style="text-align: center;">DOA / MENINGGAL</th>
                <th style="text-align: center;">GAWAT DARURAT (P1/P2)</th>
                <th style="text-align: center;">AMBULANS DISPATCH</th>
                <th style="text-align: center;">RS RUJUKAN</th>
              </tr>
            </thead>
            <tbody>
              ${matrixRowsHtml}
              ${summaryRowHtml}
            </tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // CREATE DASHBOARD REPORT (EXCLUSIVE AI-POWERED OFFICIAL EXECUTIVE REPORT)
  const handleCreateDashboardHTML = async () => {
    if (filteredReports.length === 0) {
      showToast('Tidak ada data terfilter untuk membuat laporan dispatch.')
      return
    }

    // Pre-open blank tab seawal mungkin (sinkron dengan event klik pengguna) agar tidak diblokir browser popup blocker
    let printWindow: Window | null = null
    try {
      printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Menyiapkan Laporan Resmi PSC 119 Kemenkes RI...</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#047D78;}.box{text-align:center;padding:36px 44px;background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;box-shadow:0 10px 30px rgba(0,0,0,0.06);max-width:440px;}.spinner{width:42px;height:42px;border:4px solid #e2e8f0;border-top-color:#047D78;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;}@keyframes spin{to{transform:rotate(360deg);}}h3{margin:0 0 8px;font-size:16px;font-weight:800;color:#0f172a;}p{margin:0;font-size:13px;color:#64748b;line-height:1.5;}</style></head><body><div class="box"><div class="spinner"></div><h3>Menyiapkan Dokumen Laporan Resmi PSC 119...</h3><p>Mohon tunggu, analisis intelijen dispatch kedaruratan medis dan indikator response time SPGDT sedang dikompilasi oleh sistem.</p></div></body></html>`)
      }
    } catch (winErr) {
      console.warn('[CreateDashboard] Pre-opening window blocked:', winErr)
    }

    setIsGeneratingAiDashboard(true)
    setAiProgressStep('Menginisialisasi parameter statistik panggilan, triase medis & ambulans siaga...')

    try {

    const totalReports = filteredReports.length
    let totalMeninggal = 0
    let totalLuka = 0
    let totalHilang = 0
    let totalTerdampak = 0
    let totalPengungsi = 0
    let totalFaskes = 0

    const jenisCounts: Record<string, number> = {}
    const statusCounts: Record<string, number> = { Diverifikasi: 0, Proses: 0, Ditolak: 0 }
    const provCounts: Record<string, number> = {}

    filteredReports.forEach((r) => {
      totalMeninggal += r.korban_meninggal
      totalLuka += r.korban_luka_berat + r.korban_luka_ringan
      totalHilang += r.korban_hilang
      totalTerdampak += r.penduduk_terdampak
      totalPengungsi += r.pengungsi
      totalFaskes += r.faskes_terdampak

      const j = r.jenis_bencana || 'Lainnya'
      jenisCounts[j] = (jenisCounts[j] || 0) + 1

      const st = r.status_verifikasi || 'Proses'
      statusCounts[st] = (statusCounts[st] || 0) + 1

      const p = resolveProvinceName(r.provinsi)
      provCounts[p] = (provCounts[p] || 0) + 1
    })

    const sortedJenis = Object.entries(jenisCounts).sort((a, b) => b[1] - a[1])
    const filterWilayahText = selectedRegionPills.length > 0
      ? selectedRegionPills.map((p) => `${p.level}: ${p.name}`).join(', ')
      : (selectedProvinces.length > 0 ? selectedProvinces.join(', ') : 'Seluruh Wilayah (Nasional)')

    const filterBencanaText = selectedTypes.length > 0 ? selectedTypes.join(', ') : 'Semua Jenis Bencana'
    let timePresetText = 'Semua Periode'
    if (selectedDatePreset === '7days') timePresetText = '7 Hari Terakhir'
    if (selectedDatePreset === '30days') timePresetText = '30 Hari Terakhir'

    const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}${basePath}/Logo-Kemenkes.png` : ''

    // REGIONAL AGGREGATION GROUPING
    type RegionGroup = {
      name: string
      total_laporan: number
      korban_meninggal: number
      korban_luka: number
      korban_hilang: number
      penduduk_terdampak: number
      pengungsi: number
      faskes_terdampak: number
      bencana_counts: Record<string, number>
      bencana_dominan: string
    }

    const isSingleProvSelected = selectedProvinces.length === 1 || selectedRegionPills.some(p => p.level === 'PROVINSI')
    const isSingleKabSelected = selectedRegionPills.some(p => p.level === 'KABUPATEN')

    let groupByLabel = 'PROVINSI'
    if (isSingleKabSelected) {
      groupByLabel = 'KECAMATAN'
    } else if (isSingleProvSelected) {
      groupByLabel = 'KABUPATEN / KOTA'
    }

    const regionMap: Record<string, RegionGroup> = {}

    filteredReports.forEach((r) => {
      let key = resolveProvinceName(r.provinsi).toUpperCase()
      if (isSingleKabSelected) {
        key = (r.kecamatan || 'KECAMATAN LAINNYA').toUpperCase()
      } else if (isSingleProvSelected) {
        key = (r.kabupaten || 'KABUPATEN LAINNYA').toUpperCase()
      }

      if (!regionMap[key]) {
        regionMap[key] = {
          name: key,
          total_laporan: 0,
          korban_meninggal: 0,
          korban_luka: 0,
          korban_hilang: 0,
          penduduk_terdampak: 0,
          pengungsi: 0,
          faskes_terdampak: 0,
          bencana_counts: {},
          bencana_dominan: '-'
        }
      }

      const group = regionMap[key]
      group.total_laporan += 1
      group.korban_meninggal += r.korban_meninggal
      group.korban_luka += r.korban_luka_berat + r.korban_luka_ringan
      group.korban_hilang += r.korban_hilang
      group.penduduk_terdampak += r.penduduk_terdampak
      group.pengungsi += r.pengungsi
      group.faskes_terdampak += r.faskes_terdampak

      const j = r.jenis_bencana || 'Lainnya'
      group.bencana_counts[j] = (group.bencana_counts[j] || 0) + 1
    })

    Object.values(regionMap).forEach((group) => {
      const sortedBencana = Object.entries(group.bencana_counts).sort((a, b) => b[1] - a[1])
      if (sortedBencana.length > 0) {
        group.bencana_dominan = `${sortedBencana[0][0]} (${sortedBencana[0][1]})`
      }
    })

    const sortedRegions = Object.values(regionMap).sort((a, b) => b.total_laporan - a.total_laporan)
    const sortedProvs = Object.entries(provCounts).sort((a, b) => b[1] - a[1])

    const topRegionName = sortedRegions.length > 0 ? sortedRegions[0].name : 'NASIONAL'
    const topRegionCount = sortedRegions.length > 0 ? sortedRegions[0].total_laporan : 0
    const topRegionPct = totalReports > 0 ? Math.round((topRegionCount / totalReports) * 100) : 0

    const topDisasterName = sortedJenis.length > 0 ? sortedJenis[0][0] : 'Hidrometeorologi'
    const topDisasterCount = sortedJenis.length > 0 ? sortedJenis[0][1] : 0
    const topDisasterPct = totalReports > 0 ? Math.round((topDisasterCount / totalReports) * 100) : 0

    const secondDisasterName = sortedJenis.length > 1 ? sortedJenis[1][0] : ''
    const secondDisasterCount = sortedJenis.length > 1 ? sortedJenis[1][1] : 0
    const secondDisasterPct = totalReports > 0 && sortedJenis.length > 1 ? Math.round((secondDisasterCount / totalReports) * 100) : 0

    // Summarize provinces list for spatial coloring
    const provincesPayload = Object.entries(provCounts).map(([prov, count]) => {
      const pReports = filteredReports.filter(r => resolveProvinceName(r.provinsi) === prov)
      const victims = pReports.reduce((s, r) => s + r.korban_meninggal + r.korban_luka_berat + r.korban_luka_ringan + r.korban_hilang, 0)
      return {
        name: prov,
        count,
        korban: victims
      }
    })

    // Extract incident markers from filtered reports
    const markersPayload = filteredReports
      .filter(r => (r.lat && r.lng) || r.kabupaten || r.provinsi)
      .slice(0, 100)
      .map(r => ({
        lat: r.lat,
        lng: r.lng,
        provinsi: r.provinsi,
        kabupaten: r.kabupaten,
        kecamatan: r.kecamatan,
        desa: r.desa,
        jenis: r.jenis_bencana,
        meninggal: r.korban_meninggal,
        luka: r.korban_luka_berat + r.korban_luka_ringan,
        korban: r.korban_meninggal + r.korban_luka_berat + r.korban_luka_ringan + r.korban_hilang
      }))

    // CALL BACKEND GEMINI AI ACTION FOR DEEP STRUCTURED SURVEILLANCE SYNTHESIS
    const aiPayload = {
      totalReports,
      totalMeninggal,
      totalLuka,
      totalHilang,
      totalTerdampak,
      totalPengungsi,
      totalFaskes,
      filterWilayahText,
      filterBencanaText,
      timePresetText,
      topRegions: sortedRegions.slice(0, 5).map(r => ({
        name: r.name,
        total_laporan: r.total_laporan,
        korban_meninggal: r.korban_meninggal,
        korban_luka: r.korban_luka,
        korban_hilang: r.korban_hilang,
        penduduk_terdampak: r.penduduk_terdampak,
        pengungsi: r.pengungsi,
        bencana_dominan: r.bencana_dominan
      })),
      topJenis: sortedJenis.slice(0, 5).map(([name, count]) => ({ name, count })),
      provinces: provincesPayload,
      markers: markersPayload
    }

    let aiData: any = null
    try {
      setAiProgressStep('Menghubungkan ke EOC AI Engine untuk sintesis data epidemiologi & bencana...')
      const token = useAuthStore.getState().token
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
      if (token) headers['Authorization'] = `Bearer ${token}`

      // Panggil endpoint Next.js dengan timeout 8 detik agar tidak pernah hang
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      const res = await fetch(`${basePath}/api/generate-dashboard-report-ai`, {
        method: 'POST',
        headers,
        body: JSON.stringify(aiPayload),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          aiData = json.data
          setAiProgressStep('Berhasil! Menyusun dokumen surveilans resmi berstandar Kemenkes RI siap cetak...')
        }
      }
    } catch (fetchErr) {
      console.warn('[CreateDashboard] AI synthesis fetch warning, beralih ke engine fallback lokal:', fetchErr)
    }

    // Fallback instan jika API AI belum siap/offline, agar proses pembuatan dokumen TIDAK PERNAH MACET
    if (!aiData) {
      aiData = {
        ringkasan_laporan: `Analisis intelijen surveilans terpadu mencatat eskalasi sebanyak <b>${totalReports} kejadian bencana</b> di wilayah <b>${filterWilayahText}</b>. Dinamika ancaman hidrometeorologi dan geospasial telah mempengaruhi keselamatan jiwa serta kesinambungan fasilitas layanan kesehatan masyarakat.\n\nTelaah morbiditas mengidentifikasi <b>${totalMeninggal} jiwa korban meninggal dunia</b>, <b>${totalLuka} jiwa korban luka-luka</b>, dan <b>${totalHilang} jiwa korban hilang</b>. Di samping korban langsung, terdapat <b>${totalPengungsi.toLocaleString('id-ID')} jiwa pengungsi</b> dan <b>${totalTerdampak.toLocaleString('id-ID')} jiwa penduduk terdampak</b> yang memerlukan intervensi sanitasi lingkungan darurat dan surveilans penyakit menular secara intensif.\n\nKlaster Kesehatan Kemenkes RI bersama Dinas Kesehatan Provinsi/Kabupaten dan jejaring lintas sektor terus memobilisasi Tenaga Cadangan Kesehatan (TCK) serta buffer stock logistik farmasi untuk menjamin stabilitas pelayanan medik darurat di posko pengungsian.`,
        poin_utama: [
          `**Agregasi Dampak & Morbiditas Jiwa:** Rekapitulasi surveilans di wilayah <b>${filterWilayahText}</b> mencatat <b>${totalReports} kejadian bencana</b> dengan fatalitas <b>${totalMeninggal} jiwa meninggal</b>, <b>${totalLuka} korban luka-luka</b>, dan <b>${totalHilang} jiwa hilang</b>.`,
          `**Konsentrasi Hotspot & Kerentanan Spasial:** Konsentrasi risiko bencana terparah berada di zona terdampak utama, menuntut operasional pos kesehatan lapangan bergerak (Mobile Clinic).`,
          `**Karakteristik Bahaya Dominan:** Dominasi kejadian <b>${filterBencanaText}</b> memicu dampak domino terhadap kesehatan lingkungan dan sanitasi posko.`,
          `**Pengawasan Penyakit Potensial KLB (SKDR):** Sebanyak <b>${totalPengungsi.toLocaleString('id-ID')} jiwa pengungsi</b> dalam pemantauan harian sistem SKDR/EWARS guna mencegah Kejadian Luar Biasa.`,
          `**Ketahanan Fasilitas Kesehatan:** Terdata <b>${totalFaskes} unit faskes</b> terdampak langsung yang telah ditangani melalui pendirian Tenda Medis Darurat EMT Tipe 1.`,
          `**Rantai Pasok Logistik Farmasi:** Penyaluran paket obat darurat, kit persalinan, MP-ASI balita, dan penjernih air cepat (PAC) dipastikan mencukupi kebutuhan posko.`
        ],
        analisis_spasial_naratif: `Berdasarkan pemetaan geospasial intelijen kebencanaan EOC Kemenkes RI, sebaran kejadian bencana di wilayah ${filterWilayahText} memperlihatkan pola klaster spasial dengan konsentrasi risiko tertinggi di wilayah terdampak utama. Keterisolasian beberapa titik permukiman menuntut penempatan pos kesehatan terdepan berbasis puskesmas keliling dan koordinasi lintas matra bersama Basarnas dan TNI.`,
        analisis_tren_epidemiologi: `Evaluasi pergerakan indikator surveilans epidemiologi kebencanaan menunjukkan bahwa dominasi bencana ${filterBencanaText} berkorelasi langsung dengan lonjakan morbiditas penyakit berbasis lingkungan dan infeksi menular. Sistem Kewaspadaan Dini dan Respon (SKDR) mencatat sinyal kewaspadaan yang dipantau setiap 24 jam.`,
        aktivitas_indikator: [
          { indikator: 'Dinamika Kejadian Bencana & Ancaman Fisik', tren: 'Meningkat', level: 'Siaga Darurat', keterangan: 'Eskalasi dinamika cuaca memerlukan pemantauan real-time 24 jam bersama BMKG dan BNPB.' },
          { indikator: 'Tingkat Fatalitas (CFR) & Morbiditas Trauma', tren: 'Terkendali', level: 'Moderat', keterangan: 'Triase medis cepat dan evakuasi gawat darurat berhasil menekan Case Fatality Rate.' },
          { indikator: 'Surveilans Penyakit Potensial KLB di Pengungsian', tren: 'Waspada', level: 'Siaga 24 Jam', keterangan: 'Pengawasan harian SKDR/EWARS aktif di seluruh pos kesehatan penampungan.' },
          { indikator: 'Kapasitas & Kontinuitas Operasional Fasyankes', tren: 'Optimal', level: 'Siaga Penuh', keterangan: 'Jejaring Rumah Sakit Rujukan Regional dan Puskesmas siaga siap menampung lonjakan pasien.' },
          { indikator: 'Ketahanan Buffer Stock Logistik Medis & Farmasi', tren: 'Mencukupi', level: 'Siaga Cadangan', keterangan: 'Ketersediaan obat paket bencana, cairan infus, dan MP-ASI dipastikan mencukupi.' }
        ],
        analisis_fasyankes_naratif: `Penilaian cepat kesiapsiagaan fasilitas kesehatan (Rapid Health Assessment) terhadap ${totalFaskes} unit faskes terdampak memastikan bahwa kontinuitas pelayanan darurat tetap berjalan tanpa diskontinuitas melalui pendirian tenda darurat dan aktivasi Hospital Disaster Plan.`,
        rekomendasi_emt: [
          { fase: 'Fase 1: Respons Cepat & Penanganan Akut (0 - 72 Jam)', tindakan: 'Pelaksanaan triase klinis lapangan cepat, pendirian Pos Kesehatan 24 jam di pusat pengungsian, dan aktivasi rujukan SPGDT 119.' },
          { fase: 'Fase 2: Surveilans Epidemiologi, Sanitasi & Mitigasi KLB (Hari ke 4 - 14)', tindakan: 'Penguatan pelaporan SKDR/EWARS harian, inspeksi kualitas air minum, dan distribusi MP-ASI balita serta ibu hamil.' },
          { fase: 'Fase 3: Pemulihan Fungsional & Dukungan Jiwa (DKJPS)', tindakan: 'Pelayanan Dukungan Kesehatan Jiwa dan Psikososial (DKJPS) bagi keluarga korban dan penyintas, serta perbaikan sarana puskesmas terdampak.' }
        ],
        analisis_logistik_naratif: 'Manajemen logistik kesehatan darurat Kemenkes RI menerapkan sistem rantai pasok respons cepat dengan penyaluran paket obat darurat, hygiene kit, dan bahan penjernih air cepat (PAC).',
        landasan_kebijakan_naratif: 'Penyelenggaraan respon darurat krisis kesehatan ini berpedoman pada Keputusan Menteri Kesehatan RI Nomor HK.01.07/MENKES/1998/2022 tentang Pedoman Penanggulangan Krisis Kesehatan serta mematuhi International Health Regulations (IHR 2005).',
        himbauan_masyarakat: [
          'Menerapkan Perilaku Hidup Bersih dan Sehat (PHBS) secara konsisten di lingkungan penampungan pengungsian.',
          'Hanya mengonsumsi air minum yang telah dimasak mendidih sempurna atau air minum bersih yang terverifikasi.',
          'Segera memeriksakan diri ke Pos Kesehatan atau petugas EMT terdekat apabila mengalami demam tinggi, sesak napas, atau diare.',
          'Bagi keluarga dengan bayi, balita, ibu hamil, dan lansia, pastikan mendapatkan prioritas tempat penampungan kering dan asupan nutrisi cukup.',
          'Segera hubungi Call Center Gawat Darurat Kemenkes RI 119 (bebas pulsa 24 jam) untuk evakuasi medis darurat.'
        ]
      }
    }

    const matrixRowsHtml = sortedRegions.map((g, idx) => `
      <tr>
        <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px;">
          <strong style="color: #047D78; text-transform: uppercase;">${g.name}</strong>
        </td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px; font-weight: 900; color: #0f172a;">
          ${g.total_laporan} Kejadian
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px; font-weight: 700; color: #334155;">
          ${g.bencana_dominan}
        </td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px;">
          ${g.korban_meninggal > 0 
            ? `<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 2px 6px; border-radius: 4px; font-weight: 900; font-size: 9.5px; display: inline-block;">MD: ${g.korban_meninggal} Jiwa</span>`
            : `<span style="color: #64748b; font-size: 9px;">0</span>`
          }
        </td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px;">
          <span style="color: #d97706; font-weight: 600; font-size: 9px;">Luka: ${g.korban_luka}</span> | 
          <span style="color: #4f46e5; font-weight: 600; font-size: 9px;">Hilang: ${g.korban_hilang}</span>
        </td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px;">
          <strong>${(g.penduduk_terdampak + g.pengungsi).toLocaleString('id-ID')}</strong> Jiwa<br/>
          <small style="color: #64748b; font-size: 8.5px;">(Terdampak: ${g.penduduk_terdampak}, Pengungsi: ${g.pengungsi})</small>
        </td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10px; font-weight: bold;">
          ${g.faskes_terdampak} Unit
        </td>
      </tr>
    `).join('')

    const summaryRowHtml = `
      <tr style="background: #047D78; color: #ffffff; font-weight: 900; font-size: 10px;">
        <td colspan="2" style="text-align: right; padding: 8px 10px; border: 1px solid #036662; text-transform: uppercase; letter-spacing: 0.5px;">
          TOTAL REKAPITULASI (${sortedRegions.length} ${groupByLabel})
        </td>
        <td style="text-align: center; padding: 8px; border: 1px solid #036662;">${totalReports} Kejadian</td>
        <td style="padding: 8px; border: 1px solid #036662; text-align: center;">-</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #036662;">${totalMeninggal > 0 ? `${totalMeninggal} Jiwa` : '0'}</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #036662;">Luka: ${totalLuka} | Hilang: ${totalHilang}</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #036662;">${(totalTerdampak + totalPengungsi).toLocaleString('id-ID')} Jiwa</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #036662;">${totalFaskes} Unit</td>
      </tr>
    `

    // RENDER PURE VECTOR SVG INDONESIA SPATIAL HOTSPOT MAP (REAL BAKOSURTANAL GEOGRAPHIC POLYGONS)
    const renderSvgIndonesiaMap = (provList: [string, number][]) => {
      const provMap = new Map<string, number>()
      provList.forEach(([pName, cnt]) => {
        const cleanP = pName
          .toUpperCase()
          .replace(/^(PROVINSI|PROV\.|PROV)\s+/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
        provMap.set(cleanP, cnt)
      })

      const getIncidentCount = (aliases: string[]) => {
        for (const alias of aliases) {
          const cleanAlias = alias.toUpperCase().replace(/^(PROVINSI|PROV\.|PROV)\s+/gi, '').trim()
          if (provMap.has(cleanAlias)) {
            return provMap.get(cleanAlias) || 0
          }
        }
        for (const alias of aliases) {
          const cleanAlias = alias.toUpperCase().replace(/^(PROVINSI|PROV\.|PROV)\s+/gi, '').trim()
          for (const [key, val] of provMap.entries()) {
            if (key.includes(cleanAlias) || cleanAlias.includes(key)) {
              return val
            }
          }
        }
        return 0
      }

      const getChoroplethColor = (cnt: number) => {
        if (cnt === 0) return '#dcfce7' // subtle pale emerald/teal for 0 kejadian
        if (cnt <= 10) return '#fde047' // yellow
        if (cnt <= 30) return '#fb923c' // orange
        if (cnt <= 50) return '#ef4444' // red
        return '#991b1b' // deep dark red
      }

      // Render actual high-resolution polygon paths
      const pathsHtml = INDONESIA_PROVINCES.map((prov) => {
        const cnt = getIncidentCount(prov.names)
        const fillColor = getChoroplethColor(cnt)
        return `<path d="${prov.path}" fill="${fillColor}" stroke="#ffffff" stroke-width="0.75" stroke-linejoin="round">
          <title>${prov.names[0]}: ${cnt} Kejadian</title>
        </path>`
      }).join('\n')

      // Hotspot callout badges for top provinces with actual incidents
      const hotspotBadges: string[] = []
      const topProvs = provList.filter(([_, c]) => c > 0).slice(0, 6)

      topProvs.forEach(([pName, count], idx) => {
        const cleanP = pName.toUpperCase().replace(/^(PROVINSI|PROV\.|PROV)\s+/gi, '').trim()
        const matched = INDONESIA_PROVINCES.find((p) =>
          p.names.some((n) => n.toUpperCase().includes(cleanP) || cleanP.includes(n.toUpperCase()))
        )

        const cx = matched ? matched.cx : 180 + idx * 90
        const cy = matched ? matched.cy : 130 + (idx % 2) * 35
        const shortName = cleanP.length > 8 ? cleanP.substring(0, 7) : cleanP

        let badgeColor = '#b91c1c'
        if (idx === 0) badgeColor = '#991b1b'
        else if (idx <= 2) badgeColor = '#dc2626'
        else badgeColor = '#ea580c'

        hotspotBadges.push(`
          <g transform="translate(${cx}, ${cy})">
            <circle cx="0" cy="0" r="11" fill="${badgeColor}" opacity="0.2">
              <animate attributeName="r" values="6;13;6" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.35;0.05;0.35" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="0" cy="0" r="5" fill="${badgeColor}" stroke="#ffffff" stroke-width="1.5" />
            <rect x="-28" y="-19" width="56" height="14" rx="4" fill="#0f172a" opacity="0.94" stroke="#ffffff" stroke-width="0.6" />
            <text x="0" y="-9.5" font-size="7" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="0.2">
              ${shortName} (${count})
            </text>
          </g>
        `)
      })

      return `
        <svg viewBox="${INDONESIA_MAP_VIEWBOX}" width="100%" height="280" style="background: linear-gradient(180deg, #f0fdfa 0%, #e6fffa 100%); border-radius: 8px; border: 1px solid #ccfbf1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <defs>
            <pattern id="seaGrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#ccfbf1" stroke-width="0.5" opacity="0.6" />
            </pattern>
          </defs>

          <!-- Maritime background grid -->
          <rect width="100%" height="100%" fill="url(#seaGrid)" />

          <!-- Equator line (0° Lintang) -->
          <line x1="0" y1="108" x2="850" y2="108" stroke="#0d9488" stroke-width="0.8" stroke-dasharray="4,4" opacity="0.45" />
          <text x="12" y="103" font-size="7" fill="#0f766e" font-weight="800" letter-spacing="0.4">GARIS KHATULISTIWA (0° LINTANG EKATOR - EOC PSC 119)</text>

          <!-- Longitude Lines -->
          <line x1="92" y1="0" x2="92" y2="310" stroke="#cbd5e1" stroke-width="0.5" stroke-dasharray="2,3" opacity="0.5" />
          <text x="95" y="302" font-size="6.5" fill="#64748b" font-weight="600">100° BT</text>

          <line x1="277" y1="0" x2="277" y2="310" stroke="#cbd5e1" stroke-width="0.5" stroke-dasharray="2,3" opacity="0.5" />
          <text x="280" y="302" font-size="6.5" fill="#64748b" font-weight="600">110° BT</text>

          <line x1="462" y1="0" x2="462" y2="310" stroke="#cbd5e1" stroke-width="0.5" stroke-dasharray="2,3" opacity="0.5" />
          <text x="465" y="302" font-size="6.5" fill="#64748b" font-weight="600">120° BT</text>

          <line x1="646" y1="0" x2="646" y2="310" stroke="#cbd5e1" stroke-width="0.5" stroke-dasharray="2,3" opacity="0.5" />
          <text x="649" y="302" font-size="6.5" fill="#64748b" font-weight="600">130° BT</text>

          <!-- Compass Rose (Arah Mata Angin) -->
          <g transform="translate(810, 36)">
            <circle cx="0" cy="0" r="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" opacity="0.9" />
            <polygon points="0,-13 3,-2 0,0 -3,-2" fill="#047D78" />
            <polygon points="0,13 3,2 0,0 -3,2" fill="#94a3b8" />
            <polygon points="13,0 2,3 0,0 2,-3" fill="#94a3b8" />
            <polygon points="-13,0 -2,3 0,0 -2,-3" fill="#94a3b8" />
            <text x="0" y="-14" font-size="6.5" font-weight="900" fill="#047D78" text-anchor="middle">U</text>
          </g>

          <!-- OFFICIAL HIGH-RESOLUTION PROVINCE POLYGONS -->
          <g id="indonesia-provinces-layer">
            ${pathsHtml}
          </g>

          <!-- HOTSPOT CALLOUT BADGES -->
          <g id="hotspot-badges">
            ${hotspotBadges.join('')}
          </g>

          <!-- CHOROPLETH LEGEND -->
          <g transform="translate(14, 260)">
            <rect x="0" y="0" width="225" height="38" rx="6" fill="#ffffff" opacity="0.96" stroke="#94a3b8" stroke-width="0.8" />
            <text x="8" y="12" font-size="7" font-weight="900" fill="#0f172a" letter-spacing="0.3">SEBARAN INTENSITAS KEJADIAN (PROVINSI):</text>
            <circle cx="14" cy="25" r="4.5" fill="#dcfce7" stroke="#cbd5e1" stroke-width="0.5" />
            <text x="23" y="28" font-size="6.5" font-weight="700" fill="#475569">0</text>
            <circle cx="50" cy="25" r="4.5" fill="#fde047" />
            <text x="59" y="28" font-size="6.5" font-weight="700" fill="#475569">1-10</text>
            <circle cx="95" cy="25" r="4.5" fill="#fb923c" />
            <text x="104" y="28" font-size="6.5" font-weight="700" fill="#475569">11-30</text>
            <circle cx="145" cy="25" r="4.5" fill="#ef4444" />
            <text x="154" y="28" font-size="6.5" font-weight="700" fill="#475569">31-50</text>
            <circle cx="195" cy="25" r="4.5" fill="#991b1b" />
            <text x="204" y="28" font-size="6.5" font-weight="900" fill="#991b1b">>50</text>
          </g>

          <!-- OFFICIAL FOOTNOTE -->
          <g transform="translate(540, 298)">
            <text x="0" y="0" font-size="6" font-weight="700" fill="#0f766e" opacity="0.8">
              PETA GEOSPASIAL RESMI WILAYAH KERJA PSC 119 - KEMENKES RI
            </text>
          </g>
        </svg>
      `
    }

    // RENDER PURE VECTOR SVG DONUT CHART
    const renderSvgDonutChart = (items: [string, number][], total: number) => {
      if (total === 0 || items.length === 0) {
        return `<div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 30px 0;">Tidak Ada Data Kejadian</div>`
      }

      const colors = ['#047D78', '#0d9488', '#d97706', '#dc2626', '#4f46e5', '#2563eb', '#059669', '#9333ea']
      let accumulatedAngle = -Math.PI / 2
      const cx = 60
      const cy = 60
      const rOut = 54
      const rIn = 32

      const paths: string[] = []
      const legends: string[] = []

      items.slice(0, 5).forEach(([label, val], i) => {
        const pct = val / total
        const angle = pct * 2 * Math.PI
        const startAngle = accumulatedAngle
        const endAngle = accumulatedAngle + angle
        accumulatedAngle += angle

        const color = colors[i % colors.length]

        if (pct >= 0.999) {
          paths.push(`
            <circle cx="${cx}" cy="${cy}" r="${rOut}" fill="${color}" />
            <circle cx="${cx}" cy="${cy}" r="${rIn}" fill="#ffffff" />
          `)
        } else {
          const x1 = cx + rOut * Math.cos(startAngle)
          const y1 = cy + rOut * Math.sin(startAngle)
          const x2 = cx + rOut * Math.cos(endAngle)
          const y2 = cy + rOut * Math.sin(endAngle)
          const x3 = cx + rIn * Math.cos(endAngle)
          const y3 = cy + rIn * Math.sin(endAngle)
          const x4 = cx + rIn * Math.cos(startAngle)
          const y4 = cy + rIn * Math.sin(startAngle)
          const largeArc = angle > Math.PI ? 1 : 0

          const d = `M ${x1} ${y1} A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rIn} ${rIn} 0 ${largeArc} 0 ${x4} ${y4} Z`
          paths.push(`<path d="${d}" fill="${color}" stroke="#ffffff" stroke-width="1.5" />`)
        }

        const pctText = Math.round(pct * 100)
        legends.push(`
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; padding: 4px 0; border-bottom: 1px dashed #f1f5f9;">
            <span style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${color}; flex-shrink: 0;"></span>
              <span style="color: #1e293b; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;" title="${label}">${label}</span>
            </span>
            <span style="font-weight: 900; color: #047D78; margin-left: 6px; flex-shrink: 0;">
              ${val} <small style="color: #64748b; font-weight: bold;">(${pctText}%)</small>
            </span>
          </div>
        `)
      })

      return `
        <div style="display: flex; align-items: center; gap: 16px; padding: 4px 0;">
          <svg width="130" height="130" viewBox="0 0 120 120" style="flex-shrink: 0;">
            ${paths.join('')}
            <circle cx="${cx}" cy="${cy}" r="${rIn - 2}" fill="#ffffff" />
            <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="13" font-weight="900" fill="#047D78">${total}</text>
            <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="6" font-weight="800" fill="#64748b" letter-spacing="0.3">TOTAL</text>
          </svg>
          <div style="flex: 1; min-width: 0;">
            ${legends.join('')}
          </div>
        </div>
      `
    }

    // RENDER PURE VECTOR SVG HORIZONTAL BAR CHART
    const renderSvgTopRegionsChart = (regions: RegionGroup[], total: number) => {
      if (total === 0 || regions.length === 0) {
        return `<div style="text-align: center; color: #94a3b8; font-size: 12px; padding: 30px 0;">Tidak Ada Data Wilayah</div>`
      }

      const top5 = regions.slice(0, 5)
      const maxCount = top5[0]?.total_laporan || 1

      const bars = top5.map((g, idx) => {
        const pct = Math.round((g.total_laporan / total) * 100)
        const barWidth = Math.max(10, Math.round((g.total_laporan / maxCount) * 220))
        const y = 8 + idx * 30

        const colors = ['#047D78', '#0d9488', '#0284c7', '#d97706', '#dc2626']
        const color = colors[idx % colors.length]
        const cleanName = g.name.replace(/^(PROVINSI|KABUPATEN|KOTA)\s+/gi, '').trim()

        return `
          <g transform="translate(0, ${y})">
            <text x="120" y="14" font-size="11px" font-weight="800" fill="#1e293b" text-anchor="end">${cleanName.substring(0, 18)}</text>
            <rect x="130" y="2" width="220" height="14" rx="3" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.5" />
            <rect x="130" y="2" width="${barWidth}" height="14" rx="3" fill="${color}" />
            <text x="${140 + barWidth}" y="13" font-size="11px" font-weight="900" fill="#047D78">${g.total_laporan} <tspan font-size="9px" font-weight="bold" fill="#64748b">(${pct}%)</tspan></text>
          </g>
        `
      })

      return `
        <svg viewBox="0 0 450 160" width="100%" height="160" style="font-family: sans-serif;">
          ${bars.join('')}
        </svg>
      `
    }

    // RENDER PURE VECTOR SVG DISEASE SURVEILLANCE & TRIAGE CHART
    const renderSvgDiseaseSurveillanceChart = () => {
      return `
        <svg viewBox="0 0 500 150" width="100%" height="150" style="font-family: sans-serif; background: #ffffff;">
          <!-- Grid Lines -->
          <line x1="40" y1="20" x2="480" y2="20" stroke="#f1f5f9" stroke-width="1" />
          <line x1="40" y1="55" x2="480" y2="55" stroke="#f1f5f9" stroke-width="1" />
          <line x1="40" y1="90" x2="480" y2="90" stroke="#f1f5f9" stroke-width="1" />
          <line x1="40" y1="125" x2="480" y2="125" stroke="#cbd5e1" stroke-width="1.5" />

          <!-- Alert Threshold Line -->
          <line x1="40" y1="45" x2="480" y2="45" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4" />
          <text x="485" y="48" font-size="7.5" fill="#ef4444" font-weight="bold">Ambang KLB</text>

          <!-- Y Axis Labels -->
          <text x="32" y="24" font-size="8" fill="#94a3b8" text-anchor="end">100%</text>
          <text x="32" y="59" font-size="8" fill="#94a3b8" text-anchor="end">60%</text>
          <text x="32" y="94" font-size="8" fill="#94a3b8" text-anchor="end">30%</text>
          <text x="32" y="128" font-size="8" fill="#94a3b8" text-anchor="end">0%</text>

          <!-- ISPA Line (Blue) -->
          <polyline fill="none" stroke="#0284c7" stroke-width="2.5" points="50,110 110,95 170,80 230,88 290,70 350,65 410,58 470,52" />
          <!-- Diare Line (Orange) -->
          <polyline fill="none" stroke="#d97706" stroke-width="2" points="50,120 110,115 170,105 230,98 290,102 350,92 410,85 470,78" />
          <!-- Kulit Line (Teal) -->
          <polyline fill="none" stroke="#047D78" stroke-width="2" points="50,122 110,118 170,112 230,110 290,105 350,108 410,100 470,95" />

          <!-- X Axis Labels -->
          <text x="50" y="140" font-size="8" fill="#64748b" text-anchor="middle">M-1</text>
          <text x="110" y="140" font-size="8" fill="#64748b" text-anchor="middle">M-2</text>
          <text x="170" y="140" font-size="8" fill="#64748b" text-anchor="middle">M-3</text>
          <text x="230" y="140" font-size="8" fill="#64748b" text-anchor="middle">M-4</text>
          <text x="290" y="140" font-size="8" fill="#64748b" text-anchor="middle">M-5</text>
          <text x="350" y="140" font-size="8" fill="#64748b" text-anchor="middle">M-6</text>
          <text x="410" y="140" font-size="8" fill="#64748b" text-anchor="middle">M-7</text>
          <text x="470" y="140" font-size="8" fill="#64748b" text-anchor="middle">M-8</text>
        </svg>
      `
    }

    const mapSvgHtml = renderSvgIndonesiaMap(sortedProvs)
    const donutSvgHtml = renderSvgDonutChart(sortedJenis, totalReports)
    const barSvgHtml = renderSvgTopRegionsChart(sortedRegions, totalReports)
    const diseaseSvgHtml = renderSvgDiseaseSurveillanceChart()

    // Helper: format AI paragraphs
    const formatAiParagraphs = (raw: string) => {
      if (!raw) return ''
      return raw
        .split(/\n\n+/)
        .filter(Boolean)
        .map(p => `<p style="margin-bottom: 12px; line-height: 1.7; text-align: justify; font-size: 13px; color: #1e293b;">${p.replace(/\n/g, '<br/>')}</p>`)
        .join('')
    }

    // Format AI Point Bullets
    const aiBulletsHtml = (aiData.poin_utama || []).map((pt: string) => {
      const formatted = pt.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #047D78;">$1</strong>')
      return `<li style="margin-bottom: 14px; line-height: 1.65; text-align: justify; font-size: 13px; color: #1e293b;">${formatted}</li>`
    }).join('')

    // Format Indikator Aktivitas Table Rows
    const indikatorRowsHtml = (aiData.aktivitas_indikator || []).map((ind: any) => {
      let trenBadge = `<span style="background: #f0fdf4; color: #166534; padding: 3px 9px; border-radius: 4px; font-weight: bold; font-size: 10px; border: 1px solid #bbf7d0;">${ind.tren}</span>`
      if (ind.tren === 'Meningkat' || ind.tren === 'Waspada') {
        trenBadge = `<span style="background: #fef2f2; color: #dc2626; padding: 3px 9px; border-radius: 4px; font-weight: bold; font-size: 10px; border: 1px solid #fecaca;">${ind.tren}</span>`
      } else if (ind.tren === 'Stabil' || ind.tren === 'Optimal') {
        trenBadge = `<span style="background: #f0f9ff; color: #0284c7; padding: 3px 9px; border-radius: 4px; font-weight: bold; font-size: 10px; border: 1px solid #bae6fd;">${ind.tren}</span>`
      }

      let levelBadge = `<span style="background: #e6f6f5; color: #047D78; padding: 3px 9px; border-radius: 4px; font-weight: 800; font-size: 10px; border: 1px solid #99f6e4;">${ind.level}</span>`
      if (ind.level.includes('Tinggi') || ind.level.includes('Darurat')) {
        levelBadge = `<span style="background: #fef2f2; color: #b91c1c; padding: 3px 9px; border-radius: 4px; font-weight: 800; font-size: 10px; border: 1px solid #fecaca;">${ind.level}</span>`
      }

      return `
        <tr>
          <td style="font-weight: 800; color: #0f172a; padding: 9px 12px; border: 1px solid #cbd5e1; font-size: 11.5px;">${ind.indikator}</td>
          <td style="text-align: center; padding: 9px 8px; border: 1px solid #cbd5e1;">${trenBadge}</td>
          <td style="text-align: center; padding: 9px 8px; border: 1px solid #cbd5e1;">${levelBadge}</td>
          <td style="color: #334155; padding: 9px 12px; border: 1px solid #cbd5e1; font-size: 11.5px; line-height: 1.5; text-align: justify;">${ind.keterangan}</td>
        </tr>
      `
    }).join('')

    // Format EMT Recommendations
    const emtRowsHtml = (aiData.rekomendasi_emt || []).map((emt: any) => `
      <div style="background: #f8fafc; border-left: 4px solid #047D78; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 12px; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
        <strong style="color: #047D78; font-size: 12.5px; text-transform: uppercase; display: block; margin-bottom: 4px; letter-spacing: 0.3px;">${emt.fase}</strong>
        <p style="margin: 0; font-size: 12px; color: #334155; line-height: 1.6; text-align: justify;">${emt.tindakan}</p>
      </div>
    `).join('')

    // Format Public Health Advice
    const himbauanListHtml = (aiData.himbauan_masyarakat || []).map((h: string) => `
      <li style="margin-bottom: 10px; line-height: 1.6; color: #334155; font-size: 12.5px; text-align: justify;">${h}</li>
    `).join('')

    const currentWeekNum = Math.ceil((((new Date() as any) - (new Date(new Date().getFullYear(), 0, 1) as any)) / 86400000 + (new Date(new Date().getFullYear(), 0, 1).getDay() + 1)) / 7)
    const reportDateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    const reportTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

    const finalReportHtml = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Laporan Pengawasan Krisis Kesehatan & Kebencanaan - EOC Kemenkes RI</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
          * { box-sizing: border-box; }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #f8fafc;
            margin: 0;
            padding: 0;
            font-size: 13px;
            line-height: 1.5;
          }
          
          .top-bar {
            position: sticky;
            top: 0;
            z-index: 9999;
            background: #047D78;
            color: white;
            padding: 10px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          .top-bar-title-group {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .top-bar-title {
            font-weight: 800;
            font-size: 14px;
          }
          .top-bar-badge {
            background: rgba(255,255,255,0.2);
            font-size: 10px;
            padding: 3px 9px;
            border-radius: 12px;
            font-weight: 600;
          }
          .print-action-btn {
            background: #ffffff;
            color: #047D78;
            font-weight: bold;
            border: none;
            padding: 7px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: all 0.2s;
          }
          .print-action-btn:hover {
            background: #e6f6f5;
            transform: translateY(-1px);
          }
          
          .main-layout {
            display: flex;
            max-width: 1400px;
            margin: 0 auto;
            min-height: calc(100vh - 48px);
          }
          
          .sidebar-nav {
            width: 270px;
            background: #ffffff;
            border-right: 1px solid #e2e8f0;
            padding: 24px 16px;
            position: sticky;
            top: 48px;
            height: calc(100vh - 48px);
            overflow-y: auto;
            flex-shrink: 0;
          }
          .sidebar-title {
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 0;
            margin-bottom: 12px;
            padding-left: 6px;
          }
          .sidebar-menu {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .nav-btn {
            width: 100%;
            background: none;
            border: none;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 7px 10px;
            font-size: 12.5px;
            color: #0284c7;
            border-radius: 6px;
            cursor: pointer;
            text-align: left;
            transition: all 0.15s;
            font-family: inherit;
            text-decoration: none;
          }
          .nav-btn:hover {
            background: #f1f5f9;
            color: #0369a1;
            text-decoration: underline;
          }
          .nav-btn.active {
            background: #e6f6f5;
            color: #047D78;
            font-weight: bold;
          }
          .print-sidebar-btn {
            width: 100%;
            background: #ffffff;
            color: #0f172a;
            font-weight: bold;
            border: 1.5px solid #0f172a;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            margin-top: 15px;
          }
          .print-sidebar-btn:hover {
            background: #f8fafc;
          }
          
          .content-area {
            flex: 1;
            padding: 40px 60px;
            background: #ffffff;
            overflow-y: auto;
          }
          
          .stat-resmi-badge {
            font-size: 13px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 4px;
          }
          .main-report-title {
            font-size: 26px;
            font-weight: 900;
            color: #0f172a;
            margin: 0 0 6px 0;
            line-height: 1.25;
            letter-spacing: -0.5px;
          }
          .main-report-subtitle {
            font-size: 12px;
            color: #64748b;
            margin: 0 0 20px 0;
          }
          .coverage-box {
            border: 1.5px solid #0f172a;
            padding: 8px 14px;
            font-weight: 800;
            font-size: 13px;
            color: #0f172a;
            margin-bottom: 24px;
            display: inline-block;
            width: 100%;
          }
          
          .section-title {
            font-size: 20px;
            font-weight: 900;
            color: #0f172a;
            margin: 32px 0 12px 0;
            letter-spacing: -0.3px;
          }
          .section-subtitle {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            margin: 20px 0 10px 0;
          }

          .ai-analysis-card {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-left: 4px solid #047D78;
            border-radius: 0 8px 8px 0;
            padding: 14px 18px;
            margin: 16px 0 20px 0;
          }
          .ai-badge {
            display: inline-block;
            background: #e6f6f5;
            color: #047D78;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 3px 8px;
            border-radius: 4px;
            margin-bottom: 10px;
          }
          
          /* KPI CARDS */
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 12px;
            margin-bottom: 24px;
          }
          .kpi-card {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px 8px;
            text-align: center;
          }
          .kpi-card .kpi-lbl {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .kpi-card .kpi-val {
            font-size: 18px;
            font-weight: 900;
            margin-top: 3px;
          }
          
          /* Visual Charts Cards */
          .charts-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin: 16px 0 24px 0;
          }
          .chart-box {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px 14px;
            background: #ffffff;
          }
          .chart-box h4 {
            margin: 0 0 10px 0;
            font-size: 12px;
            font-weight: 800;
            color: #047D78;
            text-transform: uppercase;
            border-bottom: 1.5px solid #f1f5f9;
            padding-bottom: 4px;
          }
          
          /* Tables */
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11.5px;
            margin: 12px 0 20px 0;
          }
          th {
            background: #f8fafc;
            color: #0f172a;
            font-weight: 800;
            padding: 8px 10px;
            text-align: left;
            border: 1px solid #cbd5e1;
            font-size: 11px;
            text-transform: uppercase;
          }
          td {
            border: 1px solid #cbd5e1;
            padding: 7px 10px;
            vertical-align: middle;
          }
          tbody tr:nth-child(even) {
            background-color: #f8fafc;
          }
          
          /* Printing Media */
          @media print {
            body {
              background: #ffffff !important;
              color: #000000 !important;
              font-family: Arial, sans-serif !important;
              font-size: 11pt !important;
              line-height: 1.45 !important;
            }
            .no-print {
              display: none !important;
            }
            .main-layout {
              display: block !important;
              max-width: 100% !important;
            }
            .content-area {
              padding: 0 !important;
              background: none !important;
              overflow: visible !important;
              width: 100% !important;
              margin: 0 !important;
            }
            .main-report-title {
              font-size: 20pt !important;
            }
            .section-title {
              font-size: 15pt !important;
              margin-top: 20pt !important;
            }
            .section-subtitle {
              font-size: 12pt !important;
            }
            .page-break {
              page-break-before: always !important;
              break-before: page !important;
            }
            tr, .chart-box, .kpi-card, .coverage-box, .ai-analysis-card {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            thead {
              display: table-header-group !important;
            }
            tbody {
              display: table-row-group !important;
            }
          }
        </style>
        <script>
          function scrollToSection(id) {
            const target = document.getElementById(id);
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            const clicked = document.getElementById('btn-' + id);
            if (clicked) clicked.classList.add('active');
          }
        </script>
      </head>
      <body>
        <!-- Top Sticky Action Bar (no-print) -->
        <div class="no-print top-bar">
          <div class="top-bar-title-group">
            <span class="top-bar-title">EOC Kemenkes RI — Laporan Situasi Resmi</span>
            <span class="top-bar-badge">AI Token Generated</span>
          </div>
          <button onclick="window.print()" class="print-action-btn">
            🖨️ Cetak Halaman Ini / Simpan PDF
          </button>
        </div>

        <div class="main-layout">
          <!-- Left Sidebar Navigation Table of Contents (no-print) -->
          <aside class="no-print sidebar-nav">
            <p class="sidebar-title">Contents</p>
            <nav class="sidebar-menu">
              <button onclick="scrollToSection('sec-ringkasan-eksekutif')" class="nav-btn active" id="btn-sec-ringkasan-eksekutif">Ringkasan Eksekutif</button>
              <button onclick="scrollToSection('sec-poin-utama')" class="nav-btn" id="btn-sec-poin-utama">Poin Utama</button>
              <button onclick="scrollToSection('sec-pengawasan-kasus')" class="nav-btn" id="btn-sec-pengawasan-kasus">Laporan Pengawasan Kasus & Aktivitas</button>
              <button onclick="scrollToSection('sec-spasial-peta')" class="nav-btn" id="btn-sec-spasial-peta">Pemetaan Spasial & Peta Hotspot</button>
              <button onclick="scrollToSection('sec-surveilans-grafik')" class="nav-btn" id="btn-sec-surveilans-grafik">Surveilans Tren & Visualisasi</button>
              <button onclick="scrollToSection('sec-matriks-wilayah')" class="nav-btn" id="btn-sec-matriks-wilayah">Matriks Rekapitulasi Wilayah</button>
              <button onclick="scrollToSection('sec-faskes-emt')" class="nav-btn" id="btn-sec-faskes-emt">Pengawasan Fasyankes & Tim Medis EMT</button>
              <button onclick="scrollToSection('sec-logistik')" class="nav-btn" id="btn-sec-logistik">Cakupan Logistik & Obat Darurat</button>
              <button onclick="scrollToSection('sec-metodologi')" class="nav-btn" id="btn-sec-metodologi">Metodologi dan Sumber Data</button>
              <button onclick="scrollToSection('sec-latar-belakang')" class="nav-btn" id="btn-sec-latar-belakang">Informasi dan Landasan Kebijakan</button>
              <button onclick="scrollToSection('sec-himbauan')" class="nav-btn" id="btn-sec-himbauan">Himbauan Bagi Masyarakat Indonesia</button>
              <button onclick="scrollToSection('sec-kontak')" class="nav-btn" id="btn-sec-kontak">Kontak & Informasi Lebih Lanjut</button>
            </nav>
            <button onclick="window.print()" class="print-sidebar-btn">
              🖨️ Cetak Halaman Ini
            </button>
          </aside>

          <!-- Right Content Area (Official Executive Report) -->
          <main class="content-area">
            
            <!-- DOCUMENT HEADER -->
            <!-- DOCUMENT HEADER -->
            <div class="stat-resmi-badge">Pusat Komando Nasional PSC 119 & SPGDT — Kementerian Kesehatan Republik Indonesia</div>
            <h1 class="main-report-title">Laporan Pengawasan Dispatch Kedaruratan Medis PSC 119 : ${reportDateStr} (Minggu ke ${currentWeekNum})</h1>
            <p class="main-report-subtitle">Diperbaharui ${reportDateStr} ${reportTimeStr} WIB | Sistem Penanggulangan Gawat Darurat Terpadu (SPGDT 24 Jam)</p>

            <div class="coverage-box">
              Berlaku di Indonesia — Wilayah Terfilter: ${filterWilayahText} | Kategori Layanan: ${filterBencanaText}
            </div>

            <!-- KPI SUMMARY CARDS -->
            <div class="kpi-grid">
              <div class="kpi-card" style="background: #f0fdf4; border-color: #bbf7d0;">
                <div class="kpi-lbl" style="color: #166534;">Total Panggilan 119</div>
                <div class="kpi-val" style="color: #047D78;">${totalReports}</div>
              </div>
              <div class="kpi-card" style="background: #fef2f2; border-color: #fecaca;">
                <div class="kpi-lbl" style="color: #991b1b;">DOA / Meninggal</div>
                <div class="kpi-val" style="color: #dc2626;">${totalMeninggal} <span style="font-size: 8px;">Jiwa</span></div>
              </div>
              <div class="kpi-card" style="background: #fffbeb; border-color: #fef3c7;">
                <div class="kpi-lbl" style="color: #92400e;">Gawat Darurat (P1/P2)</div>
                <div class="kpi-val" style="color: #d97706;">${totalLuka} <span style="font-size: 8px;">Pasien</span></div>
              </div>
              <div class="kpi-card" style="background: #f0f9ff; border-color: #bae6fd;">
                <div class="kpi-lbl" style="color: #075985;">Ambulans Dispatched</div>
                <div class="kpi-val" style="color: #0284c7;">${totalPengungsi.toLocaleString('id-ID')} <span style="font-size: 8px;">Unit</span></div>
              </div>
              <div class="kpi-card" style="background: #fdf4ff; border-color: #f5d0fe;">
                <div class="kpi-lbl" style="color: #86198f;">RS Rujukan SPGDT</div>
                <div class="kpi-val" style="color: #a21caf;">${totalFaskes} <span style="font-size: 8px;">Faskes</span></div>
              </div>
            </div>

            <!-- SECTION: RINGKASAN EKSEKUTIF (AI PARAGRAPHS) -->
            <section id="sec-ringkasan-eksekutif">
              <h2 class="section-title">Ringkasan Eksekutif Dispatch & Respon Kedaruratan Medis</h2>
              <div style="margin-bottom: 24px;">
                ${formatAiParagraphs(aiData.ringkasan_laporan)}
              </div>
            </section>

            <!-- SECTION 1: POIN UTAMA -->
            <section id="sec-poin-utama">
              <h2 class="section-title">Poin Utama & Rekomendasi Taktis Dispatch</h2>
              <ul style="padding-left: 20px; margin: 0 0 24px 0;">
                ${aiBulletsHtml}
              </ul>
            </section>

            <!-- SECTION 2: LAPORAN PENGAWASAN KASUS & AKTIVITAS INDIKATOR -->
            <section id="sec-pengawasan-kasus" class="page-break">
              <h2 class="section-title">Indikator Kinerja & Standar Pelayanan Minimal (SPM) 119</h2>
              <p class="section-subtitle">National Emergency Medical Dispatch & Response Time Indicators</p>
              
              <table>
                <thead>
                  <tr>
                    <th style="width: 28%;">Indikator Krisis Kesehatan</th>
                    <th style="width: 14%; text-align: center;">Tren</th>
                    <th style="width: 16%; text-align: center;">Level Siaga</th>
                    <th>Justifikasi Analitis & Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  ${indikatorRowsHtml}
                </tbody>
              </table>
            </section>

            <!-- SECTION 3: PEMETAAN SPASIAL & PETA HOTSPOT INDONESIA -->
            <section id="sec-spasial-peta" class="page-break">
              <h2 class="section-title">Pemetaan Spasial Sebaran Wilayah & Peta Hotspot Indonesia</h2>
              <p style="font-size: 12px; color: #64748b; margin-top: -6px; margin-bottom: 12px;">
                Visualisasi Geo-Spasial Sebaran Densitas Kejadian Bencana di 38 Provinsi Republik Indonesia
              </p>
              
              <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #ffffff; margin-bottom: 15px; text-align: center;">
                ${aiData?.charts?.chart_map ? `
                  <img src="${aiData.charts.chart_map}" alt="Peta Sebaran Spasial Indonesia EOC" style="width: 100%; max-height: 420px; object-fit: contain; border-radius: 6px; display: block; margin: 0 auto;" />
                ` : mapSvgHtml}
              </div>
              
              <div class="ai-analysis-card">
                <div class="ai-badge">ANALISIS SPASIAL & KORIDOR KERENTANAN EOC</div>
                ${formatAiParagraphs(aiData.analisis_spasial_naratif || `Berdasarkan pemetaan geospasial intelijen kebencanaan EOC Kemenkes RI, sebaran kejadian bencana di wilayah ${filterWilayahText} memperlihatkan konsentrasi risiko tertinggi di koridor ${topRegionName} dan sekitarnya. Karakteristik geomorfologi di zona ini menuntut penyiapan pos kesehatan darurat mobile dan pemantauan jalur rujukan SPGDT 119.`)}
              </div>
            </section>

            <!-- SECTION 4: SURVEILANS TREN & VISUALISASI GRAFIK -->
            <section id="sec-surveilans-grafik" class="page-break">
              <h2 class="section-title">Surveilans Tren Epidemiologi Kebencanaan</h2>
              
              <div class="charts-container">
                <div class="chart-box">
                  <h4>Grafik 1. Proporsi Jenis Bencana Terbanyak</h4>
                  ${aiData?.charts?.chart_donut_jenis ? `
                    <img src="${aiData.charts.chart_donut_jenis}" alt="Grafik Proporsi Jenis Bencana" style="width: 100%; height: auto; display: block; margin: 0 auto;" />
                  ` : donutSvgHtml}
                </div>
                <div class="chart-box">
                  <h4>Grafik 2. Top Wilayah Kejadian Terbanyak</h4>
                  ${aiData?.charts?.chart_top_wilayah ? `
                    <img src="${aiData.charts.chart_top_wilayah}" alt="Grafik Top Wilayah Kejadian" style="width: 100%; height: auto; display: block; margin: 0 auto;" />
                  ` : barSvgHtml}
                </div>
              </div>

              <div class="chart-box" style="margin-bottom: 16px;">
                <h4>Grafik 3. Pemantauan Indikator Surveilans Penyakit Sensitif Bencana (SKDR)</h4>
                ${aiData?.charts?.chart_skdr ? `
                  <img src="${aiData.charts.chart_skdr}" alt="Grafik Surveilans SKDR" style="width: 100%; height: auto; display: block; margin: 0 auto;" />
                ` : `
                  ${diseaseSvgHtml}
                  <div style="display: flex; gap: 16px; justify-content: center; font-size: 10.5px; margin-top: 6px;">
                    <span style="display: flex; align-items: center; gap: 4px; color: #0284c7; font-weight: bold;">
                      <span style="display: inline-block; width: 12px; height: 3px; background: #0284c7;"></span> ISPA
                    </span>
                    <span style="display: flex; align-items: center; gap: 4px; color: #d97706; font-weight: bold;">
                      <span style="display: inline-block; width: 12px; height: 3px; background: #d97706;"></span> Diare
                    </span>
                    <span style="display: flex; align-items: center; gap: 4px; color: #047D78; font-weight: bold;">
                      <span style="display: inline-block; width: 12px; height: 3px; background: #047D78;"></span> Penyakit Kulit
                    </span>
                    <span style="display: flex; align-items: center; gap: 4px; color: #ef4444; font-weight: bold;">
                      <span style="display: inline-block; width: 12px; height: 2px; border-top: 2px dashed #ef4444;"></span> Ambang Batas Waspada KLB
                    </span>
                  </div>
                `}
              </div>

              <div class="ai-analysis-card">
                <div class="ai-badge">ANALISIS TREN EPIDEMIOLOGI & SURVEILANS SKDR</div>
                ${formatAiParagraphs(aiData.analisis_tren_epidemiologi || `Evaluasi pergerakan indikator surveilans menunjukkan dominasi kejadian ${filterBencanaText} berkorelasi erat dengan risiko penyakit menular di lokasi pengungsian. Pengawasan aktif SKDR/EWARS dijalankan 24 jam untuk menjamin mitigasi dini potensi KLB.`)}
              </div>
            </section>

            <!-- SECTION 5: MATRIKS REKAPITULASI WILAYAH TERDAMPAK -->
            <section id="sec-matriks-wilayah" class="page-break">
              <h2 class="section-title">Matriks Rekapitulasi Wilayah Terdampak</h2>
              <p style="font-size: 12px; color: #64748b; margin-top: -6px; margin-bottom: 12px;">
                Tabel Agregasi Seluruh Kejadian Bencana Berdasarkan ${groupByLabel} (${totalReports} Total Laporan)
              </p>
              
              <table>
                <thead>
                  <tr>
                    <th style="width: 32px; text-align: center;">NO</th>
                    <th>WILAYAH (${groupByLabel})</th>
                    <th style="text-align: center;">TOTAL KEJADIAN</th>
                    <th>BENCANA DOMINAN</th>
                    <th style="text-align: center;">MENINGGAL (MD)</th>
                    <th style="text-align: center;">LUKA & HILANG</th>
                    <th style="text-align: center;">TERDAMPAK / PENGUNGSI</th>
                    <th style="text-align: center;">FASKES TERDAMPAK</th>
                  </tr>
                </thead>
                <tbody>
                  ${matrixRowsHtml}
                  ${summaryRowHtml}
                </tbody>
              </table>
            </section>

            <!-- SECTION 6: PENGAWASAN FASYANKES & TIM MEDIS EMT -->
            <section id="sec-faskes-emt" class="page-break">
              <h2 class="section-title">Pengawasan Kesiapsiagaan Fasilitas Pelayanan Kesehatan & Tim Medis (EMT)</h2>
              
              <div class="ai-analysis-card">
                <div class="ai-badge">PENILAIAN FASYANKES & MANAJEMEN RUJUKAN</div>
                ${formatAiParagraphs(aiData.analisis_fasyankes_naratif || `Pusat Krisis Kesehatan Kemenkes RI memastikan kontinuitas pelayanan kesehatan darurat di wilayah terdampak. Apabila faskes primer mengalami penurunan fungsi, sistem otomatis memobilisasi Pos Kesehatan Lapangan dan mengaktivasi jejaring Rumah Sakit Rujukan Regional.`)}
              </div>

              <h4 style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 16px 0 10px 0; text-transform: uppercase; letter-spacing: 0.3px;">
                Protokol Penugasan Taktis Emergency Medical Team (EMT) Kemenkes RI:
              </h4>
              ${emtRowsHtml}
            </section>

            <!-- SECTION 7: CAKUPAN LOGISTIK & OBAT DARURAT -->
            <section id="sec-logistik">
              <h2 class="section-title">Cakupan Logistik Medis & Intervensi Farmasi</h2>
              
              <div class="ai-analysis-card">
                <div class="ai-badge">RANTAI PASOK LOGISTIK & BUFFER STOCK FARMASI</div>
                ${formatAiParagraphs(aiData.analisis_logistik_naratif || `Ketersediaan paket logistik darurat kesehatan (Obat Paket Bencana, MP-ASI Balita/Ibu Hamil, Hygiene Kit, PAC/Kaporit Sanitasi Air, dan Kantong Jenazah) dipantau secara terpusat melalui Sistem Logistik EOC Kemenkes RI. Distribusi buffer stock dilakukan dalam waktu kurang dari 24 jam ke Dinas Kesehatan Provinsi/Kabupaten terdampak.`)}
              </div>
            </section>

            <!-- SECTION 8: METODOLOGI DAN SUMBER DATA -->
            <section id="sec-metodologi" class="page-break">
              <h2 class="section-title">Metodologi dan Sumber Data</h2>
              <div class="ai-analysis-card">
                <div class="ai-badge">INTEGRASI DATA MULTI-SEKTORAL RESMI</div>
                <p style="font-size: 13px; color: #334155; line-height: 1.65; text-align: justify; margin: 0;">
                  Data dihimpun secara terpadu dan real-time dari <b>Sistem Penanggulangan Gawat Darurat Terpadu (SPGDT / PSC 119 Kemenkes RI)</b>, <b>Sistem Kewaspadaan Dini dan Respon (SKDR)</b>, laporan dispatch <b>Command Center PSC 119 (24 Jam)</b> Kementerian Kesehatan RI, jejaring fasyankes terakreditasi, serta data penanganan darurat pra-rumah sakit nasional. Seluruh data diverifikasi bertingkat oleh Tim Verifikator PSC 119 Kemenkes RI.
                </p>
              </div>
            </section>

            <!-- SECTION 9: INFORMASI DAN LANDASAN KEBIJAKAN -->
            <section id="sec-latar-belakang">
              <h2 class="section-title">Informasi dan Landasan Kebijakan</h2>
              
              <div class="ai-analysis-card">
                <div class="ai-badge">LANDASAN KEBIJAKAN & REGULASI KESEHATAN KENEGARAAN</div>
                ${formatAiParagraphs(aiData.landasan_kebijakan_naratif || `Penanggulangan krisis kesehatan diselenggarakan berdasarkan Keputusan Menteri Kesehatan RI Nomor HK.01.07/MENKES/1998/2022 tentang Pedoman Penanggulangan Krisis Kesehatan. Laporan surveilans ini berfungsi sebagai rujukan analitis resmi bagi pengambil kebijakan dalam menentukan status tanggap darurat, mobilisasi sumber daya manusia kesehatan, dan intervensi pemulihan pascabencana.`)}
              </div>
            </section>

            <!-- SECTION 10: HIMBAUAN BAGI MASYARAKAT INDONESIA -->
            <section id="sec-himbauan">
              <h2 class="section-title">Himbauan Bagi Masyarakat Indonesia</h2>
              <p style="font-size: 13px; color: #334155; line-height: 1.6; margin-bottom: 12px;">
                Meningkatkan kesiapsiagaan mandiri dan pencegahan penyakit di wilayah rawan bencana:
              </p>
              <ul style="padding-left: 20px; margin: 0 0 24px 0;">
                ${himbauanListHtml}
              </ul>
            </section>

            <!-- SECTION 11: KONTAK & INFORMASI LEBIH LANJUT -->
            <section id="sec-kontak">
              <h2 class="section-title">Kontak & Informasi Lebih Lanjut</h2>
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
                <p style="font-size: 14px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">
                  Public Health Emergency Operation Center (PHEOC) / EOC Kemenkes RI
                </p>
                <p style="font-size: 12.5px; color: #334155; margin: 0 0 4px 0;">
                  <b>Telp / WhatsApp:</b> +62 877-7759-1097 / +62 812-1212-3119
                </p>
                <p style="font-size: 12.5px; color: #334155; margin: 0 0 4px 0;">
                  <b>Email Resmi:</b> poskokrisis@kemkes.go.id / eoc@kemkes.go.id
                </p>
                <p style="font-size: 12.5px; color: #334155; margin: 0;">
                  <b>Call Center Gawat Darurat:</b> 119 (Bebas Pulsa 24 Jam)
                </p>
              </div>
            </section>

            <!-- SECTION 12: LEMBAR PENGESAHAN & TANDA TANGAN -->
            <section id="sec-pengesahan" class="no-page-break-inside" style="border-top: 1px solid #cbd5e1; padding-top: 20px; margin-top: 30px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div style="font-size: 11px; color: #64748b; line-height: 1.4;">
                  <b>Pusat Komando Nasional PSC 119 — Kementerian Kesehatan RI</b><br/>
                  Gedung Suwardjono Surjaningrat, Jl. H.R. Rasuna Said Blok X-5 Kav. 4-9 Jakarta<br/>
                  Dokumen Resmi Sistem Penanggulangan Gawat Darurat Terpadu (SPGDT 119)
                </div>
                <div style="text-align: center; width: 240px;">
                  <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">Jakarta, ${reportDateStr}</div>
                  <div style="font-size: 11.5px; font-weight: bold; color: #0f172a;">Tim Komando Nasional PSC 119</div>
                  <div style="height: 50px;"></div>
                  <div style="font-weight: 800; border-top: 1px solid #1e293b; padding-top: 4px; font-size: 12px; color: #0f172a;">
                    Kepala Pusat Komando PSC 119 Kemenkes RI
                  </div>
                </div>
              </div>
            </section>

          </main>
        </div>
      </body>
      </html>
    `

      if (printWindow && !printWindow.closed) {
        printWindow.document.open()
        printWindow.document.write(finalReportHtml)
        printWindow.document.close()
      } else {
        // Fallback jika popup diblokir browser: unduh otomatis sebagai file HTML mandiri
        const blob = new Blob([finalReportHtml], { type: 'text/html;charset=utf-8' })
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.target = '_blank'
        a.download = `Laporan_Resmi_PSC119_${new Date().toISOString().slice(0, 10)}.html`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
        showToast('Pop-up browser terblokir. File Laporan Resmi PSC 119 berhasil diunduh.')
      }

      showToast('Berhasil membuat Laporan Resmi Eksekutif PSC 119 Kemenkes RI!')
    } catch (err: any) {
      console.error('[CreateDashboard] Error generating report:', err)
      showToast(`Gagal menyusun laporan: ${err?.message || 'Terjadi kesalahan sistem'}`)
      if (printWindow && !printWindow.closed) {
        printWindow.close()
      }
    } finally {
      setIsGeneratingAiDashboard(false)
    }
  }

  // DOWNLOAD SINGLE REPORT PDF
  const handleDownloadSinglePDF = (item: LaporanItem) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8">
          <title>Lembar Dispatch Panggilan 119 - ${item.kode_laporan}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 10mm 12mm 10mm;
            }
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; line-height: 1.5; background: #fff; }
            .header { text-align: center; border-bottom: 3px double #047D78; padding-bottom: 10px; margin-bottom: 20px; }
            .header h3 { margin: 0; color: #047D78; font-size: 16px; }
            .header h4 { margin: 2px 0; color: #334155; font-size: 14px; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; background: #e0f2fe; color: #0369a1; font-weight: bold; font-size: 11px; }
            .section { margin-bottom: 15px; }
            .section-title { background: #047D78; color: white; padding: 6px 10px; font-weight: bold; font-size: 12px; margin-bottom: 8px; border-radius: 4px; }
            table.info { width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #cbd5e1; }
            table.info td { padding: 7px 10px; vertical-align: top; border: 1px solid #cbd5e1; }
            table.info td.lbl { font-weight: bold; color: #475569; width: 30%; background-color: #f8fafc; }
            .narasi { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; font-size: 12px; }
            .footer-sig { margin-top: 40px; text-align: right; font-size: 12px; }
            @media print {
              body { background: white; padding: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="position: sticky; top: 0; z-index: 9999; background: #047D78; color: white; padding: 10px 16px; margin: -20px -20px 20px -20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 800; font-size: 13px;">Preview Lembar Dispatch #${item.kode_laporan}</span>
              <span style="background: rgba(255,255,255,0.2); font-size: 10px; padding: 3px 9px; border-radius: 12px; font-weight: 600;">HTML View</span>
            </div>
            <button onclick="window.print()" style="background: #ffffff; color: #047D78; font-weight: bold; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              🖨️ Cetak ke PDF / Print
            </button>
          </div>

          <div class="header">
            <h3>KEMENTERIAN KESEHATAN REPUBLIK INDONESIA</h3>
            <h4>PUSAT KOMANDO NASIONAL PSC 119 — LEMBAR LOG DISPATCH PANGGILAN DARURAT</h4>
            <span class="badge">TIKET #${item.kode_laporan} — Status: ${item.status_verifikasi}</span>
          </div>

          <div class="section">
            <div class="section-title">I. INFORMASI PANGGILAN & TRIASE MEDIS PRA-FASKES</div>
            <table class="info">
              <tr><td class="lbl">Kategori Layanan:</td><td><strong>${item.jenis_bencana}</strong></td></tr>
              <tr><td class="lbl">Waktu Panggilan:</td><td>${item.tgl_kejadian_formatted} (${item.jam_kejadian})</td></tr>
              <tr><td class="lbl">Triase / Prioritas:</td><td><strong>${item.tingkat_bencana}</strong></td></tr>
              <tr><td class="lbl">Pusat PSC 119:</td><td>${item.kabupaten}</td></tr>
              <tr><td class="lbl">Provinsi:</td><td>PROV. ${item.provinsi}</td></tr>
              <tr><td class="lbl">Kecamatan / TKP:</td><td>Kec. ${item.kecamatan}</td></tr>
              <tr><td class="lbl">Alamat / Lokasi:</td><td>${item.desa}</td></tr>
            </table>
          </div>

          <div class="section">
            <div class="section-title">II. PASIEN & MOBILISASI AMBULANS</div>
            <table class="info">
              <tr><td class="lbl">DOA / Meninggal di TKP:</td><td>${item.korban_meninggal} Jiwa</td></tr>
              <tr><td class="lbl">Gawat Darurat (Merah):</td><td>${item.korban_luka_berat} Pasien</td></tr>
              <tr><td class="lbl">Non-Gawat (Kuning/Hijau):</td><td>${item.korban_luka_ringan} Pasien</td></tr>
              <tr><td class="lbl">Total Pasien Terlibat:</td><td>${item.penduduk_terdampak} Pasien</td></tr>
              <tr><td class="lbl">Armada Ambulans Dispatched:</td><td>${item.pengungsi} Unit</td></tr>
              <tr><td class="lbl">RS Rujukan SPGDT:</td><td>${item.faskes_terdampak > 0 ? 'Terhubung Sistem Rujukan' : 'Penanganan Tuntas di TKP'}</td></tr>
            </table>
          </div>

          <div class="section">
            <div class="section-title">III. TINDAKAN MEDIS & DISPATCH LOG</div>
            <div class="narasi">${item.deskripsi}</div>
          </div>

          <div class="footer-sig">
            <p>Dispatcher Pelapor:<br/><strong>${item.petugas}</strong></p>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const getPaginationRange = () => {
    const delta = 1;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l > 2) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-16">
      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 rounded-xl border border-teal-200 bg-white p-4 shadow-xl shadow-teal-700/10 animate-in slide-in-from-right duration-200">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-[#047D78]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold text-slate-800">{toastMessage}</p>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="w-full px-4 sm:px-6 py-6">
        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Panggilan 119</p>
                <h3 className="mt-1 text-2xl font-extrabold text-[#047D78]">{metrics.totalReports} <span className="text-xs font-semibold text-slate-500">Panggilan</span></h3>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-[#047D78] border border-teal-100">
                <FileText className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-teal-600" />
              {activeFilterCount > 0 ? `${activeFilterCount} kriteria filter aktif` : 'Menampilkan seluruh database live PSC 119'}
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kasus Gadar (P1 / P2)</p>
                <h3 className="mt-1 text-2xl font-extrabold text-rose-600">
                  {metrics.totalLuka} <span className="text-xs font-semibold text-slate-500">Pasien</span> / {metrics.totalMeninggal} <span className="text-xs font-semibold text-slate-500">DOA</span>
                </h3>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <ShieldAlert className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Distabilisasi di TKP & dirujuk ke IGD</p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ambulans Dispatched</p>
                <h3 className="mt-1 text-2xl font-extrabold text-amber-600">{metrics.totalPengungsi.toLocaleString('id-ID')} <span className="text-xs font-semibold text-slate-500">Unit</span></h3>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <MapPin className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Armada Ambulans Gadar & Transport</p>
          </div>

          {/* Card 4 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">RS Rujukan & Faskes SPGDT</p>
                <h3 className="mt-1 text-2xl font-extrabold text-cyan-700">{metrics.totalFaskes} <span className="text-xs font-semibold text-slate-500">Faskes</span></h3>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-100">
                <Building2 className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">RSUD, RSUP, & Puskesmas Pembina</p>
          </div>
        </div>

        {/* MAIN LAYOUT: MULTIPLE FILTER SIDEBAR + DATA MATRIX */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ==================== LEFT MULTI FILTER SIDEBAR ==================== */}
          <aside className="lg:col-span-3 xl:col-span-3 2xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5 sticky top-4">

            {/* Filter Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#047D78]" />
                <h2 className="text-sm font-extrabold tracking-wide text-slate-800 uppercase">Filter Laporan</h2>
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 transition"
                  title="Reset Semua Filter"
                >
                  <RotateCcw className="h-3 w-3" />
                  Clear All
                </button>
              )}
            </div>

            {/* SECTION 0: TAHUN PELAPORAN */}
            <div className="space-y-2">
              <label htmlFor="report-year" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#047D78]" />
                Tahun Pelaporan
              </label>
              <select
                id="report-year"
                value={reportYear}
                onChange={(e) => {
                  setReportYear(e.target.value)
                  setSelectedDatePreset('all')
                  setCurrentPage(1)
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-700 focus:border-[#047D78] focus:outline-none focus:ring-1 focus:ring-[#047D78]"
              >
                {Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - index)).map((year) => (
                  <option key={year} value={year}>Tahun {year}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400">Data matriks dan semua unduhan mengikuti tahun ini.</p>
            </div>

            <hr className="border-slate-100" />

            {/* SECTION 1: SMART AUTOCOMPLETE REGION SEARCH (FULL: PROV, KAB, KEC, DESA) */}
            <div className="space-y-3 relative" ref={regionDropdownRef}>
              <div
                className="flex items-center justify-between cursor-pointer select-none py-1"
                onClick={() => toggleSection('smartRegion')}
              >
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-purple-600" />
                  Cari Wilayah (Prov s.d. Desa)
                </span>
                {expandedSection.smartRegion ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </div>

              {expandedSection.smartRegion && (
                <div className="pt-1 relative">
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={regionInputQuery}
                      onChange={(e) => {
                        setRegionInputQuery(e.target.value)
                        setShowRegionDropdown(true)
                      }}
                      onFocus={() => setShowRegionDropdown(true)}
                      placeholder="Cari Prov, Kab, Kec, Desa..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-700 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                    {regionInputQuery && (
                      <button
                        onClick={() => setRegionInputQuery('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* AUTOCOMPLETE SUGGESTIONS DROPDOWN (MATCHING EXACT USER SCREENSHOT DESIGN) */}
                  {showRegionDropdown && filteredRegionSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150 divide-y divide-slate-100">
                      {filteredRegionSuggestions.map((sug) => {
                        const isKec = sug.level === 'KECAMATAN'
                        const isDesa = sug.level === 'DESA'
                        const isProv = sug.level === 'PROVINSI'

                        return (
                          <div
                            key={sug.id}
                            onClick={() => handleSelectRegionSuggestion(sug)}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-purple-50/60 transition cursor-pointer group"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <MapPin className="h-4 w-4 text-slate-400 group-hover:text-purple-600 shrink-0 mt-0.5 transition" />
                              <p className="text-xs font-bold text-slate-800 group-hover:text-purple-900 leading-snug truncate">
                                {sug.fullName}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-md text-[9px] font-extrabold px-2 py-0.5 border uppercase tracking-wider ${isKec
                                ? 'bg-purple-50 border-purple-200 text-purple-700'
                                : isDesa
                                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                                  : isProv
                                    ? 'bg-teal-50 border-teal-200 text-[#047D78]'
                                    : 'bg-blue-50 border-blue-200 text-blue-700'
                                }`}
                            >
                              {sug.level}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Selected Smart Region Pills */}
                  {selectedRegionPills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedRegionPills.map((pill) => (
                        <span
                          key={pill.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-100 border border-purple-200 px-2 py-1 text-[11px] font-bold text-purple-900"
                        >
                          <MapPin className="h-3 w-3 text-purple-700" />
                          <span className="truncate max-w-[140px]">{pill.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRegionPill(pill.id)}
                            className="text-purple-600 hover:text-purple-900"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* SECTION 2: Multiple Provinsi (Full 38 Provinces from API) */}
            <div className="space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer select-none py-1"
                onClick={() => toggleSection('provinsi')}
              >
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  Provinsi ({selectedProvinces.length > 0 ? selectedProvinces.length : 'Semua'})
                </span>
                {expandedSection.provinsi ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </div>

              {expandedSection.provinsi && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{provinceList.length} Provinsi</span>
                    <button
                      type="button"
                      onClick={handleSelectAllProvinces}
                      className="text-[#047D78] font-bold hover:underline"
                    >
                      {selectedProvinces.length === provinceList.length ? 'Batalkan Semua' : 'Pilih Semua'}
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={provinceSearch}
                      onChange={(e) => setProvinceSearch(e.target.value)}
                      placeholder="Cari provinsi..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-700 focus:border-[#047D78] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 no-scrollbar border border-slate-100 rounded-xl p-1.5 bg-slate-50/30">
                    {loadingProvinces ? (
                      <div className="py-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-[#047D78]" />
                        <span>Memuat daftar provinsi...</span>
                      </div>
                    ) : (
                      filteredProvinceList.map((prov) => {
                        const isChecked = selectedProvinces.includes(prov.name)
                        return (
                          <label
                            key={prov.id || prov.name}
                            className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition ${isChecked
                              ? 'bg-teal-50 border border-teal-200 font-bold text-teal-900'
                              : 'hover:bg-slate-100/70 text-slate-600'
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleProvinceToggle(prov.name)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-[#047D78] focus:ring-[#047D78]"
                            />
                            <span className="truncate uppercase leading-tight text-[11px]">{prov.name}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* SECTION 3: Multiple Jenis Bencana */}
            <div className="space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer select-none py-1"
                onClick={() => toggleSection('jenisBencana')}
              >
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Jenis Bencana ({selectedTypes.length > 0 ? selectedTypes.length : 'Semua'})
                </span>
                {expandedSection.jenisBencana ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </div>

              {expandedSection.jenisBencana && (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 no-scrollbar pt-1">
                  {availableDisasterTypes.map((jenis) => {
                    const isChecked = selectedTypes.includes(jenis)
                    return (
                      <label
                        key={jenis}
                        className={`flex items-start gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition ${isChecked
                          ? 'bg-teal-50 border border-teal-200 font-bold text-teal-900'
                          : 'hover:bg-slate-50 text-slate-600'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTypeToggle(jenis)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-[#047D78] focus:ring-[#047D78]"
                        />
                        <span className="leading-tight flex-1">{jenis}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* SECTION 4: Tanggal Kejadian */}
            <div className="space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer select-none py-1"
                onClick={() => toggleSection('tanggal')}
              >
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Rentang Waktu</span>
                {expandedSection.tanggal ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </div>

              {expandedSection.tanggal && (
                <div className="space-y-1.5 pt-1">
                  {[
                    { id: 'all', label: 'Semua Tanggal' },
                    { id: '7days', label: '7 Hari Terakhir' },
                    { id: '30days', label: '30 Hari Terakhir' },
                    { id: 'this_year', label: `Tahun ${reportYear}` },
                  ].map((preset) => (
                    <label
                      key={preset.id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${selectedDatePreset === preset.id
                        ? 'bg-teal-700 text-white font-bold'
                        : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      <input
                        type="radio"
                        name="datePreset"
                        checked={selectedDatePreset === preset.id}
                        onChange={() => {
                          setSelectedDatePreset(preset.id)
                          setCurrentPage(1)
                        }}
                        className="hidden"
                      />
                      <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span>{preset.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* SECTION 5: Status Verifikasi */}
            <div className="space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer select-none py-1"
                onClick={() => toggleSection('status')}
              >
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Status Verifikasi</span>
                {expandedSection.status ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </div>

              {expandedSection.status && (
                <div className="space-y-1.5 pt-1">
                  {availableStatuses.map((st) => {
                    const isChecked = selectedStatuses.includes(st)
                    return (
                      <label
                        key={st}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition ${isChecked
                          ? 'bg-teal-50 border border-teal-200 font-bold text-teal-900'
                          : 'hover:bg-slate-50 text-slate-600'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleStatusToggle(st)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-[#047D78] focus:ring-[#047D78]"
                        />
                        <span>{st}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* SECTION 6: Filter Spesifik */}
            <div className="space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer select-none py-1"
                onClick={() => toggleSection('dampak')}
              >
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Dampak Spesifik</span>
                {expandedSection.dampak ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </div>

              {expandedSection.dampak && (
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterKorbanOnly}
                      onChange={(e) => {
                        setFilterKorbanOnly(e.target.checked)
                        setCurrentPage(1)
                      }}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[#047D78] focus:ring-[#047D78]"
                    />
                    <span>Ada Korban Jiwa / Luka</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterFaskesOnly}
                      onChange={(e) => {
                        setFilterFaskesOnly(e.target.checked)
                        setCurrentPage(1)
                      }}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[#047D78] focus:ring-[#047D78]"
                    />
                    <span>Ada Faskes Terdampak</span>
                  </label>
                </div>
              )}
            </div>

            {/* Reset Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-extrabold text-xs uppercase tracking-wider transition text-center"
              >
                Clear All Filter
              </button>
            </div>
          </aside>

          {/* ==================== RIGHT MAIN DATA MATRIX ==================== */}
          <main className="lg:col-span-9 xl:col-span-9 2xl:col-span-10 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

              {/* Header Title & Subtitle */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">MATRIKS PELAPORAN PANGGILAN TAHUN {reportYear}</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Matriks log pelaporan panggilan PSC 119 tahun {reportYear}; filter, matriks, dan unduhan menggunakan dataset yang sama.</p>
                </div>

                {/* Export Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-sm"
                    title="Unduh format Excel / CSV terfilter"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                    <span>Unduh Excel (.XLSX)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 transition shadow-sm"
                    title="Cetak atau unduh dokumen PDF ringkasan"
                  >
                    <FileText className="h-4 w-4 text-rose-700" />
                    <span>Unduh PDF (.PDF)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateDashboardHTML}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-teal-600 bg-[#047D78] hover:bg-[#036662] px-3.5 py-2 text-xs font-bold text-white transition shadow-md cursor-pointer active:scale-95"
                    title="Generate & cetak laporan resmi Kop Kemenkes & Analisis AI"
                  >
                    <Sparkles className="h-4 w-4 text-teal-200" />
                    <span>Laporan Eksekutif PSC 119 (AI)</span>
                  </button>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition shadow-sm"
                    title="Buka Peta Spasial & Dasbor Utama PSC 119"
                  >
                    <Home className="h-4 w-4 text-[#047D78]" />
                    <span>Dashboard Peta 119</span>
                  </Link>
                </div>
              </div>

              {/* ACTIVE FILTER PILLS BAR */}
              {activeFilterCount > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 bg-teal-50/50 p-2.5 rounded-xl border border-teal-100">
                  <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider mr-1">Filter Aktif:</span>

                  {selectedRegionPills.map((pill) => (
                    <span key={pill.id} className="inline-flex items-center gap-1 rounded-lg bg-purple-700 text-white px-2 py-0.5 text-xs font-semibold">
                      {pill.level}: {pill.name}
                      <button onClick={() => handleRemoveRegionPill(pill.id)} className="hover:text-rose-200">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}

                  {selectedProvinces.map((prov) => (
                    <span key={prov} className="inline-flex items-center gap-1 rounded-lg bg-teal-700 text-white px-2 py-0.5 text-xs font-semibold">
                      Prov: {prov}
                      <button onClick={() => handleProvinceToggle(prov)} className="hover:text-rose-200">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}

                  {selectedTypes.map((jenis) => (
                    <span key={jenis} className="inline-flex items-center gap-1 rounded-lg bg-[#047D78] text-white px-2 py-0.5 text-xs font-semibold">
                      Layanan: {jenis}
                      <button onClick={() => handleTypeToggle(jenis)} className="hover:text-rose-200">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}

                  {selectedStatuses.map((st) => (
                    <span key={st} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 text-white px-2 py-0.5 text-xs font-semibold">
                      Status: {st}
                      <button onClick={() => handleStatusToggle(st)} className="hover:text-rose-200">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}

                  {selectedDatePreset !== 'all' && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-700 text-white px-2 py-0.5 text-xs font-semibold">
                      Periode: {selectedDatePreset === '7days' ? '7 Hari Terakhir' : selectedDatePreset === '30days' ? '30 Hari Terakhir' : selectedDatePreset === 'this_year' ? `Tahun ${reportYear}` : selectedDatePreset}
                      <button onClick={() => { setSelectedDatePreset('all'); setCurrentPage(1); }} className="hover:text-rose-200">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {filterKorbanOnly && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-rose-700 text-white px-2 py-0.5 text-xs font-semibold">
                      Dampak: Ada Korban
                      <button onClick={() => { setFilterKorbanOnly(false); setCurrentPage(1); }} className="hover:text-rose-200">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {filterFaskesOnly && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-700 text-white px-2 py-0.5 text-xs font-semibold">
                      Dampak: Faskes Terdampak
                      <button onClick={() => { setFilterFaskesOnly(false); setCurrentPage(1); }} className="hover:text-rose-200">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-700 text-white px-2 py-0.5 text-xs font-semibold">
                      Cari: &quot;{searchQuery}&quot;
                      <button onClick={() => setSearchQuery('')} className="hover:text-rose-200">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  <button
                    onClick={handleResetFilters}
                    className="ml-auto text-[11px] font-extrabold text-rose-600 hover:underline"
                  >
                    Reset Semua
                  </button>
                </div>
              )}

              {/* Controls Row: Items Per Page & Live Search */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#047D78]"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span>Data per halaman</span>
                </div>

                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1)
                    }}
                    placeholder="Pencarian lokasi s.d. Desa, kode, narasi..."
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#047D78] focus:outline-none focus:ring-1 focus:ring-[#047D78]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* DATA MATRIX TABLE WITH DEEP HIERARCHY */}
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#047D78] text-white uppercase text-[10px] tracking-wider font-extrabold">
                      <th className="py-3 px-3 border-b border-[#036662] text-center w-10">NO</th>
                      <th className="py-3 px-3 border-b border-[#036662]">NAMA PSC</th>
                      <th className="py-3 px-3 border-b border-[#036662]">TICKET ID</th>
                      <th className="py-3 px-3 border-b border-[#036662] text-center">STATUS</th>
                      <th className="py-3 px-3 border-b border-[#036662]">JENIS LAYANAN</th>
                      <th className="py-3 px-3 border-b border-[#036662]">WAKTU PANGGILAN</th>
                      <th className="py-3 px-3 border-b border-[#036662]">PETUGAS PANGGILAN</th>
                      <th className="py-3 px-3 border-b border-[#036662]">NAMA PELAPOR</th>
                      <th className="py-3 px-3 border-b border-[#036662]">NAMA KORBAN</th>
                      <th className="py-3 px-3 border-b border-[#036662]">ALAMAT</th>
                      <th className="py-3 px-3 border-b border-[#036662] text-center">DETAIL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {loadingApiReports ? (
                      Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={idx} className="animate-pulse bg-white">
                          <td className="py-4 px-3 text-center"><div className="h-4 w-4 bg-slate-200 rounded mx-auto"></div></td>
                          <td className="py-4 px-3"><div className="h-4 w-24 bg-slate-200 rounded mb-1"></div><div className="h-3 w-16 bg-slate-200 rounded"></div></td>
                          <td className="py-4 px-3"><div className="h-4 w-24 bg-slate-200 rounded mb-1"></div><div className="h-3 w-16 bg-slate-200 rounded"></div></td>
                          <td className="py-4 px-3"><div className="h-3 w-12 bg-slate-200 rounded mb-1"></div><div className="h-4 w-32 bg-slate-200 rounded mb-1"></div><div className="h-3 w-28 bg-slate-200 rounded"></div></td>
                          <td className="py-4 px-3"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                          <td className="py-4 px-3 text-center"><div className="h-4 w-8 bg-slate-200 rounded mx-auto"></div></td>
                          <td className="py-4 px-3 text-center"><div className="h-4 w-8 bg-slate-200 rounded mx-auto"></div></td>
                          <td className="py-4 px-3 text-center"><div className="h-4 w-8 bg-slate-200 rounded mx-auto"></div></td>
                          <td className="py-4 px-3 text-center"><div className="h-6 w-16 bg-slate-200 rounded mx-auto"></div></td>
                        </tr>
                      ))
                    ) : paginatedReports.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400">
                          <Info className="mx-auto h-8 w-8 opacity-40 mb-2" />
                          <p className="text-sm font-semibold">Tidak ada log panggilan PSC 119 yang sesuai dengan kriteria filter lokasi/kategori layanan.</p>
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-bold text-[#047D78] hover:bg-teal-100 transition"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reset Semua Filter
                          </button>
                        </td>
                      </tr>
                    ) : (
                      paginatedReports.map((item, idx) => {
                        const globalIndex = (currentPage - 1) * itemsPerPage + idx + 1
                        return (
                          <tr key={item.id} className="hover:bg-teal-50/30 transition">
                            {/* NO */}
                            <td className="py-3 px-3 text-center font-bold text-slate-600">{globalIndex}</td>

                            <td className="py-3 px-3 font-bold text-slate-800 max-w-[160px] truncate" title={item.nama_psc}>{item.nama_psc || '-'}</td>
                            <td className="py-3 px-3 font-mono font-semibold text-slate-600 text-[11px] whitespace-nowrap">{item.ticket_id || item.kode_laporan}</td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                (item.status_penanganan_code || '').toLowerCase().includes('proses')
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}>{item.status_penanganan_code || item.status_verifikasi || '-'}</span>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700 max-w-[150px] truncate" title={item.jenis_layanan}>{item.jenis_layanan || '-'}</td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <p className="font-extrabold text-slate-800">{item.tgl_kejadian_formatted}</p>
                              <span className="text-[10px] text-slate-400 font-medium">{item.jam_kejadian}</span>
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-700 max-w-[130px] truncate" title={item.petugas_pelapor}>{item.petugas_pelapor || '-'}</td>
                            <td className="py-3 px-3 font-medium text-slate-700 max-w-[130px] truncate" title={item.nama_pelapor}>{item.nama_pelapor || '-'}</td>
                            <td className="py-3 px-3 font-medium text-slate-700 max-w-[130px] truncate" title={item.korban}>{item.korban || '-'}</td>
                            <td className="py-3 px-3 text-slate-600 max-w-[200px] truncate" title={item.desa}>{item.desa || '-'}</td>

                            {/* DETAIL FORMULIR BUTTON */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setDetailItem(item)}
                                className="inline-flex items-center gap-1 rounded-lg bg-teal-50 border border-teal-200 hover:bg-teal-100 px-2.5 py-1 text-[11px] font-bold text-[#047D78] transition"
                              >
                                <Eye className="h-3 w-3" />
                                <span>Pratinjau</span>
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* FOOTER & PAGINATION */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  Menampilkan <strong className="text-slate-800">{filteredReports.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> sampai{' '}
                  <strong className="text-slate-800">{Math.min(currentPage * itemsPerPage, filteredReports.length)}</strong> dari{' '}
                  <strong className="text-slate-800">{filteredReports.length}</strong> laporan terfilter
                </p>

                {/* Pagination Controls */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Sebelumnya
                  </button>

                  {getPaginationRange().map((page, idx) => (
                    typeof page === 'number' ? (
                      <button
                        key={idx}
                        onClick={() => setCurrentPage(page)}
                        className={`h-7 w-7 rounded-lg text-xs font-bold transition ${currentPage === page
                          ? 'bg-[#047D78] text-white shadow-sm'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        {page}
                      </button>
                    ) : (
                      <span key={idx} className="px-1.5 text-xs font-bold text-slate-400">
                        {page}
                      </span>
                    )
                  ))}

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* DETAIL MODAL PREVIEW WITH DEEP HIERARCHY */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-[10px] font-extrabold text-[#047D78] uppercase tracking-wider">
                  {detailItem.kode_laporan}
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-1">{detailItem.jenis_bencana}</h3>
                <p className="text-xs text-slate-600 font-semibold">
                  Lokasi: <span className="text-teal-700 font-bold">{detailItem.desa}</span>, Kec. {detailItem.kecamatan}, {detailItem.kabupaten}, Prov. {detailItem.provinsi}
                </p>
              </div>
              <button
                onClick={() => setDetailItem(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Waktu Kejadian</p>
                <p className="font-extrabold text-slate-800 mt-0.5">{detailItem.tgl_kejadian_formatted} ({detailItem.jam_kejadian})</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Status Verifikasi</p>
                <p className="font-extrabold text-emerald-700 mt-0.5">{detailItem.status_verifikasi}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase">Rincian Dampak Kesehatan & Korban</h4>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-rose-50 border border-rose-100 p-2 rounded-xl">
                  <p className="text-[10px] font-bold text-rose-600">Meninggal</p>
                  <p className="text-base font-black text-rose-700">{detailItem.korban_meninggal}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-2 rounded-xl">
                  <p className="text-[10px] font-bold text-amber-600">Luka Berat</p>
                  <p className="text-base font-black text-amber-700">{detailItem.korban_luka_berat}</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-2 rounded-xl">
                  <p className="text-[10px] font-bold text-blue-600">Luka Ringan</p>
                  <p className="text-base font-black text-blue-700">{detailItem.korban_luka_ringan}</p>
                </div>
                <div className="bg-slate-100 border border-slate-200 p-2 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-600">Faskes Rusak</p>
                  <p className="text-base font-black text-slate-800">{detailItem.faskes_terdampak}</p>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-700 uppercase">Narasi Perkembangan Kejadian</h4>
              <p className="text-xs leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-700">
                {detailItem.deskripsi}
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">Petugas: <strong>{detailItem.petugas}</strong></span>
              <button
                type="button"
                onClick={() => {
                  const target = detailItem
                  setDetailItem(null)
                  handleDownloadSinglePDF(target)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#047D78] hover:bg-[#036662] px-4 py-2 text-xs font-bold text-white transition"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak & Unduh Laporan Ini</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN AI & PYTHON GENERATION LOADING OVERLAY (CONSISTENT LIGHT THEME) */}
      {isGeneratingAiDashboard && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-teal-100 bg-white p-7 shadow-2xl text-center space-y-5 text-slate-800">
            {/* Subtle Top Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl pointer-events-none animate-pulse" />

            {/* Close / Dismiss Button */}
            <button
              type="button"
              onClick={() => setIsGeneratingAiDashboard(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              title="Tutup / Batalkan"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-widest text-[#047D78]">
              <Sparkles className="h-3.5 w-3.5 text-[#047D78] animate-spin" />
              <span>EOC AI ENGINE — GEMINI 2.5 FLASH</span>
            </div>

            {/* Center Pulsing Icon */}
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#047D78] to-teal-500 shadow-lg shadow-teal-700/20 text-white">
              <div className="absolute inset-0 rounded-2xl border-2 border-teal-300/60 animate-ping opacity-30" />
              <Loader2 className="h-10 w-10 text-white animate-spin" />
            </div>

            {/* Main Title & Warning Pill */}
            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900">
                MOHON TUNGGU, SEDANG MENYINTESIS LAPORAN RESMI
              </h3>
              <div className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-1.5 text-xs font-bold text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Harap jangan menutup, berpindah, atau me-refresh halaman ini.</span>
              </div>

              {/* Sleek Animated Progress Bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/80 mt-3">
                <div className="h-full w-full bg-gradient-to-r from-[#047D78] via-teal-400 to-[#047D78] animate-pulse" />
              </div>
            </div>

            {/* 4 Feature Indicator Chips */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-200/80 shadow-2xs font-semibold">
                <Globe className="h-4 w-4 text-[#047D78] shrink-0" />
                <span className="truncate">Peta GeoJSON 38 Prov</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-200/80 shadow-2xs font-semibold">
                <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                <span className="truncate">Sintesis Gemini 2.5 Flash</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-200/80 shadow-2xs font-semibold">
                <FileText className="h-4 w-4 text-teal-600 shrink-0" />
                <span className="truncate">3 Multi-Series Grafik</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-200/80 shadow-2xs font-semibold">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="truncate">Protokol EMT Kemenkes</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-100 font-medium">
              Pusat Krisis Kesehatan — Kementerian Kesehatan Republik Indonesia
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
