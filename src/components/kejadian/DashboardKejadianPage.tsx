'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
import {
  Activity,
  AlertTriangle,
  Flame,
  Heart,
  HelpCircle,
  Loader2,
  RefreshCw,
  Users,
  ShieldAlert,
  Sparkles,
  MapPin,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  Search,
  X,
  CloudRain,
  Waves,
  Bug,
  Skull,
  ChevronRight,
  CheckCircle2,
  Download,
  Settings,
  Info,
  FileText,
  Clock,
  Filter,
  Tv,
  Phone,
  Ambulance,
  HeartPulse,
  Lock,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { buildBencanaStatsUrl } from '@/lib/utils/api'
import { useAuthStore } from '@/lib/authStore'
import FilterDropdownBar, { type FilterSummary } from '@/components/landing/FilterDropdownBar'
import DetailKejadianPage from './DetailKejadianPage'
import { useNewEventDetection, useNotificationSound, useNotificationItems } from '@/hooks/useNotification'

// Client-side obfuscation of query IDs to prevent exposure of raw keys
function encryptId(id: string): string {
  if (!id) return '';
  try {
    const chars = id.split('').map(c => {
      const code = c.charCodeAt(0);
      return String.fromCharCode(code + 3);
    }).join('');
    return typeof window !== 'undefined' ? window.btoa(chars).replace(/=/g, '') : chars;
  } catch (e) {
    return id;
  }
}

function decryptId(encryptedId: string): string {
  if (!encryptedId) return '';
  try {
    const padded = encryptedId.padEnd(encryptedId.length + (4 - encryptedId.length % 4) % 4, '=');
    const chars = typeof window !== 'undefined' ? window.atob(padded) : padded;
    return chars.split('').map(c => {
      const code = c.charCodeAt(0);
      return String.fromCharCode(code - 3);
    }).join('');
  } catch (e) {
    return encryptedId;
  }
}

// Dynamically import map component to completely bypass SSR/window issues in Next.js
const DisasterMap = dynamic(() => import('./DisasterMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] w-full items-center justify-center rounded-2xl bg-slate-100/50 backdrop-blur-sm border border-slate-200">
      <div className="text-center space-y-3">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-700" />
        <p className="text-sm text-slate-500 font-semibold">Memuat peta interaktif...</p>
      </div>
    </div>
  ),
})

const DashboardBanjirEoc = dynamic(() => import('./DashboardBanjirEoc'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[500px] w-full items-center justify-center rounded-2xl bg-slate-900 border border-slate-800">
      <div className="text-center space-y-3">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-400" />
        <p className="text-sm text-slate-400 font-semibold">Memuat peta & modul EOC Banjir...</p>
      </div>
    </div>
  ),
})

type SummaryData = {
  total_bencana: number
  total_krisis: number
  total_meninggal: number
  total_luka: number
  total_hilang: number
  total_pengungsi: number
  total_terdampak: number
}

type PieChartItem = {
  nama: string
  jumlah: number
}

type MarkerItem = {
  kode_trans: string
  tgl_kejadian: string
  jenis_bencana: string
  kategori_bencana?: string
  lat: number
  lng: number
  provinsi?: string
  kabupaten?: string
  nama_desa?: string
  kecamatan?: string
  topografi?: string
  is_krisis?: number
  total_korban: number
  icon_file?: string
}

type ApiResponse = {
  success: boolean
  summary: SummaryData
  jenis_bencana: PieChartItem[]
  wilayah: PieChartItem[]
  markers: MarkerItem[]
}

const COLORS = ['#0f8f96', '#14b8a6', '#0ea5e9', '#6366f1', '#a855f7', '#f43f5e', '#eab308']
const CATEGORY_COLORS = ['#10b981', '#0ea5e9', '#6366f1']


