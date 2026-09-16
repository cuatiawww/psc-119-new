'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Ambulance,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Hospital,
  Info,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Route,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { getPscServiceCategory } from '@/lib/pscServiceCategory'
import { getPscResponseMinutes } from '@/lib/pscResponseTime'

const DisasterMap = dynamic(() => import('./DisasterMap'), { ssr: false })

interface DetailPanggilanPageProps {
  selectedEvent: any
  onBack: () => void
  hideBack?: boolean
}

const firstValue = (...values: any[]) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '')

const textValue = (...values: any[]) => {
  const value = firstValue(...values)
  return value === undefined ? 'Tidak tersedia' : String(value)
}

const numberValue = (...values: any[]) => {
  const value = firstValue(...values)
  if (value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && Math.abs(parsed) > 0.00001 ? parsed : null
}

const proximityScore = (originLat: number | null, originLng: number | null, lat: number | null, lng: number | null) => {
  if (originLat === null || originLng === null || lat === null || lng === null) return Number.POSITIVE_INFINITY
  const lngScale = Math.cos((originLat * Math.PI) / 180) || 1
  const latDelta = (lat - originLat) * 111
  const lngDelta = (lng - originLng) * 111 * lngScale
  return Math.sqrt((latDelta * latDelta) + (lngDelta * lngDelta))
}

const maskName = (value: any) => {
  const name = String(value || '').trim()
  if (!name) return 'Tidak tersedia'
  if (name.length <= 2) return `${name[0]}*`
  return `${name[0]}${'*'.repeat(Math.min(5, Math.max(2, name.length - 2)))}${name[name.length - 1]}`
}

const normalizeDateLabel = (value: any) => {
  if (!value) return 'Tidak tersedia'
  const raw = String(value).replace(/\s*WIB/i, '').trim()
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  return String(value)
}

const normalizeTime = (value: any) => {
  if (!value) return 'Tidak tersedia'
  const match = String(value).match(/(\d{1,2}:\d{2}(?::\d{2})?)/)
  return match ? `${match[1]} WIB` : String(value)
}

const sameId = (item: any, ticketId: string) => {
  const ids = [item?.ticket_id, item?.kode_pelaporan_panggilan, item?.kode_trans, item?.id]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value))
  return ids.includes(ticketId)
}

const getStatus = (call: any) => {
  const raw = String(firstValue(call?.status_penanganan_code, call?.status_penanganan) || '').trim()
  const lower = raw.toLowerCase()
  if (lower.includes('selesai') || lower.includes('complete') || lower.includes('closed')) {
    return { label: raw || 'Selesai', tone: 'emerald', completed: true }
  }
  if (lower.includes('batal') || lower.includes('cancel')) {
    return { label: raw || 'Dibatalkan', tone: 'rose', completed: true }
  }
  return { label: raw || 'Diproses', tone: 'amber', completed: false }
}

const DetailItem = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: any }) => (
  <div className="flex min-w-0 gap-3 border-b border-slate-100 py-3 last:border-b-0">
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 break-words text-sm font-bold text-slate-800">{value}</p>
    </div>
  </div>
)