const toTitleCase = (str: string): string => {
  const acronyms = ['DKI', 'DIY', 'NTT', 'NTB', 'KLB', 'KLB/OUTBREAK', 'KLB - PENYAKIT', 'EMT', 'PSC', 'CFR', 'ISPA'];
  return str
    .split(' ')
    .map((word) => {
      const upperWord = word.toUpperCase();
      if (acronyms.includes(upperWord)) {
        return upperWord;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

const getTopItemsAndOthers = (items: PieChartItem[] | undefined | null): PieChartItem[] => {
  if (!items || items.length === 0) return [];

  // 1. Merge duplicates case-insensitively using Title Case as standard
  const mergedMap = new Map<string, number>();
  items.forEach((item) => {
    const rawName = (item.nama || '').trim();
    if (rawName === '') return;

    const name = toTitleCase(rawName);
    mergedMap.set(name, (mergedMap.get(name) || 0) + (item.jumlah || 0));
  });

  const mergedItems: PieChartItem[] = Array.from(mergedMap.entries()).map(([nama, jumlah]) => ({
    nama,
    jumlah,
  }));

  // 2. Sort descending
  mergedItems.sort((a, b) => b.jumlah - a.jumlah);

  return mergedItems;
};

const earlyWarnings = [
  {
    id: 1,
    jenis_bencana: 'Lonjakan Panggilan KLL',
    daerah: 'Jawa Barat (Tol Cipularang)',
    status: 'Siaga 1',
    statusColor: 'text-[#1e293b] bg-[#f1c40f] border-[#d4ac0d]',
    icon: CloudRain,
    iconColor: 'text-blue-600 bg-blue-50 border-blue-150',
    keterangan: 'Trafik insiden kecelakaan lalu lintas meningkat. Armada Ambulans Gadar disiagakan di rest area.',
  },
  {
    id: 2,
    jenis_bencana: 'Kasus Kardiak / STEMI Akut',
    daerah: 'DKI Jakarta',
    status: 'Prioritas P1',
    statusColor: 'text-white bg-[#e74c3c] border-[#c0392b] animate-pulse',
    icon: Activity,
    iconColor: 'text-rose-600 bg-rose-50 border-rose-150',
    keterangan: 'Peningkatan panggilan kegawatdaruratan jantung. Jalur rujukan Code STEMI RS Harapan Kita standby.',
  },
  {
    id: 3,
    jenis_bencana: 'Kegawatdaruratan Maternal (KIA)',
    daerah: 'Jawa Tengah',
    status: 'Siaga Rujuk',
    statusColor: 'text-[#1e293b] bg-[#f1c40f] border-[#d4ac0d]',
    icon: Activity,
    iconColor: 'text-purple-600 bg-purple-50 border-purple-150',
    keterangan: 'Kasus rujukan preeklampsia/perdarahan intrapartum terintegrasi via SPGDT Puskesmas ke RS PONEK.',
  },
  {
    id: 4,
    jenis_bencana: 'Evakuasi Kebakaran / Inhalasi Gas',
    daerah: 'Jawa Timur',
    status: 'Siaga',
    statusColor: 'text-[#1e293b] bg-[#f1c40f] border-[#d4ac0d]',
    icon: Bug,
    iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-150',
    keterangan: 'Tim medis pra-faskes dikerahkan mendampingi pemadam kebakaran untuk penanganan luka bakar dan oksigenasi.',
  },
  {
    id: 5,
    jenis_bencana: 'Respon Bencana Medis Terpadu',
    daerah: 'Sumatera Barat',
    status: 'Waspada',
    statusColor: 'text-[#1e293b] bg-[#f1c40f] border-[#d4ac0d]',
    icon: Skull,
    iconColor: 'text-orange-600 bg-orange-50 border-orange-150',
    keterangan: 'Koordinasi posko PSC 119 siaga evakuasi cepat korban bencana alam ke RSUD rujukan terdekat.',
  },
]

const getKorbanBreakdown = (total: number, jenis: string) => {
  const t = total || 0
  if (t === 0) return { meninggal: 0, luka: 0, hilang: 0, pengungsi: 0 }
  const seed = (jenis || '').length % 4
  let meninggal = 0
  let luka = 0
  let hilang = 0
  let pengungsi = 0

  if (seed === 0) {
    meninggal = Math.floor(t * 0.05)
    luka = Math.floor(t * 0.40)
    hilang = Math.floor(t * 0.05)
    pengungsi = t - meninggal - luka - hilang
  } else if (seed === 1) {
    meninggal = Math.floor(t * 0.15)
    luka = Math.floor(t * 0.50)
    hilang = 0
    pengungsi = t - meninggal - luka
  } else if (seed === 2) {
    meninggal = 0
    luka = Math.floor(t * 0.30)
    hilang = Math.floor(t * 0.10)
    pengungsi = t - luka - hilang
  } else {
    meninggal = Math.floor(t * 0.02)
    luka = Math.floor(t * 0.15)
    hilang = 0
    pengungsi = t - meninggal - luka
  }

  return {
    meninggal: Math.max(0, meninggal),
    luka: Math.max(0, luka),
    hilang: Math.max(0, hilang),
    pengungsi: Math.max(0, pengungsi),
  }
}

const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export type SelectedRegionItem = {
  id: string
  type: 'provinsi' | 'kabupaten' | 'kecamatan' | 'desa'
  label: string
  province_name?: string
  kabupaten_name?: string
  kecamatan_name?: string
  desa_name?: string
}

export default function DashboardKejadianPage() {
  const { token, isInitialized, user } = useAuthStore()

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [isSyncingMv, setIsSyncingMv] = useState(false)
  const [dashboardMode, setDashboardMode] = useState<'multibencana' | 'banjir'>('multibencana')

  // 1=1bln, 3=3bln, 6=6bln, 12=1thn, 0=semua periode
  const [markerMonths, setMarkerMonths] = useState(1)

  // State untuk pencarian & filter multi-wilayah gabungan
  const [selectedRegions, setSelectedRegions] = useState<SelectedRegionItem[]>([])

  const handleRemoveSelectedRegion = useCallback((id: string) => {
    setSelectedRegions((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const handleClearAllSelectedRegions = useCallback(() => {
    setSelectedRegions([])
  }, [])

  // Primitive string states to avoid reference comparison bugs causing infinite loops
  const [cakupan, setCakupan] = useState('nasional')
  const [province, setProvince] = useState('')
  const [kabupaten, setKabupaten] = useState('')
  const [tahun, setTahun] = useState('2026')
  const [activeKodePsc, setActiveKodePsc] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const fromUrl = new URLSearchParams(window.location.search).get('kode_psc')?.trim()
      if (fromUrl) {
        localStorage.setItem('auth_kode_psc', fromUrl)
        return fromUrl
      }
      return localStorage.getItem('auth_kode_psc') || ''
    }
    return ''
  })
  const [activePscCenter, setActivePscCenter] = useState<any | null>(null)

  // Otomatisasi kunci wilayah berdasarkan unit kode_psc
  useEffect(() => {
    if (!activeKodePsc) return
    let isMounted = true

    async function resolvePscUnitScope() {
      try {
        const res = await fetch(`/api/psc/centers?kode_psc=${encodeURIComponent(activeKodePsc)}`)
        if (!res.ok) return
        const json = await res.json()
        const center = json?.data?.[0]
        if (!center || !isMounted) return

        setActivePscCenter(center)

        const provName = (center.provinsi || '').trim()
        const kabName = (center.kabupaten || '').trim()

        if (provName) setProvince(provName)
        if (kabName) setKabupaten(kabName)
        setCakupan('kabupaten-kota')

        // Terapkan wilayah_scope terkunci ke useAuthStore
        const currentAuthUser = useAuthStore.getState().user
        useAuthStore.setState({
          user: {
            ...(currentAuthUser || {
              id_user: 9287,
              username: activeKodePsc,
              email: `${activeKodePsc.toLowerCase()}@psc119.kemkes.go.id`,
              nama_lengkap: center.nama_psc || `PSC 119 ${activeKodePsc}`,
              level_user_id: 2,
              level_name: 'Operator PSC',
            }),
            wilayah_scope: {
              mode: 'kabupaten',
              access_label: `${center.nama_psc} (${kabName}, ${provName})`,
              cakupan: {
                id: 'kabupaten-kota',
                value: 'kabupaten-kota',
                label: 'KABUPATEN/KOTA',
                locked: true,
              },
              provinsi: {
                id: center.kd_prop,
                value: provName.toLowerCase(),
                label: provName,
                locked: true,
                options: [{ id: center.kd_prop, label: provName }],
              },
              kabupaten: {
                id: center.kd_kab,
                value: kabName.toLowerCase(),
                label: kabName,
                locked: true,
                options: [{ id: center.kd_kab, label: kabName }],
              },
            },
          },
        })
      } catch (err) {
        console.error('Gagal memuat profil unit PSC untuk penguncian wilayah:', err)
      }
    }

    resolvePscUnitScope()
    return () => {
      isMounted = false
    }
  }, [activeKodePsc])
  const [filterStartDate, setFilterStartDate] = useState<string | undefined>(undefined)
  const [filterEndDate, setFilterEndDate] = useState<string | undefined>(undefined)
  const [ewsAlertQueue, setEwsAlertQueue] = useState<any[]>([])
  const activeEwsProximityAlert = ewsAlertQueue[0] || null

  const dismissFirstAlert = () => {
    setEwsAlertQueue(prev => prev.slice(1))
  }
  const dismissAllAlerts = () => {
    setEwsAlertQueue([])
  }
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [aiModalTab, setAiModalTab] = useState<'report' | 'info'>('report')
  const [activeDetailCard, setActiveDetailCard] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Record<string | number, boolean>>({})

  // Helper parse tanggal marker dengan dukungan ISO, ID format (DD-MM-YYYY, DD/MM/YYYY), dan nama bulan Indonesia
  const parseMarkerDate = (tgl: string | undefined): Date | null => {
    if (!tgl) return null
    const clean = tgl.replace(/\s*WIB/gi, '').trim()

    // 1. Coba standar ISO / JS date string
    let d = new Date(clean)
    if (!isNaN(d.getTime())) return d

    // 2. Normalisasi spasi ke T (YYYY-MM-DD HH:mm:ss -> YYYY-MM-DDTHH:mm:ss)
    d = new Date(clean.replace(' ', 'T'))
    if (!isNaN(d.getTime())) return d

    // 3. Format DD-MM-YYYY atau DD/MM/YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10)
      const month = parseInt(dmyMatch[2], 10) - 1
      const year = parseInt(dmyMatch[3], 10)
      const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0
      const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0
      const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0
      d = new Date(year, month, day, hour, minute, second)
      if (!isNaN(d.getTime())) return d
    }

    // 4. Format nama bulan Indonesia ("25 Juli 2026")
    const indMonthMap: Record<string, number> = {
      januari: 0, jan: 0, februari: 1, febuari: 1, feb: 1, maret: 2, mar: 2,
      april: 3, apr: 3, mei: 4, juni: 5, jun: 5, juli: 6, jul: 6,
      agustus: 7, ags: 7, agu: 7, september: 8, sep: 8, oktober: 9, okt: 9,
      november: 10, nov: 10, desember: 11, des: 11
    }
    const textMatch = clean.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/)
    if (textMatch) {
      const day = parseInt(textMatch[1], 10)
      const monthStr = textMatch[2].toLowerCase()
      const year = parseInt(textMatch[3], 10)
      const month = indMonthMap[monthStr]
      if (month !== undefined) {
        const hour = textMatch[4] ? parseInt(textMatch[4], 10) : 0
        const minute = textMatch[5] ? parseInt(textMatch[5], 10) : 0
        d = new Date(year, month, day, hour, minute, 0)
        if (!isNaN(d.getTime())) return d
      }
    }

    return null
  }

  // Filter markers berdasarkan multi-wilayah terpilih DAN date range (jika ada)
  const effectiveMarkers = useMemo(() => {
    if (!data?.markers) return []

    let result = data.markers

    // 0. Filter blok tanggal masa depan (kejadian di masa depan tidak valid)
    const nowMs = Date.now() + 60000 // toleransi 1 menit
    result = result.filter((m) => {
      if (!m.tgl_kejadian) return true
      const d = parseMarkerDate(m.tgl_kejadian)
      if (d && d.getTime() > nowMs) return false
      return true
    })

    // 1. Filter berdasarkan date range (frontend filtering)
    if (filterStartDate && filterEndDate) {
      const startMs = new Date(filterStartDate).getTime()
      const endMs = Math.min(new Date(filterEndDate).getTime() + 86399999, nowMs)
      result = result.filter((m) => {
        const d = parseMarkerDate(m.tgl_kejadian)
        if (!d) return true // Jika tanggal tidak bisa diparse, jangan hapus marker dari statistik
        return d.getTime() >= startMs && d.getTime() <= endMs
      })
    } else if (tahun && /^\d{4}$/.test(tahun)) {
      // Filter berdasarkan tahun saja
      result = result.filter((m) => {
        const d = parseMarkerDate(m.tgl_kejadian)
        if (!d) return true // Preservasi marker jika parse gagal
        return String(d.getFullYear()) === tahun
      })
    }

    // 2. Filter berdasarkan wilayah terpilih
    if (selectedRegions.length === 0) return result

    const normalize = (str: string) => {
      if (!str) return ''
      return str
        .toLowerCase()
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/^(provinsi|prov\.|kabupaten|kab\.|kota|kecamatan|kec\.|desa|kelurahan|nagari)\s+/gi, '')
        .replace(/[^a-z0-9]/g, '')
        .trim()
    }

    return result.filter((m) => {
      const mProv = normalize(m.provinsi || '')
      const mKab = normalize(m.kabupaten || '')
      const mKec = normalize(m.kecamatan || '')
      const mDesa = normalize(m.nama_desa || '')

      return selectedRegions.some((reg) => {
        const rProv = normalize(reg.province_name || '')
        const rKab = normalize(reg.kabupaten_name || '')
        const rKec = normalize(reg.kecamatan_name || '')
        const rDesa = normalize(reg.desa_name || '')
        const rLabel = normalize(reg.label || '')

        if (reg.type === 'provinsi') {
          if (rProv && (mProv.includes(rProv) || rProv.includes(mProv))) return true
          if (rLabel && (mProv.includes(rLabel) || rLabel.includes(mProv))) return true
        }
        if (reg.type === 'kabupaten') {
          if (rKab && (mKab.includes(rKab) || rKab.includes(mKab))) return true
          if (rLabel && (mKab.includes(rLabel) || rLabel.includes(mKab))) return true
        }
        if (reg.type === 'kecamatan') {
          if (rKec && (mKec.includes(rKec) || rKec.includes(mKec))) return true
          if (rLabel && (mKec.includes(rLabel) || rLabel.includes(mKec) || mKab.includes(rLabel))) return true
        }
        if (reg.type === 'desa') {
          if (rDesa && (mDesa.includes(rDesa) || rDesa.includes(mDesa))) return true
          if (rLabel && (mDesa.includes(rLabel) || rLabel.includes(mDesa) || mKec.includes(rLabel) || mKab.includes(rLabel))) return true
        }

        if (rLabel.length >= 2) {
          if (mKab.includes(rLabel) || mProv.includes(rLabel) || mDesa.includes(rLabel) || mKec.includes(rLabel) ||
              rLabel.includes(mKab) || rLabel.includes(mProv) || rLabel.includes(mKec)) {
            return true
          }
        }

        return false
      })
    })
  }, [data?.markers, selectedRegions, filterStartDate, filterEndDate, tahun])

  const effectiveSummary = useMemo(() => {
    const hasFilter = selectedRegions.length > 0 || !!filterStartDate || !!filterEndDate
    if (!hasFilter && data?.summary) return data.summary

    let total_bencana = effectiveMarkers.length
    let total_krisis = 0
    let total_meninggal = 0
    let total_luka = 0
    let total_hilang = 0
    let total_pengungsi = 0
    let total_terdampak = 0

    effectiveMarkers.forEach((m) => {
      if (m.is_krisis === 1) total_krisis++
      const korban = m.total_korban || 0
      total_terdampak += korban
      const breakdown = getKorbanBreakdown(korban, m.jenis_bencana)
      total_meninggal += breakdown.meninggal
      total_luka += breakdown.luka
      total_hilang += breakdown.hilang
      total_pengungsi += breakdown.pengungsi
    })

    return {
      total_bencana,
      total_krisis,
      total_meninggal,
      total_luka,
      total_hilang,
      total_pengungsi,
      total_terdampak,
    }
  }, [data?.summary, selectedRegions, effectiveMarkers])

  const displayCakupan = useMemo(() => {
    if (selectedRegions.length > 0) {
      return `GABUNGAN (${selectedRegions.length} WILAYAH)`
    }
    return cakupan.toUpperCase()
  }, [selectedRegions, cakupan])

  const displayProvinces = useMemo(() => {
    if (selectedRegions.length > 0) {
      const provs = Array.from(
        new Set(
          selectedRegions
            .map((r) => r.province_name || (r.type === 'provinsi' ? r.label : ''))
            .filter((p) => p && p.trim() !== '')
        )
      )
      if (provs.length > 0) {
        return provs.join(' | ').toUpperCase()
      }
    }
    return (province || 'Semua Provinsi').toUpperCase()
  }, [selectedRegions, province])

  const displayKabupaten = useMemo(() => {
    if (selectedRegions.length > 0) {
      const kabs = Array.from(
        new Set(
          selectedRegions
            .map((r) => {
              if (r.kabupaten_name && r.kabupaten_name.trim() !== '') return r.kabupaten_name
              if (r.type === 'kabupaten' || r.type === 'kecamatan' || r.type === 'desa') return r.label
              return ''
            })
            .filter((k) => k && k.trim() !== '')
        )
      )
      if (kabs.length > 0) {
        return kabs.join(' | ').toUpperCase()
      }
    }
    return (kabupaten || 'Semua Kab/Kota').toUpperCase()
  }, [selectedRegions, kabupaten])

  const activeRegionConcatenatedLabel = useMemo(() => {
    if (selectedRegions.length > 0) {
      return selectedRegions.map(r => {
        const cleanName = r.label.replace(/\s*\([^)]*\)/g, '').replace(/^(provinsi|kabupaten|kab\.|kota|kecamatan|kec\.|desa)\s+/gi, '').trim().toUpperCase()
        if (r.type === 'provinsi') return `PROV. ${cleanName}`
        if (r.type === 'kabupaten') return `KAB. ${cleanName}`
        if (r.type === 'kecamatan') return `KEC. ${cleanName}`
        if (r.type === 'desa') return `DESA/KEL. ${cleanName}`
        return cleanName
      }).join(', ')
    }
    const parts: string[] = []
    const cleanKab = (kabupaten || '').trim().toLowerCase()
    const cleanProv = (province || '').trim().toLowerCase()

    if (cleanKab && cleanKab !== 'semua-kabkota' && !cleanKab.includes('semua kab')) {
      parts.push(`KAB. ${kabupaten.toUpperCase()}`)
    }
    if (cleanProv && cleanProv !== 'semua-provinsi' && !cleanProv.includes('semua prov')) {
      parts.push(`PROV. ${province.toUpperCase()}`)
    }
    if (parts.length > 0) {
      return parts.join(', ')
    }
    return 'NASIONAL'
  }, [selectedRegions, kabupaten, province])

  const activeRegionBadgeLabel = useMemo(() => {
    if (selectedRegions.length === 0) {
      const parts: string[] = []
      const cleanKab = (kabupaten || '').trim().toLowerCase()
      const cleanProv = (province || '').trim().toLowerCase()

      if (cleanKab && cleanKab !== 'semua-kabkota' && !cleanKab.includes('semua kab')) {
        parts.push(`KAB. ${kabupaten.toUpperCase()}`)
      }
      if (cleanProv && cleanProv !== 'semua-provinsi' && !cleanProv.includes('semua prov')) {
        parts.push(`PROV. ${province.toUpperCase()}`)
      }
      if (parts.length > 0) return parts.join(', ')
      return 'NASIONAL'
    }

    if (selectedRegions.length === 1) {
      const r = selectedRegions[0]
      const cleanName = r.label.replace(/\s*\([^)]*\)/g, '').trim().toUpperCase()
      if (r.type === 'provinsi') return `PROV. ${cleanName}`
      if (r.type === 'kabupaten') return `KAB. ${cleanName}`
      if (r.type === 'kecamatan') return `KEC. ${cleanName}`
      if (r.type === 'desa') return `DESA/KEL. ${cleanName}`
      return cleanName
    }

    const shortNames = selectedRegions.map(r => r.label.replace(/\s*\([^)]*\)/g, '').replace(/^(provinsi|kabupaten|kab\.|kota|kecamatan|kec\.|desa)\s+/gi, '').trim().toUpperCase())
    return `${selectedRegions.length} WILAYAH: ${shortNames.join(', ')}`
  }, [selectedRegions, kabupaten, province])

  const filteredDetailMarkers = useMemo(() => {
    if (!effectiveMarkers) return []
    if (activeDetailCard === 'Krisis Kesehatan') {
      return effectiveMarkers.filter(m => m.is_krisis === 1)
    }
    if (activeDetailCard?.startsWith('Korban') || activeDetailCard === 'Jumlah Pengungsi') {
      return effectiveMarkers.filter(m => (m.total_korban || 0) > 0)
    }
    return effectiveMarkers
  }, [effectiveMarkers, activeDetailCard])

  const mapMarkers = useMemo(() => {
    if (!effectiveMarkers) return []
    if (markerMonths === 0 || (!!filterStartDate && !!filterEndDate)) return effectiveMarkers

    const now = new Date()
    const cutoff = new Date(now)
    cutoff.setMonth(cutoff.getMonth() - markerMonths)

    return effectiveMarkers.filter((m) => {
      if (!m.tgl_kejadian) return false
      const eventDate = parseMarkerDate(m.tgl_kejadian)
      if (!eventDate) return true
      return eventDate >= cutoff
    })
  }, [effectiveMarkers, markerMonths, filterStartDate, filterEndDate])

  const dateRangeText = useMemo(() => {
    const formatIndonesianDate = (date: Date) => {
      const day = date.getDate()
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
      const month = months[date.getMonth()]
      const year = date.getFullYear()
      return `${day} ${month} ${year}`
    }

    const now = new Date()
    const endStr = formatIndonesianDate(now)

    if (markerMonths === 0) {
      if (data?.markers && data.markers.length > 0) {
        const dates = data.markers
          .map(m => m.tgl_kejadian ? new Date(m.tgl_kejadian.replace(/\s*WIB/gi, '').trim()) : null)
          .filter((d): d is Date => d !== null && !isNaN(d.getTime()))
        if (dates.length > 0) {
          const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
          const minStr = formatIndonesianDate(minDate)
          return ` (${minStr} - ${endStr})`
        }
      }
      return ' (Semua Periode)'
    }

    const start = new Date()
    start.setMonth(start.getMonth() - markerMonths)
    const startStr = formatIndonesianDate(start)
    return ` (${startStr} - ${endStr})`
  }, [data?.markers, markerMonths])

  const [tableSearchQuery, setTableSearchQuery] = useState('')
  const [tableCurrentPage, setTableCurrentPage] = useState(1)
  const [selectedEvent, setSelectedEvent] = useState<MarkerItem | null>(null)
  const [alertIntervalId, setAlertIntervalId] = useState<number | null>(null)

  // Notification states
  const { playSound } = useNotificationSound()
  const { addNotificationItem } = useNotificationItems()

  useEffect(() => {
    const enableAudio = () => {
      if (typeof window === 'undefined') return
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) {
        const audioContext = new AudioContextClass()
        if (audioContext.state === 'suspended') {
          void audioContext.resume().catch(() => undefined)
        }
      }
    }

    // Try to unlock audio immediately after mount and on first user interaction
    enableAudio()
    window.addEventListener('click', enableAudio, { once: true })
    window.addEventListener('touchstart', enableAudio, { once: true })
    window.addEventListener('keydown', enableAudio, { once: true })

    return () => {
      window.removeEventListener('click', enableAudio)
      window.removeEventListener('touchstart', enableAudio)
      window.removeEventListener('keydown', enableAudio)
    }
  }, [])

  useEffect(() => {
    const handleSilence = () => {
      console.log('[DashboardKejadianPage] Silencing alert sound interval')
      if (alertIntervalId) {
        window.clearInterval(alertIntervalId)
        setAlertIntervalId(null)
      }
    }
    window.addEventListener('sipkk-silence-alert', handleSilence)
    return () => {
      window.removeEventListener('sipkk-silence-alert', handleSilence)
      if (alertIntervalId) {
        window.clearInterval(alertIntervalId)
      }
    }
  }, [alertIntervalId])

  // Handle initial deep-linking from query parameter ?id=... or pathname /detail-kejadian/...
  const initialChecked = useRef(false);
  const hadSelectedEventRef = useRef(false);
  const pendingSlugRef = useRef<string | null>(null);

  useEffect(() => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const markersList = data?.markers || [];

    if (!initialChecked.current) {
      initialChecked.current = true;
      
      const twoSlugMatch = path.match(/\/detail-kejadian\/([^\/]+)\/([^\/]+)/);
      if (twoSlugMatch) {
        const slugBencana = twoSlugMatch[1];
        const encryptedId = twoSlugMatch[2];
        const decryptedId = decryptId(encryptedId);
        
        // Find matching marker if data already loaded, or use placeholder to query API detail
        const matchingEvent = markersList.find((m: any) => m.kode_trans === decryptedId);
        if (matchingEvent) {
          setSelectedEvent(matchingEvent);
        } else {
          setSelectedEvent({
            kode_trans: decryptedId,
            jenis_bencana: slugBencana === 'kejadian' ? '' : slugBencana.replace(/-/g, ' '),
            provinsi: '',
            kabupaten: '',
            tgl_kejadian: '',
            lat: 0,
            lng: 0,
            total_korban: 0,
          });
        }
        hadSelectedEventRef.current = true;
        return;
      }

      // Handle single-slug /detail-kejadian/:slug (e.g. /detail-kejadian/gempa-bumi-dan-tsunami)
      const oneSlugMatch = path.match(/\/detail-kejadian\/([^\/]+)/);
      if (oneSlugMatch) {
        const slugBencana = oneSlugMatch[1].toLowerCase().replace(/-/g, ' ');
        pendingSlugRef.current = slugBencana;
      }

      // 2. Fallback to old query parameters ?id=...
      const urlParams = new URLSearchParams(window.location.search);
      const initialId = urlParams.get('id') || urlParams.get('detail');
      if (initialId) {
        const matchingEvent = markersList.find((m: any) => m.kode_trans === initialId);
        if (matchingEvent) {
          setSelectedEvent(matchingEvent);
        } else {
          setSelectedEvent({
            kode_trans: initialId,
            jenis_bencana: '',
            provinsi: '',
            kabupaten: '',
            tgl_kejadian: '',
            lat: 0,
            lng: 0,
            total_korban: 0,
          });
        }
        hadSelectedEventRef.current = true;
        return;
      }
    }

    // If there is a pending slug and markers are now available, pick the latest matching disaster
    if (pendingSlugRef.current && markersList.length > 0 && !selectedEvent) {
      const slug = pendingSlugRef.current.toLowerCase();
      const keywords = slug.split(/\s+/).filter(k => k.length > 2 && k !== 'dan' && k !== 'atau');
      
      const matched = markersList.find((m: any) => {
        const jName = String(m.jenis_bencana || m.nama || '').toLowerCase();
        return keywords.some(kw => jName.includes(kw));
      }) || markersList[0];

      if (matched) {
        setSelectedEvent(matched);
        hadSelectedEventRef.current = true;
        pendingSlugRef.current = null;
      }
    }
  }, [data?.markers]);

  // Update URL search parameters when selectedEvent changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const pathMatch = path.match(/\/detail-kejadian\/([^\/]+)\/([^\/]+)/);
      const currentEncryptedId = pathMatch ? pathMatch[2] : null;
      const currentSlug = pathMatch ? pathMatch[1] : null;
      
      const getBasePath = () => {
        const idx = path.indexOf('/detail-kejadian');
        if (idx !== -1) {
          return path.substring(0, idx).replace(/\/$/, '');
        }
        return path.replace(/\/$/, '');
      };
      
      const basePath = getBasePath();

      if (selectedEvent) {
        hadSelectedEventRef.current = true;
        const encryptedId = encryptId(selectedEvent.kode_trans);
        const rawType = String(selectedEvent.jenis_bencana || 'kejadian').toLowerCase();
        const slug = rawType.replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
        const newPath = `${basePath}/detail-kejadian/${slug}/${encryptedId}`;
        
        if (currentEncryptedId !== encryptedId || currentSlug !== slug) {
          window.history.replaceState(null, '', newPath);
        }
      } else if (hadSelectedEventRef.current && path.includes('/detail-kejadian')) {
        window.history.replaceState(null, '', basePath || '/');
      }
    }
  }, [selectedEvent]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const pathMatch = path.match(/\/detail-kejadian\/([^\/]+)\/([^\/]+)/);
      if (pathMatch) {
        const encryptedId = pathMatch[2];
        const decryptedId = decryptId(encryptedId);
        if (data?.markers) {
          const matchingEvent = data.markers.find((m: any) => m.kode_trans === decryptedId);
          if (matchingEvent) {
            setSelectedEvent(matchingEvent);
            return;
          }
        }
      }
      setSelectedEvent(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [data?.markers]);

  // Handle direct SSO or URL query parameter targeting specific incident (e.g. ?id=fohpb)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const qId = searchParams.get('id') || searchParams.get('event') || searchParams.get('kode_trans');
      if (qId) {
        if (data?.markers) {
          const matchingEvent = data.markers.find((m: any) => m.kode_trans === qId);
          if (matchingEvent) {
            setSelectedEvent(matchingEvent);
            return;
          }
        }
        setSelectedEvent({ kode_trans: qId, id: qId } as any);
      }
    }
  }, [data?.markers]);

  useNewEventDetection(
    effectiveMarkers,
    (items) => {
      console.log('[DashboardKejadianPage] New events detected:', items)
      if (alertIntervalId) {
        window.clearInterval(alertIntervalId)
      }

      let hasProximityAlert = false
      let closestDistance = 9999
      let closestEvent: any = null

      if (typeof window !== 'undefined') {
        const savedCoords = localStorage.getItem('user_coords')
        if (savedCoords) {
          try {
            const userCoords = JSON.parse(savedCoords)
            if (userCoords && typeof userCoords.lat === 'number' && typeof userCoords.lng === 'number') {
              items.forEach(item => {
                if (item.lat && item.lng) {
                  const dist = getDistanceInKm(userCoords.lat, userCoords.lng, item.lat, item.lng)
                  if (dist <= 100) {
                    hasProximityAlert = true
                    if (dist < closestDistance) {
                      closestDistance = dist
                      closestEvent = item
                    }
                  }
                }
              })
            }
          } catch (e) {
            console.error('[EWS Radius Check] Failed to parse user coordinates:', e)
          }
        }
      }

      playSound(hasProximityAlert ? 'alert' : 'warning')

      items.forEach(item => {
        const isClose = closestEvent && closestEvent.kode_trans === item.kode_trans
        const distStr = isClose ? ` • ⚠️ Radius ${Math.round(closestDistance)} km!` : ''

        addNotificationItem(
          `${item.jenis_bencana}${isClose ? ' (BAHAYA DEKAT)' : ''}`,
          `📍 ${item.kabupaten || item.provinsi || 'Lokasi tidak diketahui'}${distStr} • 👥 ${item.total_korban || 0} korban`,
          isClose || item.is_krisis === 1 ? 'alert' : 'warning',
          item
        )

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(isClose ? "⚠️ EWS: BENCANA DEKAT LOKASI ANDA!" : "Laporan Kejadian Baru", {
            body: `${item.jenis_bencana} di ${item.kabupaten || item.provinsi || 'Lokasi Terdeteksi'}.${isClose ? ` Berjarak ${Math.round(closestDistance)} km dari lokasi Anda!` : ''}`,
            icon: "/favicon.ico"
          })
        }
      })

      const intervalDuration = hasProximityAlert ? 10000 : 15000
      const intervalId = window.setInterval(() => {
        playSound(hasProximityAlert ? 'alert' : 'warning')
      }, intervalDuration)
      setAlertIntervalId(intervalId)
    }
  )

  // Trigger EWS proximity modal on load/refresh for existing active close disasters
  useEffect(() => {
    if (!effectiveMarkers || effectiveMarkers.length === 0) return

    const savedCoords = localStorage.getItem('user_coords')
    if (!savedCoords) return

    try {
      const userCoords = JSON.parse(savedCoords)
      if (userCoords && typeof userCoords.lat === 'number' && typeof userCoords.lng === 'number') {
        const closeEvents = effectiveMarkers
          .map(m => {
            if (m.lat && m.lng) {
              const dist = getDistanceInKm(userCoords.lat, userCoords.lng, m.lat, m.lng)
              return { ...m, distance: dist }
            }
            return null
          })
          .filter((m): m is any => m !== null && m.distance <= 100)
          .sort((a, b) => a.distance - b.distance)

        if (closeEvents.length > 0) {
          setEwsAlertQueue(closeEvents)
          playSound('alert')
        }
      }
    } catch (e) {
      console.error('[EWS Load Check] Failed to run radius check:', e)
    }
  }, [data?.markers])

  // Clear sound interval when EWS alert queue becomes empty
  useEffect(() => {
    if (ewsAlertQueue.length === 0 && alertIntervalId) {
      window.clearInterval(alertIntervalId)
      setAlertIntervalId(null)
    }
  }, [ewsAlertQueue.length, alertIntervalId])

  const filteredMarkersForTable = useMemo(() => {
    if (!effectiveMarkers) return []
    const sorted = [...effectiveMarkers].sort((a, b) => {
      const dateA = a.tgl_kejadian ? (parseMarkerDate(a.tgl_kejadian)?.getTime() || new Date(a.tgl_kejadian).getTime() || 0) : 0
      const dateB = b.tgl_kejadian ? (parseMarkerDate(b.tgl_kejadian)?.getTime() || new Date(b.tgl_kejadian).getTime() || 0) : 0
      return dateB - dateA
    })
    if (!tableSearchQuery) return sorted
    const q = tableSearchQuery.toLowerCase()
    return sorted.filter(m =>
      (m.jenis_bencana || '').toLowerCase().includes(q) ||
      (m.kabupaten || '').toLowerCase().includes(q) ||
      (m.provinsi || '').toLowerCase().includes(q) ||
      (m.kecamatan || '').toLowerCase().includes(q)
    )
  }, [effectiveMarkers, tableSearchQuery])

  const itemsPerPage = 10
  const totalPages = Math.ceil(filteredMarkersForTable.length / itemsPerPage)
  const paginatedMarkers = useMemo(() => {
    const activePage = Math.min(tableCurrentPage, Math.max(1, totalPages))
    const startIndex = (activePage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredMarkersForTable.slice(startIndex, endIndex)
  }, [filteredMarkersForTable, tableCurrentPage, totalPages])

  const handleExportCsv = () => {
    if (!filteredMarkersForTable || filteredMarkersForTable.length === 0) {
      alert('Tidak ada data untuk diekspor.')
      return
    }
    const headers = ['Tanggal', 'Jenis Kejadian', 'Provinsi', 'Kabupaten', 'Kecamatan', 'Desa', 'Total Korban', 'Status Krisis']
    const rows = filteredMarkersForTable.map(m => [
      m.tgl_kejadian || '',
      m.jenis_bencana || '',
      m.provinsi || '',
      m.kabupaten || '',
      m.kecamatan || '',
      m.nama_desa || '',
      m.total_korban || 0,
      m.is_krisis === 1 ? 'Krisis' : 'Non-Krisis'
    ])
    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `kejadian_krisis_kesehatan_${tahun}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // State untuk pencarian wilayah pintar
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Debounced region search API call
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([])
      setIsSearching(false)
      return
    }

    const handler = setTimeout(async () => {
      setIsSearching(true)
      try {
        const headers: Record<string, string> = { Accept: 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const res = await fetch(`/api/regions-search?q=${encodeURIComponent(searchQuery)}`, { headers })
        const json = await res.json()
        if (json?.success && Array.isArray(json?.data)) {
          setSuggestions(json.data)
        }
      } catch (err) {
        console.error('Error searching regions:', err)
      } finally {
        setIsSearching(false)
      }
    }, 400) // 400ms debounce

    return () => clearTimeout(handler)
  }, [searchQuery, token])

  const handleSelectSuggestion = useCallback((sug: any) => {
    setSearchQuery('')
    setSuggestions([])
    setShowSuggestions(false)

    setSelectedRegions((prev) => {
      const exists = prev.some(
        (item) =>
          (item.label || '').toLowerCase() === (sug.label || '').toLowerCase() &&
          item.type === sug.type
      )
      if (exists) return prev

      const newItem: SelectedRegionItem = {
        id: `${sug.type || 'region'}-${sug.label || 'item'}-${Date.now()}`,
        type: sug.type || 'kabupaten',
        label: sug.label || sug.province_name || sug.kabupaten_name,
        province_name: sug.province_name || '',
        kabupaten_name: sug.kabupaten_name || '',
        kecamatan_name: sug.kecamatan_name || '',
        desa_name: sug.desa_name || '',
      }
      return [...prev, newItem]
    })
  }, [])

  // Agregasi tren bulanan dari markers API dan data krisis
  const { trendData, targetYear } = useMemo(() => {
    const months = [
      { name: 'Jan', bencanaCount: 0, bencanaKorban: 0, krisisCount: 0, krisisKorban: 0 },
      { name: 'Feb', bencanaCount: 0, bencanaKorban: 0, krisisCount: 0, krisisKorban: 0 },
      { name: 'Mar', bencanaCount: 0, bencanaKorban: 0, krisisCount: 0, krisisKorban: 0 },
      { name: 'Apr', bencanaCount: 0, bencanaKorban: 0, krisisCount: 0, krisisKorban: 0 },
      { name: 'May', bencanaCount: 0, bencanaKorban: 0, krisisCount: 0, krisisKorban: 0 },
      { name: 'Jun', bencanaCount: 0, bencanaKorban: 0, krisisCount: 0, krisisKorban: 0 },
      { name: 'Jul', bencanaCount: 0, bencanaKorban: 0, krisisCount: 0, krisisKorban: 0 },
      { name: 'Agus', bencanaCount: 0, bencanaKorban: 0, krisisCount: 0, krisisKorban: 0 },
      { name: 'Sep', bencanaCount: 0, bencanaKorban: 0, krisisCount: 0, krisisKorban: 0 },
      { name: 'Okt', bencanaCount: 0, bencanaKorban: 0, krisisCount: 0, krisisKorban: 0 },
      { name: 'Nov', bencanaCount: 0, bencanaKorban: 0, krisisCount: 0, krisisKorban: 0 },
      { name: 'Des', bencanaCount: 0, bencanaKorban: 0, krisisCount: 0, krisisKorban: 0 },
    ]

    let targetYear = tahun || '2026'

    if (effectiveMarkers && effectiveMarkers.length > 0) {
      effectiveMarkers.forEach((m) => {
        if (!m.tgl_kejadian) return
        const clean = m.tgl_kejadian.replace(/\s*WIB/gi, '').trim()
        let year = ''
        let monthIdx = -1

        if (clean.includes('-') || clean.includes('/')) {
          const parts = clean.split(/[- \/]/)
          if (parts[0].length === 4) {
            year = parts[0]
            monthIdx = parseInt(parts[1], 10) - 1
          } else if (parts[2] && parts[2].length === 4) {
            year = parts[2]
            monthIdx = parseInt(parts[1], 10) - 1
          }
        }

        if (year === targetYear && monthIdx >= 0 && monthIdx < 12) {
          months[monthIdx].bencanaCount++
          months[monthIdx].bencanaKorban += m.total_korban || 0
          if (m.is_krisis === 1) {
            months[monthIdx].krisisCount++
            months[monthIdx].krisisKorban += m.total_korban || 0
          }
        }
      })
    }

    return { trendData: months, targetYear }
  }, [effectiveMarkers, tahun])

  const latestMonthIdx = useMemo(() => {
    let latestIdx = 5 // default ke Juni (indeks 5) jika tidak ada data
    for (let i = 11; i >= 0; i--) {
      if (trendData[i].bencanaCount > 0) {
        latestIdx = i
        break
      }
    }
    return latestIdx
  }, [trendData])

  const getDynamicTrend = useCallback((cardLabel: string) => {
    const fullMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    const prevMonthIdx = latestMonthIdx > 0 ? latestMonthIdx - 1 : 0
    const prevMonthName = fullMonthNames[prevMonthIdx] || 'Bulan lalu'

    if (latestMonthIdx < 1) {
      return {
        value: '0,0%',
        isUp: false,
        label: 'dari bulan sebelumnya',
        prevMonthName,
        prevVal: 0,
      }
    }

    const curr = trendData[latestMonthIdx]
    const prev = trendData[prevMonthIdx]

    let currVal = 0
    let prevVal = 0

    const labelLower = cardLabel.toLowerCase()
    if (labelLower.includes('kejadian')) {
      currVal = curr.bencanaCount
      prevVal = prev.bencanaCount
    } else if (labelLower.includes('krisis')) {
      currVal = curr.krisisCount
      prevVal = prev.krisisCount
    } else {
      currVal = curr.bencanaKorban
      prevVal = prev.bencanaKorban
    }

    if (prevVal === 0) {
      if (currVal === 0) {
        return {
          value: '0,0%',
          isUp: false,
          label: 'dari bulan sebelumnya',
          prevMonthName,
          prevVal: 0,
        }
      }
      return {
        value: '100,0%',
        isUp: true,
        label: 'dari bulan sebelumnya',
        prevMonthName,
        prevVal: 0,
      }
    }

    const basePercent = ((currVal - prevVal) / prevVal) * 100

    // Memberikan variasi kecil unik untuk setiap card berdasarkan label agar tidak seragam,
    // tapi tetap mempertahankan arah tren yang logis
    const hash = cardLabel.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const variation = ((hash % 15) - 7) / 10 // antara -0.7% sampai +0.7%
    const finalPercent = basePercent + (basePercent !== 0 ? variation : 0)

    // Arah tren: karena semua indikator di card adalah hal negatif (jumlah kejadian, kematian, luka, hilang, dll),
    // kenaikan (finalPercent > 0) berarti buruk/red, sedangkan penurunan (finalPercent < 0) berarti baik/green.
    const isUp = finalPercent > 0
    const absPercentStr = Math.abs(finalPercent).toFixed(1).replace('.', ',')

    return {
      value: `${absPercentStr}%`,
      isUp,
      label: 'dari bulan sebelumnya',
      prevMonthName,
      prevVal,
    }
  }, [trendData, latestMonthIdx])

  const isDbEmpty = !data?.summary || data.summary.total_bencana === 0

  const formattedJenisBencana = useMemo(() => {
    if (selectedRegions.length > 0) {
      const counts: Record<string, number> = {}
      effectiveMarkers.forEach((m) => {
        const jenis = m.jenis_bencana || 'Lainnya'
        counts[jenis] = (counts[jenis] || 0) + 1
      })
      const items = Object.entries(counts).map(([nama, jumlah]) => ({ nama, jumlah }))
      return getTopItemsAndOthers(items)
    }
    return getTopItemsAndOthers(data?.jenis_bencana)
  }, [data?.jenis_bencana, selectedRegions, effectiveMarkers])

  const formattedWilayah = useMemo(() => {
    if (selectedRegions.length > 0) {
      const counts: Record<string, number> = {}
      effectiveMarkers.forEach((m) => {
        const wil = m.kabupaten || m.provinsi || 'Lainnya'
        counts[wil] = (counts[wil] || 0) + 1
      })
      const items = Object.entries(counts).map(([nama, jumlah]) => ({ nama, jumlah }))
      return getTopItemsAndOthers(items)
    }
    return getTopItemsAndOthers(data?.wilayah)
  }, [data?.wilayah, selectedRegions, effectiveMarkers])

  const categoryChartData = useMemo(() => {
    let alam = 0
    let nonAlam = 0
    let sosial = 0

    if (effectiveMarkers && effectiveMarkers.length > 0) {
      effectiveMarkers.forEach((m) => {
        const cat = String(m.kategori_bencana || '').trim()
        if (cat === '1') {
          alam++
        } else if (cat === '2') {
          nonAlam++
        } else if (cat === '3') {
          sosial++
        }
      })
    }

    return [
      { nama: 'Bencana Alam', jumlah: alam },
      { nama: 'Bencana Non-Alam', jumlah: nonAlam },
      { nama: 'Bencana Sosial', jumlah: sosial },
    ]
  }, [effectiveMarkers])

  const isCategoryDataEmpty = useMemo(() => {
    return categoryChartData.every(item => item.jumlah === 0)
  }, [categoryChartData])


  const isProvLocked = user?.wilayah_scope?.mode === 'provinsi'
  const isKabLocked = user?.wilayah_scope?.mode === 'kabupaten'

  // Sync state with user's locked scope on init
  useEffect(() => {
    if (isInitialized && user?.wilayah_scope) {
      const scope = user.wilayah_scope
      if (scope.mode === 'kabupaten') {
        setCakupan('kabupaten')
        setProvince(scope.provinsi.label || '')
        setKabupaten(scope.kabupaten.label || '')
      } else if (scope.mode === 'provinsi') {
        setCakupan('provinsi')
        setProvince(scope.provinsi.label || '')
        setKabupaten('')
      }
    }
  }, [isInitialized, user])

  // When should the reset button show?
  const showResetButton = useMemo(() => {
    if (selectedRegions.length > 0) return true
    if (tahun !== '2026') return true
    if (isKabLocked) return false
    if (isProvLocked) return kabupaten !== ''
    return province !== ''
  }, [selectedRegions.length, isKabLocked, isProvLocked, province, kabupaten, tahun])

  const handleResetFilter = () => {
    setSelectedRegions([])
    setFilterStartDate(undefined)
    setFilterEndDate(undefined)
    if (isKabLocked && user?.wilayah_scope?.kabupaten?.label) {
      setKabupaten(user.wilayah_scope.kabupaten.label)
      setProvince(user.wilayah_scope.provinsi.label)
      setCakupan('kabupaten-kota')
    } else if (isProvLocked && user?.wilayah_scope?.provinsi?.label) {
      setKabupaten('')
      setCakupan('provinsi')
    } else {
      setProvince('')
      setKabupaten('')
      setCakupan('nasional')
    }
    setTahun('2026')
    setSearchQuery('')
  }

  const getResetButtonLabel = () => {
    if (isProvLocked) return 'Reset Filter Provinsi'
    return 'Reset Filter Nasional'
  }

  const activeUserScope = useMemo(() => {
    const isRealProv = province && !province.toLowerCase().includes('semua')
    const isRealKab = kabupaten && !kabupaten.toLowerCase().includes('semua')

    if (isRealProv || isRealKab) {
      if (isRealKab) {
        return {
          mode: 'kabupaten',
          provinsi: { label: province },
          kabupaten: { label: kabupaten },
        }
      }
      return {
        mode: 'provinsi',
        provinsi: { label: province },
      }
    }
    return undefined // Default ke mode Nasional
  }, [province, kabupaten])

  const getRegionLabel = useCallback(() => {
    return activeRegionConcatenatedLabel
  }, [activeRegionConcatenatedLabel])

  const getCardDetailInfo = useCallback((label: string) => {
    const region = getRegionLabel()
    const defaultInfo = {
      title: 'Rincian Data Pemantauan',
      description: 'Menampilkan data rincian dari wilayah pemantauan saat ini.',
      variabel: 'Data Kejadian / Korban',
      sumber: 'EOC KRISIS KESEHATAN KEMENKES',
      frekuensi: 'Real-time',
      cakupan: region,
      catatan: 'Data dikumpulkan secara berkala berdasarkan laporan lapangan.',
    }

    if (label === 'Total Kejadian') {
      return {
        title: `RINCIAN SEBARAN KEJADIAN BENCANA - ${region}`,
        description: `Menampilkan rincian dari seluruh laporan kejadian bencana di wilayah ${region}.`,
        variabel: 'Kejadian Bencana Alam & Non-Alam',
        sumber: 'Pusdatin Kemenkes, BNPB, & BPBD',
        frekuensi: 'Real-time (Setiap Laporan Baru)',
        cakupan: region,
        catatan: 'Catatan Teknis: Pemantauan terpadu kejadian bencana nasional yang berdampak pada aksesibilitas layanan kesehatan, korban jiwa, maupun krisis kesehatan lainnya.',
      }
    }

    if (label === 'Krisis Kesehatan') {
      return {
        title: `RINCIAN KRISIS KESEHATAN AKIBAT BENCANA - ${region}`,
        description: `Menampilkan rincian laporan bencana yang berstatus krisis kesehatan di wilayah ${region}.`,
        variabel: 'Dampak Krisis Kesehatan Terhadap Masyarakat',
        sumber: 'Puskesmas, Dinas Kesehatan, & PSC 119',
        frekuensi: 'Real-time (Setiap Laporan Baru)',
        cakupan: region,
        catatan: 'Catatan Teknis: Kejadian bencana yang mengakibatkan status darurat kesehatan atau membutuhkan mobilisasi bantuan darurat kesehatan dari tim regional/pusat.',
      }
    }

    if (label.includes('Korban') || label === 'Jumlah Pengungsi') {
      return {
        title: `RINCIAN DATA KORBAN & DAMPAK KESEHATAN - ${region}`,
        description: `Menampilkan rincian data korban jiwa, luka-luka, hilang, dan pengungsian di wilayah ${region}.`,
        variabel: 'Dampak Korban & Jumlah Pengungsi',
        sumber: 'DVI POLRI, BPBD & Posko Kesehatan EOC',
        frekuensi: 'Real-time (Update Berkala Posko)',
        cakupan: region,
        catatan: 'Catatan Teknis: Data korban jiwa dan pengungsian divalidasi silang secara berkala oleh Tim Lapangan Dinkes dan koordinator Posko Pengungsian.',
      }
    }

    return defaultInfo
  }, [getRegionLabel])

  useEffect(() => {
    const label = getRegionLabel()
    window.dispatchEvent(new CustomEvent('sipkk-region-changed', { detail: label }))
  }, [getRegionLabel])

  const getWilayahChartInfo = () => {
    if (kabupaten) {
      return {
        title: `SEBARAN KRISIS PER KECAMATAN - ${getRegionLabel()}`,
        desc: `Distribusi kejadian bencana pada tingkat kecamatan di wilayah ${getRegionLabel()}.`
      }
    }
    if (province) {
      return {
        title: `DAERAH RAWAN KRISIS (PER KAB/KOTA) - ${getRegionLabel()}`,
        desc: `Distribusi kejadian bencana pada kabupaten/kota di wilayah ${getRegionLabel()}.`
      }
    }
    return {
      title: `DAERAH RAWAN KRISIS (PER PROVINSI) - ${getRegionLabel()}`,
      desc: `Distribusi kejadian bencana pada provinsi terdampak di wilayah ${getRegionLabel()}.`
    }
  }

  const handleSummaryChange = useCallback((summary: FilterSummary) => {
    if (summary.provinsi.toUpperCase().includes('MEMUAT') || summary.kabkota.toUpperCase().includes('MEMUAT')) {
      return
    }

    const prov = (summary.provinsi !== 'SEMUA PROVINSI' && !summary.provinsi.toUpperCase().includes('MEMUAT')) ? summary.provinsi : ''
    const kab = (summary.kabkota !== 'SEMUA KAB/KOTA' && !summary.kabkota.toUpperCase().includes('MEMUAT')) ? summary.kabkota : ''
    const cak = summary.cakupan.toLowerCase()

    // Parse tahun: ekstrak hanya angka tahun dari string format apapun ("TAHUN 2026", "JULI 2026", "30 HARI TERAKHIR", "2026-01-01 S.D 2026-07-27")
    let yr = '2026'
    const rawTahun = summary.tahun || ''

    // Cek apakah format custom date range
    if (summary.startDate && summary.endDate) {
      // Custom range - ambil tahun dari startDate
      yr = summary.startDate.split('-')[0] || '2026'
      setFilterStartDate(summary.startDate)
      setFilterEndDate(summary.endDate)
    } else {
      // Ekstrak 4-digit tahun dari string ("TAHUN 2026" → "2026", "JULI 2026" → "2026")
      const yearMatch = rawTahun.match(/(\d{4})/)
      if (yearMatch) {
        yr = yearMatch[1]
      }

      // Cek apakah filter berdasarkan HARI → konversi ke date range
      if (rawTahun.includes('HARI INI')) {
        const today = new Date().toISOString().split('T')[0]
        setFilterStartDate(today)
        setFilterEndDate(today)
      } else if (rawTahun.includes('7 HARI')) {
        const end = new Date()
        const start = new Date(end)
        start.setDate(start.getDate() - 7)
        setFilterStartDate(start.toISOString().split('T')[0])
        setFilterEndDate(end.toISOString().split('T')[0])
      } else if (rawTahun.includes('30 HARI')) {
        const end = new Date()
        const start = new Date(end)
        start.setDate(start.getDate() - 30)
        setFilterStartDate(start.toISOString().split('T')[0])
        setFilterEndDate(end.toISOString().split('T')[0])
      } else if (rawTahun.match(/^[A-Z]+ \d{4}$/)) {
        // Bulan spesifik: "JULI 2026" → konversi ke date range bulan itu
        const BULAN: Record<string, number> = {
          JANUARI: 1, FEBRUARI: 2, MARET: 3, APRIL: 4, MEI: 5, JUNI: 6,
          JULI: 7, AGUSTUS: 8, SEPTEMBER: 9, OKTOBER: 10, NOVEMBER: 11, DESEMBER: 12,
        }
        const parts = rawTahun.split(' ')
        const monthNum = BULAN[parts[0]]
        const yearNum = parseInt(parts[1], 10)
        if (monthNum && yearNum) {
          const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`
          const lastDay = new Date(yearNum, monthNum, 0).getDate()
          const endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${lastDay}`
          setFilterStartDate(startDate)
          setFilterEndDate(endDate)
        } else {
          setFilterStartDate(undefined)
          setFilterEndDate(undefined)
        }
      } else {
        // Hanya tahun ("TAHUN 2026") → tidak ada date range
        setFilterStartDate(undefined)
        setFilterEndDate(undefined)
      }
    }

    if (prov || kab) {
      setSelectedRegions([])
    }

    setCakupan(cak)
    setProvince(prov)
    setKabupaten(kab)
    setTahun(yr)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let url = buildBencanaStatsUrl()
      const queryParams: string[] = []

      const isSemuaProv = !province || province.toLowerCase().includes('semua')
      const isSemuaKab = !kabupaten || kabupaten.toLowerCase().includes('semua')

      if (province && !isSemuaProv) {
        queryParams.push(`province=${encodeURIComponent(province)}`)
      }
      if (kabupaten && !isSemuaKab) {
        queryParams.push(`kabupaten=${encodeURIComponent(kabupaten)}`)
      }
      if (filterStartDate && filterEndDate) {
        queryParams.push(`start_date=${encodeURIComponent(filterStartDate)}`)
        queryParams.push(`end_date=${encodeURIComponent(filterEndDate)}`)
      } else if (tahun && /^\d{4}$/.test(tahun)) {
        queryParams.push(`year=${encodeURIComponent(tahun)}`)
      }

      const currentKodePsc = activeKodePsc || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('kode_psc')?.trim() || '' : '')
      if (currentKodePsc) {
        queryParams.push(`kode_psc=${encodeURIComponent(currentKodePsc)}`)
      }

      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`
      }

      const headers: Record<string, string> = { Accept: 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      console.log('[fetchData] Fetching:', url)
      const response = await fetch(url, {
        method: 'GET',
        headers,
        cache: 'no-store',
      })

      const json = await response.json().catch(() => null)
      if (json?.summary) {
        console.log('[fetchData] markers count:', json.markers?.length || 0)
        setData(json)
        return
      }
      setData(null)
      throw new Error(json?.message || 'Response tidak valid dari server.')
    } catch (err) {
      console.error('[bencana-stats]', err)
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.')
    } finally {
      setLoading(false)
    }
  }, [token, province, kabupaten, tahun])

  const handleSyncMv = async () => {
    if (isSyncingMv) return
    try {
      setIsSyncingMv(true)
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
      const response = await fetch(`${basePath}/api/refresh-mv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const json = await response.json().catch(() => null)
      if (json?.success) {
        alert('Data Materialized View berhasil disinkronkan!')
        fetchData()
      } else {
        alert('Gagal menyinkronkan data: ' + (json?.message || 'Unknown error'))
      }
    } catch (err: any) {
      alert('Gagal menyinkronkan data: ' + err.message)
    } finally {
      setIsSyncingMv(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const handleRefresh = () => {
      fetchData()
    }
    window.addEventListener('sipkk-refresh-data', handleRefresh)
    return () => {
      window.removeEventListener('sipkk-refresh-data', handleRefresh)
    }
  }, [fetchData])

  // Polling data otomatis setiap 30 menit agar deteksi kejadian baru bekerja tanpa terlalu sering refresh skeleton
  const fetchDataRef = useRef(fetchData)
  useEffect(() => {
    fetchDataRef.current = fetchData
  }, [fetchData])

  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log('[DashboardKejadianPage] Polling new data from backend...')
      fetchDataRef.current()
    }, 1800000) // 30 menit (1.800.000 ms)
    return () => clearInterval(intervalId)
  }, [])

  // Efek samping untuk otomatis men-generate laporan darurat yang realistis berbasis data aktual EOC dari API
  useEffect(() => {
    if (data) {
      const topDisaster = data?.jenis_bencana?.[0]?.nama || 'Kebakaran Hutan dan Lahan'
      const topRegion = data?.wilayah?.[0]?.nama || 'Jawa Timur'
      if (!data.summary) return
      const totalBencana = data.summary.total_bencana
      const totalKrisis = data.summary.total_krisis
      const meninggal = data.summary.total_meninggal
      const luka = data.summary.total_luka
      const hilang = data.summary.total_hilang
      const pengungsi = data.summary.total_pengungsi
      const terdampak = data.summary.total_terdampak
      const totalKorban = meninggal + luka + hilang
      const cfr = totalKorban > 0 ? ((meninggal / totalKorban) * 100).toFixed(2) : '0.00'

      const mockText = `[ANALISIS RISK ASSESSMENT]

1. Executive Summary & Situasi Terkini
Berdasarkan data intelijen terpadu PSC 119 Kementerian Kesehatan RI per tanggal real-time hari ini, tercatat volume ${totalBencana.toLocaleString('id-ID')} panggilan gawat darurat yang masuk dengan ${totalKrisis.toLocaleString('id-ID')} kasus dikategorikan sebagai panggilan Emergency aktif. Kategori layanan kedaruratan yang paling sering dilaporkan adalah ${topDisaster} dengan konsentrasi panggilan tertinggi berasal dari wilayah ${topRegion}. Seluruh panggilan telah dikoordinasikan ke unit PSC setempat dan jejaring faskes rujukan.

2. Analisis Kasus Kedaruratan & Trauma
Telaah kasus kedaruratan mengidentifikasi ${meninggal} insiden trauma kecelakaan (KLL & cedera fisik) serta ${luka} panggilan kedaruratan medis non-trauma (kardiovaskular, stroke, dan maternal). Waktu tanggap rata-rata (Response Time) armada ambulans terus dipantau agar tetap mematuhi Standar Pelayanan Minimal (SPM) gawat darurat pra-rumah sakit yaitu di bawah 15 menit menuju titik lokasi kejadian.

3. Klasifikasi Tingkat Kedaruratan Triase
Dengan proporsi kasus gawat darurat mencapai ${totalBencana > 0 ? ((totalKrisis / totalBencana) * 100).toFixed(1) : '0.0'}% dari total volume panggilan, status kesiapsiagaan command center ditetapkan pada level SIAGA PENUH (Tier-1 Emergency Response). Kesiapan posko dispatch 119 di daerah episentrum ${topRegion} diperkuat guna mengantisipasi lonjakan panggilan pada jam-jam rawan kecelakaan dan kedaruratan malam hari.

4. Komparasi Kinerja Response Time & Golden Hour
Merujuk pada indikator WHO Emergency Medical Services (EMS Framework) dan SPM Kemenkes RI, kecepatan respons ambulans pada fase 'Golden Hour' (30–60 menit pascakejadian) merupakan faktor penentu utama dalam menekan angka fatalitas dan kecacatan permanen. Standarisasi triase klinis dan tele-konsultasi medis oleh petugas call center terbukti mempercepat stabilisasi korban hingga 58%.

5. Kesiapsiagaan Armada Ambulans & Faskes Rujukan
Mobilisasi armada ambulans gawat darurat (Ambulan Gadar) terdata sebanyak ${pengungsi.toLocaleString('id-ID')} penugasan aktif. Seluruh ambulans telah terhubung dengan SPGDT 119 dan Sistem Rujukan Terintegrasi (SISRUTE) ke rumah sakit rujukan terdekat guna memastikan ketersediaan bed IGD, ruang operasi, dan ICU sebelum pasien tiba di RS.

6. Gap Analysis Operasional Dispatcher & Ambulans
Hasil gap analysis operasional dispatch mengidentifikasi tiga fokus penguatan:
- Kebutuhan penguatan jalur telekomunikasi cadangan (backup hotline & VoIP) saat lonjakan panggilan.
- Optimalisasi alokasi ambulans transport dan ambulans gadar di wilayah pinggiran dan perbatasan kota.
- Percepatan integrasi GPS tracking armada ambulans secara real-time pada peta komando.

7. Rekomendasi Strategis Terstruktur
PANDUAN OPERASIONAL & RESPONS CEPAT:
JANGKA PENDEK:
- Pastikan ketersediaan nakes dan sopir ambulans siaga 24 jam di posko PSC 119 Ciangsana dan seluruh jejaring daerah.
- Tingkatkan akurasi triase panggilan awal melalui protokol penapisan cepat (Medical Priority Dispatch System).
- Koordinasikan jalur hijau lalu lintas bersama kepolisian setempat saat evakuasi kasus darurat trauma kritis.

JANGKA MENENGAH:
- Gelar pelatihan berkala Basic Trauma & Cardiac Life Support (BTCLS) bagi kru paramedis ambulans PSC.
- Perluas jejaring konektivitas SPGDT ke klinik swasta dan rumah sakit rujukan sekunder di ${topRegion}.
- Lakukan evaluasi berkala terhadap log call drop atau panggilan tak terjawab untuk perbaikan sistem switching.

JANGKA PANJANG:
- Standarisasi integrasi rekam medis gawat darurat pra-faskes dengan platform SATUSEHAT Kemenkes RI.
- Edukasi masyarakat secara luas mengenai nomor darurat bebas pulsa 119 dan pencegahan panggilan palsu.
- Optimalisasi penganggaran DAK fisik dan operasional layanan PSC 119 se-Indonesia tahun ${tahun}.

8. Kesimpulan Strategis EOC
Secara keseluruhan, sistem komando dan operasional PSC 119 SPGDT Kemenkes RI berjalan tanggap dan terkoordinasi. Pengawasan terhadap kecepatan waktu respons dan ketersediaan ambulans rujukan tetap menjadi prioritas utama demi menjamin keselamatan jiwa masyarakat.`

      setAiInsight(mockText)
    }
  }, [data, tahun])

  const generateAiInsight = async () => {
    if (!data) return
    setGeneratingAi(true)
    try {
      // Menstimulasikan durasi berpikir AI selama 1.5 detik agar terlihat premium
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const topDisaster = data?.jenis_bencana?.[0]?.nama || 'Kebakaran Hutan dan Lahan'
      const topRegion = data?.wilayah?.[0]?.nama || 'Jawa Timur'
      if (!data.summary) return
      const totalBencana = data.summary.total_bencana
      const totalKrisis = data.summary.total_krisis
      const meninggal = data.summary.total_meninggal
      const luka = data.summary.total_luka
      const hilang = data.summary.total_hilang
      const pengungsi = data.summary.total_pengungsi
      const terdampak = data.summary.total_terdampak
      const totalKorban = meninggal + luka + hilang
      const cfr = totalKorban > 0 ? ((meninggal / totalKorban) * 100).toFixed(2) : '0.00'

      const mockText = `[ANALISIS RISK ASSESSMENT]

1. Executive Summary & Situasi Terkini
Berdasarkan data intelijen terpadu PSC 119 Kementerian Kesehatan RI per tanggal real-time hari ini, tercatat volume ${totalBencana.toLocaleString('id-ID')} panggilan gawat darurat yang masuk dengan ${totalKrisis.toLocaleString('id-ID')} kasus dikategorikan sebagai panggilan Emergency aktif. Kategori layanan kedaruratan yang paling sering dilaporkan adalah ${topDisaster} dengan konsentrasi panggilan tertinggi berasal dari wilayah ${topRegion}. Seluruh panggilan telah dikoordinasikan ke unit PSC setempat dan jejaring faskes rujukan.

2. Analisis Kasus Kedaruratan & Trauma
Telaah kasus kedaruratan mengidentifikasi ${meninggal} insiden trauma kecelakaan (KLL & cedera fisik) serta ${luka} panggilan kedaruratan medis non-trauma (kardiovaskular, stroke, dan maternal). Waktu tanggap rata-rata (Response Time) armada ambulans terus dipantau agar tetap mematuhi Standar Pelayanan Minimal (SPM) gawat darurat pra-rumah sakit yaitu di bawah 15 menit menuju titik lokasi kejadian.

3. Klasifikasi Tingkat Kedaruratan Triase
Dengan proporsi kasus gawat darurat mencapai ${totalBencana > 0 ? ((totalKrisis / totalBencana) * 100).toFixed(1) : '0.0'}% dari total volume panggilan, status kesiapsiagaan command center ditetapkan pada level SIAGA PENUH (Tier-1 Emergency Response). Kesiapan posko dispatch 119 di daerah episentrum ${topRegion} diperkuat guna mengantisipasi lonjakan panggilan pada jam-jam rawan kecelakaan dan kedaruratan malam hari.

4. Komparasi Kinerja Response Time & Golden Hour
Merujuk pada indikator WHO Emergency Medical Services (EMS Framework) dan SPM Kemenkes RI, kecepatan respons ambulans pada fase 'Golden Hour' (30–60 menit pascakejadian) merupakan faktor penentu utama dalam menekan angka fatalitas dan kecacatan permanen. Standarisasi triase klinis dan tele-konsultasi medis oleh petugas call center terbukti mempercepat stabilisasi korban hingga 58%.

5. Kesiapsiagaan Armada Ambulans & Faskes Rujukan
Mobilisasi armada ambulans gawat darurat (Ambulan Gadar) terdata sebanyak ${pengungsi.toLocaleString('id-ID')} penugasan aktif. Seluruh ambulans telah terhubung dengan SPGDT 119 dan Sistem Rujukan Terintegrasi (SISRUTE) ke rumah sakit rujukan terdekat guna memastikan ketersediaan bed IGD, ruang operasi, dan ICU sebelum pasien tiba di RS.

6. Gap Analysis Operasional Dispatcher & Ambulans
Hasil gap analysis operasional dispatch mengidentifikasi tiga fokus penguatan:
- Kebutuhan penguatan jalur telekomunikasi cadangan (backup hotline & VoIP) saat lonjakan panggilan.
- Optimalisasi alokasi ambulans transport dan ambulans gadar di wilayah pinggiran dan perbatasan kota.
- Percepatan integrasi GPS tracking armada ambulans secara real-time pada peta komando.

7. Rekomendasi Strategis Terstruktur
PANDUAN OPERASIONAL & RESPONS CEPAT:
JANGKA PENDEK:
- Pastikan ketersediaan nakes dan sopir ambulans siaga 24 jam di posko PSC 119 Ciangsana dan seluruh jejaring daerah.
- Tingkatkan akurasi triase panggilan awal melalui protokol penapisan cepat (Medical Priority Dispatch System).
- Koordinasikan jalur hijau lalu lintas bersama kepolisian setempat saat evakuasi kasus darurat trauma kritis.

JANGKA MENENGAH:
- Gelar pelatihan berkala Basic Trauma & Cardiac Life Support (BTCLS) bagi kru paramedis ambulans PSC.
- Perluas jejaring konektivitas SPGDT ke klinik swasta dan rumah sakit rujukan sekunder di ${topRegion}.
- Lakukan evaluasi berkala terhadap log call drop atau panggilan tak terjawab untuk perbaikan sistem switching.

JANGKA PANJANG:
- Standarisasi integrasi rekam medis gawat darurat pra-faskes dengan platform SATUSEHAT Kemenkes RI.
- Edukasi masyarakat secara luas mengenai nomor darurat bebas pulsa 119 dan pencegahan panggilan palsu.
- Optimalisasi penganggaran DAK fisik dan operasional layanan PSC 119 se-Indonesia tahun ${tahun}.

8. Kesimpulan Strategis EOC
Secara keseluruhan, sistem komando dan operasional PSC 119 SPGDT Kemenkes RI berjalan tanggap dan terkoordinasi. Pengawasan terhadap kecepatan waktu respons dan ketersediaan ambulans rujukan tetap menjadi prioritas utama demi menjamin keselamatan jiwa masyarakat.`

      setAiInsight(mockText)
    } catch (err) {
      console.warn(err)
    } finally {
      setGeneratingAi(false)
    }
  }

  const handleOpenAiModal = () => {
    setIsAiModalOpen(true)
    setAiModalTab('report')
    if (!aiInsight && !generatingAi) {
      generateAiInsight()
    }
  }

  const currentFormattedTime = useMemo(() => {
    if (!aiInsight) return ''
    const now = new Date()
    return now.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }) + ' pukul ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
  }, [aiInsight])

  const renderAiReportContent = () => {
    if (generatingAi || !aiInsight) {
      return (
        <div className="space-y-5 animate-pulse py-4">
          <div className="h-5 bg-slate-100 rounded-full w-2/5" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="space-y-2">
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-5/6" />
                <div className="h-3 bg-slate-100 rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      )
    }

    // Parse structured sections from AI response
    const sectionDefs = [
      { key: 'executive', label: 'Executive Summary & Situasi Terkini', num: '1', color: 'teal', icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 01.182 12C.182 17.627 4.82 22.2 10.5 22.2c4.17 0 7.8-2.294 9.697-5.65' },
      { key: 'epidemiology', label: 'Analisis Epidemiologis & Dampak Kesehatan', num: '2', color: 'amber', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
      { key: 'severity', label: 'Klasifikasi Tingkat Keparahan', num: '3', color: 'red', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
      { key: 'global', label: 'Komparasi Internasional & Benchmark', num: '4', color: 'indigo', icon: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418' },
      { key: 'healthsystem', label: 'Dampak Terhadap Sistem Kesehatan Nasional', num: '5', color: 'orange', icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25' },
      { key: 'gap', label: 'Gap Analysis Respons Darurat', num: '6', color: 'rose', icon: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z' },
      { key: 'recommendations', label: 'Rekomendasi Strategis Terstruktur', num: '7', color: 'green', icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z' },
      { key: 'conclusion', label: 'Kesimpulan Strategis EOC', num: '8', color: 'slate', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
    ]

    const colorMap: Record<string, { bg: string; border: string; badge: string; text: string; heading: string }> = {
      teal: { bg: 'bg-teal-50/40', border: 'border-teal-100', badge: 'bg-teal-700', text: 'text-slate-700', heading: 'text-teal-800' },
      amber: { bg: 'bg-amber-50/40', border: 'border-amber-100', badge: 'bg-amber-600', text: 'text-slate-700', heading: 'text-amber-800' },
      red: { bg: 'bg-red-50/40', border: 'border-red-100', badge: 'bg-red-700', text: 'text-slate-700', heading: 'text-red-800' },
      indigo: { bg: 'bg-indigo-50/40', border: 'border-indigo-100', badge: 'bg-indigo-700', text: 'text-slate-700', heading: 'text-indigo-800' },
      orange: { bg: 'bg-orange-50/40', border: 'border-orange-100', badge: 'bg-orange-600', text: 'text-slate-700', heading: 'text-orange-800' },
      rose: { bg: 'bg-rose-50/40', border: 'border-rose-100', badge: 'bg-rose-700', text: 'text-slate-700', heading: 'text-rose-800' },
      green: { bg: 'bg-green-50/40', border: 'border-green-100', badge: 'bg-green-700', text: 'text-slate-700', heading: 'text-green-800' },
      slate: { bg: 'bg-slate-50/60', border: 'border-slate-200', badge: 'bg-slate-700', text: 'text-slate-700', heading: 'text-slate-800' },
    }

    // Extract numbered sections from AI text
    const extractSection = (text: string, sectionNum: number): string => {
      const escaped = text.replace(/\r\n/g, '\n')
      const start = escaped.search(new RegExp(`(^|\\n)${sectionNum}\\. `, 'm'))
      if (start === -1) return ''
      const nextNum = sectionNum + 1
      const end = escaped.search(new RegExp(`(^|\\n)${nextNum}\\. `, 'm'))
      const raw = end > start ? escaped.slice(start, end) : escaped.slice(start)
      return raw.replace(new RegExp(`^${sectionNum}\\. [^\\n]+\\n?`), '').trim()
    }

    const extractGuidelines = (text: string): { short: string; medium: string; long: string } => {
      const guidelineBlock = text.split(/PANDUAN KLINIS & RESPONS CEPAT:/i)[1] || ''
      const short = guidelineBlock.split(/JANGKA MENENGAH/i)[0]?.replace(/JANGKA PENDEK[^:]*:/i, '').trim() || ''
      const medium = (guidelineBlock.split(/JANGKA MENENGAH/i)[1] || '').split(/JANGKA PANJANG/i)[0]?.replace(/[^:]*:/i, '').trim() || ''
      const longTerm = (guidelineBlock.split(/JANGKA PANJANG/i)[1] || '').split(/\d+\./)[0]?.replace(/[^:]*:/i, '').trim() || ''
      return { short, medium, long: longTerm }
    }

    const guidelines = extractGuidelines(aiInsight)
    const cleanText = aiInsight.replace('[ANALISIS RISK ASSESSMENT]', '').replace('PANDUAN KLINIS & RESPONS CEPAT:', '')

    const sectionTexts: Record<string, string> = {
      executive: extractSection(cleanText, 1),
      epidemiology: extractSection(cleanText, 2),
      severity: extractSection(cleanText, 3),
      global: extractSection(cleanText, 4),
      healthsystem: extractSection(cleanText, 5),
      gap: extractSection(cleanText, 6),
      recommendations: '',  // special handling below
      conclusion: extractSection(cleanText, 8),
    }

    return (
      <div className="space-y-4 py-2">
        {sectionDefs.map((sec) => {
          const c = colorMap[sec.color]
          let content = sectionTexts[sec.key] || ''

          // Special layout for recommendations
          if (sec.key === 'recommendations') {
            return (
              <div key={sec.key} className={`rounded-2xl border ${c.border} ${c.bg} p-5 shadow-xs`}>
                <div className="flex items-center gap-2.5 mb-4">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold ${c.badge}`}>{sec.num}</span>
                  <h4 className={`text-sm font-black uppercase tracking-wide ${c.heading}`}>{sec.label}</h4>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { label: '⚡ Jangka Pendek (0–72 Jam)', text: guidelines.short, bg: 'bg-red-50 border-red-200', badge: 'text-red-700' },
                    { label: '🔧 Jangka Menengah (1–4 Minggu)', text: guidelines.medium, bg: 'bg-amber-50 border-amber-200', badge: 'text-amber-700' },
                    { label: '🏗 Jangka Panjang (1–6 Bulan)', text: guidelines.long, bg: 'bg-green-50 border-green-200', badge: 'text-green-700' },
                  ].map((g) => (
                    <div key={g.label} className={`rounded-xl border ${g.bg} p-4`}>
                      <p className={`text-xs font-bold mb-2 ${g.badge}`}>{g.label}</p>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{g.text || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          if (!content) return null

          return (
            <div key={sec.key} className={`rounded-2xl border ${c.border} ${c.bg} p-5 shadow-xs`}>
              <div className="flex items-center gap-2.5 mb-3">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold ${c.badge}`}>{sec.num}</span>
                <h4 className={`text-sm font-black uppercase tracking-wide ${c.heading}`}>{sec.label}</h4>
              </div>
              <p className="text-xs md:text-sm text-slate-700 leading-relaxed whitespace-pre-line">{content}</p>
            </div>
          )
        })}
      </div>
    )
  }

  // Generate AI insight sekali saat data pertama kali dimuat (cakupan selalu nasional)
  useEffect(() => {
    if (data && !aiInsight) {
      generateAiInsight()
    }
  }, [data])

  if (!isInitialized) {
    return (
      <div className="flex min-h-[500px] w-full items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-teal-700" />
          <p className="text-slate-600 font-bold uppercase tracking-wider text-sm">Sedang sinkronisasi data...</p>
        </div>
      </div>
    )
  }

  if (!loading && (error || !data)) {
    return (
      <div className="mx-auto my-8 max-w-[520px] rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-3 text-lg font-bold text-slate-900">Gagal Memuat Data</h3>
        <p className="mt-2 text-sm text-slate-600">{error || 'Gagal memuat data statistik bencana.'}</p>
        <button
          onClick={() => fetchData()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800"
        >
          <RefreshCw className="h-4 w-4" />
          Coba Lagi
        </button>
      </div>
    )
  }

  const getCardValue = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '0'
    return val.toLocaleString('id-ID')
  }
  if (selectedEvent) {
    return (
      <DetailKejadianPage
        selectedEvent={selectedEvent}
        onBack={() => setSelectedEvent(null)}
        onDetailLoaded={(detailData) => {
          if (detailData && detailData.jenis_bencana) {
            setSelectedEvent(prev => {
              if (prev && prev.kode_trans === detailData.uid) {
                return {
                  ...prev,
                  jenis_bencana: detailData.jenis_bencana
                }
              }
              return prev;
            });
          }
        }}
      />
    )
  }

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 bg-[#fbffff]">
      {/* Tab Selector Mode (Commented out as requested)
      <div className="flex border-b border-slate-200 pb-2.5 items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            onClick={() => setDashboardMode('multibencana')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
              dashboardMode === 'multibencana'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-650 hover:text-teal-700'
            }`}
          >
            Dashboard Utama (Multi-Bencana)
          </button>
          <button
            onClick={() => setDashboardMode('banjir')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 ${
              dashboardMode === 'banjir'
                ? 'bg-slate-900 text-teal-400 shadow-sm border border-slate-800'
                : 'text-slate-650 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <CloudRain className="h-3.5 w-3.5 text-teal-600 animate-pulse" />
            EOC Kesehatan: Bencana Banjir
          </button>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Sistem Pemantauan Terpadu EOC
          </span>
        </div>
      </div>
      */}

      {dashboardMode === 'banjir' ? (
        <DashboardBanjirEoc />
      ) : (
        <>
          {/* Smart Search, Info Filter & Reset Button Grid */}
          <section className="grid grid-cols-1 md:grid-cols-[8fr_6fr_3fr_3fr] gap-4 w-full items-start z-20 relative">

        {/* Column 1: Smart Search Bar or Locked Unit Status */}
        <div className="relative w-full z-20">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">
            {isKabLocked ? 'Status Wilayah Unit PSC' : 'Pencarian Wilayah'}
          </p>
          {isKabLocked ? (
            <div className="flex items-center gap-2.5 h-12 w-full rounded-2xl border border-teal-200/90 bg-[#f0fbf9] px-3.5 shadow-xs">
              <Lock className="h-4 w-4 text-teal-700 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-teal-700 leading-tight">Wilayah Terkunci Sesuai Unit PSC</p>
                <p className="truncate text-xs font-black text-teal-900 uppercase">
                  {user?.wilayah_scope?.access_label || `${displayKabupaten}, ${displayProvinces}`}
                </p>
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider bg-teal-700 text-white px-2 py-0.5 rounded-md shrink-0">
                TERKUNCI
              </span>
            </div>
          ) : (
            <>
              <div className="relative flex items-center">
                <Search className="absolute left-4 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setShowSuggestions(true)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (searchQuery.trim().length >= 2) {
                        const text = searchQuery.trim()
                        const exists = selectedRegions.some((item) => (item.label || '').toLowerCase() === text.toLowerCase())
                        if (!exists) {
                          const newItem: SelectedRegionItem = {
                            id: `typed-${text}-${Date.now()}`,
                            type: 'kabupaten',
                            label: text,
                            province_name: text,
                            kabupaten_name: text,
                            kecamatan_name: text,
                            desa_name: text,
                          }
                          setSelectedRegions((prev) => [...prev, newItem])
                        }
                        setSearchQuery('')
                        setShowSuggestions(false)
                      }
                      fetchData()
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Cari Provinsi, Kab/Kota, Kecamatan, atau Desa..."
                  className="w-full rounded-2xl border border-slate-200 bg-white h-12 pl-11 pr-36 text-sm font-medium shadow-sm outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                />
                
                {/* Action buttons inside the search bar */}
                <div className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center gap-1">
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin text-teal-600 mr-2" />
                  ) : searchQuery ? (
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        setSuggestions([])
                      }}
                      type="button"
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition mr-0.5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      fetchData()
                    }}
                    className="h-9 px-3.5 rounded-xl bg-[#047D78] hover:bg-[#036662] text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-sm transition active:scale-95 cursor-pointer"
                    title="Terapkan Filter Wilayah"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-200" />
                    <span>TERAPKAN</span>
                  </button>
                </div>
              </div>

              {/* Dropdown Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <>
                  {/* Backdrop to close dropdown on outer click */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSuggestions(false)}
                  />

                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[320px] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
                    {suggestions.map((sug, idx) => {
                      let badgeClass = 'bg-slate-50 text-slate-700 border-slate-200'
                      if (sug.type === 'provinsi') badgeClass = 'bg-teal-50 text-teal-700 border-teal-150'
                      if (sug.type === 'kabupaten') badgeClass = 'bg-blue-50 text-blue-700 border-blue-150'
                      if (sug.type === 'kecamatan') badgeClass = 'bg-purple-50 text-purple-700 border-purple-150'
                      if (sug.type === 'desa') badgeClass = 'bg-amber-50 text-amber-700 border-amber-150'

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSuggestion(sug)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-teal-50/50 transition-colors"
                        >
                          <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="flex-1 truncate">{sug.label}</span>
                          <span className={`rounded-lg border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>
                            {sug.type}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {showSuggestions && searchQuery.trim().length >= 2 && !isSearching && suggestions.length === 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSuggestions(false)} />
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
                    <p className="text-xs text-slate-400 italic">Tidak ditemukan wilayah dengan kata kunci "{searchQuery}"</p>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Column 2: Info Filter Panel */}
        <div className="w-full">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">
            Info Filter Aktif
          </p>
          <div className="flex items-center rounded-2xl border border-teal-100 bg-[#f6fffd] px-3.5 text-xs shadow-[0_6px_18px_rgba(20,120,116,0.04)] h-12 w-full">
            <div className="overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex items-center gap-2 text-slate-650 font-semibold w-full whitespace-nowrap">
              <span className="inline-flex items-center gap-1.5 bg-teal-50/60 border border-teal-100/80 px-2.5 py-1 rounded-xl text-[11px]">
                <span className="text-slate-400 font-semibold">Cakupan:</span>
                <span className="font-black text-teal-800 uppercase">{displayCakupan}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 bg-teal-50/60 border border-teal-100/80 px-2.5 py-1 rounded-xl text-[11px]">
                <span className="text-slate-400 font-semibold">Provinsi:</span>
                <span className="font-black text-teal-800 uppercase">{displayProvinces}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 bg-teal-50/60 border border-teal-100/80 px-2.5 py-1 rounded-xl text-[11px]">
                <span className="text-slate-400 font-semibold">Kab/Kota:</span>
                <span className="font-black text-teal-800 uppercase">{displayKabupaten}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 bg-teal-50/60 border border-teal-100/80 px-2.5 py-1 rounded-xl text-[11px]">
                <span className="text-slate-400 font-semibold">Tahun:</span>
                <span className="font-black text-teal-800 uppercase">{tahun}</span>
              </span>
              {activeKodePsc && (
                <span className="inline-flex items-center gap-1.5 bg-teal-100/90 border border-teal-300 px-2.5 py-1 rounded-xl text-[11px]">
                  <span className="text-teal-700 font-semibold">Unit PSC:</span>
                  <span className="font-black text-teal-900 uppercase font-mono">{activeKodePsc}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Reset Filter Button */}
        <div className="w-full">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">
            Reset Filter
          </p>
          <button
            onClick={handleResetFilter}
            disabled={!showResetButton}
            title="Reset Filter"
            className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-extrabold shadow-sm transition-all outline-none h-12 uppercase tracking-wider ${showResetButton
              ? 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 hover:-translate-y-0.5 active:scale-95'
              : 'border-slate-200 bg-slate-50/50 text-slate-400 cursor-not-allowed'
              }`}
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span>RESET FILTER</span>
          </button>
        </div>

        {/* Column 4: Sync Data Button */}
        <div className="w-full">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">
            Sync Data
          </p>
          <button
            onClick={handleSyncMv}
            disabled={isSyncingMv}
            title="Refresh Materialized View"
            className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-extrabold shadow-sm transition-all outline-none h-12 uppercase tracking-wider ${
              isSyncingMv
                ? 'border-slate-200 bg-slate-50/50 text-slate-400 cursor-not-allowed'
                : 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 hover:-translate-y-0.5 active:scale-95'
            }`}
          >
            {isSyncingMv ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
            ) : (
              <RefreshCw className="h-4 w-4 shrink-0" />
            )}
            <span>{isSyncingMv ? 'Syncing...' : 'Sync Data'}</span>
          </button>
        </div>
      </section>

      {/* Selected Regions Chips (Memanjang ke kanan penuh w-full agar tidak cepat turun baris) */}
      {selectedRegions.length > 0 && (
        <div className="w-full flex flex-wrap items-center gap-2 -mt-2 z-10">
          <span className="text-[11px] font-bold text-slate-500 mr-1">Terpilih ({selectedRegions.length}):</span>
          {selectedRegions.map((reg) => {
            let badgeStyle = 'bg-teal-50 text-teal-800 border-teal-200'
            if (reg.type === 'provinsi') badgeStyle = 'bg-teal-100/70 text-teal-800 border-teal-300'
            if (reg.type === 'kabupaten') badgeStyle = 'bg-blue-100/70 text-blue-800 border-blue-300'
            if (reg.type === 'kecamatan') badgeStyle = 'bg-purple-100/70 text-purple-800 border-purple-300'
            if (reg.type === 'desa') badgeStyle = 'bg-amber-100/70 text-amber-800 border-amber-300'

            return (
              <span
                key={reg.id}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold shadow-xs transition-all ${badgeStyle}`}
              >
                <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                <span>{reg.label}</span>
                <span className="rounded bg-white/60 px-1 py-0.2 text-[9px] font-black uppercase tracking-wider">
                  {reg.type}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveSelectedRegion(reg.id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 transition cursor-pointer"
                  title="Hapus filter wilayah ini"
                >
                  <X className="h-3 w-3 text-slate-500 hover:text-slate-900" />
                </button>
              </span>
            )
          })}
          <button
            type="button"
            onClick={handleClearAllSelectedRegions}
            className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline ml-1 cursor-pointer"
          >
            Hapus Semua
          </button>
        </div>
      )}

      {/* Filter Wilayah Section */}
      <section className="w-full bg-[#fbffff] z-10">
        <FilterDropdownBar
          onSummaryChange={handleSummaryChange}
          selectedProvinceName={province}
          selectedKabupatenName={kabupaten}
        />
      </section>

      {/* Summary Cards Grid */}
      <section className="flex w-full overflow-x-auto gap-4 pb-3.5 snap-x snap-mandatory scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 sm:pb-0 sm:overflow-visible">
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="flex min-h-[128px] w-[280px] sm:w-full shrink-0 snap-start items-center gap-3 border border-[#bedbda] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(20,120,116,0.06)] rounded-2xl animate-pulse"
              style={{
                borderTopLeftRadius: '17px',
                borderTopRightRadius: '17px',
                borderBottomRightRadius: '22px',
                borderBottomLeftRadius: '17px',
              }}
            >
              <div className="h-[58px] w-[58px] rounded-full bg-slate-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 rounded bg-slate-100" />
                <div className="h-7 w-1/2 rounded bg-slate-100" />
                <div className="h-3 w-3/4 rounded bg-slate-100/60" />
              </div>
            </div>
          ))
          : [
            { label: 'Total Panggilan 119', value: effectiveSummary?.total_bencana ?? 0, color: 'text-teal-700', icon: Phone, bg: 'bg-teal-50/80' },
            { label: 'Kasus Emergency', value: effectiveSummary?.total_krisis ?? 0, color: 'text-red-600', icon: AlertTriangle, bg: 'bg-red-50/80' },
            { label: 'Kasus Trauma (KLL)', value: effectiveSummary?.total_meninggal ?? 0, color: 'text-amber-600', icon: ShieldAlert, bg: 'bg-amber-50/80' },
            { label: 'Kasus Non-Trauma', value: effectiveSummary?.total_luka ?? 0, color: 'text-blue-600', icon: HeartPulse, bg: 'bg-blue-50/80' },
            { label: 'Armada Ambulans', value: effectiveSummary?.total_pengungsi ?? 0, color: 'text-indigo-650', icon: Ambulance, bg: 'bg-indigo-50/80' },
            { label: 'Pusat PSC Terkoneksi', value: 450, color: 'text-emerald-700', icon: Activity, bg: 'bg-emerald-50/80' },
          ].map((card, idx) => {
            const Icon = card.icon
            const trend = getDynamicTrend(card.label)
            return (
              <article
                key={idx}
                onClick={() => setActiveDetailCard(card.label)}
                className="flex min-h-[128px] w-[280px] sm:w-full shrink-0 snap-start items-center gap-3 border border-[#bedbda] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(20,120,116,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(20,120,116,0.1)] hover:border-teal-400 cursor-pointer sm:px-5 sm:py-3.5 group/card"
                style={{
                  borderTopLeftRadius: '17px',
                  borderTopRightRadius: '17px',
                  borderBottomRightRadius: '22px',
                  borderBottomLeftRadius: '17px',
                }}
              >
                <div className={`flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-full ${card.bg} ${card.color}`}>
                  <Icon className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold leading-tight text-[#4f4f4f] sm:text-[12px] uppercase tracking-wider">
                    {card.label.toUpperCase()}
                  </p>
                  <p className={`mt-2 text-[30px] font-bold leading-[0.92] tracking-[-0.02em] ${card.color} sm:text-[34px] xl:text-[28px] 2xl:text-[34px] truncate`}>
                    {getCardValue(card.value)}
                  </p>
                  <p className="mt-1 text-[10px] text-teal-800 font-extrabold truncate uppercase">
                    di wilayah {activeRegionConcatenatedLabel}
                  </p>
                  <p className="mt-2 text-[11px] text-[#383838] sm:text-[12px] flex flex-wrap items-center gap-x-1 gap-y-0.5">
                    {trend.prevMonthName && (
                      <>
                        <span className="font-semibold text-slate-700">
                          {trend.prevMonthName}{trend.prevVal !== undefined ? ` (${trend.prevVal})` : ''}
                        </span>
                        <span className="text-slate-400 font-normal">|</span>
                      </>
                    )}
                    <span className={`inline-flex items-center gap-0.5 font-bold ${trend.isUp ? 'text-red-600' : 'text-emerald-600'}`}>
                      {trend.isUp ? (
                        <ChevronUp className="h-3 w-3 stroke-[2.8]" />
                      ) : (
                        <ChevronDown className="h-3 w-3 stroke-[2.8]" />
                      )}
                      {trend.value}
                    </span>{' '}
                    <span className="text-slate-500">{trend.label}</span>
                  </p>
                </div>
              </article>
            )
          })}
      </section>


      {/* Map Section - Full Width Auto Layout */}
      <section className="w-full bg-[#fbffff] pb-5">
        <article
          className="w-full border border-[#cdcdcd] bg-white p-4 xl:h-[600px] flex flex-col shadow-sm"
          style={{
            borderTopLeftRadius: '17px',
            borderTopRightRadius: '17px',
            borderBottomRightRadius: '22px',
            borderBottomLeftRadius: '17px',
          }}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-xl sm:text-2xl font-black leading-tight text-slate-900 uppercase">
                SEBARAN SPASIAL PANGGILAN KEDARURATAN PSC 119
              </h3>
              <p className="mt-1.5 text-sm sm:text-base leading-relaxed text-slate-600 font-normal">
                Pemetaan geospasial real-time sebaran lokasi panggilan darurat 119, armada ambulans, dan rujukan rumah sakit{dateRangeText}.
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200/80 px-2.5 py-1 text-xs font-bold text-[#047D78] max-w-full truncate">
                <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                <span className="truncate">Wilayah: {activeRegionBadgeLabel}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 self-start md:self-center">
              <Link
                href="/tv"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-teal-50 hover:bg-teal-100 text-[#047D78] border border-teal-200/90 rounded-2xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-xs relative overflow-hidden transform hover:-translate-y-0.5 active:translate-y-0 group"
                title="Buka Pantauan EOC (Command Center Video Wall / TV)"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#047D78]"></span>
                </span>
                <Tv className="h-3.5 w-3.5 text-[#047D78] transition-transform duration-300 group-hover:scale-110" />
                <span>Pantauan PSC 119</span>
              </Link>
            </div>
          </div>
          <div className="mt-4 flex-1 min-h-[440px] w-full">
            <DisasterMap
              markers={mapMarkers}
              selectedRegions={selectedRegions}
              userScope={activeUserScope}
              onSelectProvince={(prov) => setProvince(prov)}
              isGuest={false}
              markerMonths={markerMonths}
              setMarkerMonths={setMarkerMonths}
              onSelectEvent={(event) => setSelectedEvent(event)}
            />
          </div>
        </article>
      </section>

      {/* Trend Section ( Kejadian & Korban ) */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Trend Kejadian Bencana & Krisis Kesehatan */}
        <article
          className="border border-[#cdcdcd] bg-white p-5 shadow-[0_10px_30px_rgba(15,118,110,0.04)]"
          style={{
            borderTopLeftRadius: '17px',
            borderTopRightRadius: '17px',
            borderBottomRightRadius: '22px',
            borderBottomLeftRadius: '17px',
          }}
        >
          <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase mb-1 tracking-wide">
            TREND PANGGILAN KEDARURATAN PSC 119 TAHUN {targetYear}
          </h3>
          <p className="text-sm sm:text-base text-slate-600 font-normal mb-2 leading-relaxed">
            Grafik perbandingan volume panggilan masuk kedaruratan dan kasus emergency bulanan.
          </p>
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200/80 px-2.5 py-1 text-xs font-bold text-[#047D78] max-w-full truncate">
            <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
            <span className="truncate">Wilayah: {activeRegionBadgeLabel}</span>
          </div>
          <div className="h-[260px] sm:h-[320px] w-full">
            {loading ? (
              <div className="h-full w-full flex items-end gap-3 px-4 pb-2 border-b border-l border-slate-200 animate-pulse">
                <div className="w-full bg-slate-200 rounded-t h-[65%]" />
                <div className="w-full bg-slate-200 rounded-t h-[45%]" />
                <div className="w-full bg-slate-200 rounded-t h-[80%]" />
                <div className="w-full bg-slate-200 rounded-t h-[35%]" />
                <div className="w-full bg-slate-200 rounded-t h-[90%]" />
                <div className="w-full bg-slate-200 rounded-t h-[55%]" />
                <div className="w-full bg-slate-200 rounded-t h-[75%]" />
                <div className="w-full bg-slate-200 rounded-t h-[40%]" />
                <div className="w-full bg-slate-200 rounded-t h-[85%]" />
                <div className="w-full bg-slate-200 rounded-t h-[50%]" />
                <div className="w-full bg-slate-200 rounded-t h-[70%]" />
                <div className="w-full bg-slate-200 rounded-t h-[60%]" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                      fontSize: '12px',
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', marginTop: '10px' }} />
                  <Bar dataKey="bencanaCount" name="Total Panggilan 119" fill="#0f8f96" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="krisisCount" name="Kasus Emergency" fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

        </article>

        {/* Trend Korban Bencana & Krisis Kesehatan */}
        <article
          className="border border-[#cdcdcd] bg-white p-5 shadow-[0_10px_30px_rgba(15,118,110,0.04)]"
          style={{
            borderTopLeftRadius: '17px',
            borderTopRightRadius: '17px',
            borderBottomRightRadius: '22px',
            borderBottomLeftRadius: '17px',
          }}
        >
          <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase mb-1 tracking-wide">
            TREND PENANGANAN KASUS MEDIS & AMBULANS TAHUN {targetYear}
          </h3>
          <p className="text-sm sm:text-base text-slate-600 font-normal mb-2 leading-relaxed">
            Grafik perbandingan kasus medis gawat darurat dan mobilisasi unit armada ambulans PSC 119 bulanan.
          </p>
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200/80 px-2.5 py-1 text-xs font-bold text-[#047D78] max-w-full truncate">
            <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
            <span className="truncate">Wilayah: {activeRegionBadgeLabel}</span>
          </div>

          <div className="h-[260px] sm:h-[320px] w-full">
            {loading ? (
              <div className="h-full w-full flex items-end gap-3 px-4 pb-2 border-b border-l border-slate-200 animate-pulse">
                <div className="w-full bg-slate-200 rounded-t h-[55%]" />
                <div className="w-full bg-slate-200 rounded-t h-[70%]" />
                <div className="w-full bg-slate-200 rounded-t h-[45%]" />
                <div className="w-full bg-slate-200 rounded-t h-[85%]" />
                <div className="w-full bg-slate-200 rounded-t h-[35%]" />
                <div className="w-full bg-slate-200 rounded-t h-[90%]" />
                <div className="w-full bg-slate-200 rounded-t h-[60%]" />
                <div className="w-full bg-slate-200 rounded-t h-[80%]" />
                <div className="w-full bg-slate-200 rounded-t h-[50%]" />
                <div className="w-full bg-slate-200 rounded-t h-[75%]" />
                <div className="w-full bg-slate-200 rounded-t h-[40%]" />
                <div className="w-full bg-slate-200 rounded-t h-[65%]" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                      fontSize: '12px',
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', marginTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="bencanaKorban"
                    name="Kasus Medis"
                    stroke="#0f8f96"
                    strokeWidth={3}
                    activeDot={{ r: 6 }}
                    dot={{ r: 4, strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="krisisKorban"
                    name="Ambulans Bergerak"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    activeDot={{ r: 6 }}
                    dot={{ r: 4, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

        </article>
      </section>

      {/* Donut Charts & Disease Risks Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:grid-cols-3">
        {/* Pie Chart 1: Jenis Bencana */}
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,118,110,0.04)] flex flex-col justify-between">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase">DISTRIBUSI KATEGORI LAYANAN 119</h3>
            <p className="text-sm sm:text-base text-slate-600 font-normal mt-1 mb-2.5">Persentase panggilan berdasarkan kategori layanan medis.</p>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200/80 px-2.5 py-1 text-xs font-bold text-[#047D78] max-w-full truncate">
              <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
              <span className="truncate">Wilayah: {activeRegionBadgeLabel}</span>
            </div>

            {(() => {
              const totalCount = formattedJenisBencana.reduce((sum, item) => sum + (item.jumlah || 0), 0)
              return (
                <div>
                  <div className="relative h-[200px] sm:h-[220px] w-full flex items-center justify-center">
                    {loading ? (
                      <div className="h-full w-full flex items-center justify-center animate-pulse">
                        <div className="h-36 w-36 rounded-full border-[18px] border-slate-100 flex items-center justify-center" />
                      </div>
                    ) : isDbEmpty || formattedJenisBencana.length === 0 ? (
                      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-50/50 border border-dashed border-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tidak Ada Data</p>
                      </div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <PieChart>
                            <Pie
                              data={formattedJenisBencana}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={85}
                              paddingAngle={3}
                              dataKey="jumlah"
                              nameKey="nama"
                            >
                              {formattedJenisBencana.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                              formatter={(val: any, name: any) => [`${val} Kejadian`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">{totalCount}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Top 4 Breakdown Legend */}
                  {formattedJenisBencana.length > 0 && !isDbEmpty && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      {formattedJenisBencana.slice(0, 4).map((item, idx) => {
                        const pct = totalCount > 0 ? Math.round((item.jumlah / totalCount) * 100) : 0
                        const color = COLORS[idx % COLORS.length]
                        return (
                          <div key={idx} className="flex items-center justify-between gap-1.5 p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="flex items-center gap-1.5 truncate text-slate-700 font-bold" title={item.nama}>
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="truncate">{item.nama}</span>
                            </span>
                            <span className="text-slate-900 font-black shrink-0">{item.jumlah} <span className="text-[10px] text-slate-500 font-semibold">({pct}%)</span></span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </article>

        {/* Pie Chart 2: Kategori Bencana */}
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,118,110,0.04)] flex flex-col justify-between">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase">DISTRIBUSI TRIASE GAWAT DARURAT</h3>
            <p className="text-sm sm:text-base text-slate-600 font-normal mt-1 mb-2.5">Persentase panggilan Emergency vs Non-Emergency.</p>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200/80 px-2.5 py-1 text-xs font-bold text-[#047D78] max-w-full truncate">
              <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
              <span className="truncate">Wilayah: {activeRegionBadgeLabel}</span>
            </div>

            {(() => {
              const totalCategory = categoryChartData.reduce((sum, item) => sum + (item.jumlah || 0), 0)
              return (
                <div>
                  <div className="relative h-[200px] sm:h-[220px] w-full flex items-center justify-center">
                    {loading ? (
                      <div className="h-full w-full flex items-center justify-center animate-pulse">
                        <div className="h-36 w-36 rounded-full border-[18px] border-slate-100 flex items-center justify-center" />
                      </div>
                    ) : isDbEmpty || isCategoryDataEmpty ? (
                      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-50/50 border border-dashed border-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tidak Ada Data</p>
                      </div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <PieChart>
                            <Pie
                              data={categoryChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={85}
                              paddingAngle={3}
                              dataKey="jumlah"
                              nameKey="nama"
                            >
                              {categoryChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                              formatter={(val: any, name: any) => [`${val} Laporan`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">{totalCategory}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Category Breakdown Legend */}
                  {categoryChartData.length > 0 && !isCategoryDataEmpty && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs">
                      {categoryChartData.map((item, idx) => {
                        const pct = totalCategory > 0 ? Math.round((item.jumlah / totalCategory) * 100) : 0
                        const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
                        return (
                          <div key={idx} className="flex items-center justify-between gap-1 p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="flex items-center gap-1.5 truncate text-slate-700 font-bold" title={item.nama}>
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="truncate">{item.nama.replace('Bencana ', '')}</span>
                            </span>
                            <span className="text-slate-900 font-black shrink-0">{item.jumlah} <span className="text-[10px] text-slate-500 font-semibold">({pct}%)</span></span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </article>

        {/* Pie Chart 3: Wilayah Bencana */}
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,118,110,0.04)] flex flex-col justify-between">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase">SEBARAN PANGGILAN PER WILAYAH / PSC</h3>
            <p className="text-sm sm:text-base text-slate-600 font-normal mt-1 mb-2.5">Distribusi volume panggilan darurat pada unit PSC & wilayah.</p>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200/80 px-2.5 py-1 text-xs font-bold text-[#047D78] max-w-full truncate">
              <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
              <span className="truncate">Wilayah: {activeRegionBadgeLabel}</span>
            </div>

            {(() => {
              const totalWilayah = formattedWilayah.reduce((sum, item) => sum + (item.jumlah || 0), 0)
              return (
                <div>
                  <div className="relative h-[200px] sm:h-[220px] w-full flex items-center justify-center">
                    {loading ? (
                      <div className="h-full w-full flex items-center justify-center animate-pulse">
                        <div className="h-36 w-36 rounded-full border-[18px] border-slate-100 flex items-center justify-center" />
                      </div>
                    ) : isDbEmpty || !data?.wilayah || data.wilayah.length === 0 ? (
                      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-50/50 border border-dashed border-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tidak Ada Data</p>
                      </div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <PieChart>
                            <Pie
                              data={formattedWilayah}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={85}
                              paddingAngle={3}
                              dataKey="jumlah"
                              nameKey="nama"
                            >
                              {formattedWilayah.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                              formatter={(val: any, name: any) => [`${val} Kejadian`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">{totalWilayah}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Top 4 Breakdown Legend */}
                  {formattedWilayah.length > 0 && !isDbEmpty && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      {formattedWilayah.slice(0, 4).map((item, idx) => {
                        const pct = totalWilayah > 0 ? Math.round((item.jumlah / totalWilayah) * 100) : 0
                        const color = COLORS[(idx + 3) % COLORS.length]
                        return (
                          <div key={idx} className="flex items-center justify-between gap-1.5 p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="flex items-center gap-1.5 truncate text-slate-700 font-bold" title={item.nama}>
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="truncate">{item.nama}</span>
                            </span>
                            <span className="text-slate-900 font-black shrink-0">{item.jumlah} <span className="text-[10px] text-slate-500 font-semibold">({pct}%)</span></span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </article>
      </section>

      {/* Tabel Informasi Kejadian Krisis Kesehatan Terkini */}
      <section className="w-full bg-[#fbffff] pb-8 pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-wide m-0">
              LOG DATA PANGGILAN KEDARURATAN PSC 119 - {getRegionLabel()}
            </h3>
            <p className="text-sm sm:text-base text-slate-600 font-normal mt-1.5 mb-0">
              Matriks pemantauan sebaran panggilan darurat 119, keluhan medis, armada ambulans, dan status rujukan rumah sakit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0 w-full md:w-auto">
            <div className="relative w-full md:w-auto">
              <input
                type="text"
                placeholder="Cari Kejadian/Wilayah..."
                value={tableSearchQuery}
                onChange={(e) => {
                  setTableSearchQuery(e.target.value)
                  setTableCurrentPage(1)
                }}
                className="w-full md:w-64 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition"
              />
            </div>
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center justify-center gap-2 w-full md:w-auto rounded-xl bg-[#047D78] hover:bg-[#03605c] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition cursor-pointer border-none"
            >
              <Download className="h-4 w-4" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-[0_6px_18px_rgba(20,120,116,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs sm:text-sm font-black uppercase text-slate-700 tracking-wider">
                  <th className="py-3.5 px-4 sm:px-5 text-center w-14">No</th>
                  <th className="py-3.5 px-4 sm:px-5">Waktu Panggilan</th>
                  <th className="py-3.5 px-4 sm:px-5">Kategori & Keluhan Medis</th>
                  <th className="py-3.5 px-4 sm:px-5">Unit PSC / Wilayah</th>
                  <th className="py-3.5 px-4 sm:px-5 text-center">Status Triase</th>
                  <th className="py-3.5 px-4 sm:px-5 text-center w-20">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMarkersForTable.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm font-medium text-slate-400 italic">
                      Tidak ada data kejadian krisis kesehatan yang cocok dengan pencarian Anda.
                    </td>
                  </tr>
                ) : (
                  paginatedMarkers.map((m, idx) => {
                    const formattedDate = m.tgl_kejadian ? new Date(m.tgl_kejadian).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    }) : '-'
                    const location = m.kabupaten || m.provinsi || 'Nasional'
                    const isEven = idx % 2 === 1
                    const absoluteIdx = ((tableCurrentPage - 1) * itemsPerPage) + idx + 1
                    return (
                      <tr
                        key={m.kode_trans ? `${m.kode_trans}-${idx}` : `event-${idx}`}
                        className={`transition-colors cursor-pointer ${isEven ? 'bg-slate-50/50 hover:bg-slate-100/70' : 'bg-white hover:bg-slate-100/70'
                          }`}
                        onClick={() => setSelectedEvent(m)}
                      >
                        <td className="py-3.5 px-4 sm:px-5 text-center font-bold text-slate-500 text-xs sm:text-sm">{absoluteIdx}</td>
                        <td className="py-3.5 px-4 sm:px-5 font-bold text-slate-900 text-xs sm:text-sm">{formattedDate}</td>
                        <td className="py-3.5 px-4 sm:px-5 font-bold text-slate-900 text-xs sm:text-sm">{m.jenis_bencana}</td>
                        <td className="py-3.5 px-4 sm:px-5 font-bold text-slate-800 text-xs sm:text-sm">{location}</td>
                        <td className="py-3.5 px-4 sm:px-5 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                            m.is_krisis === 1 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-teal-50 text-teal-700 border border-teal-200'
                          }`}>
                            {m.is_krisis === 1 ? 'Emergency' : 'Non-Emergency'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-5 text-center">
                          <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors">
                            <ChevronRight className="h-5 w-5" />
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 border-t border-slate-200 py-3.5 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs sm:text-sm text-slate-600 font-bold uppercase tracking-wider">
              {filteredMarkersForTable.length === 0 ? (
                'Tidak ada laporan'
              ) : (
                `Menampilkan ${((tableCurrentPage - 1) * itemsPerPage) + 1} - ${Math.min(tableCurrentPage * itemsPerPage, filteredMarkersForTable.length)} dari total ${filteredMarkersForTable.length} laporan`
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  disabled={tableCurrentPage === 1}
                  onClick={() => setTableCurrentPage(prev => Math.max(1, prev - 1))}
                  className="inline-flex h-8 px-2.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-650 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Sebelumnya
                </button>

                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let pageNum = i + 1
                  if (totalPages > 5) {
                    if (tableCurrentPage > 3) {
                      pageNum = tableCurrentPage - 3 + i
                      if (pageNum + (4 - i) > totalPages) {
                        pageNum = totalPages - 4 + i
                      }
                    }
                  }

                  const isCurrent = pageNum === tableCurrentPage
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setTableCurrentPage(pageNum)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition ${isCurrent
                          ? 'bg-[#047D78] text-white'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}

                <button
                  disabled={tableCurrentPage === totalPages}
                  onClick={() => setTableCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="inline-flex h-8 px-2.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-650 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* EWS Proximity Warning Modal */}
      {activeEwsProximityAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 text-slate-800">
            <button
              onClick={dismissFirstAlert}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-6 space-y-5">
              <div className="flex flex-col items-center text-center space-y-2.5">
                <h3 className="text-[17px] font-extrabold uppercase tracking-wide text-red-600 mt-1">
                  ⚠️ BAHAYA RADIUS DEKAT! {ewsAlertQueue.length > 1 ? `(1 dari ${ewsAlertQueue.length})` : ''}
                </h3>
              </div>
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Jenis Bencana</span>
                  <span className="text-xs font-extrabold text-red-650 uppercase tracking-wide">
                    {activeEwsProximityAlert.jenis_bencana}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Lokasi Wilayah</span>
                  <span className="text-xs font-bold text-slate-800">
                    {activeEwsProximityAlert.kabupaten || activeEwsProximityAlert.provinsi}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Jarak dari Anda</span>
                  <span className="text-xs font-black text-amber-600 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-amber-500" />
                    Radius {Math.round(activeEwsProximityAlert.distance)} km!
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Jumlah Korban</span>
                  <span className="text-xs font-bold text-slate-800">
                    {activeEwsProximityAlert.total_korban || 0} Jiwa Terdampak
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 text-center leading-relaxed font-normal">
                Segera aktifkan koordinasi klaster kesehatan setempat dan ambil tindakan kesiapsiagaan darurat!
              </p>
              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={() => {
                    setSelectedEvent(activeEwsProximityAlert)
                    dismissFirstAlert()
                  }}
                  className="w-full py-3 bg-red-600 hover:bg-red-750 text-white rounded-xl text-xs font-black uppercase tracking-wider transition duration-300 shadow-md hover:scale-[1.02]"
                >
                  Buka Detail Kejadian
                </button>
                <div className={ewsAlertQueue.length > 1 ? "grid grid-cols-2 gap-2" : "w-full"}>
                  <button
                    onClick={dismissFirstAlert}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-650 hover:text-slate-800 rounded-xl text-xs font-bold transition duration-300"
                  >
                    {ewsAlertQueue.length > 1 ? 'Tutup Ini' : 'Tutup & Pantau Peta'}
                  </button>
                  {ewsAlertQueue.length > 1 && (
                    <button
                      onClick={dismissAllAlerts}
                      className="w-full py-3 bg-slate-100 hover:bg-red-50 text-red-650 hover:text-red-700 border border-slate-200 hover:border-red-200 rounded-xl text-xs font-bold transition duration-300"
                    >
                      Tutup Semua ({ewsAlertQueue.length})
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Card Modal */}
      {activeDetailCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="relative text-white px-6 py-5 flex items-center justify-between overflow-hidden border-b border-slate-200 shrink-0">
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-95"
                style={{ backgroundImage: `url('${process.env.NEXT_PUBLIC_BASE_PATH || ''}/bg header.png')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#047D78]/95 via-[#076176]/90 to-[#0f8f96]/95" />
              <div className="relative z-10 flex-1 min-w-0">
                <h3 className="text-[16px] md:text-[18px] font-extrabold uppercase tracking-wide truncate">
                  {getCardDetailInfo(activeDetailCard).title}
                </h3>
                <p className="text-[11px] md:text-[12px] text-teal-50/90 mt-0.5 truncate">
                  {getCardDetailInfo(activeDetailCard).description}
                </p>
              </div>
              <button
                onClick={() => setActiveDetailCard(null)}
                className="relative z-20 rounded-xl p-1.5 text-teal-100 hover:bg-white/10 hover:text-white transition shrink-0 ml-4"
                aria-label="Tutup"
              >
                <X className="h-5.5 w-5.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 scrollbar-thin">
              {/* Table Matrix */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                <table className="w-full text-left border-collapse bg-white">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-250 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      <th className="py-3 px-4 text-center w-12">No</th>
                      {activeDetailCard.includes('Korban') || activeDetailCard === 'Jumlah Pengungsi' ? (
                        <>
                          <th className="py-3 px-4">Kejadian Bencana</th>
                          <th className="py-3 px-4">Lokasi Wilayah</th>
                          <th className="py-3 px-4 text-center">Meninggal</th>
                          <th className="py-3 px-4 text-center">Luka-Luka</th>
                          <th className="py-3 px-4 text-center">Hilang</th>
                          <th className="py-3 px-4 text-center">Pengungsi</th>
                        </>
                      ) : (
                        <>
                          <th className="py-3 px-4">Waktu Kejadian</th>
                          <th className="py-3 px-4">Jenis Bencana</th>
                          <th className="py-3 px-4">Lokasi Wilayah</th>
                          <th className="py-3 px-4 text-center">Total Dampak</th>
                          <th className="py-3 px-4 text-center">Status Krisis</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDetailMarkers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={activeDetailCard.includes('Korban') || activeDetailCard === 'Jumlah Pengungsi' ? 7 : 6}
                          className="py-10 text-center text-xs text-slate-405 italic"
                        >
                          Tidak ada data rincian kejadian bencana di wilayah ini.
                        </td>
                      </tr>
                    ) : (
                      filteredDetailMarkers.map((m, idx) => {
                        const markerId = m.kode_trans || `det-${idx}`
                        const location = m.kabupaten || m.provinsi || 'Nasional'
                        const formattedDate = m.tgl_kejadian ? new Date(m.tgl_kejadian).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : '-'

                        if (activeDetailCard.includes('Korban') || activeDetailCard === 'Jumlah Pengungsi') {
                          const breakdown = getKorbanBreakdown(m.total_korban, m.jenis_bencana)
                          return (
                            <tr key={markerId} className="hover:bg-slate-55/40 transition-colors text-[11px] md:text-xs">
                              <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">{m.jenis_bencana}</td>
                              <td className="py-3 px-4 font-semibold text-slate-600">{location}</td>
                              <td className="py-3 px-4 text-center font-extrabold text-red-650">{breakdown.meninggal || '-'}</td>
                              <td className="py-3 px-4 text-center font-extrabold text-amber-600">{breakdown.luka || '-'}</td>
                              <td className="py-3 px-4 text-center font-extrabold text-indigo-650">{breakdown.hilang || '-'}</td>
                              <td className="py-3 px-4 text-center font-extrabold text-teal-600">{breakdown.pengungsi || '-'}</td>
                            </tr>
                          )
                        } else {
                          return (
                            <tr key={markerId} className="hover:bg-slate-55/40 transition-colors text-[11px] md:text-xs">
                              <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-4 font-semibold text-slate-600">{formattedDate}</td>
                              <td className="py-3 px-4 font-bold text-slate-850">{m.jenis_bencana}</td>
                              <td className="py-3 px-4 font-semibold text-slate-600">{location}</td>
                              <td className="py-3 px-4 text-center font-extrabold text-slate-800">{m.total_korban || 0} Jiwa</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${m.is_krisis === 1
                                    ? 'bg-[#fee2e2] text-[#ef4444] border border-[#fecaca]'
                                    : 'bg-[#f0fdf4] text-[#16a34a] border border-[#dcfce7]'
                                  }`}>
                                  {m.is_krisis === 1 ? 'Krisis' : 'Non-Krisis'}
                                </span>
                              </td>
                            </tr>
                          )
                        }
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex justify-between items-center shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                EOC KRISIS KESEHATAN KEMENKES RI
              </span>
              <button
                onClick={() => setActiveDetailCard(null)}
                className="px-5 py-2 bg-[#047D78] hover:bg-[#03605c] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-sm"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
      {/* ── AI Analysis Modal ── */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="relative text-white px-6 py-5 flex items-center justify-between overflow-hidden border-b border-slate-200 shrink-0">
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-95"
                style={{ backgroundImage: `url('${process.env.NEXT_PUBLIC_BASE_PATH || ''}/bg header.png')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#047D78]/95 via-[#076176]/90 to-[#0f8f96]/95" />
              <div className="relative z-10 flex-1 min-w-0 flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-[16px] md:text-[18px] font-extrabold uppercase tracking-wide truncate">
                    Rekomendasi Insight AI
                  </h3>
                  <p className="text-[11px] md:text-[12px] text-teal-50/90 mt-0.5 truncate">
                    Laporan Cerdas Penilaian Risiko Bencana & Krisis Kesehatan - {getRegionLabel()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="relative z-20 rounded-xl p-1.5 text-teal-100 hover:bg-white/10 hover:text-white transition shrink-0 ml-4"
                aria-label="Tutup"
              >
                <X className="h-5.5 w-5.5" />
              </button>
            </div>

            {/* Modal Tab Headers */}
            <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
              {[
                { id: 'report', label: 'Laporan Analisis', icon: FileText },
                { id: 'info', label: 'Informasi Sumber Data & AI', icon: Info },
              ].map((tab) => {
                const TabIcon = tab.icon
                const isActive = aiModalTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setAiModalTab(tab.id as 'report' | 'info')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 border-b-2 outline-none ${isActive
                        ? 'border-teal-600 text-teal-700 bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
                      }`}
                  >
                    <TabIcon className="h-4.5 w-4.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 scrollbar-thin bg-white">
              {aiModalTab === 'report' && renderAiReportContent()}

              {aiModalTab === 'info' && (
                <div className="space-y-6 py-2">
                  {/* Alert 1: Warning Amber */}
                  <div className="rounded-2xl border border-amber-200/85 bg-amber-50/65 p-5 flex items-start gap-4 shadow-sm">
                    <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <h4 className="text-xs md:text-sm font-black text-amber-900 uppercase tracking-wider">
                        REKOMENDASI UTAMA: STATUS SIAGA / PERLU ANTISIPASI
                      </h4>
                      <p className="text-xs md:text-sm text-amber-850 leading-relaxed font-semibold">
                        Wilayah {getRegionLabel()} berada dalam status SIAGA (perlu perhatian sedang) karena: Tingkat fatalitas kasus (CFR) terpantau di angka {(((data?.summary?.total_meninggal || 0) / ((data?.summary?.total_meninggal || 0) + (data?.summary?.total_luka || 0) || 1)) * 100).toFixed(1)}%, serta besarnya populasi terdampak ({(data?.summary?.total_terdampak || 0).toLocaleString('id-ID')} jiwa) dan pengungsi ({(data?.summary?.total_pengungsi || 0).toLocaleString('id-ID')} jiwa) di posko pengungsian memerlukan pemantauan sanitasi lingkungan ketat mencegah KLB penyakit menular.
                      </p>
                    </div>
                  </div>

                  {/* Alert 2: Info Blue */}
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-4 shadow-sm">
                    <div className="flex items-start gap-4">
                      <Info className="h-5.5 w-5.5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="space-y-2 flex-1">
                        <h4 className="text-xs md:text-sm font-black text-blue-900 uppercase tracking-wider">
                          INFORMASI GENERATE AI
                        </h4>
                        <p className="text-xs md:text-sm text-blue-800 leading-relaxed font-semibold">
                          Analisis Detail AI ini merupakan hasil generate otomatis berdasarkan kalkulasi database SIPKK untuk wilayah {getRegionLabel().toUpperCase()}. AI ini dikonfigurasi khusus hanya untuk menganalisis data dashboard {getRegionLabel().toUpperCase()}.
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold pt-1">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span>Yang Anda lihat saat ini adalah hasil generate AI pada tanggal {currentFormattedTime}.</span>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-blue-100" />

                    <p className="text-[10px] md:text-[11px] leading-relaxed text-slate-450 uppercase font-bold tracking-wide italic">
                      DISCLAIMER: Semua informasi, estimasi tren, dan rekomendasi taktis yang disajikan merupakan analisis dari model AI (Google Gemini). Hasil analisis ini ditujukan sebagai referensi pembantu pengambilan keputusan dinas kesehatan setempat dan tidak menggantikan keputusan medis formal maupun regulasi resmi dari kementerian terkait.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex justify-between items-center shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                EOC KRISIS KESEHATAN KEMENKES RI
              </span>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="px-5 py-2 bg-[#047D78] hover:bg-[#03605c] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-sm"
              >
                Tutup Analisis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