const MetricCard = ({ label, value, hint, icon: Icon, tone = 'teal' }: { label: string; value: React.ReactNode; hint: string; icon: any; tone?: 'teal' | 'blue' | 'amber' | 'slate' | 'rose' }) => {
  const tones = {
    teal: 'border-teal-200 bg-teal-50/60 text-teal-700',
    blue: 'border-sky-200 bg-sky-50/60 text-sky-700',
    amber: 'border-amber-200 bg-amber-50/60 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    rose: 'border-rose-200 bg-rose-50/60 text-rose-700',
  }
  return (
    <div className={`rounded-2xl border p-4 shadow-[0_4px_14px_rgba(15,118,110,0.04)] ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider opacity-75">{label}</p>
          <p className="mt-2 line-clamp-2 text-lg font-black leading-tight text-slate-900">{value}</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">{hint}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
    </div>
  )
}

export default function DetailPanggilanPage({ selectedEvent, onBack, hideBack }: DetailPanggilanPageProps) {
  const selectedRaw = selectedEvent?.raw_psc || selectedEvent || {}
  const ticketId = String(firstValue(selectedEvent?.ticket_id, selectedEvent?.kode_trans, selectedRaw?.ticket_id, selectedRaw?.kode_pelaporan_panggilan) || '')
  const initialCall = useMemo(() => ({ ...selectedRaw, ...selectedEvent }), [selectedEvent, selectedRaw])
  const [call, setCall] = useState<any>(initialCall)
  const [hospitals, setHospitals] = useState<any[]>([])
  const [resourceAmbulances, setResourceAmbulances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [routeCoords, setRouteCoords] = useState<number[][]>([])
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null)

  useEffect(() => {
    let active = true
    const initial = initialCall
    const rawDate = firstValue(initial.tanggal_panggilan, initial.tgl_pelaporan_panggilan, initial.tgl_kejadian, '')
    const yearMatch = String(rawDate).match(/(20\d{2})/)
    const year = yearMatch?.[1] || '2026'
    const kodePsc = String(firstValue(initial.kode_psc, selectedRaw.kode_psc) || '')

    const fetchCall = fetch(`/api/psc/panggilan?ticket_id=${encodeURIComponent(ticketId)}&tahun=${year}&per_page=100`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const rows = Array.isArray(payload?.data) ? payload.data : []
        const matched = rows.find((item: any) => sameId(item, ticketId))
        if (active && matched) setCall({ ...initial, ...matched, raw_psc: matched })
      })
      .catch(() => {
        if (active) setError('Endpoint detail panggilan tidak dapat dihubungi.')
      })

    const fetchCenter = kodePsc
      ? fetch(`/api/psc/centers?kode_psc=${encodeURIComponent(kodePsc)}`, { cache: 'no-store' })
          .then((response) => response.ok ? response.json() : null)
          .then((payload) => {
            const center = payload?.data?.[0]
            const nested = center?.data_rumahsakit_sarana || center?.rumahsakit || center?.rumah_sakit || []
            if (active && Array.isArray(nested)) setHospitals(nested)
          })
          .catch(() => undefined)
      : Promise.resolve()

    Promise.all([fetchCall, fetchCenter]).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [initialCall, selectedEvent, ticketId])

  const status = useMemo(() => getStatus(call), [call])
  const responseMinutes = useMemo(() => getPscResponseMinutes({
    response_time_minutes: call?.response_time_minutes,
    waktu_respons: call?.waktu_respons,
    jam_pelaporan_panggilan: call?.jam_pelaporan_panggilan,
    tgl_status_penanganan: call?.tgl_status_penanganan,
  }), [call])
  const category = useMemo(() => getPscServiceCategory({
    jenis_layanan: firstValue(call?.jenis_layanan, call?.kategori_layanan),
    id_jenis_layanan: call?.id_jenis_layanan,
  }), [call])

  const callLat = numberValue(call?.latitude, call?.lat, selectedEvent?.lat)
  const callLng = numberValue(call?.longitude, call?.lng, selectedEvent?.lng)
  const callKodePsc = String(firstValue(call?.kode_psc, selectedRaw?.kode_psc) || '').trim()
  const callYear = String(firstValue(call?.tanggal_panggilan, call?.tgl_pelaporan_panggilan, '')).match(/(20\d{2})/)?.[1] || '2026'
  const referralName = String(firstValue(call?.rumahsakit_rujukan, call?.nama_rumahsakit_rujukan, call?.rumah_sakit_tujuan) || '').trim()

  useEffect(() => {
    if (!callKodePsc) return
    let active = true
    fetch(`/api/bencana-stats?kode_psc=${encodeURIComponent(callKodePsc)}&year=${callYear}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!active) return
        if (Array.isArray(payload?.hospitals) && payload.hospitals.length > 0) setHospitals(payload.hospitals)
        setResourceAmbulances(Array.isArray(payload?.ambulances) ? payload.ambulances : [])
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [callKodePsc, callYear])

  const normalizedHospitals = useMemo(() => hospitals.map((hospital: any, index: number) => ({
    ...hospital,
    id: hospital.id || `hospital-${index}`,
    nama: firstValue(hospital.nama, hospital.nama_rs, hospital.nama_rumah_sakit, hospital.name) || 'Rumah Sakit Rujukan',
    lat: numberValue(hospital.latitude, hospital.lat),
    lng: numberValue(hospital.longitude, hospital.lng, hospital.lon),
  })).filter((hospital: any) => hospital.lat !== null && hospital.lng !== null), [hospitals])

  const nearestHospital = useMemo(() => normalizedHospitals
    .slice()
    .sort((a: any, b: any) => proximityScore(callLat, callLng, a.lat, a.lng) - proximityScore(callLat, callLng, b.lat, b.lng))[0] || null, [callLat, callLng, normalizedHospitals])

  const referralHospital = useMemo(() => {
    const direct = {
      nama: referralName,
      lat: numberValue(call?.latitude_rumahsakit, call?.latitude_rs, call?.rs_latitude, call?.rumahsakit_latitude),
      lng: numberValue(call?.longitude_rumahsakit, call?.longitude_rs, call?.rs_longitude, call?.rumahsakit_longitude),
    }
    if (direct.nama && direct.lat !== null && direct.lng !== null) return direct
    if (referralName) {
      const needle = referralName.toLowerCase().replace(/[^a-z0-9]/g, '')
      const matched = normalizedHospitals.find((hospital: any) => String(hospital.nama).toLowerCase().replace(/[^a-z0-9]/g, '').includes(needle) || needle.includes(String(hospital.nama).toLowerCase().replace(/[^a-z0-9]/g, '')))
      if (matched) return matched
    }
    return nearestHospital
  }, [call, nearestHospital, normalizedHospitals, referralName])

  const mapHospitals = useMemo(() => {
    const candidates = [nearestHospital, referralHospital].filter(Boolean) as any[]
    const unique = new Map<string, any>()
    candidates.forEach((hospital) => {
      const key = `${hospital.lat}:${hospital.lng}`
      if (!unique.has(key)) unique.set(key, hospital)
    })
    return Array.from(unique.values())
  }, [nearestHospital, referralHospital])

  const ambulance = useMemo(() => {
    const callLatAmbulance = numberValue(call?.latitude_ambulan, call?.lat_ambulan, call?.ambulance_latitude, call?.lat_ambulance)
    const callLngAmbulance = numberValue(call?.longitude_ambulan, call?.lng_ambulan, call?.ambulance_longitude, call?.lng_ambulance)
    const callAmbulance = callLatAmbulance !== null && callLngAmbulance !== null ? [{
      id_ambulan: call?.id_ambulan || `dispatch-${ticketId}`,
      kode_ambulan: call?.nomor_kendaraan || call?.id_ambulan || 'Ambulans PSC',
      no_kendaraan: call?.nomor_kendaraan || 'Ambulans PSC 119',
      nama_psc: call?.nama_psc,
      status_aktif: status.completed ? '1' : 'Sedang Bertugas',
      lat: callLatAmbulance,
      lng: callLngAmbulance,
    }] : []
    const apiAmbulances = resourceAmbulances.map((item: any, index: number) => ({
      ...item,
      id_ambulan: item.id_ambulan || `ambulance-${index}`,
      lat: numberValue(item.latitude, item.lat),
      lng: numberValue(item.longitude, item.lng, item.lon),
    })).filter((item: any) => item.lat !== null && item.lng !== null)
    return [...apiAmbulances, ...callAmbulance]
      .sort((a: any, b: any) => proximityScore(callLat, callLng, a.lat, a.lng) - proximityScore(callLat, callLng, b.lat, b.lng))
      .slice(0, 1)
  }, [call, callLat, callLng, resourceAmbulances, status.completed, ticketId])

  const marker = useMemo(() => {
    if (callLat === null || callLng === null) return []
    return [{
      marker_type: 'call',
      kode_trans: ticketId,
      ticket_id: ticketId,
      tgl_kejadian: firstValue(call?.tanggal_panggilan, call?.tgl_pelaporan_panggilan, ''),
      jenis_bencana: firstValue(call?.spesifikasi_layanan, call?.jenis_layanan, 'Panggilan PSC 119'),
      kategori_layanan: call?.kategori_layanan,
      jenis_layanan: call?.jenis_layanan,
      spesifikasi_layanan: call?.spesifikasi_layanan,
      status_penanganan_code: call?.status_penanganan_code,
      provinsi: call?.provinsi,
      kabupaten: call?.kabupaten,
      nama_desa: call?.nama_lokasi || call?.alamat,
      lat: callLat,
      lng: callLng,
      icon_file: category === 'Emergency' ? 'icon_krisis_red.png' : 'icon_krisis_yellow.png',
      total_korban: 1,
    }]
  }, [call, callLat, callLng, category, ticketId])

  const routeTarget = useMemo(() => {
    if (!referralHospital || referralHospital.lat === null || referralHospital.lng === null) return null
    return {
      id: String(referralHospital.id || referralHospital.nama),
      name: String(referralHospital.nama),
      latitude: Number(referralHospital.lat),
      longitude: Number(referralHospital.lng),
      type: 'hospital' as const,
    }
  }, [referralHospital])

  useEffect(() => {
    if (!routeTarget || callLat === null || callLng === null) {
      return
    }

    let active = true
    const fallback = [[callLng, callLat], [routeTarget.longitude, routeTarget.latitude]]
    const url = `https://router.project-osrm.org/route/v1/driving/${callLng},${callLat};${routeTarget.longitude},${routeTarget.latitude}?overview=full&geometries=geojson`
    fetch(url)
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return
        const route = payload?.routes?.[0]
        if (payload?.code === 'Ok' && route?.geometry?.coordinates) {
          setRouteCoords(route.geometry.coordinates)
          setRouteInfo({ distance: route.distance / 1000, duration: route.duration / 60 })
        } else {
          setRouteCoords(fallback)
        }
      })
      .catch(() => {
        if (active) setRouteCoords(fallback)
      })
    return () => { active = false }
  }, [callLat, callLng, routeTarget])

  const timeline = useMemo(() => {
    const receivedAt = `${normalizeDateLabel(firstValue(call?.tanggal_panggilan, call?.tgl_pelaporan_panggilan))} · ${normalizeTime(call?.jam_pelaporan_panggilan)}`
    const dispatched = Boolean(firstValue(call?.nomor_kendaraan, call?.nama_petugas_ambulan, call?.id_ambulan, call?.layanan_ambulance))
    const completedAt = firstValue(call?.tgl_status_penanganan, call?.tanggal_selesai, call?.waktu_selesai)
    return [
      { label: 'Panggilan diterima', time: receivedAt, state: 'done', icon: Phone },
      { label: 'Ambulan ditugaskan', time: dispatched ? textValue(call?.tgl_penugasan, call?.waktu_penugasan, 'Waktu tidak tersedia') : 'Belum tersedia', state: dispatched ? 'done' : 'pending', icon: Ambulance },
      { label: 'Penanganan selesai', time: status.completed ? normalizeDateLabel(completedAt || call?.tanggal_panggilan) : 'Belum selesai', state: status.completed ? 'done' : 'current', icon: status.completed ? CheckCircle2 : Clock3 },
    ]
  }, [call, status.completed])

  const displayStatusClass = status.tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status.tone === 'rose'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'

  if (loading) {
    return (
      <div className="w-full space-y-5 bg-[#fbffff] px-4 py-5 sm:px-6 lg:px-8 animate-pulse">
        <div className="h-8 w-72 rounded-xl bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 rounded-2xl border border-slate-200 bg-white" />)}
        </div>
        <div className="h-[580px] rounded-2xl border border-slate-200 bg-slate-100" />
      </div>
    )
  }

  return (
    <div className="w-full space-y-5 overflow-x-hidden bg-[#fbffff] px-3 py-4 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {!hideBack && (
            <button type="button" onClick={onBack} className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50" title="Kembali ke dashboard">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-teal-700">Detail Panggilan</span>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${displayStatusClass}`}>{status.label}</span>
            </div>
            <h1 className="truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl">Detail Panggilan PSC 119</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
              <span className="font-mono text-slate-700">No. Tiket: {textValue(ticketId)}</span>
              <span className="text-slate-300">•</span>
              <span>{normalizeDateLabel(firstValue(call?.tanggal_panggilan, call?.tgl_pelaporan_panggilan))}</span>
              <span>{normalizeTime(call?.jam_pelaporan_panggilan)}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-3 py-1.5 text-[11px] font-black ${category === 'Emergency' ? 'bg-rose-50 text-rose-700' : category === 'Non Emergency' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{category}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600"><Radio className="h-3.5 w-3.5 text-teal-600" /> PSC 119</span>
        </div>
      </header>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800"><Info className="mr-2 inline h-4 w-4" />Data terbaru tidak berhasil dimuat. Menampilkan data yang tersedia pada daftar panggilan.</div>}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Waktu Respons" value={responseMinutes !== null ? `${responseMinutes} menit` : 'Tidak tersedia'} hint="Dari waktu respons API" icon={Clock3} tone="blue" />
        <MetricCard label="Status Penanganan" value={status.label} hint="Status terakhir dari API" icon={status.completed ? CheckCircle2 : Clock3} tone={status.completed ? 'teal' : 'amber'} />
        <MetricCard label="Armada Ditugaskan" value={textValue(call?.nomor_kendaraan, call?.layanan_ambulance)} hint="Nomor kendaraan / layanan" icon={Ambulance} tone="teal" />
        <MetricCard label="PSC Penanggung Jawab" value={textValue(call?.nama_psc, call?.kode_psc)} hint="Unit pengelola panggilan" icon={ShieldCheck} tone="slate" />
        <MetricCard label="Rumah Sakit Tujuan" value={textValue(referralName)} hint="Fasilitas rujukan panggilan" icon={Hospital} tone="rose" />
        <MetricCard label="Sumber Panggilan" value={textValue(call?.sumber_panggilan)} hint="Kanal masuk laporan" icon={Phone} tone="amber" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,118,110,0.04)]">
          <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-3"><FileText className="h-5 w-5 text-teal-700" /><h2 className="text-base font-black uppercase tracking-wide text-slate-900">Informasi Panggilan</h2></div>
          <div className="grid grid-cols-1 gap-x-7 md:grid-cols-2">
            <DetailItem label="Kategori layanan" value={textValue(call?.kategori_layanan, category)} icon={ShieldCheck} />
            <DetailItem label="Spesifikasi layanan" value={textValue(call?.spesifikasi_layanan, call?.jenis_layanan)} icon={Info} />
            <DetailItem label="Nama pelapor" value={maskName(call?.nama_pelapor)} icon={UserRound} />
            <DetailItem label="Nomor telepon" value={textValue(call?.telp, call?.nomor_telepon)} icon={Phone} />
            <DetailItem label="Keluhan / kebutuhan" value={textValue(call?.keluhan, call?.keterangan)} icon={FileText} />
            <DetailItem label="Korban" value={textValue(call?.korban)} icon={UserRound} />
            <DetailItem label="Tanggal panggilan" value={normalizeDateLabel(firstValue(call?.tanggal_panggilan, call?.tgl_pelaporan_panggilan))} icon={CalendarDays} />
            <DetailItem label="Jam panggilan" value={normalizeTime(call?.jam_pelaporan_panggilan)} icon={Clock3} />
          </div>
          <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/70 px-3.5 py-3 text-[11px] font-semibold leading-relaxed text-sky-800"><Info className="mr-1.5 inline h-3.5 w-3.5" />Data pribadi pelapor ditampilkan secara tersamar untuk menjaga privasi.</div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,118,110,0.04)]">
          <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-3"><MapPin className="h-5 w-5 text-teal-700" /><h2 className="text-base font-black uppercase tracking-wide text-slate-900">Lokasi Kejadian</h2></div>
          <div className="grid grid-cols-1 gap-x-7 md:grid-cols-2">
            <DetailItem label="Alamat lengkap" value={textValue(call?.nama_lokasi, call?.alamat)} icon={MapPin} />
            <DetailItem label="Provinsi" value={textValue(call?.provinsi)} icon={Navigation} />
            <DetailItem label="Kabupaten / Kota" value={textValue(call?.kabupaten, call?.nama_kab)} icon={Navigation} />
            <DetailItem label="Kecamatan" value={textValue(call?.kecamatan)} icon={Navigation} />
            <DetailItem label="Koordinat" value={callLat !== null && callLng !== null ? `${callLat.toFixed(6)}, ${callLng.toFixed(6)}` : 'Tidak tersedia'} icon={MapPin} />
          </div>
          {callLat !== null && callLng !== null && <a className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-teal-700 hover:text-teal-900" href={`https://www.google.com/maps/search/?api=1&query=${callLat},${callLng}`} target="_blank" rel="noreferrer">Buka lokasi di Maps <Navigation className="h-3.5 w-3.5" /></a>}
        </article>
      </section>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_14px_rgba(15,118,110,0.04)] sm:p-5">
        <div className="mb-4 flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><Route className="h-5 w-5 text-teal-700" /><h2 className="text-base font-black uppercase tracking-wide text-slate-900">Lokasi Panggilan dan Penanganan Ambulans</h2></div><p className="mt-1 text-xs font-medium text-slate-500">Peta interaktif menggunakan komponen peta PSC yang sama dengan dashboard.</p></div>
          <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-600"><span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-rose-700"><MapPin className="h-3 w-3" /> Lokasi panggilan</span><span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-sky-700"><Route className="h-3 w-3" /> Rute</span><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700"><Hospital className="h-3 w-3" /> Rumah sakit</span></div>
        </div>
        <div className="h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-[620px]">
          <DisasterMap
            markers={marker as any}
            ambulances={ambulance}
            hospitals={mapHospitals}
            isGuest={false}
            isFloodEocMode={true}
            isCallDetailMode={true}
            selectedRouteTarget={routeTarget}
            routeCoords={routeCoords}
            routeInfo={routeInfo}
            selectedRouteSource={callLat !== null && callLng !== null ? { id: `call-${ticketId}`, name: 'Lokasi Panggilan', latitude: callLat, longitude: callLng, type: 'kejadian' } : null}
            disasterType="panggilan"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 text-[11px] font-semibold text-slate-600">
          {routeInfo ? <><span>Jarak rute: <strong className="text-slate-900">{routeInfo.distance.toFixed(1)} km</strong></span><span>Estimasi perjalanan: <strong className="text-slate-900">{Math.round(routeInfo.duration)} menit</strong></span></> : <span>{referralName ? 'Koordinat rute rumah sakit belum tersedia dari API.' : 'Rumah sakit tujuan belum tersedia dari data API.'}</span>}
        </div>
      </article>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,118,110,0.04)]">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3"><Ambulance className="h-5 w-5 text-teal-700" /><h2 className="text-base font-black uppercase tracking-wide text-slate-900">Dispatch Ambulans</h2></div>
          <div className="grid grid-cols-1 gap-x-7 md:grid-cols-2"><DetailItem label="Nomor kendaraan" value={textValue(call?.nomor_kendaraan)} icon={Ambulance} /><DetailItem label="Nama petugas ambulans" value={textValue(call?.nama_petugas_ambulan, call?.nama_petugas_ambulan_lainnya)} icon={UserRound} /><DetailItem label="Jenis layanan" value={textValue(call?.layanan_ambulance)} icon={Route} /><DetailItem label="Status armada" value={status.label} icon={status.completed ? CheckCircle2 : Clock3} /><DetailItem label="Waktu penugasan" value={textValue(call?.tgl_penugasan, call?.waktu_penugasan)} icon={Clock3} /><DetailItem label="Rumah sakit / fasilitas tujuan" value={textValue(referralName)} icon={Hospital} /></div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,118,110,0.04)]">
          <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3"><Clock3 className="h-5 w-5 text-teal-700" /><h2 className="text-base font-black uppercase tracking-wide text-slate-900">Timeline Penanganan</h2></div>
          <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-2">
            <div className="absolute left-5 right-5 top-5 hidden h-0.5 bg-slate-200 sm:block" />
            {timeline.map((item: any) => {
              const Icon = item.icon
              const active = item.state === 'done'
              return <div key={item.label} className="relative flex items-center gap-3 sm:flex-col sm:items-center sm:text-center"><span className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-white shadow-sm ${active ? 'bg-teal-600 text-white' : item.state === 'current' ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-500'}`}><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-xs font-black text-slate-800">{item.label}</p><p className="mt-1 text-[10px] font-semibold leading-relaxed text-slate-500">{item.time}</p></div></div>
            })}
          </div>
        </article>
      </section>

      <footer className="flex flex-col gap-2 border-t border-slate-200 pt-4 text-[11px] font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Sumber data: API PSC 119 Kemenkes RI</span><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-teal-600" /> Data ditampilkan sesuai ketersediaan endpoint</span></footer>
    </div>
  )
}
