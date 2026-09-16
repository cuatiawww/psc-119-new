'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDisasterName } from '@/lib/utils/disasterUtils'
import { Loader2, Settings, X, MapPin, Eye, EyeOff, Globe, Layers, Info, Clock, AlertTriangle, Compass, Activity, RotateCcw, Wind, Building2, Tent, Ambulance, User, Phone, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/lib/authStore'




// OpenLayers core
import OlMap from 'ol/Map'
import View from 'ol/View'
import GeoJSON from 'ol/format/GeoJSON'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import TileArcGISRest from 'ol/source/TileArcGISRest'
import { Fill, Stroke, Style, Circle as CircleStyle, Icon, Text as OlText } from 'ol/style'
import { fromLonLat, toLonLat } from 'ol/proj'
import { defaults as defaultControls } from 'ol/control'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import Overlay from 'ol/Overlay'
import CircleGeom from 'ol/geom/Circle'
import 'ol/ol.css'
import { WindLayer } from 'ol-wind'

function maskPersonName(name: string): string {
  if (!name || name === '-') return '-'
  const parts = name.split(',')
  const mainName = parts[0].trim()
  const degrees = parts.slice(1).join(',').trim()

  const knownPrefixes = new Set(['dr.', 'dr', 'drg.', 'drg', 'ns.', 'ns', 'apt.', 'apt', 'bdn.', 'bdn', 'prof.', 'prof', 'ir.', 'ir', 'drs.', 'drs', 'dra.', 'dra'])

  const words = mainName.split(/\s+/)
  const maskedWords = words.map(w => {
    const cleanWord = w.replace(/[^a-zA-Z.]/g, '')
    if (knownPrefixes.has(cleanWord.toLowerCase())) {
      return w
    }
    if (w.length <= 2) return w[0] + '*'
    if (w.length === 3) return w[0] + '*' + w[2]
    return w.substring(0, 1) + '***' + w.substring(w.length - 1)
  })

  const maskedMain = maskedWords.join(' ')
  return degrees ? `${maskedMain}, ${degrees}` : maskedMain
}

function destroyWindLayerSafely(wl: any) {
  if (!wl) return
  try { wl.setVisible?.(false) } catch { }
  const obj = wl as unknown as Record<string, unknown>
  const tryCall = (k: string, arg?: unknown) => {
    const fn = obj[k]
    if (typeof fn === 'function') {
      try { (fn as (a?: unknown) => void)(arg) } catch { }
    }
  }
  tryCall('stop')
  tryCall('destroy')
  tryCall('dispose')
  tryCall('remove')
  tryCall('setMap', null)
  tryCall('setTarget', null)
}

function getLargestPolygonInteriorPoint(feature: any) {
  const geom = feature?.getGeometry?.()
  if (!geom) return null
  const type = geom.getType?.()
  if (type === 'MultiPolygon') {
    const polygons = geom.getPolygons()
    if (!polygons || polygons.length === 0) return null
    let maxArea = -1
    let largest = polygons[0]
    for (let i = 0; i < polygons.length; i++) {
      const a = polygons[i].getArea()
      if (a > maxArea) {
        maxArea = a
        largest = polygons[i]
      }
    }
    return largest.getInteriorPoint()
  } else if (type === 'Polygon') {
    return geom.getInteriorPoint()
  }
  return geom
}

function cleanFaskesLookupName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/^(rsud|rs\s*umum\s*daerah|rs\s*umum|rs|puskesmas|pkm|uptd|upt|klinik|pustu)\s+/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function getFaskesTriageData(rawItem?: any, name?: string, faskesList?: any[]) {
  let m = 0, k = 0, h = 0, ht = 0, total = 0, catatan = ''
  let found = false

  // 1. Direct fields if present on rawItem
  if (rawItem) {
    const rawM = rawItem.triase_merah ?? rawItem.merah ?? rawItem.korban_luka_berat ?? rawItem.luka_berat
    const rawK = rawItem.triase_kuning ?? rawItem.kuning
    const rawH = rawItem.triase_hijau ?? rawItem.hijau ?? rawItem.korban_luka_ringan ?? rawItem.luka_ringan
    const rawHt = rawItem.triase_hitam ?? rawItem.hitam ?? rawItem.korban_meninggal ?? rawItem.meninggal
    const rawTot = rawItem.total_pasien ?? rawItem.total ?? rawItem.korban_tertangani ?? rawItem.total_korban

    if (rawM !== undefined || rawK !== undefined || rawH !== undefined || rawHt !== undefined || rawTot !== undefined) {
      m = Math.max(0, Number(rawM || 0))
      k = Math.max(0, Number(rawK || 0))
      h = Math.max(0, Number(rawH || 0))
      ht = Math.max(0, Number(rawHt || 0))
      total = Number(rawTot ?? (m + k + h + ht))
      catatan = rawItem.catatan || rawItem.diagnosis || rawItem.catatan_triase || rawItem.catatan_pasien || ''
      if (m > 0 || k > 0 || h > 0 || ht > 0 || total > 0) {
        found = true
      }
    }
  }

  // 2. If triage breakdown is all 0 or not found, try cross-referencing with faskesList
  if ((!found || (m === 0 && k === 0 && h === 0 && ht === 0 && total > 0)) && Array.isArray(faskesList) && name) {
    const qName = cleanFaskesLookupName(name)
    const matched = faskesList.find((f: any) => {
      const fN = cleanFaskesLookupName(f.nama || f.nama_faskes || f.nama_master || '')
      return fN && (fN === qName || fN.includes(qName) || qName.includes(fN))
    })

    if (matched) {
      const fM = Number(matched.triase_merah || matched.merah || 0)
      const fK = Number(matched.triase_kuning || matched.kuning || 0)
      const fH = Number(matched.triase_hijau || matched.hijau || 0)
      const fHt = Number(matched.triase_hitam || matched.hitam || 0)
      const fTot = Number(matched.total_pasien || matched.total || (fM + fK + fH + fHt) || 0)

      if (fM > 0 || fK > 0 || fH > 0 || fHt > 0 || fTot > 0) {
        m = fM
        k = fK
        h = fH
        ht = fHt
        total = fTot || (m + k + h + ht)
        catatan = catatan || matched.catatan || matched.catatan_medis || matched.diagnosis || ''
        found = true
      }
    }
  }

  // If total > 0 but m, k, h, ht are all 0 (e.g. general casualty count only), assign to Hijau (Rawat Ringan/Jalan)
  if (total > 0 && m === 0 && k === 0 && h === 0 && ht === 0) {
    h = total
  }

  if (m === 0 && k === 0 && h === 0 && ht === 0 && total === 0 && !found) {
    return null
  }

  return { merah: m, kuning: k, hijau: h, hitam: ht, total: total || (m + k + h + ht), catatan }
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface MarkerData {
  kode_trans: string
  tgl_kejadian: string
  jenis_bencana: string
  kategori_bencana?: string
  lat: number
  lng: number
  provinsi?: string
  kabupaten?: string
  nama_kab?: string
  nama_desa?: string
  desa?: string
  kecamatan?: string
  topografi?: string
  total_korban: number
  meninggal?: number
  luka_berat?: number
  luka_ringan?: number
  pengungsi?: number
  terdampak?: number
  icon_file?: string
  jml_titik_lokasi?: number
  // PSC Fields
  kategori_layanan?: string
  jenis_layanan?: string
  nomor_kendaraan?: string
  nama_petugas_ambulan?: string
  status_penanganan_code?: string
  status_verifikasi?: string
  [key: string]: any
}

interface DisasterMapProps {
  markers: MarkerData[]
  ambulances?: any[]
  hospitals?: any[]
  selectedRegions?: any[]
  userScope?: any
  /** Fokus peta ke center PSC yang dipilih admin/tamu. */
  selectedPscCenter?: any | null
  onSelectProvince?: (prov: string) => void
  isGuest?: boolean
  /** Jumlah bulan ke belakang untuk menampilkan pin (0 = semua periode) */
  markerMonths?: number
  setMarkerMonths?: (val: number) => void
  onSelectEvent?: (event: MarkerData) => void
  // Flood EOC Routing Props
  isFloodEocMode?: boolean
  /** Mode detail panggilan: peta hanya menampilkan panggilan, ambulans, RS, dan rute. */
  isCallDetailMode?: boolean
  selectedRouteTarget?: {
    id: string
    name: string
    latitude: number
    longitude: number
    type: 'hospital' | 'clinic' | 'shelter' | 'tck'
  } | null
  routeCoords?: number[][]
  routeInfo?: { distance: number; duration: number } | null
  faskesList?: any[]
  poskoList?: any[]
  tckList?: any[]
  /** Daftar faskes yang terdampak/rusak (dari laporan RHA). Ditampilkan dengan pin merah dan popup info kerusakan. */
  faskesRusakList?: any[]
  onSelectRouteTarget?: (target: any, type: 'hospital' | 'clinic' | 'shelter' | 'tck') => void
  disasterType?: string
  selectedRouteSource?: any
  onSelectRouteSource?: (source: any) => void
  lokasiList?: any[]
  /** Real earthquake epicenter points from USGS/BMKG API */
  earthquakePoints?: Array<{ lat: number; lng: number; magnitude: number; depth: number; place: string; time: string; dateStr: string; dateLabel: string; distKm: number; isMainshock: boolean; mmi?: number; tsunami?: number }>
}

interface MarkerPopupState {
  data: MarkerData
  x: number   // pixel x di dalam container peta
  y: number   // pixel y di dalam container peta
  coord?: number[]
}

interface EocPopupState {
  rawItem: any
  type: 'hospital' | 'clinic' | 'pustu' | 'shelter' | 'disaster' | 'tck' | 'earthquake' | 'volcano'
  name: string
  address?: string
  lat: number
  lng: number
  distance?: number
  /** Apakah faskes ini masuk daftar terdampak/rusak bencana */
  isTerdampak?: boolean
  /** Info kerusakan dari data inputan RHA */
  dampakInfo?: {
    rusak_berat?: number
    rusak_sedang?: number
    rusak_ringan?: number
    kondisi_faskes?: string
    fungsi_pelayanan?: string
    jenis_faskes?: string
    status?: string
  }
  details?: {
    jenis?: string
    operasional?: string
    dokter?: number | string
    perawat?: number | string
    kapasitas?: number | string
    ambulans?: number | string
    pengungsi_jiwa?: number | string
    kontak?: string
    golongan?: string
    spesifikasi?: string
    organisasi?: string
    nama_tim_emt?: string
    pekerjaan?: string
    nomor_telp?: string
  }
  earthquakeInfo?: {
    magnitude: number
    depth: number
    place: string
    time: string
    dateStr?: string
    dateLabel?: string
    isMainshock: boolean
    mmi?: number | string
    tsunami?: number
    distKm?: number
    source?: string
  }
  volcanoInfo?: {
    level: 1 | 2 | 3 | 4
    status: string
    statusColor: string
    elevation: number
    hazardRadiusKm: number
    rekomendasi: string
    link: string
    provinsi: string
    kabupaten: string
  }
  x: number
  y: number
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getSvgVolcanoPin(level: number, color: string): string {
  const isHigh = level >= 3
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="36" viewBox="0 0 32 36">
    <path d="M16 35 C16 35 4 22 4 14 A12 12 0 0 1 28 14 C28 22 16 35 16 35 Z" fill="${color}" stroke="#ffffff" stroke-width="2.2" filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.3))"/>
    <path d="M10 20 L13 11 L19 11 L22 20 Z" fill="#ffffff" opacity="0.95"/>
    <path d="M13 11 L16 7 L19 11 Z" fill="#ffedd5" opacity="0.95"/>
    <circle cx="16" cy="8" r="2" fill="${isHigh ? '#ef4444' : '#f97316'}"/>
  </svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

function getSvgMainshockPin(mag: number): string {
  const magText = mag > 0 ? (mag >= 10 ? mag.toFixed(0) : mag.toFixed(1)) : '7.4'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54" fill="none">
    <circle cx="23" cy="20" r="19" fill="rgba(220, 38, 38, 0.25)" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3 3"/>
    <path d="M23 4C14.16 4 7 11.16 7 20C7 31 23 50 23 50S39 31 39 20C39 11.16 31.84 4 23 4Z" fill="#dc2626" stroke="#ffffff" stroke-width="2.5"/>
    <circle cx="23" cy="20" r="11" fill="#ffffff"/>
    <text x="23" y="24" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="900" fill="#991b1b">M ${magText}</text>
  </svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

function getSvgAftershockNode(mag: number): string {
  if (mag >= 6.0) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#b91c1c" stroke="#ffffff" stroke-width="2.5"/>
      <text x="12" y="15.5" text-anchor="middle" font-family="system-ui, sans-serif" font-size="8.5" font-weight="900" fill="#ffffff">${mag.toFixed(1)}</text>
    </svg>`
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
  }
  if (mag >= 5.0) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" fill="#ea580c" stroke="#ffffff" stroke-width="2"/>
      <text x="10" y="13" text-anchor="middle" font-family="system-ui, sans-serif" font-size="7.5" font-weight="900" fill="#ffffff">${mag.toFixed(1)}</text>
    </svg>`
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
  }
  if (mag >= 4.0) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="5.5" fill="#f59e0b" stroke="#ffffff" stroke-width="1.8"/>
    </svg>`
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
    <circle cx="5" cy="5" r="4" fill="#fbbf24" stroke="#ffffff" stroke-width="1.2"/>
  </svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

/** Normalisasi nama wilayah → key perbandingan (strip prefix, uppercase, tanpa spasi/simbol) */
const cleanKey = (name?: string | null) => {
  if (!name) return ''
  let cleaned = name
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/^(KABUPATEN|KAB|KOTA|PROVINSI|PROV|DAERAH ISTIMEWA|DI|DKI)\s+/gi, '')
    .trim()

  if (cleaned.includes('JAKARTA')) return 'JAKARTA'
  if (cleaned.includes('YOGYAKARTA')) return 'YOGYAKARTA'
  if (cleaned.includes('BANGKA')) return 'BANGKABELITUNG'
  if (cleaned.includes('KEPULAUAN RIAU') || cleaned === 'KEPRI') return 'KEPULAUANRIAU'
  if (cleaned === 'NTB' || cleaned.includes('NUSA TENGGARA BARAT')) return 'NUSATENGGARABARAT'
  if (cleaned === 'NTT' || cleaned.includes('NUSA TENGGARA TIMUR')) return 'NUSATENGGARATIMUR'

  return cleaned.replace(/[^A-Z0-9]/g, '')
}

/** Ambil nama provinsi dari properties feature OL (berbagai kemungkinan key) */
const getFeatureName = (feature: any, level: 'provinsi' | 'kabupaten') => {
  if (!feature) return ''
  const props = typeof feature.getProperties === 'function' ? feature.getProperties() : (feature.properties || {})
  const keys = level === 'provinsi'
    ? ['provinsi', 'PROVINSI', 'nama_prov', 'nama_provinsi', 'nm_prov', 'prov_single', 'prov_multi', 'WADMPR', 'NAME_1', 'NAMOBJ', 'Propinsi', 'PROV', 'prov', 'name', 'NAME']
    : ['nama_kab', 'NAMA_KAB', 'kabupaten', 'KABUPATEN', 'kab_single', 'kab_multi', 'WADMKK', 'WADMMP', 'NAME_2', 'NAMOBJ', 'nama', 'name', 'KAB_KOTA', 'kab_kota', 'nm_kab', 'nmkab', 'KABKOT', 'kab']
  for (const key of keys) {
    if (props[key] !== undefined && props[key] !== null && String(props[key]).trim() !== '') return String(props[key]).trim()
  }
  return ''
}

/** Warna choropleth berdasarkan jumlah kejadian sesuai legenda (Kemenkes / Inarisk Style seperti D:\project\puskes) */
const choroplethColor = (count: number, opacity: number = 0.92) => {
  if (count === 0) return `rgba(241, 245, 249, ${opacity * 0.6})`
  if (count <= 10) return `rgba(234, 179, 8, ${opacity})`        // Kuning (1 - 10)
  if (count <= 30) return `rgba(249, 115, 22, ${opacity})`       // Oranye (11 - 30)
  if (count <= 50) return `rgba(239, 68, 68, ${opacity})`        // Coral Red (31 - 50)
  return `rgba(185, 28, 28, ${opacity})`                         // Deep Crimson Red (> 50)
}

/** Style choropleth OL untuk tingkat kejadian dengan label angka per wilayah (seperti D:\project\puskes) */
const choroplethStyle = (count: number, labelText?: string) => {
  const baseColor = choroplethColor(count, 0.92)

  return new Style({
    fill: new Fill({ color: baseColor }),
    stroke: new Stroke({
      color: count === 0 ? 'rgba(148, 163, 184, 0.5)' : '#ffffff',
      width: count === 0 ? 0.8 : 1.5,
      lineDash: count > 50 ? [8, 4] : undefined,
    }),
    text: count > 0 ? new OlText({
      text: labelText || String(count),
      font: 'bold 11px Inter, sans-serif',
      fill: new Fill({ color: '#ffffff' }),
      stroke: new Stroke({ color: 'rgba(15, 23, 42, 0.8)', width: 2.5 }),
      textAlign: 'center',
      textBaseline: 'middle',
    }) : undefined,
  })
}

/** Warna pin marker berdasarkan total korban */
const pinColor = (totalKorban: number) => {
  if (totalKorban === 0) return '#94a3b8'
  if (totalKorban <= 5) return '#facc15'
  if (totalKorban <= 20) return '#f97316'
  return '#dc2626'
}

/** Style OL untuk marker Titik Panggilan 119 (Ikon Gambar Orang) */
const getCallerMarkerStyle = (m: any) => {
  const isEmergency =
    m?.is_krisis === 1 ||
    String(m?.kategori_bencana || '') === '1' ||
    String(m?.kategori_layanan || '').toLowerCase().includes('emergency') ||
    String(m?.jenis_layanan || '').toLowerCase().includes('emergency')

  const statusStr = String(m?.status_penanganan_code || m?.status_penanganan || '').toLowerCase()
  const isSelesai = statusStr.includes('selesai')

  // Color coding:
  // Emergency (Gawat Darurat) -> Rose Red (%23e11d48)
  // Selesai (Completed) -> Teal Kemenkes (%23047D78)
  // Non-Emergency / Diproses -> Amber (%23f59e0b)
  let fillColor = '%23e11d48'
  if (isSelesai) {
    fillColor = '%23047D78'
  } else if (!isEmergency) {
    fillColor = '%23f59e0b'
  }

  // Modern SVG: Person icon (Gambar Orang) di dalam lingkaran berbingkai putih rapih
  const personSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36"><circle cx="18" cy="18" r="16" fill="${fillColor}" stroke="%23ffffff" stroke-width="2.5"/><circle cx="18" cy="11.5" r="4.2" fill="%23ffffff"/><path d="M10 25c0-4.4 3.6-8 8-8s8 3.6 8 8v1.5H10V25z" fill="%23ffffff"/></svg>`

  return new Style({
    image: new Icon({
      src: personSvg,
      scale: 0.9,
    }),
  })
}

/** Style OL untuk marker pin */
const markerStyle = (iconFile: string | undefined, totalKorban: number, markerData?: any) => {
  if (markerData?.marker_type === 'call' || markerData?.ticket_id || markerData?.sumber_panggilan || markerData?.nomor_kendaraan !== undefined) {
    return getCallerMarkerStyle(markerData)
  }
  if (iconFile && (iconFile.startsWith('data:image') || iconFile.startsWith('http'))) {
    return new Style({
      image: new Icon({
        src: iconFile,
        scale: 0.85,
      }),
    })
  }
  if (markerData) {
    return getCallerMarkerStyle(markerData)
  }
  return new Style({
    image: new CircleStyle({
      radius: 7,
      fill: new Fill({ color: pinColor(totalKorban) }),
      stroke: new Stroke({ color: '#ffffff', width: 2 }),
    }),
  })
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

// Cache GeoJSON agar tidak fetch ulang setiap render
const geojsonCache: Record<string, any> = {}

// basePath untuk URL fetch API — NEXT_PUBLIC_BASE_PATH diinjeksi saat build time oleh Next.js
// Fallback ke string kosong jika tidak ada (development tanpa basePath)
const NEXT_BASE_PATH: string = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

// ─────────────────────────────────────────────
// Helper: Categorize a faskes item into rs/puskesmas/klinik/pustu
// Pure function — defined at module level for stable reference in useMemo
// ─────────────────────────────────────────────
function categorizeFaskes(f: any): 'rs' | 'puskesmas' | 'klinik' | 'pustu' {
  const jStr = String(f.jenis || f.jenis_faskes || f.subjenis || '').toLowerCase()
  const nStr = String(f.nama || f.nama_faskes || '').toLowerCase()
  // Check RS first — use specific terms to avoid false positives from bare 'rs' substring
  if (
    jStr === 'rumah sakit' ||
    jStr.includes('rumah sakit') ||
    jStr.startsWith('rs') ||
    jStr === 'rsia' || jStr === 'rsud' || jStr === 'rsu' || jStr === 'rstp' || jStr === 'rsk' ||
    nStr.startsWith('rsud ') || nStr.startsWith('rs ') || nStr.includes(' rsud') ||
    nStr.includes('rumah sakit')
  ) return 'rs'
  // Pustu / Pembantu
  if (
    jStr.includes('pustu') || jStr.includes('pembantu') ||
    jStr.includes('poskesdes') || jStr.includes('polindes') || jStr.includes('posyandu') ||
    nStr.includes('pustu') || nStr.includes('pembantu')
  ) return 'pustu'
  // Klinik
  if (jStr.includes('klinik') || nStr.includes('klinik') || jStr.includes('balai pengobatan')) return 'klinik'
  // Default: Puskesmas
  return 'puskesmas'
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function DisasterMap({
  markers,
  ambulances = [],
  hospitals = [],
  selectedRegions = [],
  userScope,
  selectedPscCenter = null,
  onSelectProvince,
  isGuest: propIsGuest,
  markerMonths,
  setMarkerMonths,
  onSelectEvent,
  isFloodEocMode = false,
  isCallDetailMode = false,
  selectedRouteTarget = null,
  routeCoords = [],
  routeInfo = null,
  faskesList = [],
  poskoList = [],
  tckList = [],
  faskesRusakList = [],
  onSelectRouteTarget,
  disasterType,
  selectedRouteSource = null,
  onSelectRouteSource,
  lokasiList = [],
  earthquakePoints = []
}: DisasterMapProps) {
  const { token, user, isGuest: storeIsGuest } = useAuthStore()
  const isGuest = propIsGuest || storeIsGuest || !token || !user
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

  const [showTckLayer, setShowTckLayer] = useState(false) // Toggle layer TCK Kemkes (default: non-aktif)
  const [showPosko, setShowPosko] = useState(false) // Toggle layer Posko Pengungsian (default: non-aktif)
  const [showSeismicLayer, setShowSeismicLayer] = useState(!isCallDetailMode) // Toggle layer Titik Gempa USGS/BMKG
  // ── Volcano (MAGMA ESDM) state ──
  const [showVolcanoLayer, setShowVolcanoLayer] = useState(false) // Default non-aktif as requested
  const [volcanoList, setVolcanoList] = useState<any[]>([])
  const [isVolcanoLoading, setIsVolcanoLoading] = useState(false)
  const [volcanoMinLevel, setVolcanoMinLevel] = useState(1) // Default 1 (Semua Level)
  // ── Live USGS Earthquake state (Strictly Indonesia Only) ──
  const [liveEarthquakes, setLiveEarthquakes] = useState<any[]>([])
  const [eqDays, setEqDays] = useState<number>(30) // Default 30 hari (1 bulan)
  const [eqMinMag, setEqMinMag] = useState<number>(4.5) // Default M >= 4.5
  const [isEqLoading, setIsEqLoading] = useState<boolean>(false)
  const [eqCustomStart, setEqCustomStart] = useState<string | null>(null)

  const activeEqList = useMemo(() => {
    return (liveEarthquakes && liveEarthquakes.length > 0) ? liveEarthquakes : earthquakePoints
  }, [liveEarthquakes, earthquakePoints])
  const [showAmbulances, setShowAmbulances] = useState(true) // Toggle layer Ambulans PSC
  const [showHospitals, setShowHospitals] = useState(true) // Toggle layer RS Rujukan
  const [ambulancePopup, setAmbulancePopup] = useState<any | null>(null)
  const [hospitalPopup, setHospitalPopup] = useState<any | null>(null)

  // Infer normalized disaster category ONLY when disasterType is explicitly provided (Detail Page)
  const disasterCategory = useMemo(() => {
    if (!disasterType) return 'none' // Main dashboard page has no default auto-activated hazard layer
    const name = String(disasterType).toLowerCase()
    if (name.includes('kebakaran') || name.includes('karhutla') || name.includes('fire')) return 'kebakaran'
    if (name.includes('banjir') || name.includes('flood') || name.includes('genangan') || name.includes('rob')) return 'banjir'
    if (name.includes('gempa') || name.includes('earthquake')) return 'gempa'
    if (name.includes('longsor') || name.includes('landslide')) return 'longsor'
    if (name.includes('gunung') || name.includes('erupsi')) return 'gunung'
    return 'none'
  }, [disasterType])

  // ── Map refs ──
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<OlMap | null>(null)
  const baseMapLayerRef = useRef<any>(null)
  const provinceLayerRef = useRef<VectorLayer<VectorSource<any>> | null>(null)
  const kabupatenLayerRef = useRef<VectorLayer<VectorSource<any>> | null>(null)
  const markerLayerRef = useRef<VectorLayer<VectorSource<any>> | null>(null)
  const pulseOverlaysRef = useRef<Overlay[]>([])
  const lastFetchedProvinceRef = useRef<string | null>(null)
  const lastScopeKeyRef = useRef<string | null>(null)
  const prevTargetIdRef = useRef<string | null>(null)

  // BNPB layers refs
  const bnpbAdminLayerRef = useRef<any>(null)
  const bnpbHillshadeLayerRef = useRef<any>(null)
  const bnpbKepadatanLayerRef = useRef<any>(null)
  const bnpbBanjirLayerRef = useRef<any>(null)
  const bnpbGempaLayerRef = useRef<any>(null)
  const bnpbLongsorLayerRef = useRef<any>(null)
  const bnpbKarhutlaLayerRef = useRef<any>(null)
  const windLayerRef = useRef<any>(null)
  const showWindyRef = useRef(false)

  // EOC Routing Refs
  const eocLayerRef = useRef<VectorLayer<VectorSource<any>> | null>(null)
  const ambulanceLayerRef = useRef<VectorLayer<VectorSource<any>> | null>(null)
  const hospitalLayerRef = useRef<VectorLayer<VectorSource<any>> | null>(null)
  const seismicLayerRef = useRef<VectorLayer<VectorSource<any>> | null>(null)
  const volcanoLayerRef = useRef<VectorLayer<VectorSource<any>> | null>(null)

  // Stable callback refs (avoid stale closures inside OL event handlers)
  const onSelectProvinceRef = useRef(onSelectProvince)
  const userScopeRef = useRef(userScope)
  const markersRef = useRef(markers)
  const onSelectRouteTargetRef = useRef(onSelectRouteTarget)
  const faskesListRef = useRef(faskesList)
  const poskoListRef = useRef(poskoList)
  const faskesRusakListRef = useRef(faskesRusakList)
  const lokasiListRef = useRef(lokasiList)
  const nttSituasiRef = useRef<any[]>([])

  useEffect(() => {
    let active = true
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
    const normalizeNttRows = (rows: any[]): any[] => {
      if (!Array.isArray(rows)) return []
      return rows.map(r => {
        const out: any = {}
        Object.keys(r).forEach(k => {
          const key = k.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
          out[key] = r[k]
        })
        // Ensure numeric fields parsed correctly
        out.meninggal = Number(out.meninggal || 0)
        out.luka_berat = Number(out.luka_berat || 0)
        out.luka_ringan = Number(out.luka_ringan || 0)
        out.pengungsi = Number(out.pengungsi || 0)
        out.titik_pengungsian = Number(out.titik_pengungsian || 0)
        out.populasi_terdampak = Number(out.populasi_terdampak || out.penduduk_terdampak || 0)
        return out
      })
    }
    fetch(`${basePath}/api/ntt-data`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (!active) return
        if (json.success) {
          const list = json.tables?.situasi_kesehatan || json.data?.situasi_kesehatan || []
          nttSituasiRef.current = normalizeNttRows(Array.isArray(list) ? list : [])
        }
      })
      .catch((e) => console.warn('[DisasterMap] NTT Data fetch:', e))
    return () => {
      active = false
    }
  }, [])

  // ── UI state ──
  const [isLoading, setIsLoading] = useState(false)
  const [mapInstance, setMapInstance] = useState<OlMap | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showMarkers, setShowMarkers] = useState(true)  // toggle pin visibility
  const [showEocRoute, setShowEocRoute] = useState(true)
  const [pulseRadius, setPulseRadius] = useState<number>(1) // Default 1 km

  // ── Faskes Sub-Category Checkbox Filters ──
  const [faskesTypeFilters, setFaskesTypeFilters] = useState<{
    rs: boolean
    puskesmas: boolean
    klinik: boolean
    pustu: boolean
    siagaOnly: boolean
  }>({
    rs: true,
    puskesmas: true,
    klinik: true,
    pustu: true,
    siagaOnly: true,
  })

  const faskesCountsByType = useMemo(() => {
    const list = Array.isArray(faskesList) ? faskesList : []
    let rs = 0, puskesmas = 0, klinik = 0, pustu = 0, siaga = 0
    let rsSiaga = 0, pkmSiaga = 0, klinikSiaga = 0, pustuSiaga = 0

    list.forEach((f: any) => {
      const totPasien = Number(f.total_pasien || 0) || (Number(f.triase_merah || 0) + Number(f.triase_kuning || 0) + Number(f.triase_hijau || 0) + Number(f.triase_hitam || 0))
      const hasTriage = totPasien > 0

      if (hasTriage) siaga++

      const cat = categorizeFaskes(f)
      if (cat === 'rs') {
        rs++
        if (hasTriage) rsSiaga++
      } else if (cat === 'pustu') {
        pustu++
        if (hasTriage) pustuSiaga++
      } else if (cat === 'klinik') {
        klinik++
        if (hasTriage) klinikSiaga++
      } else {
        puskesmas++
        if (hasTriage) pkmSiaga++
      }
    })
    return {
      rs, puskesmas, klinik, pustu, siaga, total: list.length,
      rsSiaga, pkmSiaga, klinikSiaga, pustuSiaga
    }
  }, [faskesList])

  // Auto-enable EOC Routing layer when a route target is selected
  useEffect(() => {
    if (selectedRouteTarget) {
      setShowEocRoute(true)
    }
  }, [selectedRouteTarget])
  const [showBaseMap, setShowBaseMap] = useState(true)
  const [showGeoJson, setShowGeoJson] = useState(true)
  const [showWindy, setShowWindy] = useState(false)
  const [showWindLegend, setShowWindLegend] = useState(false)
  const [showRegionLegend, setShowRegionLegend] = useState(false)
  const [showCasualtyLegend, setShowCasualtyLegend] = useState(false)

  useEffect(() => {
    showWindyRef.current = showWindy
  }, [showWindy])

  // Fungsi untuk kembali ke titik pusat utama kejadian bencana (Reset View/Zoom)
  const handleResetCenter = useCallback(() => {
    if (!mapInstanceRef.current) return
    const firstM = markersRef.current && markersRef.current[0]
    const hasCoord = firstM && Number(firstM.lng) !== 0 && Number(firstM.lat) !== 0
    const centerCoord = hasCoord
      ? fromLonLat([Number(firstM.lng), Number(firstM.lat)])
      : isFloodEocMode
        ? fromLonLat([122.9814, -8.3421])
        : fromLonLat([118, -2.5])
    const targetZoom = isFloodEocMode ? 8.2 : 4.8

    mapInstanceRef.current.getView().animate({
      center: centerCoord,
      zoom: targetZoom,
      duration: 700
    })
  }, [isFloodEocMode])

  // BNPB layer visibilities - semua layer bahaya nonaktif secara default
  const [showBnpbAdmin, setShowBnpbAdmin] = useState(false)
  const [showBnpbHillshade, setShowBnpbHillshade] = useState(false)
  const [showBnpbKepadatan, setShowBnpbKepadatan] = useState(false)
  const [showBnpbBanjir, setShowBnpbBanjir] = useState(false)
  const [showBnpbGempa, setShowBnpbGempa] = useState(false)
  const [showBnpbLongsor, setShowBnpbLongsor] = useState(false)
  const [showBnpbKarhutla, setShowBnpbKarhutla] = useState(false)

  // Auto activate matching spatial layer ONLY on Detail Page (when disasterType is provided)
  useEffect(() => {
    if (isCallDetailMode) {
      setShowBnpbAdmin(false)
      setShowBnpbHillshade(false)
      setShowBnpbKepadatan(false)
      setShowBnpbBanjir(false)
      setShowBnpbGempa(false)
      setShowBnpbLongsor(false)
      setShowBnpbKarhutla(false)
      setShowSeismicLayer(false)
      setShowBmkg(false)
      setShowTckLayer(false)
      setShowPosko(false)
      setShowWindy(false)
      return
    }
    if (!disasterType || disasterCategory === 'none') {
      setShowBnpbBanjir(false)
      setShowBnpbGempa(false)
      setShowBnpbLongsor(false)
      setShowBnpbKarhutla(false)
      return
    }

    if (disasterCategory === 'kebakaran') {
      setShowBnpbKarhutla(true)
      setShowBnpbBanjir(false)
      setShowBnpbGempa(false)
      setShowBnpbLongsor(false)
      setShowWindy(false)
    } else if (disasterCategory === 'banjir') {
      setShowBnpbBanjir(true)
      setShowBnpbKarhutla(false)
      setShowBnpbGempa(false)
      setShowBnpbLongsor(false)
    } else if (disasterCategory === 'gempa') {
      setShowBnpbGempa(true)
      setShowBmkg(false)
      setShowBnpbBanjir(false)
      setShowBnpbKarhutla(false)
      setShowBnpbLongsor(false)
    } else if (disasterCategory === 'longsor') {
      setShowBnpbLongsor(true)
      setShowBnpbBanjir(false)
      setShowBnpbKarhutla(false)
      setShowBnpbGempa(false)
    }
  }, [disasterCategory, disasterType, isCallDetailMode])

  const [markerPopup, setMarkerPopup] = useState<MarkerPopupState | null>(null)
  const [eocPopup, setEocPopup] = useState<EocPopupState | null>(null)

  // ── BMKG Layer states ──
  const [showBmkg, setShowBmkg] = useState(false)
  const [bmkgGempas, setBmkgGempas] = useState<any[]>([])

  // Callback to create a pulsing overlay dynamically
  const createPulseOverlay = useCallback((lng: number, lat: number, type: 'danger' | 'warning' | 'gempa') => {
    const map = mapInstanceRef.current || mapInstance
    if (!map) return

    const pulseEl = document.createElement('div')
    pulseEl.className = 'ews-pulse-overlay pointer-events-none select-none'
    pulseEl.style.position = 'relative'
    pulseEl.style.width = '52px'
    pulseEl.style.height = '52px'
    pulseEl.style.display = 'flex'
    pulseEl.style.alignItems = 'center'
    pulseEl.style.justifyContent = 'center'

    let colorHex = '#ef4444' // red
    if (type === 'warning') colorHex = '#f97316' // orange
    else if (type === 'gempa') colorHex = '#ea580c' // amber

    pulseEl.innerHTML = `
      <style>
        @keyframes eocPulsePing {
          0% { transform: scale(0.4); opacity: 0.95; }
          60% { transform: scale(1.9); opacity: 0.15; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes eocPulseRadar {
          0% { transform: scale(0.2); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
          100% { transform: scale(2.1); opacity: 0; }
        }
      </style>
      <div style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background: ${colorHex}; opacity: 0.55; animation: eocPulsePing 1.8s cubic-bezier(0, 0.2, 0.8, 1) infinite;"></div>
      <div style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; border: 2.2px solid ${colorHex}; animation: eocPulseRadar 1.8s ease-out infinite; animation-delay: 0.45s;"></div>
      <div style="position: relative; width: 10px; height: 10px; border-radius: 9999px; background: ${colorHex}; border: 2px solid #ffffff; box-shadow: 0 0 10px ${colorHex};"></div>
    `

    const overlay = new Overlay({
      element: pulseEl,
      positioning: 'center-center',
      stopEvent: false,
      position: fromLonLat([lng, lat])
    })

    map.addOverlay(overlay)
    pulseOverlaysRef.current.push(overlay)
  }, [mapInstance])

  // ── Filter states ──
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set())
  const [excludedTypes, setExcludedTypes] = useState<Set<string>>(new Set())

  const toggleCategory = (catId: string) => {
    setExcludedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) {
        next.delete(catId)
      } else {
        next.add(catId)
      }
      return next
    })
  }

  const toggleType = (typeName: string) => {
    setExcludedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(typeName)) {
        next.delete(typeName)
      } else {
        next.add(typeName)
      }
      return next
    })
  }

  // Polygon popup state (province / kabupaten click popup)
  const [activePopup, setActivePopup] = useState<{
    type: 'provinsi' | 'kabupaten'
    name: string
    featureExtent?: any
    stats: {
      totalEvents: number
      totalEmergency?: number
      totalAmbulans?: number
      totalSelesai?: number
      totalKorban?: number
      meninggal?: number
      lukaBerat?: number
      lukaRingan?: number
      totalLuka?: number
      pengungsi?: number
      titikPosko?: number
      populasiTerdampak?: number
      faskesCount?: number
      poskoCount?: number
      breakdown: { name: string; count: number; emergency?: number; ambulans?: number; selesai?: number; totalKorban?: number }[]
      eventsList?: MarkerData[]
      faskesList?: any[]
      poskoList?: any[]
      lokasiList?: any[]
    }
  } | null>(null)

  // ── Sync refs ──
  useEffect(() => {
    onSelectProvinceRef.current = onSelectProvince
    userScopeRef.current = userScope
    markersRef.current = markers
    onSelectRouteTargetRef.current = onSelectRouteTarget
    faskesListRef.current = faskesList
    poskoListRef.current = poskoList
    faskesRusakListRef.current = faskesRusakList
    lokasiListRef.current = lokasiList
  }, [onSelectProvince, userScope, markers, onSelectRouteTarget, faskesList, poskoList, faskesRusakList, lokasiList])

  // Dismiss popup on scope changes
  useEffect(() => {
    setActivePopup(null)
    setMarkerPopup(null)
    setEocPopup(null)
  }, [userScope])

  // ─────────────────────────────────────────────
  // Computed
  // ─────────────────────────────────────────────

  // 1. Get filtered markers first based on exclusions
  const filteredMarkers = useMemo(() => {
    return markers.filter((m) => {
      const cat = String(m.kategori_bencana || '1')
      if (excludedCategories.has(cat)) return false
      if (excludedTypes.has(m.jenis_bencana)) return false
      return true
    })
  }, [markers, excludedCategories, excludedTypes])



  // 2. Compute category totals from all markers
  const categoryCounts = useMemo(() => {
    let alam = 0
    let nonAlam = 0
    let sosial = 0
    markers.forEach((m) => {
      const cat = String(m.kategori_bencana || '1')
      if (cat === '1') alam++
      else if (cat === '2') nonAlam++
      else if (cat === '3') sosial++
    })
    return { alam, nonAlam, sosial }
  }, [markers])

  // 3. Compute disaster types breakdown from all markers
  const disasterTypesBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    const typeToCategory = new Map<string, string>()
    markers.forEach((m) => {
      counts.set(m.jenis_bencana, (counts.get(m.jenis_bencana) || 0) + 1)
      if (m.kategori_bencana !== undefined && m.kategori_bencana !== null) {
        typeToCategory.set(m.jenis_bencana, String(m.kategori_bencana))
      }
    })
    return Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
      category: typeToCategory.get(name) || '1',
    })).sort((a, b) => b.count - a.count)
  }, [markers])

  // 4. Compute counts for choropleth based on filtered markers
  const { provinceCounts, kabupatenCounts } = useMemo(() => {
    const provinceCounts = new Map<string, number>()
    const kabupatenCounts = new Map<string, number>()
    filteredMarkers.forEach((m) => {
      const pStr = m.provinsi || (m as any).prov_single || (m as any).nama_prov || (m as any).prov || ''
      const kStr = m.kabupaten || (m as any).kab_single || (m as any).nama_kab || (m as any).kab || ''
      const pKey = cleanKey(pStr)
      const kKey = cleanKey(kStr)

      if (pKey) provinceCounts.set(pKey, (provinceCounts.get(pKey) || 0) + 1)
      if (kKey) kabupatenCounts.set(kKey, (kabupatenCounts.get(kKey) || 0) + 1)
    })
    return { provinceCounts, kabupatenCounts }
  }, [filteredMarkers])

  // Keys wilayah terpilih untuk polygon highlight / arsiran GeoJSON
  const selectedProvKeys = useMemo(() => {
    const keys: string[] = []
    if (Array.isArray(selectedRegions)) {
      selectedRegions.forEach((r: any) => {
        const pName = r.province_name || (r.type === 'provinsi' ? r.label : '')
        if (pName) keys.push(cleanKey(pName))
        if (r.label) {
          const matchProv = r.label.match(/,\s*([A-Za-z\s]+)\)/)
          if (matchProv && matchProv[1]) keys.push(cleanKey(matchProv[1]))
          keys.push(cleanKey(r.label))
        }
      })
    }
    return keys
  }, [selectedRegions])

  const selectedKabKeys = useMemo(() => {
    const keys: string[] = []
    if (Array.isArray(selectedRegions)) {
      selectedRegions.forEach((r: any) => {
        const kName = r.kabupaten_name || (r.type === 'kabupaten' ? r.label : '')
        if (kName) keys.push(cleanKey(kName))

        if (r.label) {
          const matchKab = r.label.match(/\((?:KAB\.|KOTA|KABUPATEN)\s*([^,)]+)/i)
          if (matchKab && matchKab[1]) keys.push(cleanKey(matchKab[1]))
          keys.push(cleanKey(r.label))
        }
      })
    }
    return keys
  }, [selectedRegions])

  // ─────────────────────────────────────────────
  // Initialize Map (once)
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current) return

    // Base Map OSM layer
    const baseMapLayer = new TileLayer({
      source: new OSM(),
      visible: showBaseMap,
    })
    baseMapLayerRef.current = baseMapLayer

    // BNPB layers
    const bnpbAdminLayer = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/inarisk/batas_administrasi/MapServer',
        params: {},
      }),
      visible: showBnpbAdmin,
      zIndex: 6,
    })
    bnpbAdminLayerRef.current = bnpbAdminLayer

    const bnpbHillshadeLayer = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/Basemap/Indo_Hillshade/MapServer',
        params: {},
      }),
      visible: showBnpbHillshade,
      opacity: 0.6,
      zIndex: 4,
    })
    bnpbHillshadeLayerRef.current = bnpbHillshadeLayer

    const bnpbKepadatanLayer = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/Basemap/Kepadatan_penduduk_2020/MapServer',
        params: {},
      }),
      visible: showBnpbKepadatan,
      opacity: 0.6,
      zIndex: 5,
    })
    bnpbKepadatanLayerRef.current = bnpbKepadatanLayer

    const bnpbBanjirLayer = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/inarisk/layer_bahaya_banjir/ImageServer',
        params: {},
      }),
      visible: showBnpbBanjir,
      opacity: 0.6,
      zIndex: 7,
    })
    bnpbBanjirLayerRef.current = bnpbBanjirLayer

    const bnpbGempaLayer = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/inarisk/layer_bahaya_gempabumi/ImageServer',
        params: {},
      }),
      visible: showBnpbGempa,
      opacity: 0.6,
      zIndex: 7,
    })
    bnpbGempaLayerRef.current = bnpbGempaLayer

    const bnpbLongsorLayer = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/inarisk/layer_bahaya_tanah_longsor/ImageServer',
        params: {},
      }),
      visible: showBnpbLongsor,
      opacity: 0.6,
      zIndex: 7,
    })
    bnpbLongsorLayerRef.current = bnpbLongsorLayer

    const bnpbKarhutlaLayer = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/inarisk/layer_bahaya_kebakaran_hutan_dan_lahan/ImageServer',
        params: {},
      }),
      visible: showBnpbKarhutla,
      opacity: 0.6,
      zIndex: 7,
    })
    bnpbKarhutlaLayerRef.current = bnpbKarhutlaLayer

    // Province choropleth layer — zIndex 2 agar di atas basemap
    const provinceLayer = new VectorLayer({
      source: new VectorSource(),
      zIndex: 2,
      style: new Style({
        fill: new Fill({ color: 'rgba(241, 245, 249, 0.6)' }),
        stroke: new Stroke({ color: 'rgba(100, 116, 139, 0.85)', width: 1.2 }),
      }),
    })
    provinceLayerRef.current = provinceLayer

    // Kabupaten choropleth layer — zIndex 3 agar di atas province
    const kabupatenLayer = new VectorLayer({
      source: new VectorSource(),
      zIndex: 3,
      style: new Style({
        fill: new Fill({ color: 'rgba(241, 245, 249, 0.6)' }),
        stroke: new Stroke({ color: 'rgba(100, 116, 139, 0.85)', width: 1.2 }),
      }),
    })
    kabupatenLayerRef.current = kabupatenLayer  // ← FIX: assign ref yang terlupakan

    // Marker pin layer
    const markerLayer = new VectorLayer({ source: new VectorSource(), zIndex: 10 })
    markerLayerRef.current = markerLayer

    // Hospital layer
    const hospitalLayer = new VectorLayer({ source: new VectorSource(), zIndex: 11 })
    hospitalLayerRef.current = hospitalLayer

    // EOC routing & faskes layer
    const eocLayer = new VectorLayer({ source: new VectorSource(), zIndex: 12 })
    eocLayerRef.current = eocLayer

    // Ambulance unit layer
    const ambulanceLayer = new VectorLayer({ source: new VectorSource(), zIndex: 14 })
    ambulanceLayerRef.current = ambulanceLayer

    // Dedicated Seismic (Earthquake USGS) layer
    const seismicLayer = new VectorLayer({ source: new VectorSource(), zIndex: 13 })
    seismicLayerRef.current = seismicLayer

    // Dedicated Volcano (MAGMA ESDM) layer
    const volcanoLayer = new VectorLayer({ source: new VectorSource(), zIndex: 15 })
    volcanoLayerRef.current = volcanoLayer

    const firstM = markers && markers[0]
    const hasInitialCoord = firstM && Number(firstM.lng) !== 0 && Number(firstM.lat) !== 0
    const initialCenter = isFloodEocMode && hasInitialCoord
      ? fromLonLat([Number(firstM.lng), Number(firstM.lat)])
      : fromLonLat([118, -2.5])
    const initialZoom = isFloodEocMode ? 8.2 : 4.8

    const map = new OlMap({
      target: mapRef.current,
      layers: [
        baseMapLayer,
        bnpbAdminLayer,
        bnpbHillshadeLayer,
        bnpbKepadatanLayer,
        bnpbBanjirLayer,
        bnpbGempaLayer,
        bnpbLongsorLayer,
        bnpbKarhutlaLayer,
        provinceLayer,
        kabupatenLayer,
        hospitalLayer,
        markerLayer,
        ambulanceLayer,
        eocLayer,
        seismicLayer,
        volcanoLayer
      ],
      controls: defaultControls({ attribution: false }),
      view: new View({
        center: initialCenter,
        zoom: initialZoom,
        minZoom: 4,
        maxZoom: 15,
      }),
    })

    // Overlay elements will be added dynamically on render hook

    // ── Click handler ──
    map.on('singleclick', (evt) => {
      // 1. Check EOC Layer, Seismic, and Volcano features
      const eocFeature = map.forEachFeatureAtPixel(
        evt.pixel,
        (f) => f,
        { layerFilter: (l) => l === eocLayerRef.current || l === seismicLayerRef.current || l === volcanoLayerRef.current }
      )
      if (eocFeature) {
        const id = eocFeature.get('id')
        const rawItem = eocFeature.get('rawItem')
        const itemType = eocFeature.get('itemType')
        const name = eocFeature.get('name') || rawItem?.nama || rawItem?.nama_faskes || 'Lokasi Terkait'

        if (id && !String(id).startsWith('pulse-circle') && id !== 'route-line' && id !== 'flood' && rawItem) {
          // Auto zoom ke koordinat titik EOC / faskes / posko
          const eocGeom = eocFeature.getGeometry() as Point
          const eocCoords = eocGeom && typeof eocGeom.getCoordinates === 'function' ? eocGeom.getCoordinates() : null
          if (eocCoords) {
            map.getView().animate({
              center: eocCoords,
              zoom: Math.max(map.getView().getZoom() || 10, 14),
              duration: 600,
            })
          }

          const container = mapContainerRef.current
          if (container && mapRef.current) {
            const rect = container.getBoundingClientRect()
            const mapRect = mapRef.current.getBoundingClientRect()
            const x = evt.pixel[0] + (mapRect.left - rect.left)
            const y = evt.pixel[1] + (mapRect.top - rect.top)

            const lat = Number(rawItem.latitude || rawItem.lat || 0)
            const lng = Number(rawItem.longitude || rawItem.lng || 0)
            const firstMarker = markersRef.current && markersRef.current[0]
            const originLat = firstMarker ? Number(firstMarker.lat) : lat
            const originLng = firstMarker ? Number(firstMarker.lng) : lng
            const distKm = getDistanceInKm(originLat, originLng, lat, lng)

            const hasStructuralDamage = Number(rawItem.rusak_berat || 0) > 0 || 
                                       Number(rawItem.rusak_sedang || 0) > 0 || 
                                       Number(rawItem.rusak_ringan || 0) > 0 ||
                                       String(rawItem.kondisi_bangunan || '').toLowerCase().includes('rusak') ||
                                       String(rawItem.kondisi_faskes || '').toLowerCase().includes('rusak') ||
                                       String(rawItem.status || '').toLowerCase().includes('rusak') ||
                                       String(rawItem.status || '').toLowerCase().includes('tutup')

            const isTerdampak = (!!rawItem._isTerdampak && hasStructuralDamage) || hasStructuralDamage
            const isEarthquake = itemType === 'earthquake'
            const isVolcano = itemType === 'volcano'

            setEocPopup({
              rawItem,
              type: (itemType as any) || 'clinic',
              name: isEarthquake ? (rawItem.name || name) : isVolcano ? (rawItem.nama || name) : name,
              address: isEarthquake
                ? (rawItem.place || 'Wilayah Episentrum Gempa Indonesia')
                : isVolcano
                ? `${rawItem.kabupaten || ''}, ${rawItem.provinsi || ''} (${rawItem.elevation || 0} mdpl)`
                : (rawItem.alamat || rawItem.kecamatan || (rawItem.kab_kota ? `Kab. ${rawItem.kab_kota}` : '') || (rawItem.nama_desa ? `Desa ${rawItem.nama_desa}, Kec. ${rawItem.kecamatan || ''}` : '')),
              lat,
              lng,
              distance: isEarthquake ? (rawItem.distKm || (distKm > 0.05 ? Number(distKm.toFixed(1)) : 0)) : (distKm > 0.05 ? Number(distKm.toFixed(1)) : 0),
              isTerdampak,
              dampakInfo: isTerdampak ? {
                rusak_berat: Number(rawItem.rusak_berat || 0),
                rusak_sedang: Number(rawItem.rusak_sedang || 0),
                rusak_ringan: Number(rawItem.rusak_ringan || 0),
                kondisi_faskes: rawItem.kondisi_faskes || rawItem.kondisi || '',
                fungsi_pelayanan: rawItem.fungsi_pelayanan || rawItem.fungsi || '',
                jenis_faskes: rawItem.jenis_faskes || rawItem.jenis || '',
                status: rawItem.status || ''
              } : undefined,
              details: !isEarthquake ? {
                jenis: rawItem.jenis || rawItem.jenis_faskes || rawItem.jenis_pos || (itemType === 'tck' ? 'Relawan TCK Kemkes RI' : undefined),
                operasional: rawItem.operasional || rawItem.status_operasional || 'Operasional Normal',
                dokter: rawItem.dokter,
                perawat: rawItem.perawat,
                kapasitas: rawItem.kapasitas || rawItem.tt_tersedia,
                ambulans: rawItem.ambulans,
                pengungsi_jiwa: rawItem.jml_pengungsi || rawItem.jiwa,
                kontak: rawItem.telepon || rawItem.kontak || rawItem.pj_kontak || rawItem.nomor_telp,
                golongan: rawItem.golongan,
                spesifikasi: rawItem.spesifikasi,
                organisasi: rawItem.organisasi,
                nama_tim_emt: rawItem.nama_tim_emt,
                pekerjaan: rawItem.pekerjaan,
                nomor_telp: rawItem.nomor_telp
              } : undefined,
              earthquakeInfo: isEarthquake ? {
                magnitude: Number(rawItem.magnitude || 0),
                depth: Number(rawItem.depth || 10),
                place: rawItem.place || 'Wilayah Episentrum Indonesia',
                time: rawItem.time || '',
                dateStr: rawItem.dateStr || '',
                dateLabel: rawItem.dateLabel || '',
                isMainshock: !!rawItem.isMainshock,
                mmi: rawItem.mmi,
                tsunami: rawItem.tsunami,
                distKm: rawItem.distKm,
                source: 'Katalog Seismik Global USGS & BMKG TEWS'
              } : undefined,
              volcanoInfo: isVolcano ? {
                level: rawItem.level || 1,
                status: rawItem.status || 'Level I (Normal)',
                statusColor: rawItem.statusColor || '#10b981',
                elevation: Number(rawItem.elevation || 0),
                hazardRadiusKm: Number(rawItem.hazardRadiusKm || 0),
                rekomendasi: rawItem.rekomendasi || 'Tetap waspada dan ikuti arahan PVMBG.',
                link: rawItem.link || 'https://magma.esdm.go.id/v1/gunung-api/laporan',
                provinsi: rawItem.provinsi || '',
                kabupaten: rawItem.kabupaten || '',
              } : undefined,
              x,
              y
            })
          }

          setMarkerPopup(null)
          setActivePopup(null)
          return
        }
      }

      // 2. Check marker pin (Titik Panggilan 119 - Auto Zoom)
      const markerFeature = map.forEachFeatureAtPixel(
        evt.pixel,
        (f) => f,
        { layerFilter: (l) => l === markerLayerRef.current }
      )
      if (markerFeature) {
        const data = markerFeature.get('markerData') as MarkerData

        // Auto zoom ke pin panggilan yang diklik
        const markerGeom = markerFeature.getGeometry() as Point
        const coords = markerGeom && typeof markerGeom.getCoordinates === 'function' ? markerGeom.getCoordinates() : null
        if (coords) {
          map.getView().animate({
            center: coords,
            zoom: Math.max(map.getView().getZoom() || 10, 14.5),
            duration: 600,
          })
        }

        // Calculate pixel position relative to map container
        const container = mapContainerRef.current
        if (container && mapRef.current) {
          const rect = container.getBoundingClientRect()
          const mapRect = mapRef.current.getBoundingClientRect()
          const x = evt.pixel[0] + (mapRect.left - rect.left)
          const y = evt.pixel[1] + (mapRect.top - rect.top)
          setMarkerPopup({ data, x, y, coord: coords || undefined })
        }

        setEocPopup(null)
        setAmbulancePopup(null)
        setHospitalPopup(null)
        setActivePopup(null)
        return
      }

      // Check ambulance pin (Armada Ambulans - Auto Zoom)
      const ambulanceFeature = map.forEachFeatureAtPixel(
        evt.pixel,
        (f) => f,
        { layerFilter: (l) => l === ambulanceLayerRef.current }
      )
      if (ambulanceFeature) {
        const data = ambulanceFeature.get('ambulanceData')

        // Auto zoom ke armada ambulans yang diklik
        const ambGeom = ambulanceFeature.getGeometry() as Point
        const coords = ambGeom && typeof ambGeom.getCoordinates === 'function' ? ambGeom.getCoordinates() : null
        if (coords) {
          map.getView().animate({
            center: coords,
            zoom: Math.max(map.getView().getZoom() || 10, 14.5),
            duration: 600,
          })
        }

        const container = mapContainerRef.current
        if (container && mapRef.current) {
          const rect = container.getBoundingClientRect()
          const mapRect = mapRef.current.getBoundingClientRect()
          const x = evt.pixel[0] + (mapRect.left - rect.left)
          const y = evt.pixel[1] + (mapRect.top - rect.top)
          setAmbulancePopup({ data, x, y, coord: coords || undefined })
        }
        setMarkerPopup(null)
        setHospitalPopup(null)
        setEocPopup(null)
        setActivePopup(null)
        return
      }

      // Check hospital pin (RS Rujukan - Auto Zoom)
      const hospitalFeature = map.forEachFeatureAtPixel(
        evt.pixel,
        (f) => f,
        { layerFilter: (l) => l === hospitalLayerRef.current }
      )
      if (hospitalFeature) {
        const data = hospitalFeature.get('hospitalData')

        // Auto zoom ke RS rujukan yang diklik
        const hospGeom = hospitalFeature.getGeometry() as Point
        const coords = hospGeom && typeof hospGeom.getCoordinates === 'function' ? hospGeom.getCoordinates() : null
        if (coords) {
          map.getView().animate({
            center: coords,
            zoom: Math.max(map.getView().getZoom() || 10, 14.5),
            duration: 600,
          })
        }

        const container = mapContainerRef.current
        if (container && mapRef.current) {
          const rect = container.getBoundingClientRect()
          const mapRect = mapRef.current.getBoundingClientRect()
          const x = evt.pixel[0] + (mapRect.left - rect.left)
          const y = evt.pixel[1] + (mapRect.top - rect.top)
          setHospitalPopup({ data, x, y, coord: coords || undefined })
        }
        setMarkerPopup(null)
        setAmbulancePopup(null)
        setEocPopup(null)
        setActivePopup(null)
        return
      }

      // 3. Check polygon features (Province / Kabupaten - Auto Zoom Wilayah)
      const polyFeature = map.forEachFeatureAtPixel(evt.pixel, (f, layer) => {
        if (layer === kabupatenLayerRef.current || layer === provinceLayerRef.current) {
          return f
        }
        const g = f?.getGeometry?.()
        const t = g?.getType?.()
        if (t === 'Polygon' || t === 'MultiPolygon') {
          return f
        }
        return null
      })

      if (!polyFeature) {
        setActivePopup(null)
        setMarkerPopup(null)
        setAmbulancePopup(null)
        setHospitalPopup(null)
        setEocPopup(null)
        return
      }

      setMarkerPopup(null)
      setAmbulancePopup(null)
      setHospitalPopup(null)
      setEocPopup(null)

      const currentScope = userScopeRef.current
      const isProvMode = currentScope?.mode === 'provinsi'
      const isKabMode = currentScope?.mode === 'kabupaten'

      // Selalu auto zoom/fit ke poligon wilayah yang diklik
      const polyGeom = polyFeature.getGeometry?.()
      const extent = polyGeom?.getExtent?.()
      if (extent && extent.length === 4 && isFinite(extent[0]) && isFinite(extent[1]) && isFinite(extent[2]) && isFinite(extent[3])) {
        map.getView().fit(extent, {
          padding: [60, 60, 60, 60],
          duration: 600,
          maxZoom: isProvMode || isKabMode ? 13 : 8.8,
        })
      } else if (evt.coordinate) {
        map.getView().animate({
          center: evt.coordinate,
          zoom: Math.max(map.getView().getZoom() || 6, 8.5),
          duration: 600,
        })
      }

      if (!isProvMode && !isKabMode) {
        // National mode → clicked province
        const provName = getFeatureName(polyFeature, 'provinsi') || polyFeature.get('name') || polyFeature.get('PROVINSI') || polyFeature.get('Propinsi') || ''
        if (!provName) return

        const provCleaned = cleanKey(provName)
        const provMarkers = markersRef.current.filter((m) => cleanKey(m.provinsi) === provCleaned)

        // Group by kabupaten (PSC metrics: calls, emergency, ambulans, selesai)
        const kabMap = new Map<string, { count: number; emergency: number; ambulans: number; selesai: number }>()
        let totalEmergency = 0
        let totalAmbulans = 0
        let totalSelesai = 0

        provMarkers.forEach((m: any) => {
          const kab = m.kabupaten || m.nama_kab || 'LAINNYA'
          const existing = kabMap.get(kab) || { count: 0, emergency: 0, ambulans: 0, selesai: 0 }
          existing.count++

          const isEm = (m.jenis_layanan || m.kategori_layanan || m.jenis_bencana || '').toLowerCase().includes('emergency') || 
                       (m.kategori_layanan || m.jenis_bencana || '').toLowerCase().includes('trauma')
          if (isEm) {
            existing.emergency++
            totalEmergency++
          }
          if (m.nomor_kendaraan || m.nama_petugas_ambulan || (m.jenis_layanan || '').toLowerCase().includes('ambulan')) {
            existing.ambulans++
            totalAmbulans++
          }
          if ((m.status_penanganan_code || m.status_verifikasi || '').toLowerCase().includes('selesai')) {
            existing.selesai++
            totalSelesai++
          }
          kabMap.set(kab, existing)
        })

        const breakdown = Array.from(kabMap.entries())
          .map(([name, s]) => ({ name, count: s.count, emergency: s.emergency, ambulans: s.ambulans, selesai: s.selesai }))
          .sort((a, b) => b.count - a.count)

        setActivePopup({
          type: 'provinsi',
          name: provName,
          featureExtent: extent,
          stats: {
            totalEvents: provMarkers.length,
            totalEmergency,
            totalAmbulans,
            totalSelesai,
            breakdown,
          },
        })
      } else {
        // Province/kabupaten mode → clicked kabupaten
        const kabName = getFeatureName(polyFeature, 'kabupaten') || polyFeature.get('name') || polyFeature.get('KABUPATEN') || polyFeature.get('WADMKK') || ''
        if (!kabName) return

        const kabCleaned = cleanKey(kabName)

        // Jika mode kabupaten terkunci, abaikan klik pada kabupaten lain
        if (isKabMode && currentScope?.kabupaten?.label) {
          const targetClean = cleanKey(currentScope.kabupaten.label)
          if (kabCleaned !== targetClean && !kabCleaned.includes(targetClean) && !targetClean.includes(kabCleaned)) {
            return
          }
        }

        const kabMarkers = markersRef.current.filter((m) => cleanKey(m.kabupaten) === kabCleaned || cleanKey(m.nama_kab) === kabCleaned)

        const allFaskes = [...(faskesListRef.current || []), ...(faskesRusakListRef.current || [])]
        const kabFaskes = allFaskes.filter((f: any) => {
          const k1 = cleanKey(f.kabupaten)
          const k2 = cleanKey(f.kab_kota)
          const k3 = cleanKey(f.alamat)
          const k4 = cleanKey(f.nama || f.nama_faskes)
          const k5 = cleanKey(f.desa)
          return k1 === kabCleaned || k2 === kabCleaned || k3.includes(kabCleaned) || k4.includes(kabCleaned) || k5.includes(kabCleaned)
        })

        const allPosko = poskoListRef.current || []
        const kabPosko = allPosko.filter((p: any) => {
          const k1 = cleanKey(p.kabupaten)
          const k2 = cleanKey(p.lokasi_spesifik)
          const k3 = cleanKey(p.nama || p.nama_pos)
          return k1 === kabCleaned || k2.includes(kabCleaned) || k3.includes(kabCleaned)
        })

        const allLokasi = lokasiListRef.current || []
        const kabLokasi = allLokasi.filter((l: any) => cleanKey(l.kabupaten) === kabCleaned)

        let kabEmergency = 0
        let kabAmbulans = 0
        let kabSelesai = 0
        kabMarkers.forEach((m: any) => {
          const isEm = (m.jenis_layanan || m.kategori_layanan || m.jenis_bencana || '').toLowerCase().includes('emergency') || 
                       (m.kategori_layanan || m.jenis_bencana || '').toLowerCase().includes('trauma')
          if (isEm) kabEmergency++
          if (m.nomor_kendaraan || m.nama_petugas_ambulan || (m.jenis_layanan || '').toLowerCase().includes('ambulan')) kabAmbulans++
          if ((m.status_penanganan_code || m.status_verifikasi || '').toLowerCase().includes('selesai')) kabSelesai++
        })

        setActivePopup({
          type: 'kabupaten',
          name: kabName,
          featureExtent: extent,
          stats: {
            totalEvents: kabMarkers.length,
            totalEmergency: kabEmergency,
            totalAmbulans: kabAmbulans,
            totalSelesai: kabSelesai,
            faskesCount: kabFaskes.length,
            breakdown: [],
            eventsList: kabMarkers,
            faskesList: kabFaskes,
            poskoList: kabPosko,
            lokasiList: kabLokasi,
          },
        })
      }
    })

    // Sinkronisasi posisi pixel popup saat peta bergerak/zoom
    const handleMove = () => {
      if (!mapContainerRef.current || !mapRef.current) return
      const rect = mapContainerRef.current.getBoundingClientRect()
      const mapRect = mapRef.current.getBoundingClientRect()
      const offsetX = mapRect.left - rect.left
      const offsetY = mapRect.top - rect.top

      setMarkerPopup((prev) => {
        if (!prev?.coord) return prev
        const px = map.getPixelFromCoordinate(prev.coord)
        if (!px) return prev
        return { ...prev, x: px[0] + offsetX, y: px[1] + offsetY }
      })
      setAmbulancePopup((prev: any) => {
        if (!prev?.coord) return prev
        const px = map.getPixelFromCoordinate(prev.coord)
        if (!px) return prev
        return { ...prev, x: px[0] + offsetX, y: px[1] + offsetY }
      })
      setHospitalPopup((prev: any) => {
        if (!prev?.coord) return prev
        const px = map.getPixelFromCoordinate(prev.coord)
        if (!px) return prev
        return { ...prev, x: px[0] + offsetX, y: px[1] + offsetY }
      })
    }
    map.on('moveend', handleMove)

        mapInstanceRef.current = map
    setMapInstance(map)

    // Setup Windy Layer via npm ol-wind (async fetch GFS data)
    async function initWindy() {
      try {
        const res = await fetch(`${NEXT_BASE_PATH}/api/gfs`)
        if (!res.ok) return
        const windData = await res.json()
        const baseVelocity = 0.01
        const windLayer = new WindLayer(windData as any, {
          zIndex: 8,
          windOptions: {
            velocityScale: baseVelocity,
            paths: 1000,
            colorScale: [
              'rgb(15,60,140)',
              'rgb(30,100,155)',
              'rgb(70,150,145)',
              'rgb(85,160,115)',
              'rgb(130,180,110)',
              'rgb(175,200,140)',
              'rgb(215,195,60)',
              'rgb(205,160,45)',
              'rgb(210,125,35)',
              'rgb(200,95,20)',
              'rgb(195,70,15)',
              'rgb(185,35,10)',
              'rgb(170,18,8)',
              'rgb(155,8,12)',
              'rgb(115,0,18)',
            ],
            lineWidth: 2,
            generateParticleOption: true,
          },
          fieldOptions: { wrapX: true },
        } as any)
        // Default: sesuaikan dengan showWindyRef (false by default)
        const isWindActive = showWindyRef.current
        ; (windLayer as any).setVisible?.(isWindActive)
        try {
          if (isWindActive && typeof (windLayer as any).start === 'function') {
            ; (windLayer as any).start()
          }
        } catch { }
        map.addLayer(windLayer as any)
        windLayerRef.current = windLayer as any
      } catch (err) {
        console.warn('[DisasterMap] Windy Layer load error (optional):', err)
      }
    }
    void initWindy()

    return () => {
      map.setTarget(undefined)
      mapInstanceRef.current = null
      pulseOverlaysRef.current.forEach((ov) => map.removeOverlay(ov))
      pulseOverlaysRef.current = []
      setMapInstance(null)

      // Destroy Windy Layer safely
      if (windLayerRef.current) {
        destroyWindLayerSafely(windLayerRef.current)
        windLayerRef.current = null
      }

      bnpbAdminLayerRef.current = null
      bnpbHillshadeLayerRef.current = null
      bnpbKepadatanLayerRef.current = null
      bnpbBanjirLayerRef.current = null
      bnpbGempaLayerRef.current = null
      bnpbLongsorLayerRef.current = null
      bnpbKarhutlaLayerRef.current = null
      provinceLayerRef.current = null
      kabupatenLayerRef.current = null
      markerLayerRef.current = null
      eocLayerRef.current = null
      seismicLayerRef.current = null
      volcanoLayerRef.current = null
    }
  }, [])

  // ── Sync Basemap and GeoJSON Layer states ──
  // Pusatkan peta ke lokasi unit PSC saat filter Kode PSC dipilih.
  useEffect(() => {
    const map = mapInstanceRef.current || mapInstance
    if (!map || !selectedPscCenter) return

    const lat = Number(selectedPscCenter.latitude ?? selectedPscCenter.lat)
    const lng = Number(selectedPscCenter.longitude ?? selectedPscCenter.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) < 0.0001 || Math.abs(lng) < 0.0001) return

    map.getView().animate({
      center: fromLonLat([lng, lat]),
      zoom: 10,
      duration: 800,
    })
  }, [mapInstance, selectedPscCenter])

  useEffect(() => {
    const baseMapLayer = baseMapLayerRef.current
    const provinceLayer = provinceLayerRef.current
    const kabupatenLayer = kabupatenLayerRef.current

    if (baseMapLayer) {
      baseMapLayer.setVisible(showBaseMap)
    }

    if (provinceLayer && kabupatenLayer) {
      provinceLayer.setVisible(showGeoJson)
      kabupatenLayer.setVisible(showGeoJson)

      if (showBaseMap && showGeoJson) {
        provinceLayer.setOpacity(0.85)
        kabupatenLayer.setOpacity(0.85)
      } else {
        provinceLayer.setOpacity(1.0)
        kabupatenLayer.setOpacity(1.0)
      }
    }
  }, [showBaseMap, showGeoJson])

  // ── Sync BNPB Layers state ──
  useEffect(() => {
    const visible = !isCallDetailMode
    if (bnpbAdminLayerRef.current) bnpbAdminLayerRef.current.setVisible(visible && showBnpbAdmin)
    if (bnpbHillshadeLayerRef.current) bnpbHillshadeLayerRef.current.setVisible(visible && showBnpbHillshade)
    if (bnpbKepadatanLayerRef.current) bnpbKepadatanLayerRef.current.setVisible(visible && showBnpbKepadatan)
    if (bnpbBanjirLayerRef.current) bnpbBanjirLayerRef.current.setVisible(visible && showBnpbBanjir)
    if (bnpbGempaLayerRef.current) bnpbGempaLayerRef.current.setVisible(visible && showBnpbGempa)
    if (bnpbLongsorLayerRef.current) bnpbLongsorLayerRef.current.setVisible(visible && showBnpbLongsor)
    if (bnpbKarhutlaLayerRef.current) bnpbKarhutlaLayerRef.current.setVisible(visible && showBnpbKarhutla)
  }, [isCallDetailMode, showBnpbAdmin, showBnpbHillshade, showBnpbKepadatan, showBnpbBanjir, showBnpbGempa, showBnpbLongsor, showBnpbKarhutla])

  // ── Sync Windy Layer state ──
  useEffect(() => {
    const wl = windLayerRef.current
    if (wl) {
      wl.setVisible(showWindy)
      try {
        if (showWindy) {
          if (typeof wl.start === 'function') {
            wl.start()
          }
        } else {
          if (typeof wl.stop === 'function') {
            wl.stop()
          }
        }
      } catch (e) { }
      // Force refresh map
      try {
        mapInstance?.renderSync?.()
      } catch { }
    }
  }, [showWindy, mapInstance])


  // Helper untuk update style choropleth layer secara konsisten
  const updateChoroplethStyles = useCallback(() => {
    const provinceLayer = provinceLayerRef.current
    const kabupatenLayer = kabupatenLayerRef.current
    if (!provinceLayer || !kabupatenLayer) return

    const isProvMode = userScope?.mode === 'provinsi'
    const isKabMode = userScope?.mode === 'kabupaten'
    const targetProvKey = cleanKey(userScope?.provinsi?.label || '')
    const targetKabKey = cleanKey(userScope?.kabupaten?.label || '')

    provinceLayer.setStyle((feature: any) => {
      const provKey = cleanKey(getFeatureName(feature, 'provinsi'))
      const count = provinceCounts.get(provKey) || 0

      // Multi-wilayah terpilih via Smart Search Bar
      if (selectedRegions && selectedRegions.length > 0) {
        const isSelectedProv = selectedProvKeys.some(
          (k) => k && (provKey.includes(k) || k.includes(provKey) || (provKey.includes('jakarta') && k.includes('jakarta')) || (provKey.includes('yogyakarta') && k.includes('yogyakarta')))
        )
        if (isSelectedProv) {
          return new Style({
            fill: new Fill({ color: choroplethColor(count, 0.75) }),
            stroke: new Stroke({ color: '#0f766e', width: 2.8 }),
          })
        }
        // Wilayah non-terpilih: Choropleth berskala lebih redup agar persebaran tetap terlihat
        return new Style({
          fill: new Fill({ color: choroplethColor(count, 0.25) }),
          stroke: new Stroke({ color: 'rgba(100, 116, 139, 0.75)', width: 1.0 }),
        })
      }

      if ((isProvMode || isKabMode) && targetProvKey) {
        // Selected province → outline tegas transparan agar layer kabupaten di dalamnya terlihat
        if (provKey === targetProvKey) {
          return new Style({
            fill: new Fill({ color: 'rgba(0,0,0,0)' }),
            stroke: new Stroke({ color: '#9333ea', width: 3.0 })
          })
        }
        // Provinsi lain di-hide / diarsir disabled halus agar peta terfokus
        return new Style({
          fill: new Fill({ color: 'rgba(241, 245, 249, 0.4)' }),
          stroke: new Stroke({ color: 'rgba(148, 163, 184, 0.35)', width: 0.8 })
        })
      }

      // National choropleth style
      return choroplethStyle(count, count > 0 ? String(count) : undefined)
    })

    kabupatenLayer.setStyle((feature: any) => {
      const kabKey = cleanKey(getFeatureName(feature, 'kabupaten'))
      const rawName = getFeatureName(feature, 'kabupaten')
      const formattedName = rawName.replace(/^(KABUPATEN|KAB|KOTA)\s+/i, '').trim()

      if (selectedRegions && selectedRegions.length > 0 && selectedKabKeys.length > 0) {
        const isSelectedKab = selectedKabKeys.some(
          (k) => k && (kabKey.includes(k) || k.includes(kabKey))
        )
        if (isSelectedKab) {
          const polyStyle = new Style({
            fill: new Fill({ color: 'rgba(37, 99, 235, 0.45)' }),
            stroke: new Stroke({ color: '#1d4ed8', width: 2.8 }),
          })
          const textStyle = new Style({
            geometry: (f: any) => getLargestPolygonInteriorPoint(f),
            text: new OlText({
              text: formattedName,
              font: 'bold 11px Inter, sans-serif',
              fill: new Fill({ color: '#0f172a' }),
              stroke: new Stroke({ color: '#ffffff', width: 3.5 }),
              overflow: false
            })
          })
          return [polyStyle, textStyle]
        }
      }

      // Mode Provinsi atau Kabupaten → Batas tegas & Label nama tepat 1 kali per kabupaten pada daratan utama
      if ((isProvMode || isKabMode) && targetProvKey) {
        const isTargetKab = isKabMode && targetKabKey && (kabKey === targetKabKey || kabKey.includes(targetKabKey) || targetKabKey.includes(kabKey))

        // Jika mode kabupaten: wilayah kabupaten lain dibuat redup/disabled agar fokus penuh ke kabupaten target
        if (isKabMode && targetKabKey && !isTargetKab) {
          return new Style({
            fill: new Fill({ color: 'rgba(241, 245, 249, 0.4)' }),
            stroke: new Stroke({ color: 'rgba(203, 213, 225, 0.35)', width: 0.8 }),
          })
        }

        const polyStyle = new Style({
          fill: new Fill({ color: isTargetKab ? 'rgba(15, 118, 110, 0.22)' : 'rgba(254, 240, 138, 0.18)' }),
          stroke: new Stroke({ color: isTargetKab ? '#0f766e' : '#a855f7', width: isTargetKab ? 3.5 : 2.6 }),
        })
        const textStyle = new Style({
          geometry: (f: any) => getLargestPolygonInteriorPoint(f),
          text: new OlText({
            text: formattedName,
            font: isTargetKab ? 'bold 12px Inter, sans-serif' : '10px Inter, sans-serif',
            fill: new Fill({ color: isTargetKab ? '#0f766e' : '#64748b' }),
            stroke: new Stroke({ color: '#ffffff', width: 3.5 }),
            overflow: false
          })
        })
        return [polyStyle, textStyle]
      }

      const count = kabupatenCounts.get(kabKey) || 0
      return choroplethStyle(count)
    })

    provinceLayer.changed()
    kabupatenLayer.changed()
  }, [userScope, provinceCounts, kabupatenCounts, selectedRegions, selectedProvKeys, selectedKabKeys])

  useEffect(() => {
    updateChoroplethStyles()
  }, [updateChoroplethStyles])

  // ─────────────────────────────────────────────
  // Load Province GeoJSON (once)
  // ─────────────────────────────────────────────

  useEffect(() => {
    const map = mapInstance
    const provinceLayer = provinceLayerRef.current
    if (!map || !provinceLayer) return

    const source = provinceLayer.getSource()!
    if (source.getFeatures().length > 0) {
      updateChoroplethStyles()
      return  // already loaded
    }

    const cacheKey = 'level_provinsi'
    const load = (geojson: any) => {
      const features = new GeoJSON().readFeatures(geojson, {
        dataProjection: 'EPSG:4326',
        featureProjection: map.getView().getProjection(),
      })
      source.addFeatures(features)
      updateChoroplethStyles()
    }

    if (geojsonCache[cacheKey]) {
      load(geojsonCache[cacheKey])
    } else {
      setIsLoading(true)
      fetch(`${NEXT_BASE_PATH}/api/wilayah-geojson?level=provinsi`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.success && data.geojson) {
            geojsonCache[cacheKey] = data.geojson
            load(data.geojson)
          } else {
            // fallback lokal
            fetch(`${NEXT_BASE_PATH}/indonesia-provinces.geojson`)
              .then((fr) => fr.json())
              .then((fgeo) => {
                geojsonCache[cacheKey] = fgeo
                load(fgeo)
              })
          }
        })
        .catch(() => {
          fetch(`${NEXT_BASE_PATH}/indonesia-provinces.geojson`)
            .then((fr) => fr.json())
            .then((fgeo) => {
              geojsonCache[cacheKey] = fgeo
              load(fgeo)
            })
            .catch((e) => console.error('GeoJSON provinsi gagal:', e))
        })
        .finally(() => setIsLoading(false))
    }
  }, [mapInstance, updateChoroplethStyles])

  // ─────────────────────────────────────────────
  // Load/Clear Kabupaten GeoJSON based on scope
  // ─────────────────────────────────────────────

  useEffect(() => {
    const map = mapInstance
    const kabupatenLayer = kabupatenLayerRef.current
    if (!map || !kabupatenLayer) return

    const kabSource = kabupatenLayer.getSource()!
    const isProvMode = userScope?.mode === 'provinsi'
    const isKabMode = userScope?.mode === 'kabupaten'
    const provinceName = userScope?.provinsi?.label || ''
    const kabupatenName = userScope?.kabupaten?.label || ''
    const scopeKey = `${userScope?.mode}_${provinceName}_${kabupatenName}`

    if ((isProvMode || isKabMode) && provinceName) {
      const focusMap = (features: any[]) => {
        if (isKabMode && kabupatenName) {
          const cleanTarget = cleanKey(kabupatenName)
          const targetFeature = features.find((f: any) => {
            const props = f.getProperties?.() || {}
            const name = cleanKey(getFeatureName(f, 'kabupaten') || props.name || props.kabupaten || props.WADMKK || props.KAB_KOTA || props.NAME_2 || '')
            return name.includes(cleanTarget) || cleanTarget.includes(name)
          })
          if (targetFeature) {
            const geom = targetFeature.getGeometry()
            if (geom) {
              const extent = geom.getExtent()
              map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 600, maxZoom: 12 })
              return
            }
          }
        }
        const extent = kabSource.getExtent()
        if (extent && features.length > 0) {
          map.getView().fit(extent, { padding: [40, 40, 40, 40], duration: 500 })
        }
      }

      if (lastFetchedProvinceRef.current !== provinceName) {
        lastFetchedProvinceRef.current = provinceName
        const cacheKey = `level_kabupaten_${provinceName}`
        const load = (geojson: any) => {
          kabSource.clear()
          const features = new GeoJSON().readFeatures(geojson, {
            dataProjection: 'EPSG:4326',
            featureProjection: map.getView().getProjection(),
          })
          kabSource.addFeatures(features)
          updateChoroplethStyles()
          if (lastScopeKeyRef.current !== scopeKey) {
            lastScopeKeyRef.current = scopeKey
            focusMap(features)
          }
        }

        if (geojsonCache[cacheKey]) {
          load(geojsonCache[cacheKey])
        } else {
          setIsLoading(true)
          const provUpper = provinceName.toUpperCase()
          const isNtt = provUpper.includes('NUSA TENGGARA TIMUR') || provUpper.includes('NTT')
          const nttFallbackUrl = `${NEXT_BASE_PATH}/data/ntt-kabupaten.geojson`

          const loadNttDirect = () => {
            fetch('/data/ntt-kabupaten.geojson')
              .then((fr) => fr.json())
              .then((fgeo) => {
                geojsonCache[cacheKey] = fgeo
                load(fgeo)
              })
              .catch((err) => console.error('GeoJSON fallback gagal:', err))
          }

          fetch(`/api/wilayah-geojson?level=kabupaten&province=${encodeURIComponent(provinceName)}`)
            .then((r) => r.json())
            .then((data) => {
              if (data?.success && data.geojson) {
                geojsonCache[cacheKey] = data.geojson
                load(data.geojson)
              } else if (isNtt) {
                loadNttDirect()
              }
            })
            .catch((e) => {
              if (isNtt) {
                loadNttDirect()
              } else {
                console.error('GeoJSON kabupaten gagal:', e)
              }
            })
            .finally(() => setIsLoading(false))
        }
      } else {
        updateChoroplethStyles()
        if (lastScopeKeyRef.current !== scopeKey) {
          lastScopeKeyRef.current = scopeKey
          focusMap(kabSource.getFeatures())
        }
      }
    } else {
      lastFetchedProvinceRef.current = null
      kabSource.clear()
      updateChoroplethStyles()
      if (lastScopeKeyRef.current !== scopeKey) {
        lastScopeKeyRef.current = scopeKey
        map.getView().animate({ center: fromLonLat([118, -2.5]), zoom: 4.8, duration: 500 })
      }
    }
  }, [mapInstance, userScope?.mode, userScope?.provinsi?.label, userScope?.kabupaten?.label, updateChoroplethStyles])

  // ─────────────────────────────────────────────
  // Re-style choropleth & multi-region layers when data/selectedRegions changes
  // ─────────────────────────────────────────────

  useEffect(() => {
    updateChoroplethStyles()
  }, [updateChoroplethStyles])

  // Auto-fit map extent saat wilayah terpilih berubah
  useEffect(() => {
    const map = mapInstance
    const provinceLayer = provinceLayerRef.current
    if (!map || !provinceLayer || !selectedRegions || selectedRegions.length === 0) return

    const source = provinceLayer.getSource()
    if (!source) return

    const features = source.getFeatures()
    if (!features || features.length === 0) return

    const matchedFeatures: any[] = []
    features.forEach((f: any) => {
      const provKey = cleanKey(getFeatureName(f, 'provinsi'))
      const isMatch = selectedProvKeys.some(
        (k) => k && (provKey.includes(k) || k.includes(provKey) || (provKey.includes('jakarta') && k.includes('jakarta')) || (provKey.includes('yogyakarta') && k.includes('yogyakarta')))
      )
      if (isMatch) matchedFeatures.push(f)
    })

    if (matchedFeatures.length > 0) {
      const extents = matchedFeatures.map((f: any) => f.getGeometry().getExtent())
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      extents.forEach((e: any) => {
        if (e[0] < minX) minX = e[0]
        if (e[1] < minY) minY = e[1]
        if (e[2] > maxX) maxX = e[2]
        if (e[3] > maxY) maxY = e[3]
      })

      if (minX !== Infinity && maxX !== -Infinity) {
        map.getView().fit([minX, minY, maxX, maxY], { padding: [60, 60, 60, 60], duration: 600 })
      }
    }
  }, [mapInstance, selectedRegions, selectedProvKeys])

  // ── BMKG earthquake data fetch ──
  useEffect(() => {
    let active = true
    async function fetchBmkg() {
      try {
        const res = await fetch('/api/bmkg-gempa')
        if (res.ok) {
          const json = await res.json()
          if (json.success && json.data?.Infogempa?.gempa) {
            const rawList = json.data.Infogempa.gempa
            const list = Array.isArray(rawList) ? rawList : [rawList]

            if (active) {
              setBmkgGempas(list)

            }
          }
        }
      } catch (e) {
        console.error('[BMKG] Failed to fetch earthquake data:', e)
      }
    }

    void fetchBmkg()
    const interval = setInterval(fetchBmkg, 120000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  // ── USGS Live Earthquake fetch (Strictly Indonesia Only) ──
  const fetchUsgsEarthquakes = useCallback(async () => {
    if (!showSeismicLayer || isCallDetailMode) return
    setIsEqLoading(true)
    try {
      const params = new URLSearchParams()
      if (eqCustomStart) {
        params.set('starttime', eqCustomStart)
      } else {
        params.set('days', String(eqDays))
      }
      params.set('minmagnitude', String(eqMinMag))

      const res = await fetch(`${basePath}/api/gempa-usgs?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setLiveEarthquakes(json.data)
        }
      }
    } catch (e) {
      console.error('[USGS] Failed to fetch earthquake data:', e)
    } finally {
      setIsEqLoading(false)
    }
  }, [showSeismicLayer, isCallDetailMode, basePath, eqDays, eqMinMag, eqCustomStart])

  useEffect(() => {
    if (showSeismicLayer && !isCallDetailMode) {
      void fetchUsgsEarthquakes()
    }
  }, [fetchUsgsEarthquakes, showSeismicLayer, isCallDetailMode])

  // ── MAGMA ESDM Volcano fetch ──
  const fetchVolcanoes = useCallback(async () => {
    if (!showVolcanoLayer || isCallDetailMode) return
    setIsVolcanoLoading(true)
    try {
      const res = await fetch(`${basePath}/api/magma-gunung?min_level=${volcanoMinLevel}`)
      if (res.ok) {
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setVolcanoList(json.data)
        }
      }
    } catch (e) {
      console.error('[MAGMA] Failed to fetch volcano data:', e)
    } finally {
      setIsVolcanoLoading(false)
    }
  }, [showVolcanoLayer, isCallDetailMode, basePath, volcanoMinLevel])

  useEffect(() => {
    if (showVolcanoLayer && !isCallDetailMode) {
      void fetchVolcanoes()
    }
  }, [fetchVolcanoes, showVolcanoLayer, isCallDetailMode])

  // ─────────────────────────────────────────────
  // Sync marker features when markers/visibility changes
  // ─────────────────────────────────────────────

  useEffect(() => {
    const markerLayer = markerLayerRef.current
    if (!markerLayer) return

    const source = markerLayer.getSource()!
    source.clear()

    if (!showMarkers || (isFloodEocMode && !isCallDetailMode)) {
      markerLayer.setVisible(false)
      const map = mapInstanceRef.current
      if (map) {
        pulseOverlaysRef.current.forEach((ov) => map.removeOverlay(ov))
        pulseOverlaysRef.current = []
      }
      return
    }

    markerLayer.setVisible(true)

    // Clear old pulse overlays first
    const map = mapInstanceRef.current
    if (map) {
      pulseOverlaysRef.current.forEach((ov) => map.removeOverlay(ov))
      pulseOverlaysRef.current = []
    }

    const validMarkers = filteredMarkers.filter((m) => {
      const rawLat = m.lat !== undefined ? m.lat : (m as any).latitude
      const rawLng = m.lng !== undefined ? m.lng : (m as any).longitude
      const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat || '').trim())
      const lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng || '').trim())
      return !isNaN(lat) && !isNaN(lng) && Math.abs(lat) > 0 && Math.abs(lng) > 0
    })

    const features: Feature<any>[] = validMarkers.map((m) => {
      const rawLat = m.lat !== undefined ? m.lat : (m as any).latitude
      const rawLng = m.lng !== undefined ? m.lng : (m as any).longitude
      const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat || '').trim())
      const lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng || '').trim())
      const feature = new Feature({
        geometry: new Point(fromLonLat([lng, lat])),
        markerData: { ...m, lat, lng },
      })
      feature.setStyle(getCallerMarkerStyle(m))
      return feature
    })

    // Berikan efek radar pulse untuk panggilan gawat darurat aktif
    validMarkers.slice(0, 6).forEach((m) => {
      const isEmergency =
        m.is_krisis === 1 ||
        String(m.kategori_bencana || '') === '1' ||
        String(m.kategori_layanan || '').toLowerCase().includes('emergency') ||
        String(m.jenis_layanan || '').toLowerCase().includes('emergency')
      const isSelesai = String(m.status_penanganan_code || m.status_penanganan || '').toLowerCase().includes('selesai')
      const rawLat = m.lat !== undefined ? m.lat : (m as any).latitude
      const rawLng = m.lng !== undefined ? m.lng : (m as any).longitude
      const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat || '').trim())
      const lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng || '').trim())
      if (isEmergency && !isSelesai && !isNaN(lat) && !isNaN(lng)) {
        createPulseOverlay(lng, lat, 'danger')
      }
    })

    // Add BMKG Gempa Terkini Layer
    if (!isCallDetailMode && showBmkg && bmkgGempas.length > 0) {
      bmkgGempas.forEach((g) => {
        if (g.Coordinates) {
          const [latStr, lngStr] = g.Coordinates.split(',')
          const glat = parseFloat(latStr)
          const glng = parseFloat(lngStr)
          if (!isNaN(glat) && !isNaN(glng)) {
            const gempaFeature = new Feature({
              geometry: new Point(fromLonLat([glng, glat])),
              markerData: {
                kode_trans: `bmkg-${g.DateTime}`,
                jenis_bencana: `Gempa M ${g.Magnitude}`,
                provinsi: g.Potensi,
                kabupaten: `${g.Wilayah} (Kedalaman ${g.Kedalaman})`,
                total_korban: 0,
                lat: glat,
                lng: glng
              }
            })
            gempaFeature.setStyle(new Style({
              image: new CircleStyle({
                radius: 8,
                fill: new Fill({ color: '#f97316' }),
                stroke: new Stroke({ color: '#ffffff', width: 2 })
              })
            }))
            features.push(gempaFeature)

          }
        }
      })
    }

    source.addFeatures(features)

  }, [filteredMarkers, showMarkers, showBmkg, bmkgGempas, createPulseOverlay])

  // ── Sync Ambulance Unit Layer ──
  useEffect(() => {
    const layer = ambulanceLayerRef.current
    if (!layer) return
    const source = layer.getSource()
    if (!source) return
    source.clear()

    if (!showAmbulances || !Array.isArray(ambulances) || ambulances.length === 0) {
      layer.setVisible(false)
      return
    }

    layer.setVisible(true)

    const ambulanceStyle = (isServing: boolean) =>
      new Style({
        image: new Icon({
          src: isServing
            ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36"><circle cx="18" cy="18" r="16" fill="%23f59e0b" stroke="%23ffffff" stroke-width="2.5"/><path d="M10 19h16v5a1 1 0 0 1-1 1h-1.5a2.5 2.5 0 0 1-5 0h-3a2.5 2.5 0 0 1-5 0H10v-6zm0-1l2-5h9l3 5H10z" fill="%23ffffff"/><circle cx="13.5" cy="25" r="1.5" fill="%23f59e0b"/><circle cx="21.5" cy="25" r="1.5" fill="%23f59e0b"/><rect x="16" y="15" width="2" height="6" fill="%23dc2626"/><rect x="14" y="17" width="6" height="2" fill="%23dc2626"/></svg>'
            : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36"><circle cx="18" cy="18" r="16" fill="%230284c7" stroke="%23ffffff" stroke-width="2.5"/><path d="M10 19h16v5a1 1 0 0 1-1 1h-1.5a2.5 2.5 0 0 1-5 0h-3a2.5 2.5 0 0 1-5 0H10v-6zm0-1l2-5h9l3 5H10z" fill="%23ffffff"/><circle cx="13.5" cy="25" r="1.5" fill="%230284c7"/><circle cx="21.5" cy="25" r="1.5" fill="%230284c7"/><rect x="16" y="15" width="2" height="6" fill="%23dc2626"/><rect x="14" y="17" width="6" height="2" fill="%23dc2626"/></svg>',
          scale: 0.9,
        }),
      })

    const features: Feature<any>[] = []
    ambulances.forEach((a: any) => {
      const lat = a.lat !== undefined ? Number(a.lat) : parseFloat(a.latitude)
      const lng = a.lng !== undefined ? Number(a.lng) : parseFloat(a.longitude)
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) > 0) {
        const isServing = String(a.status_aktif || '').toLowerCase().includes('tugas') || String(a.status_aktif || '').toLowerCase().includes('layan')
        const feat = new Feature({
          geometry: new Point(fromLonLat([lng, lat])),
          ambulanceData: a,
        })
        feat.setStyle(ambulanceStyle(isServing))
        features.push(feat)
      }
    })

    source.addFeatures(features)
  }, [ambulances, showAmbulances])

  // ── Sync Hospital & Referral Sarana Layer ──
  useEffect(() => {
    const layer = hospitalLayerRef.current
    if (!layer) return
    const source = layer.getSource()
    if (!source) return
    source.clear()

    if (!showHospitals || !Array.isArray(hospitals) || hospitals.length === 0) {
      layer.setVisible(false)
      return
    }

    layer.setVisible(true)

    const hospitalStyle = new Style({
      image: new Icon({
        src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="34" height="34"><circle cx="17" cy="17" r="15" fill="%23059669" stroke="%23ffffff" stroke-width="2.5"/><rect x="14.5" y="8" width="5" height="18" rx="1.5" fill="%23ffffff"/><rect x="8" y="14.5" width="18" height="5" rx="1.5" fill="%23ffffff"/></svg>',
        scale: 0.85,
      }),
    })

    const features: Feature<any>[] = []
    hospitals.forEach((h: any) => {
      const lat = h.lat !== undefined ? Number(h.lat) : parseFloat(h.latitude)
      const lng = h.lng !== undefined ? Number(h.lng) : parseFloat(h.longitude)
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) > 0) {
        const feat = new Feature({
          geometry: new Point(fromLonLat([lng, lat])),
          hospitalData: h,
        })
        feat.setStyle(hospitalStyle)
        features.push(feat)
      }
    })

    source.addFeatures(features)
  }, [hospitals, showHospitals])

  // ── Sync Dedicated Seismic (Earthquake USGS) Layer ──
  useEffect(() => {
    const layer = seismicLayerRef.current
    if (!layer) return
    const source = layer.getSource()
    if (!source) return
    source.clear()

    if (!showSeismicLayer || isCallDetailMode || !Array.isArray(activeEqList) || activeEqList.length === 0) {
      layer.setVisible(false)
      return
    }

    layer.setVisible(true)

    let mainshockIdx = 0
    let maxMag = -1
    activeEqList.forEach((eq: any, i: number) => {
      const m = Number(eq.magnitude || 0)
      if (eq.isMainshock || m > maxMag) {
        maxMag = m
        mainshockIdx = i
      }
    })

    activeEqList.forEach((eq: any, idx: number) => {
      const eqLat = Number(eq.lat || 0)
      const eqLng = Number(eq.lng || 0)
      if (eqLat !== 0 && eqLng !== 0) {
        const mag = Number(eq.magnitude || 0)
        const isMain = idx === mainshockIdx

        if (isMain) {
          const primaryRadiusKm = Math.min(80, Math.max(35, (mag - 3) * 12))
          const shockCircle = new Feature({
            geometry: new CircleGeom(fromLonLat([eqLng, eqLat]), primaryRadiusKm * 1000),
            id: 'eq-circle-main'
          })
          shockCircle.setStyle(new Style({
            fill: new Fill({ color: 'rgba(220, 38, 38, 0.07)' }),
            stroke: new Stroke({
              color: 'rgba(220, 38, 38, 0.75)',
              width: 2.2,
              lineDash: [6, 6]
            })
          }))
          source.addFeature(shockCircle)

          const innerRadiusKm = Math.max(15, primaryRadiusKm * 0.45)
          const innerShockCircle = new Feature({
            geometry: new CircleGeom(fromLonLat([eqLng, eqLat]), innerRadiusKm * 1000),
            id: 'eq-circle-inner'
          })
          innerShockCircle.setStyle(new Style({
            fill: new Fill({ color: 'rgba(220, 38, 38, 0.12)' }),
            stroke: new Stroke({
              color: '#dc2626',
              width: 1.5
            })
          }))
          source.addFeature(innerShockCircle)

          createPulseOverlay(eqLng, eqLat, 'danger')
        }

        const eqFeat = new Feature({
          geometry: new Point(fromLonLat([eqLng, eqLat])),
          id: `eq-point-${idx}`,
          name: `${isMain ? '★ Episentrum Gempa Utama' : '⚡ Titik Gempa Susulan'} M ${mag.toFixed(1)} - ${eq.place || 'Indonesia'}`,
          rawItem: {
            ...eq,
            latitude: eqLat,
            longitude: eqLng
          },
          itemType: 'earthquake'
        })

        if (isMain) {
          eqFeat.setStyle(new Style({
            image: new Icon({
              src: getSvgMainshockPin(mag),
              scale: 1.0,
              anchor: [0.5, 0.92]
            }),
            zIndex: 100
          }))
        } else {
          eqFeat.setStyle(new Style({
            image: new Icon({
              src: getSvgAftershockNode(mag),
              scale: 1.0,
              anchor: [0.5, 0.5]
            }),
            zIndex: Math.round(mag * 10)
          }))
        }

        source.addFeature(eqFeat)
      }
    })
  }, [showSeismicLayer, isCallDetailMode, activeEqList, createPulseOverlay])

  // ── Sync Dedicated Volcano (MAGMA ESDM) Layer ──
  useEffect(() => {
    const layer = volcanoLayerRef.current
    if (!layer) return
    const source = layer.getSource()
    if (!source) return
    source.clear()

    if (!showVolcanoLayer || isCallDetailMode || !Array.isArray(volcanoList) || volcanoList.length === 0) {
      layer.setVisible(false)
      return
    }

    layer.setVisible(true)

    volcanoList.forEach((v: any, idx: number) => {
      const vLat = Number(v.lat || 0)
      const vLng = Number(v.lng || 0)
      if (vLat !== 0 && vLng !== 0) {
        const level = Number(v.level || 1)
        const color = v.statusColor || (level === 4 ? '#dc2626' : level === 3 ? '#ea580c' : level === 2 ? '#eab308' : '#10b981')

        if (level >= 3 && v.hazardRadiusKm > 0) {
          const radiusMeters = v.hazardRadiusKm * 1000
          const hazardCircle = new Feature({
            geometry: new CircleGeom(fromLonLat([vLng, vLat]), radiusMeters),
            id: `volcano-circle-${idx}`
          })
          hazardCircle.setStyle(new Style({
            fill: new Fill({ color: level === 4 ? 'rgba(220, 38, 38, 0.15)' : 'rgba(234, 88, 12, 0.12)' }),
            stroke: new Stroke({
              color: color,
              width: 2,
              lineDash: [4, 4]
            })
          }))
          source.addFeature(hazardCircle)

          if (level === 4) {
            createPulseOverlay(vLng, vLat, 'danger')
          }
        }

        const vFeat = new Feature({
          geometry: new Point(fromLonLat([vLng, vLat])),
          id: `volcano-${idx}`,
          name: `🌋 ${v.nama} (${v.status})`,
          rawItem: {
            ...v,
            latitude: vLat,
            longitude: vLng
          },
          itemType: 'volcano'
        })

        vFeat.setStyle(new Style({
          image: new Icon({
            src: getSvgVolcanoPin(level, color),
            scale: level >= 3 ? 1.05 : 0.85,
            anchor: [0.5, 0.95]
          }),
          zIndex: 50 + level * 10
        }))

        source.addFeature(vFeat)
      }
    })
  }, [showVolcanoLayer, isCallDetailMode, volcanoList, createPulseOverlay])

  // ── Sync EOC Routing & Faskes Layer ──
  useEffect(() => {
    const eocLayer = eocLayerRef.current
    if (!eocLayer) return

    const map = mapInstanceRef.current || mapInstance
    if (!map) return

    const source = eocLayer.getSource()!
    source.clear()

    if ((!isFloodEocMode && !isCallDetailMode) || !showEocRoute) {
      eocLayer.setVisible(false)
      return
    }

    eocLayer.setVisible(true)

    // Start coordinates (center of disaster or current view center)
    const firstMarker = markers && markers[0]
    const currentCenter = map.getView()?.getCenter()
    const centerCoords = currentCenter ? toLonLat(currentCenter) : [118.0, -2.5]
    const startLat = firstMarker ? Number(firstMarker.lat) : Number(centerCoords[1] || -2.5)
    const startLng = firstMarker ? Number(firstMarker.lng) : Number(centerCoords[0] || 118.0)

    const getSvgPin = (color: string, iconType: 'flood' | 'gempa' | 'hospital' | 'clinic' | 'pustu' | 'shelter' | 'disaster' | 'tck' | 'earthquake') => {
      let inner = '<circle cx="12" cy="10" r="3" fill="' + color + '"/>'
      if (iconType === 'hospital') {
        inner = '<path d="M12 6v8M8 10h8" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round"/><path d="M9 18h6" stroke="#ffffff" stroke-width="1.8"/>'
      } else if (iconType === 'clinic') {
        inner = '<path d="M12 6.5v7M8.5 10h7" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>'
      } else if (iconType === 'pustu') {
        inner = '<path d="M12 7v6M9 10h6" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>'
      } else if (iconType === 'shelter') {
        inner = '<path d="M12 6l5 4.5v5.5H7v-5.5l5-4.5z" stroke="#ffffff" stroke-width="2" fill="rgba(255,255,255,0.2)"/>'
      } else if (iconType === 'tck') {
        // Tenaga Cadangan Kesehatan (TCK) - Dokter / Personil Medis Siaga
        inner = '<circle cx="12" cy="7.2" r="2.8" fill="#ffffff"/><path d="M6.5 16c0-2.8 2.5-4.8 5.5-4.8s5.5 2 5.5 4.8" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M12 12v3.2M10.4 13.6h3.2" stroke="' + color + '" stroke-width="1.3" stroke-linecap="round"/>'
      } else if (iconType === 'flood' || iconType === 'gempa' || iconType === 'disaster') {
        inner = '<circle cx="12" cy="10" r="3.5" fill="#ffffff"/><circle cx="12" cy="10" r="1.5" fill="' + color + '"/>'
      } else if (iconType === 'earthquake') {
        inner = '<circle cx="12" cy="10" r="4.5" fill="#ffffff"/><path d="M12 6.5l-2 3.5h2l-1.5 3.5 3.5-4h-2l1.5-3z" fill="' + color + '"/>'
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="34" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" fill="${color}" opacity="0.95"/>${inner}</svg>`
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
    }

    const getSvgMainshockPin = (mag: number) => {
      const magText = mag > 0 ? (mag >= 10 ? mag.toFixed(0) : mag.toFixed(1)) : ''
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54" fill="none">
        <circle cx="23" cy="20" r="19" fill="rgba(220, 38, 38, 0.25)" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3 3"/>
        <path d="M23 4C14.16 4 7 11.16 7 20C7 31 23 50 23 50S39 31 39 20C39 11.16 31.84 4 23 4Z" fill="#dc2626" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="23" cy="20" r="11" fill="#ffffff"/>
        <text x="23" y="24" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="900" fill="#991b1b">${magText ? `M ${magText}` : 'GEMPA'}</text>
      </svg>`
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
    }

    const getSvgAftershockNode = (mag: number) => {
      if (mag >= 6.0) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="#b91c1c" stroke="#ffffff" stroke-width="2.5"/>
          <text x="12" y="15.5" text-anchor="middle" font-family="system-ui, sans-serif" font-size="8.5" font-weight="900" fill="#ffffff">${mag.toFixed(1)}</text>
        </svg>`
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
      }
      if (mag >= 5.0) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="8" fill="#ea580c" stroke="#ffffff" stroke-width="2"/>
          <text x="10" y="13" text-anchor="middle" font-family="system-ui, sans-serif" font-size="7.5" font-weight="900" fill="#ffffff">${mag.toFixed(1)}</text>
        </svg>`
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
      }
      if (mag >= 4.0) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5.5" fill="#f59e0b" stroke="#ffffff" stroke-width="1.8"/>
        </svg>`
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
        <circle cx="5" cy="5" r="4" fill="#fbbf24" stroke="#ffffff" stroke-width="1.2"/>
      </svg>`
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
    }

    // 1. Add disaster location pins and pulsing radius circle ONLY on the main epicenter/target
    if (showMarkers && !isCallDetailMode) {
      const validDisasterMarkers = Array.isArray(markers) ? markers : []

      validDisasterMarkers.forEach((m: any, idx: number) => {
        if (m.lat && m.lng && Number(m.lat) !== 0 && Number(m.lng) !== 0) {
          const lat = Number(m.lat)
          const lng = Number(m.lng)
          const isEpicenter = !!m.isEpicenter || idx === 0

          // Draw pin marker
          const disasterFeat = new Feature({
            geometry: new Point(fromLonLat([lng, lat])),
            id: `disaster-${idx}`,
            name: m.nama || (m.nama_desa ? `Kec. ${m.kecamatan || ''}, Desa ${m.nama_desa}` : (isEpicenter ? (m.jenis_bencana ? `Pusat Episentrum ${m.jenis_bencana}` : 'Pusat Episentrum Gempa') : `Titik Dampak - ${m.kabupaten || 'Kabupaten'}`)),
            rawItem: m,
            itemType: 'disaster'
          })
          disasterFeat.setStyle(new Style({
            image: new Icon({
              src: getSvgPin(isEpicenter ? '#dc2626' : '#ea580c', 'disaster'),
              scale: isEpicenter ? 1.05 : 0.78,
              anchor: [0.5, 1]
            }),
            zIndex: isEpicenter ? 100 : 50
          }))
          source.addFeature(disasterFeat)

          // Draw concentric impact radius rings on epicenter and radar pulse overlay on all disaster points
          if (isEpicenter) {
            const concentricRings = [
              { km: 5, stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.20)' },
              { km: 15, stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.15)' },
              { km: 35, stroke: '#eab308', fill: 'rgba(234, 179, 8, 0.10)' },
              { km: 60, stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.08)' }
            ]

            concentricRings.forEach((r) => {
              const circleFeat = new Feature({
                geometry: new CircleGeom(fromLonLat([lng, lat]), r.km * 1000),
                id: `pulse-circle-${idx}-${r.km}`
              })
              circleFeat.setStyle(new Style({
                fill: new Fill({ color: r.fill }),
                stroke: new Stroke({
                  color: r.stroke,
                  width: 2.0,
                  lineDash: [6, 6]
                })
              }))
              source.addFeature(circleFeat)
            })

            // Inner core zone for epicenter
            const innerCircle = new Feature({
              geometry: new CircleGeom(fromLonLat([lng, lat]), 2500),
              id: `pulse-inner-${idx}`
            })
            innerCircle.setStyle(new Style({
              fill: new Fill({ color: 'rgba(220, 38, 38, 0.28)' }),
              stroke: new Stroke({ color: 'rgba(185, 28, 28, 0.95)', width: 1.8 })
            }))
            source.addFeature(innerCircle)
          }

          // Trigger radar overlay bip-bip denyut (always active like on TV display)
          createPulseOverlay(lng, lat, isEpicenter ? 'danger' : 'warning')
        }
      })
    }

    // 1.5. Add Real Earthquake Points & Epicenters (from USGS/BMKG API - Strictly Indonesia)
    if (!isCallDetailMode && showSeismicLayer && Array.isArray(activeEqList) && activeEqList.length > 0) {
      // Identify mainshock index (highest magnitude or marked isMainshock)
      let mainshockIdx = 0
      let maxMag = -1
      activeEqList.forEach((eq: any, i: number) => {
        const m = Number(eq.magnitude || 0)
        if (eq.isMainshock || m > maxMag) {
          maxMag = m
          mainshockIdx = i
        }
      })

      activeEqList.forEach((eq: any, idx: number) => {
        const eqLat = Number(eq.lat || 0)
        const eqLng = Number(eq.lng || 0)
        if (eqLat !== 0 && eqLng !== 0) {
          const mag = Number(eq.magnitude || 0)
          const isMain = idx === mainshockIdx

          // Only the Mainshock gets the Primary Isoseismal / Shake Impact Circles (zona guncangan utama)
          if (isMain) {
            const primaryRadiusKm = Math.min(80, Math.max(35, (mag - 3) * 12))
            const shockCircle = new Feature({
              geometry: new CircleGeom(fromLonLat([eqLng, eqLat]), primaryRadiusKm * 1000),
              id: `eq-circle-main`
            })
            shockCircle.setStyle(new Style({
              fill: new Fill({ color: 'rgba(220, 38, 38, 0.07)' }),
              stroke: new Stroke({
                color: 'rgba(220, 38, 38, 0.75)',
                width: 2.2,
                lineDash: [6, 6]
              })
            }))
            source.addFeature(shockCircle)

            // Inner Severe Shaking Zone (MMI VII-VIII)
            const innerRadiusKm = Math.max(15, primaryRadiusKm * 0.45)
            const innerShockCircle = new Feature({
              geometry: new CircleGeom(fromLonLat([eqLng, eqLat]), innerRadiusKm * 1000),
              id: `eq-circle-inner`
            })
            innerShockCircle.setStyle(new Style({
              fill: new Fill({ color: 'rgba(220, 38, 38, 0.12)' }),
              stroke: new Stroke({
                color: '#dc2626',
                width: 1.5
              })
            }))
            source.addFeature(innerShockCircle)

            // Pulse overlay on mainshock epicenter
            createPulseOverlay(eqLng, eqLat, 'danger')
          }

          // Epicenter / Aftershock marker feature
          const eqFeat = new Feature({
            geometry: new Point(fromLonLat([eqLng, eqLat])),
            id: `eq-point-${idx}`,
            name: `${isMain ? '★ Episentrum Gempa Utama' : '⚡ Titik Gempa Susulan'} M ${mag.toFixed(1)} - ${eq.place || 'Indonesia'}`,
            rawItem: {
              ...eq,
              latitude: eqLat,
              longitude: eqLng
            },
            itemType: 'earthquake'
          })

          if (isMain) {
            eqFeat.setStyle(new Style({
              image: new Icon({
                src: getSvgMainshockPin(mag),
                scale: 1.0,
                anchor: [0.5, 0.92]
              }),
              zIndex: 100
            }))
          } else {
            eqFeat.setStyle(new Style({
              image: new Icon({
                src: getSvgAftershockNode(mag),
                scale: 1.0,
                anchor: [0.5, 0.5]
              }),
              zIndex: Math.round(mag * 10)
            }))
          }

          source.addFeature(eqFeat)
        }
      })
    }

    // 2. Add Faskes List (Filtered by Checkboxes: RS, Puskesmas, Klinik, Pustu, Siaga Only)
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
    const rawFaskesList = Array.isArray(faskesList) ? faskesList : []
    const hasAnyCategoryChecked = faskesTypeFilters.rs || faskesTypeFilters.puskesmas || faskesTypeFilters.klinik || faskesTypeFilters.pustu

    if (hasAnyCategoryChecked || faskesTypeFilters.siagaOnly) {
      rawFaskesList.forEach((f: any, idx: number) => {
        const fLat = Number(f.latitude || f.lat || 0)
        const fLng = Number(f.longitude || f.lng || 0)
        if (fLat !== 0 && fLng !== 0) {
          // Strict NTT Bounding Box check when in NTT event / provincial mode:
          if (isFloodEocMode) {
            if (fLat < -11.6 || fLat > -7.5 || fLng < 118.5 || fLng > 125.5) {
              return // Skip faskes located outside NTT province
            }
          }

          // Categorize using shared helper for consistency with count display
          const category = categorizeFaskes(f)

          // Patient triage check (merawat pasien bencana)
          const totPasien = Number(f.total_pasien || 0) || (Number(f.triase_merah || 0) + Number(f.triase_kuning || 0) + Number(f.triase_hijau || 0) + Number(f.triase_hitam || 0))
          const hasTriage = totPasien > 0

          // If Siaga Only is active, must have triage patients
          if (faskesTypeFilters.siagaOnly && !hasTriage) return

          // Category filtering:
          if (hasAnyCategoryChecked) {
            if (category === 'rs' && !faskesTypeFilters.rs) return
            if (category === 'puskesmas' && !faskesTypeFilters.puskesmas) return
            if (category === 'klinik' && !faskesTypeFilters.klinik) return
            if (category === 'pustu' && !faskesTypeFilters.pustu) return
          }

          let itemCategory: 'hospital' | 'clinic' | 'pustu' = 'clinic'
          if (category === 'rs') {
            itemCategory = 'hospital'
          } else if (category === 'pustu') {
            itemCategory = 'pustu'
          } else if (category === 'klinik') {
            itemCategory = 'clinic'
          }

          const fFeat = new Feature({
            geometry: new Point(fromLonLat([fLng, fLat])),
            id: f.nama || `faskes-${idx}`,
            name: f.nama || f.nama_faskes,
            rawItem: f,
            itemType: itemCategory
          })

          let faskesIconSrc = `${basePath}/puskes.svg`
          if (category === 'rs') {
            faskesIconSrc = `${basePath}/rs.svg`
          } else if (category === 'puskesmas') {
            faskesIconSrc = `${basePath}/puskes.svg`
          } else if (category === 'klinik') {
            faskesIconSrc = `${basePath}/klinik.svg`
          } else if (category === 'pustu') {
            faskesIconSrc = `${basePath}/pustu.svg`
          }

          fFeat.setStyle(new Style({
            image: new Icon({
              src: faskesIconSrc,
              size: [102.46, 102.46],
              scale: 0.28,
              anchor: [0.5, 0.5]
            })
          }))
          source.addFeature(fFeat)
        }
      })
    }

      // 2b. Add Faskes Terdampak/Rusak (pin merah — dari data inputan RHA)
      const fRusakList = Array.isArray(faskesRusakList) ? faskesRusakList : []
      fRusakList.forEach((f: any, idx: number) => {
        const fLat = Number(f.latitude || f.lat || 0)
        const fLng = Number(f.longitude || f.lng || 0)
        // Only show on map if has coordinates within NTT bounds
        if (fLat !== 0 && fLng !== 0) {
          if (isFloodEocMode) {
            if (fLat < -11.6 || fLat > -7.5 || fLng < 118.5 || fLng > 125.5) {
              return
            }
          }

          // Categorize using shared helper for consistency
          const category = categorizeFaskes(f)

          // Patient triage check
          const totPasien = Number(f.total_pasien || 0) || (Number(f.triase_merah || 0) + Number(f.triase_kuning || 0) + Number(f.triase_hijau || 0) + Number(f.triase_hitam || 0))
          const hasTriage = totPasien > 0

          if (faskesTypeFilters.siagaOnly && !hasTriage) return

          if (hasAnyCategoryChecked) {
            if (category === 'rs' && !faskesTypeFilters.rs) return
            if (category === 'puskesmas' && !faskesTypeFilters.puskesmas) return
            if (category === 'klinik' && !faskesTypeFilters.klinik) return
            if (category === 'pustu' && !faskesTypeFilters.pustu) return
          }

          const hasDamage = Number(f.rusak_berat || 0) > 0 || 
                            Number(f.rusak_sedang || 0) > 0 || 
                            Number(f.rusak_ringan || 0) > 0 || 
                            String(f.kondisi_bangunan || '').toLowerCase().includes('rusak') || 
                            String(f.kondisi_faskes || '').toLowerCase().includes('rusak') ||
                            String(f.status || '').toLowerCase().includes('rusak') ||
                            String(f.status || '').toLowerCase().includes('tutup')
          const fFeat = new Feature({
            geometry: new Point(fromLonLat([fLng, fLat])),
            id: `rusak-${f.nama_faskes || f.nama || idx}`,
            name: f.nama_faskes || f.nama || (hasDamage ? 'Faskes Terdampak' : 'Faskes Siaga'),
            rawItem: { ...f, _isTerdampak: hasDamage },
            itemType: category === 'rs' ? 'hospital' : category === 'pustu' ? 'pustu' : 'clinic'
          })

          let rusakIconSrc = `${basePath}/puskes.svg`
          if (category === 'rs') {
            rusakIconSrc = `${basePath}/rs.svg`
          } else if (category === 'puskesmas') {
            rusakIconSrc = `${basePath}/puskes.svg`
          } else if (category === 'klinik') {
            rusakIconSrc = `${basePath}/klinik.svg`
          } else if (category === 'pustu') {
            rusakIconSrc = `${basePath}/pustu.svg`
          }

          fFeat.setStyle(new Style({
            image: new Icon({
              src: rusakIconSrc,
              size: [102.46, 102.46],
              scale: 0.28,
              anchor: [0.5, 0.5]
            })
          }))
          source.addFeature(fFeat)
        }
      })

    // 3. Add Posko List (if enabled)
    if (!isCallDetailMode && showPosko) {
      const pList = Array.isArray(poskoList) ? poskoList : []
      pList.forEach((pos: any, idx: number) => {
        const pLat = Number(pos.latitude || pos.lat || 0)
        const pLng = Number(pos.longitude || pos.lng || 0)
        if (pLat !== 0 && pLng !== 0) {
          if (isFloodEocMode) {
            if (pLat < -11.6 || pLat > -7.5 || pLng < 118.5 || pLng > 125.5) {
              return
            }
          }

          const pFeat = new Feature({
            geometry: new Point(fromLonLat([pLng, pLat])),
            id: pos.nama || `posko-${idx}`,
            name: pos.nama || `Posko ${pos.kecamatan || ''}`,
            rawItem: pos,
            itemType: 'shelter'
          })
          pFeat.setStyle(new Style({
            image: new Icon({
              src: `${basePath}/posyandu.svg`,
              scale: 0.08,
              anchor: [0.5, 0.5]
            })
          }))
          source.addFeature(pFeat)
        }
      })
    }

    // 4. Add TCK Relawan List (if enabled)
    if (!isCallDetailMode && showTckLayer) {
      const tList = Array.isArray(tckList) ? tckList : []
      const nttKabCoords: Record<string, [number, number]> = {
        'mangga': [-8.62, 120.46],
        'manggarai timur': [-8.65, 120.57],
        'manggarai barat': [-8.56, 119.98],
        'flores timur': [-8.33, 122.98],
        'lembata': [-8.37, 123.54],
        'sikka': [-8.62, 122.21],
        'ende': [-8.84, 121.65],
        'ngada': [-8.78, 120.97],
        'nagekeo': [-8.70, 121.28],
        'alor': [-8.29, 124.57],
        'timor tengah selatan': [-9.86, 124.28],
        'kupang': [-10.17, 123.60]
      }

      tList.forEach((tck: any, idx: number) => {
        let tLat = Number(tck.latitude || tck.lat || 0)
        let tLng = Number(tck.longitude || tck.lng || 0)

        // If no explicit coordinates, attempt matching with faskesList or NTB/NTT kabupaten center
        if (tLat === 0 || tLng === 0) {
          const occ = String(tck.pekerjaan || '').toLowerCase()
          const matchedF = rawFaskesList.find((f: any) => {
            const fName = String(f.nama || '').toLowerCase()
            return occ && (fName.includes(occ) || occ.includes(fName))
          })

          if (matchedF && (matchedF.latitude || matchedF.lat)) {
            const jitterLat = ((idx % 7) - 3) * 0.002
            const jitterLng = (((idx * 3) % 7) - 3) * 0.002
            tLat = Number(matchedF.latitude || matchedF.lat) + jitterLat
            tLng = Number(matchedF.longitude || matchedF.lng) + jitterLng
          } else {
            const kabStr = String(tck.kab_kota || '').toLowerCase()
            let matchedCoords: [number, number] | null = null
            for (const [kKey, coords] of Object.entries(nttKabCoords)) {
              if (kabStr.includes(kKey)) {
                matchedCoords = coords
                break
              }
            }
            if (!matchedCoords) {
              matchedCoords = [startLat || -8.62, startLng || 120.46]
            }
            const jitterLat = ((idx % 9) - 4) * 0.004
            const jitterLng = (((idx * 2) % 9) - 4) * 0.004
            tLat = matchedCoords[0] + jitterLat
            tLng = matchedCoords[1] + jitterLng
          }
        }

        if (tLat !== 0 && tLng !== 0) {
          if (isFloodEocMode) {
            if (tLat < -11.6 || tLat > -7.5 || tLng < 118.5 || tLng > 125.5) {
              return
            }
          }

          const tFeat = new Feature({
            geometry: new Point(fromLonLat([tLng, tLat])),
            id: tck.id_relawan || `tck-${idx}`,
            name: tck.nama || 'Relawan TCK Kemkes',
            rawItem: {
              ...tck,
              latitude: tLat,
              longitude: tLng
            },
            itemType: 'tck'
          })
          tFeat.setStyle(new Style({
            image: new Icon({
              src: `${basePath}/tck.svg`,
              size: [102.46, 102.46],
              scale: 0.28,
              anchor: [0.5, 0.5]
            })
          }))
          source.addFeature(tFeat)
        }
      })
    }

    // 4. Draw route if active
    if (routeCoords && routeCoords.length > 0) {
      const lineCoords = routeCoords.map((c) => fromLonLat(c))
      const routeFeat = new Feature({
        geometry: new LineString(lineCoords),
        id: 'route-line'
      })
      routeFeat.setStyle(new Style({
        stroke: new Stroke({
          color: '#0284c7',
          width: 4.5,
          lineDash: [4, 6]
        })
      }))
      source.addFeature(routeFeat)
    }

    // Zoom view to encompass route or center ONLY ONCE when target ID changes
    if (map && selectedRouteTarget && selectedRouteTarget.id !== prevTargetIdRef.current) {
      prevTargetIdRef.current = selectedRouteTarget.id
      map.getView().animate({
        center: fromLonLat([Number(selectedRouteTarget.longitude), Number(selectedRouteTarget.latitude)]),
        zoom: 13,
        duration: 700
      })
    } else if (!selectedRouteTarget) {
      prevTargetIdRef.current = null
      // Auto-fit directly to NTT / Flores disaster area extent when in EOC detail mode
      if (map && isFloodEocMode && source.getFeatures().length > 0) {
        const ext = source.getExtent()
        if (ext && ext.length === 4 && isFinite(ext[0]) && isFinite(ext[1]) && isFinite(ext[2]) && isFinite(ext[3])) {
          map.getView().fit(ext, { padding: [50, 50, 50, 50], maxZoom: 9.5, duration: 600 })
        } else {
          const firstM = markers && markers[0]
          const cLng = firstM?.lng ? Number(firstM.lng) : 121.5
          const cLat = firstM?.lat ? Number(firstM.lat) : -8.6
        }
      }
    }

    return () => {
      if (map) {
        pulseOverlaysRef.current.forEach(ov => map.removeOverlay(ov))
        pulseOverlaysRef.current = []
      }
    }
  }, [showEocRoute, isFloodEocMode, isCallDetailMode, showMarkers, showPosko, showTckLayer, showSeismicLayer, earthquakePoints, activeEqList, tckList, faskesList, faskesRusakList, faskesTypeFilters, poskoList, selectedRouteTarget, routeCoords, markers, mapInstance, pulseRadius])

  // ─────────────────────────────────────────────
  // Legend / UI data
  // ─────────────────────────────────────────────

  const markerTitle = userScope?.mode === 'provinsi' || userScope?.mode === 'kabupaten'
    ? 'SEBARAN KEJADIAN PER KABUPATEN/KOTA'
    : 'SEBARAN KEJADIAN PER PROVINSI'

  const choroplethLegend = [
    { label: '0 kejadian', color: 'rgba(241, 245, 249, 0.8)' },
    { label: '1 – 10 kejadian', color: '#facc15' },
    { label: '11 – 30 kejadian', color: '#f97316' },
    { label: '31 – 50 kejadian', color: '#ef4444' },
    { label: '> 50 kejadian', color: '#991b1b' },
  ]

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div
      ref={mapContainerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#f1fcfc]"
    >
      {/* Floating Layer Switcher for PSC Map (Dihidden sementara sesuai permintaan user) */}
      {/*
      <div className="absolute top-3.5 left-3.5 z-20 flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-md text-xs font-bold">
        <button
          type="button"
          onClick={() => setShowMarkers((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
            showMarkers
              ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-xs'
              : 'bg-slate-100 text-slate-400 border border-transparent line-through'
          }`}
          title="Tampilkan/Sembunyikan Titik Panggilan 119"
        >
          <span className={`flex h-4 w-4 items-center justify-center rounded-full ${showMarkers ? 'bg-rose-600 text-white' : 'bg-slate-400 text-slate-100'}`}>
            <User className="h-2.5 w-2.5" />
          </span>
          <span>Titik Panggilan {markers?.length ? `(${markers.length})` : ''}</span>
        </button>

        {ambulances && ambulances.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAmbulances((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              showAmbulances
                ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-xs'
                : 'bg-slate-100 text-slate-400 border border-transparent opacity-60'
            }`}
            title="Tampilkan/Sembunyikan Armada Ambulans PSC"
          >
            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${showAmbulances ? 'bg-amber-500 text-white' : 'bg-slate-400 text-slate-100'}`}>
              <Ambulance className="h-2.5 w-2.5" />
            </span>
            <span>Ambulans ({ambulances.length})</span>
          </button>
        )}

        {hospitals && hospitals.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHospitals((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              showHospitals
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs'
                : 'bg-slate-100 text-slate-400 border border-transparent opacity-60'
            }`}
            title="Tampilkan/Sembunyikan RS Rujukan"
          >
            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${showHospitals ? 'bg-emerald-600 text-white' : 'bg-slate-400 text-slate-100'}`}>
              <Building2 className="h-2.5 w-2.5" />
            </span>
            <span>RS Rujukan ({hospitals.length})</span>
          </button>
        )}
      </div>
      */}

      {/* Floating EOC Route details card on the left side of the map (Hanya tampil saat rute aktif/diklik) */}
      {isFloodEocMode && showEocRoute && selectedRouteTarget && (
        <div className="absolute top-4 left-4 z-20 w-80 max-h-[85%] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-left-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Compass className="h-3.5 w-3.5 text-teal-700" />
                {isCallDetailMode ? 'Info Rute Panggilan & Rujukan' : 'Info Rujukan Faskes & Evakuasi'}
              </span>
              <button
                onClick={() => onSelectRouteTarget && onSelectRouteTarget(null, 'clinic')}
                className="text-slate-400 hover:text-slate-650 p-0.5 rounded transition"
                title="Tutup / Bersihkan Rute"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-750">
              <div>
                <h5 className="font-extrabold text-slate-900 text-sm leading-tight">{selectedRouteTarget.name}</h5>
                <span className="text-[9px] uppercase font-bold text-teal-700">
                  {selectedRouteTarget.type === 'hospital' ? 'Rumah Sakit Rujukan' : selectedRouteTarget.type === 'shelter' ? 'Posko Pengungsian' : selectedRouteTarget.type === 'tck' ? 'Relawan TCK Kemkes RI' : 'Puskesmas / Klinik'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 py-2 border-y border-slate-200 bg-slate-50 px-2 rounded-lg">
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Jarak Tempuh</span>
                  <span className="font-extrabold text-slate-800 text-sm">
                    {routeInfo ? `${routeInfo.distance.toFixed(1)} km` : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Durasi Respon</span>
                  <span className="font-extrabold text-slate-800 text-sm">
                    {routeInfo ? `${Math.round(routeInfo.duration)} mnt` : '-'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-455 uppercase block">Rute Taktis Darurat</span>
                <p className="text-[11px] text-slate-650 leading-relaxed font-semibold">
                  {selectedRouteTarget.type === 'hospital'
                    ? (isCallDetailMode ? 'Rute ambulans dari lokasi panggilan menuju Rumah Sakit rujukan/terdekat.' : 'Rute evakuasi gawat darurat ambulans menuju Rumah Sakit rujukan utama.')
                    : selectedRouteTarget.type === 'shelter'
                      ? 'Jalur penyelamatan dan mobilisasi warga terdampak menuju posko pengungsian terdekat.'
                      : selectedRouteTarget.type === 'tck'
                        ? 'Jalur koordinasi darurat & mobilisasi penugasan Tenaga Cadangan Kesehatan (TCK) / Tim EMT menuju lokasi bencana.'
                        : 'Akses pelayanan medis menuju Puskesmas / Klinik siaga setempat.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── OL Map canvas ── */}
      <div ref={mapRef} className="h-full w-full min-h-[480px]" />

      {/* ── Loading overlay ── */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/95 px-6 py-4 shadow-[0_12px_40px_rgba(15,118,110,0.15)] border border-teal-100">
            <Loader2 className="h-7 w-7 animate-spin text-teal-700" />
            <span className="text-xs font-bold text-slate-700 tracking-wider uppercase">Memuat Peta Spasial...</span>
          </div>
        </div>
      )}

      {/* ── EOC Navigation / Directions Card Overlay ── */}
      {selectedRouteTarget && (
        <div className="absolute left-4 top-4 z-20 max-w-sm sm:max-w-md w-[90%] sm:w-auto rounded-2xl border border-teal-200/90 bg-white/95 backdrop-blur-md p-3.5 shadow-[0_12px_40px_rgba(15,118,110,0.18)] animate-in fade-in slide-in-from-left duration-200">
          <div className="flex items-start justify-between border-b border-slate-100 pb-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white shadow-xs shrink-0">
                <Compass className="h-4 w-4" />
              </span>
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-teal-700 block leading-none">
                  {isCallDetailMode ? 'RUTE AMBULANS KE RUMAH SAKIT' : selectedRouteTarget.type === 'tck' ? 'RUTE MOBILISASI TCK KEMKES' : 'RUTE NAVIGASI DARAT EOC'}
                </span>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight mt-0.5 truncate max-w-[230px]">
                  {isCallDetailMode ? 'DARI LOKASI PANGGILAN →' : 'DARI BENCANA ➔'} {selectedRouteTarget.name}
                </h4>
              </div>
            </div>
            <button
              onClick={() => onSelectRouteTarget?.(null, 'hospital')}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition shrink-0"
              title="Tutup Rute"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* From & To Detail Rows */}
          <div className="space-y-1.5 text-xs text-slate-700">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-150">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-600 shrink-0 animate-ping" />
              <span className="text-[10px] font-black text-slate-500 uppercase shrink-0 w-10">DARI:</span>
              <span className="font-extrabold text-slate-900 truncate">
                {isCallDetailMode ? '📍 Titik Panggilan PSC 119' : `📍 Titik Kejadian Bencana (${disasterType || 'Bencana'})`}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-teal-50/70 p-2 rounded-xl border border-teal-150">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-600 shrink-0" />
              <span className="text-[10px] font-black text-teal-800 uppercase shrink-0 w-10">KE:</span>
              <span className="font-extrabold text-slate-900 truncate">
                {selectedRouteTarget.type === 'tck' ? '🧑‍⚕️ ' : selectedRouteTarget.type === 'shelter' ? '⛺ ' : '🏥 '}
                {selectedRouteTarget.name}
              </span>
            </div>

            {routeInfo && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-slate-100/70 px-2.5 py-1.5 rounded-lg border border-slate-200/70 text-center">
                  <span className="text-[9px] font-black text-slate-500 uppercase block">Jarak Tempuh</span>
                  <span className="text-xs sm:text-sm font-black text-teal-800 block mt-0.5">{routeInfo.distance.toFixed(1)} km</span>
                </div>
                <div className="bg-slate-100/70 px-2.5 py-1.5 rounded-lg border border-slate-200/70 text-center">
                  <span className="text-[9px] font-black text-slate-500 uppercase block">Est. Waktu Tempuh</span>
                  <span className="text-xs sm:text-sm font-black text-teal-800 block mt-0.5">
                    {(() => {
                      const totalMnt = Math.round(routeInfo.duration)
                      if (totalMnt >= 60) {
                        const jam = Math.floor(totalMnt / 60)
                        const mnt = totalMnt % 60
                        return mnt > 0 ? `${jam} jam ${mnt} mnt` : `${jam} jam`
                      }
                      return `${totalMnt} mnt`
                    })()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Direct Google Maps Navigation Button (From ➔ To) */}
          {(() => {
            const origLat = markers && markers[0] ? markers[0].lat : selectedRouteTarget.latitude - 0.05
            const origLng = markers && markers[0] ? markers[0].lng : selectedRouteTarget.longitude - 0.05
            const gmapsDirUrl = `https://www.google.com/maps/dir/?api=1&origin=${origLat},${origLng}&destination=${selectedRouteTarget.latitude},${selectedRouteTarget.longitude}&travelmode=driving`

            return (
              <a
                href={gmapsDirUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm transition-all active:scale-[0.98]"
              >
                <Compass className="h-3.5 w-3.5" />
                Buka Maps
              </a>
            )
          })()}
        </div>
      )}

      {/* ── Top-Right Map Controls Toolbar ── */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        {/* Reset Zoom / Center to Disaster Button */}
        <button
          onClick={handleResetCenter}
          className="flex items-center gap-1.5 rounded-xl bg-white/95 border border-slate-300 px-3 py-2 shadow-md text-slate-750 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 transition-all active:scale-95 animate-in fade-in duration-200"
          title={isCallDetailMode ? 'Kembali ke Titik Panggilan (Reset Zoom)' : 'Kembali ke Titik Pusat Kejadian Bencana (Reset Zoom)'}
        >
          <RotateCcw className="h-3.5 w-3.5 text-teal-650" />
          <span className="text-xs font-black tracking-wide hidden sm:inline">{isCallDetailMode ? 'Pusat Panggilan' : 'Pusat Kejadian'}</span>
        </button>

        {/* Settings button */}
        <button
          onClick={() => { setShowSettings(true); setMarkerPopup(null) }}
          className="flex items-center gap-1.5 rounded-xl bg-white/95 border border-slate-300 px-3 py-2 shadow-md text-slate-750 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 transition-all active:scale-95 animate-in fade-in duration-200"
          title="Pengaturan Layer & Tampilan Peta"
        >
          <Settings className="h-3.5 w-3.5 text-teal-650" />
          <span className="text-xs font-black tracking-wide">Pengaturan Peta</span>
        </button>
      </div>

      {/* ── Settings panel (slide from right) ── */}
      {showSettings && (
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 z-20 bg-black/10"
            onClick={() => setShowSettings(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-0 z-30 h-full w-72 bg-white/98 backdrop-blur-md border-l border-slate-200 shadow-[−8px_0_40px_rgba(0,0,0,0.08)] flex flex-col animate-in slide-in-from-right duration-200">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-teal-700" />
                <span className="text-sm font-bold text-slate-800">Pengaturan Peta</span>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* ── Tampilan section ── */}
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">
                  Tampilan
                </p>

                {/* Toggle marker pins */}
                <div
                  onClick={() => setShowMarkers((v) => !v)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:bg-rose-50/50 hover:border-rose-100 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <User className="h-4 w-4 text-rose-600" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Titik Panggilan 119</p>
                      <p className="text-[10px] text-slate-400">Titik lokasi pemanggil / kedaruratan (Ikon Orang)</p>
                    </div>
                  </div>
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showMarkers ? 'bg-rose-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showMarkers ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </div>
                </div>

                {/* Toggle layer armada dan rumah sakit dipusatkan di Pengaturan Peta */}
                {ambulances && ambulances.length > 0 && (
                  <div
                    onClick={() => setShowAmbulances((v) => !v)}
                    className="mt-2.5 flex cursor-pointer items-center justify-between rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2.5 hover:bg-sky-100/50 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Ambulance className="h-4 w-4 text-sky-600" />
                      <div>
                        <p className="text-xs font-semibold text-sky-900">Ambulans PSC</p>
                        <p className="text-[10px] text-sky-700">Tampilkan armada ambulans pada peta ({ambulances.length})</p>
                      </div>
                    </div>
                    <div
                      className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showAmbulances ? 'bg-sky-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showAmbulances ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </div>
                )}

                {hospitals && hospitals.length > 0 && (
                  <div
                    onClick={() => setShowHospitals((v) => !v)}
                    className="mt-2.5 flex cursor-pointer items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5 hover:bg-emerald-100/50 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 className="h-4 w-4 text-emerald-600" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-900">RS Rujukan</p>
                        <p className="text-[10px] text-emerald-700">Tampilkan rumah sakit pada peta ({hospitals.length})</p>
                      </div>
                    </div>
                    <div
                      className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showHospitals ? 'bg-emerald-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showHospitals ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </div>
                )}

                {/* Period range selector */}
                {setMarkerMonths !== undefined && (
                  <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <Clock className="h-4 w-4 text-teal-600 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">Rentang Waktu Pin</p>
                        <p className="text-[10px] text-slate-400">Tampilkan kejadian N bulan terakhir</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[
                        { label: '1 Bln', value: 1 },
                        { label: '3 Bln', value: 3 },
                        { label: '6 Bln', value: 6 },
                        { label: '1 Thn', value: 12 },
                        { label: 'Semua', value: 0 },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setMarkerMonths(opt.value)}
                          className={`rounded-lg py-1.5 text-[10px] font-bold transition-all duration-150 ${markerMonths === opt.value
                              ? 'bg-teal-600 text-white shadow-sm'
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700'
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Toggle basemap */}
                <div
                  onClick={() => setShowBaseMap((v) => !v)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:bg-teal-50/50 hover:border-teal-100 transition-all mt-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <Globe className="h-4 w-4 text-teal-600" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Peta Dasar (OSM)</p>
                      <p className="text-[10px] text-slate-400">Tampilkan peta jalan & geografis</p>
                    </div>
                  </div>
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showBaseMap ? 'bg-teal-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showBaseMap ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </div>
                </div>

                {/* Toggle GeoJSON boundary */}
                <div
                  onClick={() => setShowGeoJson((v) => !v)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:bg-teal-50/50 hover:border-teal-100 transition-all mt-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="h-4 w-4 text-teal-600" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Batas Administrasi</p>
                      <p className="text-[10px] text-slate-400">Layer GeoJSON kerawanan wilayah</p>
                    </div>
                  </div>
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showGeoJson ? 'bg-teal-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showGeoJson ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </div>
                </div>

                {/* Toggle Windy */}
                <div
                  onClick={() => setShowWindy((v) => !v)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:bg-teal-50/50 hover:border-teal-100 transition-all mt-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <Globe className="h-4 w-4 text-teal-600" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Aliran Angin (Windy)</p>
                      <p className="text-[10px] text-slate-400">Tampilkan pola pergerakan angin GFS</p>
                    </div>
                  </div>
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showWindy ? 'bg-teal-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showWindy ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </div>
                </div>

                {/* Toggle EOC Route (only when isFloodEocMode is active) */}
                {isFloodEocMode && (
                  <div
                    onClick={() => setShowEocRoute((v) => !v)}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:bg-teal-50/50 hover:border-teal-100 transition-all mt-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <Layers className="h-4 w-4 text-teal-600" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{isCallDetailMode ? 'Rute Ambulans &amp; Rujukan' : 'Rute Evakuasi &amp; Faskes'}</p>
                        <p className="text-[10px] text-slate-400">Tampilkan jalur rute jalan raya dan pin faskes</p>
                      </div>
                    </div>
                    <div
                      className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showEocRoute ? 'bg-teal-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showEocRoute ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </div>
                )}

                {/* Sub-Checkbox Filter Faskes (Simple List styled like Jenis Kejadian) */}
                {isFloodEocMode && showEocRoute && !isCallDetailMode && (
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                        Tipe Fasilitas Kesehatan
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFaskesTypeFilters({ rs: true, puskesmas: true, klinik: true, pustu: true, siagaOnly: false })}
                          className="text-[10px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 hover:bg-teal-100 transition-colors"
                        >
                          Semua
                        </button>
                        <button
                          type="button"
                          onClick={() => setFaskesTypeFilters({ rs: false, puskesmas: false, klinik: false, pustu: false, siagaOnly: false })}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-100 transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 border border-slate-100 rounded-xl bg-[#fcfdfd] p-2 shadow-inner">
                      {/* Rumah Sakit */}
                      <label
                        className="flex cursor-pointer items-center justify-between py-1.5 px-2 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-lg transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={faskesTypeFilters.rs}
                            onChange={(e) => setFaskesTypeFilters((prev) => ({ ...prev, rs: e.target.checked }))}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                          <img src={`${basePath}/rs.svg`} alt="RS" className="w-4 h-4 shrink-0" />
                          <span className="text-[11px] font-semibold text-slate-700 truncate">Rumah Sakit (RS)</span>
                        </div>
                        <span className={`text-[10px] font-extrabold ${faskesTypeFilters.siagaOnly ? 'text-rose-600' : 'text-slate-400'}`}>
                          {faskesTypeFilters.siagaOnly ? (
                            <span>{faskesCountsByType.rsSiaga} <span className="text-slate-300 font-normal">/ {faskesCountsByType.rs}</span></span>
                          ) : (
                            faskesCountsByType.rs
                          )}
                        </span>
                      </label>

                      {/* Puskesmas */}
                      <label
                        className="flex cursor-pointer items-center justify-between py-1.5 px-2 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-lg transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={faskesTypeFilters.puskesmas}
                            onChange={(e) => setFaskesTypeFilters((prev) => ({ ...prev, puskesmas: e.target.checked }))}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                          <img src={`${basePath}/puskes.svg`} alt="Puskesmas" className="w-4 h-4 shrink-0" />
                          <span className="text-[11px] font-semibold text-slate-700 truncate">Puskesmas</span>
                        </div>
                        <span className={`text-[10px] font-extrabold ${faskesTypeFilters.siagaOnly ? 'text-rose-600' : 'text-slate-400'}`}>
                          {faskesTypeFilters.siagaOnly ? (
                            <span>{faskesCountsByType.pkmSiaga} <span className="text-slate-300 font-normal">/ {faskesCountsByType.puskesmas}</span></span>
                          ) : (
                            faskesCountsByType.puskesmas
                          )}
                        </span>
                      </label>

                      {/* Klinik */}
                      <label
                        className="flex cursor-pointer items-center justify-between py-1.5 px-2 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-lg transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={faskesTypeFilters.klinik}
                            onChange={(e) => setFaskesTypeFilters((prev) => ({ ...prev, klinik: e.target.checked }))}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                          <img src={`${basePath}/klinik.svg`} alt="Klinik" className="w-4 h-4 shrink-0" />
                          <span className="text-[11px] font-semibold text-slate-700 truncate">Klinik</span>
                        </div>
                        <span className="text-[10px] font-extrabold text-slate-400">
                          {faskesTypeFilters.siagaOnly ? (
                            <span>{faskesCountsByType.klinikSiaga} <span className="text-slate-300 font-normal">/ {faskesCountsByType.klinik}</span></span>
                          ) : (
                            faskesCountsByType.klinik
                          )}
                        </span>
                      </label>

                      {/* Puskesmas Pembantu (Pustu) */}
                      <label
                        className="flex cursor-pointer items-center justify-between py-1.5 px-2 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-lg transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={faskesTypeFilters.pustu}
                            onChange={(e) => setFaskesTypeFilters((prev) => ({ ...prev, pustu: e.target.checked }))}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                          <img src={`${basePath}/pustu.svg`} alt="Pustu" className="w-4 h-4 shrink-0" />
                          <span className="text-[11px] font-semibold text-slate-700 truncate">Puskesmas Pembantu (Pustu)</span>
                        </div>
                        <span className="text-[10px] font-extrabold text-slate-400">
                          {faskesTypeFilters.siagaOnly ? (
                            <span>{faskesCountsByType.pustuSiaga} <span className="text-slate-300 font-normal">/ {faskesCountsByType.pustu.toLocaleString('id-ID')}</span></span>
                          ) : (
                            faskesCountsByType.pustu.toLocaleString('id-ID')
                          )}
                        </span>
                      </label>

                      {/* Hanya Faskes Rawat Pasien */}
                      <label
                        className="flex cursor-pointer items-center justify-between py-1.5 px-2 hover:bg-slate-50 border-t border-slate-150 pt-2 transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={faskesTypeFilters.siagaOnly}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setFaskesTypeFilters((prev) => {
                                if (checked) {
                                  return {
                                    ...prev,
                                    siagaOnly: true,
                                    rs: true,
                                    puskesmas: true,
                                    klinik: true,
                                    pustu: true,
                                  }
                                }
                                return {
                                  ...prev,
                                  siagaOnly: false,
                                }
                              })
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                          <span className={`text-[11px] font-bold truncate ${faskesTypeFilters.siagaOnly ? 'text-rose-700 font-extrabold' : 'text-slate-700'}`}>
                            Hanya Faskes Rawat Pasien
                          </span>
                        </div>
                        <span className={`text-[10px] font-extrabold ${faskesTypeFilters.siagaOnly ? 'text-rose-600' : 'text-slate-400'}`}>
                          {faskesCountsByType.siaga}
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Radius Denyutan Bencana (only when isFloodEocMode is active) */}
                {isFloodEocMode && !isCallDetailMode && (
                  <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <Compass className="h-4 w-4 text-rose-500 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">Radius Episentrum &amp; Dampak</p>
                        <p className="text-[10px] text-slate-400">Jangkauan area dampak (km)</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[
                        { label: '1 km', value: 1 },
                        { label: '5 km', value: 5 },
                        { label: '10 km', value: 10 },
                        { label: '25 km', value: 25 },
                        { label: '50 km', value: 50 },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPulseRadius(opt.value)}
                          className={`rounded-lg py-1 text-[10px] font-black transition-all ${pulseRadius === opt.value
                              ? 'bg-rose-500 text-white shadow-xs'
                              : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-100'
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Seleksi Titik Asal Rute (only when isFloodEocMode is active) */}
                {isFloodEocMode && !isCallDetailMode && Array.isArray(markers) && markers.length > 0 && onSelectRouteSource && (
                  <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center gap-2.5 mb-2">
                      <MapPin className="h-4 w-4 text-sky-600 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">Titik Asal Rute (FROM)</p>
                        <p className="text-[10px] text-slate-400">Pilih titik bencana sebagai asal rute</p>
                      </div>
                    </div>
                    <select
                      value={selectedRouteSource?.id || ''}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        const idx = markers.findIndex((m, i) => (m.kode_trans || `loc-${i}`) === targetId);
                        if (idx !== -1) {
                          const m = markers[idx];
                          onSelectRouteSource({
                            id: targetId,
                            name: m.nama_desa
                              ? `Titik ${idx + 1} - Desa ${m.nama_desa}${m.kecamatan ? `, Kec. ${m.kecamatan}` : ''}`
                              : m.kecamatan
                                ? `Titik ${idx + 1} - Kec. ${m.kecamatan}`
                                : `Titik Bencana ${idx + 1}`,
                            latitude: Number(m.lat),
                            longitude: Number(m.lng),
                            type: 'kejadian'
                          });
                        }
                      }}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-750 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-2xs"
                    >
                      {markers.map((m, idx) => {
                        const optId = m.kode_trans || `loc-${idx}`;
                        // Buat label per-titik yang unik tanpa inherit daftar semua kecamatan
                        const locLabel = m.nama_desa
                          ? `Titik ${idx + 1}: Desa ${m.nama_desa}${m.kecamatan ? ` (Kec. ${m.kecamatan})` : ''}`
                          : m.kecamatan
                            ? `Titik ${idx + 1}: Kec. ${m.kecamatan}`
                            : `Titik Bencana ${idx + 1} (${Number(m.lat).toFixed(4)}, ${Number(m.lng).toFixed(4)})`
                        return (
                          <option key={optId} value={optId}>
                            ⚠️ {locLabel}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Toggle Wind Legend */}
                <div
                  onClick={() => setShowWindLegend((v) => !v)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:bg-teal-50/50 hover:border-teal-100 transition-all mt-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <Wind className="h-4 w-4 text-teal-600" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Legenda Aliran Angin</p>
                      <p className="text-[10px] text-slate-400">Keterangan gradasi warna &amp; kecepatan angin</p>
                    </div>
                  </div>
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showWindLegend ? 'bg-teal-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showWindLegend ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </div>
                </div>

                {/* Toggle region legend visibility */}
                <div
                  onClick={() => setShowRegionLegend((v) => !v)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:bg-teal-50/50 hover:border-teal-100 transition-all mt-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <Info className="h-4 w-4 text-teal-600" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Legenda Wilayah</p>
                      <p className="text-[10px] text-slate-400">Keterangan warna jumlah kejadian</p>
                    </div>
                  </div>
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showRegionLegend ? 'bg-teal-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showRegionLegend ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </div>
                </div>

                {/* Toggle casualty legend visibility */}
                <div
                  onClick={() => setShowCasualtyLegend((v) => !v)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:bg-teal-50/50 hover:border-teal-100 transition-all mt-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <Info className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Legenda Korban</p>
                      <p className="text-[10px] text-slate-400">Keterangan warna dampak korban</p>
                    </div>
                  </div>
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showCasualtyLegend ? 'bg-teal-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showCasualtyLegend ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </div>
                </div>



              </div>

              {/* ── BMKG & TCK Layers Section ── */}
              <div className="mb-6 border-b border-slate-100 pb-5 space-y-2.5">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">
                  SUMBER DATA & LAYANAN TERPADU
                </p>

                {/* Toggle Real USGS Seismic Epicenters (Strictly Indonesia) */}
                <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 space-y-2.5 transition-all">
                  <div
                    onClick={() => setShowSeismicLayer((v) => !v)}
                    className="flex cursor-pointer items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-red-900 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                        Titik Episentrum Gempa (USGS Indonesia)
                        {activeEqList && activeEqList.length > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-red-700 text-white rounded-full">
                            {activeEqList.length}
                          </span>
                        )}
                        {isEqLoading && (
                          <Loader2 className="h-3 w-3 text-red-600 animate-spin" />
                        )}
                      </p>
                      <p className="text-[10px] text-red-700 font-medium">
                        Plot data seismik riil episentrum gempa bumi di wilayah Indonesia
                      </p>
                    </div>
                    <div
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${showSeismicLayer ? 'bg-red-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showSeismicLayer ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </div>

                  {/* Filter controls when layer active */}
                  {showSeismicLayer && (
                    <div className="pt-2 border-t border-red-100/80 space-y-2.5 animate-in fade-in duration-200">
                      {/* Timeframe selector */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9.5px] font-bold text-red-800 uppercase tracking-wider">
                            Periode Gempa
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void fetchUsgsEarthquakes()
                            }}
                            disabled={isEqLoading}
                            className="inline-flex items-center gap-1 text-[9.5px] text-red-700 hover:text-red-900 font-bold px-1.5 py-0.5 rounded hover:bg-red-100 transition cursor-pointer"
                            title="Muat ulang data USGS terkini"
                          >
                            <RotateCcw className={`h-2.5 w-2.5 ${isEqLoading ? 'animate-spin' : ''}`} />
                            Muat Ulang
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { label: '7 Hari', days: 7, start: null },
                            { label: '30 Hari', days: 30, start: null },
                            { label: '90 Hari', days: 90, start: null },
                            { label: 'Tahun 2026', days: 0, start: '2026-01-01' },
                          ].map((t) => {
                            const isActive = t.start ? eqCustomStart === t.start : (!eqCustomStart && eqDays === t.days)
                            return (
                              <button
                                key={t.label}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (t.start) {
                                    setEqCustomStart(t.start)
                                  } else {
                                    setEqCustomStart(null)
                                    setEqDays(t.days)
                                  }
                                }}
                                className={`text-[9px] font-bold py-1 px-0.5 rounded-lg border transition text-center cursor-pointer ${
                                  isActive
                                    ? 'bg-red-600 text-white border-red-700 shadow-xs'
                                    : 'bg-white text-slate-600 border-red-100 hover:bg-red-100/60'
                                }`}
                              >
                                {t.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Magnitude filter */}
                      <div>
                        <span className="text-[9.5px] font-bold text-red-800 uppercase tracking-wider block mb-1">
                          Batas Minimal Magnitudo
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { label: 'M ≥ 4.5', mag: 4.5 },
                            { label: 'M ≥ 5.0', mag: 5.0 },
                            { label: 'M ≥ 6.0', mag: 6.0 },
                          ].map((m) => {
                            const isActive = eqMinMag === m.mag
                            return (
                              <button
                                key={m.label}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEqMinMag(m.mag)
                                }}
                                className={`text-[9px] font-bold py-1 px-1 rounded-lg border transition text-center cursor-pointer ${
                                  isActive
                                    ? 'bg-red-600 text-white border-red-700 shadow-xs'
                                    : 'bg-white text-slate-600 border-red-100 hover:bg-red-100/60'
                                }`}
                              >
                                {m.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Scope note */}
                      <div className="flex items-center gap-1 text-[8.5px] text-red-700/90 bg-red-100/50 p-1.5 rounded-md">
                        <span>🇮🇩</span>
                        <span className="font-medium">Khusus Wilayah Indonesia (-11.5° s/d 6.5° LU, 95.0° s/d 141.0° BT)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Toggle MAGMA ESDM Volcano Layer (Default NON-AKTIF) */}
                <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-3 space-y-2.5 transition-all">
                  <div
                    onClick={() => setShowVolcanoLayer((v) => !v)}
                    className="flex cursor-pointer items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-orange-950 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-orange-600 animate-pulse" />
                        Aktivitas Gunung Api (MAGMA ESDM)
                        {volcanoList && volcanoList.length > 0 && showVolcanoLayer && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-orange-700 text-white rounded-full">
                            {volcanoList.length}
                          </span>
                        )}
                        {isVolcanoLoading && (
                          <Loader2 className="h-3 w-3 text-orange-600 animate-spin" />
                        )}
                      </p>
                      <p className="text-[10px] text-orange-800/90 font-medium">
                        Status aktivitas &amp; rekomendasi bahaya PVMBG Badan Geologi ESDM
                      </p>
                    </div>
                    <div
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${showVolcanoLayer ? 'bg-orange-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showVolcanoLayer ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </div>

                  {/* Filter controls when volcano layer active */}
                  {showVolcanoLayer && (
                    <div className="pt-2 border-t border-orange-100/80 space-y-2.5 animate-in fade-in duration-200">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9.5px] font-bold text-orange-900 uppercase tracking-wider">
                            Filter Tingkat Status
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void fetchVolcanoes()
                            }}
                            disabled={isVolcanoLoading}
                            className="inline-flex items-center gap-1 text-[9.5px] text-orange-800 hover:text-orange-950 font-bold px-1.5 py-0.5 rounded hover:bg-orange-100 transition cursor-pointer"
                            title="Segarkan data MAGMA ESDM"
                          >
                            <RotateCcw className={`h-2.5 w-2.5 ${isVolcanoLoading ? 'animate-spin' : ''}`} />
                            Segarkan
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { label: 'Semua Level', level: 1 },
                            { label: 'Waspada+ (2-4)', level: 2 },
                            { label: 'Siaga & Awas', level: 3 },
                          ].map((l) => {
                            const isActive = volcanoMinLevel === l.level
                            return (
                              <button
                                key={l.label}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setVolcanoMinLevel(l.level)
                                }}
                                className={`text-[9px] font-bold py-1 px-1 rounded-lg border transition text-center cursor-pointer ${
                                  isActive
                                    ? 'bg-orange-600 text-white border-orange-700 shadow-xs'
                                    : 'bg-white text-slate-600 border-orange-100 hover:bg-orange-100/60'
                                }`}
                              >
                                {l.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[8.5px] text-orange-800/90 pt-0.5">
                        <span>Sumber: magma.esdm.go.id/v1/gunung-api/laporan</span>
                        <a
                          href="https://magma.esdm.go.id/v1/gunung-api/laporan"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold underline text-orange-900 hover:text-orange-950"
                        >
                          Portal Resmi
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Toggle TCK Kemkes Layer */}
                <div
                  onClick={() => setShowTckLayer((v) => !v)}
                  className="hidden flex cursor-pointer items-center justify-between rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-2 hover:bg-teal-100/50 transition-all"
                >
                  <div>
                    <p className="text-xs font-semibold text-teal-900 flex items-center gap-1.5">
                      <img src={`${basePath}/tck.svg`} alt="TCK" className="w-4 h-4 shrink-0" />
                      TCK Terregistrasi Wilayah
                      {tckList && tckList.length > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-teal-700 text-white rounded-full">
                          {tckList.length}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-teal-700 font-medium">Titik sebaran dokter, perawat & tim EMT siaga</p>
                  </div>
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showTckLayer ? 'bg-teal-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showTckLayer ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </div>
                </div>

                {/* Toggle Posko Pengungsian Layer */}
                <div
                  onClick={() => setShowPosko((v) => !v)}
                  className="hidden flex cursor-pointer items-center justify-between rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2 hover:bg-sky-100/50 transition-all"
                >
                  <div>
                    <p className="text-xs font-semibold text-sky-900 flex items-center gap-1.5">
                      <Tent className="w-4 h-4 shrink-0 text-sky-700" />
                      Posko Pengungsian Siaga
                      {poskoList && poskoList.length > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-sky-700 text-white rounded-full">
                          {poskoList.length}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-sky-700 font-medium">Titik pos pengungsian & penyaluran logistik</p>
                  </div>
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showPosko ? 'bg-teal-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showPosko ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </div>
                </div>

                <div
                  onClick={() => setShowBmkg((v) => !v)}
                  className="hidden flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 hover:bg-teal-50/50 hover:border-teal-100 transition-all"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Layer Gempa Terkini BMKG</p>
                    <p className="text-[10px] text-slate-400 font-medium">Plot seismik realtime BMKG</p>
                  </div>
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showBmkg ? 'bg-teal-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showBmkg ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </div>
                </div>
              </div>

              {/* ── BNPB Inarisk Layers Section ── */}
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">
                  Layer BNPB (Inarisk)
                </p>
                <div className="space-y-2.5">
                  {/* Toggle BNPB Batas Administrasi */}
                  <div
                    onClick={() => setShowBnpbAdmin((v) => !v)}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 hover:bg-teal-50/50 hover:border-teal-100 transition-all"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Batas Administrasi BNPB</p>
                      <p className="text-[10px] text-slate-400 font-medium">Batas administrasi daerah Inarisk</p>
                    </div>
                    <div
                      className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showBnpbAdmin ? 'bg-teal-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showBnpbAdmin ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </div>

                  {/* Toggle BNPB Hillshade */}
                  <div
                    onClick={() => setShowBnpbHillshade((v) => !v)}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 hover:bg-teal-50/50 hover:border-teal-100 transition-all"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Indo Hillshade</p>
                      <p className="text-[10px] text-slate-400 font-medium">Peta bayangan bukit basemap</p>
                    </div>
                    <div
                      className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showBnpbHillshade ? 'bg-teal-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showBnpbHillshade ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </div>

                  {/* Toggle BNPB Kepadatan Penduduk 2020 */}
                  <div
                    onClick={() => setShowBnpbKepadatan((v) => !v)}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 hover:bg-teal-50/50 hover:border-teal-100 transition-all"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Kepadatan Penduduk 2020</p>
                      <p className="text-[10px] text-slate-400 font-medium">Kepadatan penduduk tahun 2020</p>
                    </div>
                    <div
                      className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showBnpbKepadatan ? 'bg-teal-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showBnpbKepadatan ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </div>

                  {/* Complete InaRISK Hazard Layers (All 4 Hazards Always Available) */}
                  <div
                    onClick={() => setShowBnpbBanjir((v) => !v)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 transition-all ${disasterCategory === 'banjir'
                        ? 'border-blue-200 bg-blue-50/60 hover:bg-blue-100/60 shadow-xs'
                        : 'border-slate-100 bg-slate-50 hover:bg-teal-50/50 hover:border-teal-100'
                      }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        {disasterCategory === 'banjir' && <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />}
                        Bahaya Banjir (InaRISK)
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">Peta zona rawan genangan & banjir</p>
                    </div>
                    <div
                      className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showBnpbBanjir ? 'bg-teal-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showBnpbBanjir ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </div>

                  <div
                    onClick={() => setShowBnpbGempa((v) => !v)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 transition-all ${disasterCategory === 'gempa'
                        ? 'border-amber-200 bg-amber-50/60 hover:bg-amber-100/60 shadow-xs'
                        : 'border-slate-100 bg-slate-50 hover:bg-teal-50/50 hover:border-teal-100'
                      }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        {disasterCategory === 'gempa' && <span className="h-2 w-2 rounded-full bg-amber-600 animate-pulse" />}
                        Bahaya Gempa Bumi (InaRISK)
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">Peta kerawanan guncangan & sesar gempa</p>
                    </div>
                    <div
                      className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showBnpbGempa ? 'bg-teal-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showBnpbGempa ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </div>

                  <div
                    onClick={() => setShowBnpbLongsor((v) => !v)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 transition-all ${disasterCategory === 'longsor'
                        ? 'border-stone-300 bg-amber-900/10 hover:bg-amber-900/20 shadow-xs'
                        : 'border-slate-100 bg-slate-50 hover:bg-teal-50/50 hover:border-teal-100'
                      }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        {disasterCategory === 'longsor' && <span className="h-2 w-2 rounded-full bg-amber-800 animate-pulse" />}
                        Bahaya Tanah Longsor (InaRISK)
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">Peta kerentanan gerakan tanah lereng</p>
                    </div>
                    <div
                      className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showBnpbLongsor ? 'bg-teal-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showBnpbLongsor ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </div>

                  <div
                    onClick={() => setShowBnpbKarhutla((v) => !v)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 transition-all ${disasterCategory === 'kebakaran'
                        ? 'border-red-200 bg-red-50/60 hover:bg-red-100/60 shadow-xs'
                        : 'border-slate-100 bg-slate-50 hover:bg-teal-50/50 hover:border-teal-100'
                      }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        {disasterCategory === 'kebakaran' && <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />}
                        Bahaya Karhutla (InaRISK)
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">Peta kerawanan kebakaran hutan & lahan</p>
                    </div>
                    <div
                      className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${showBnpbKarhutla ? 'bg-teal-600' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${showBnpbKarhutla ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Filter & Kategori Section ── */}
              <div className={showMarkers ? "space-y-5 transition-opacity" : "space-y-5 opacity-40 pointer-events-none transition-opacity"}>
                {/* ── Kategori Bencana ── */}
                <div>
                  <p className="hidden text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">
                    Kategori Bencana
                  </p>
                  <div className="space-y-2">
                    {/* Bencana Alam */}
                    <div
                      onClick={() => toggleCategory('1')}
                      className="hidden flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 hover:bg-teal-50/40 hover:border-teal-100 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">Bencana Alam</span>
                        <span className="rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{categoryCounts.alam}</span>
                      </div>
                      <div
                        className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${!excludedCategories.has('1') ? 'bg-teal-600' : 'bg-slate-300'}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${!excludedCategories.has('1') ? 'translate-x-4' : 'translate-x-0'}`}
                        />
                      </div>
                    </div>

                    {/* Bencana Non-Alam */}
                    <div
                      onClick={() => toggleCategory('2')}
                      className="hidden flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 hover:bg-teal-50/40 hover:border-teal-100 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">Bencana Non-Alam</span>
                        <span className="rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{categoryCounts.nonAlam}</span>
                      </div>
                      <div
                        className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${!excludedCategories.has('2') ? 'bg-teal-600' : 'bg-slate-300'}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${!excludedCategories.has('2') ? 'translate-x-4' : 'translate-x-0'}`}
                        />
                      </div>
                    </div>

                    {/* Bencana Sosial */}
                    <div
                      onClick={() => toggleCategory('3')}
                      className="hidden flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 hover:bg-teal-50/40 hover:border-teal-100 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">Bencana Sosial</span>
                        <span className="rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{categoryCounts.sosial}</span>
                      </div>
                      <div
                        className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${!excludedCategories.has('3') ? 'bg-teal-600' : 'bg-slate-300'}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${!excludedCategories.has('3') ? 'translate-x-4' : 'translate-x-0'}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Detail Jenis Kejadian ── */}
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">
                    Jenis Kejadian
                  </p>
                  {disasterTypesBreakdown.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-4 text-center">
                      <p className="text-[11px] text-slate-400 italic">Tidak ada jenis kejadian</p>
                    </div>
                  ) : (
                    <div className="max-h-[260px] overflow-y-auto pr-1 space-y-1.5 border border-slate-100 rounded-xl bg-[#fcfdfd] p-2 shadow-inner">
                      {disasterTypesBreakdown.map((item) => {
                        const isChecked = !excludedTypes.has(item.name);
                        const isCategoryDisabled = excludedCategories.has(item.category);
                        const getCategoryLabel = (cat: string) => {
                          if (cat === '1') return 'Alam'
                          if (cat === '2') return 'Non-Alam'
                          return 'Sosial'
                        }
                        const getCategoryBadgeClass = (cat: string) => {
                          if (cat === '1') return 'bg-teal-50 text-teal-700 border-teal-150'
                          if (cat === '2') return 'bg-blue-50 text-blue-700 border-blue-150'
                          return 'bg-purple-50 text-purple-700 border-purple-150'
                        }

                        return (
                          <div
                            key={item.name}
                            onClick={() => {
                              if (!isCategoryDisabled) toggleType(item.name);
                            }}
                            className={`flex cursor-pointer items-center justify-between py-1.5 px-2 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-lg transition-all ${isCategoryDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked && !isCategoryDisabled}
                                disabled={isCategoryDisabled}
                                onChange={() => { }} // handled by parent onClick
                                className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                              />
                              <span className="text-[11px] font-semibold text-slate-700 truncate">{item.name}</span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider shrink-0 ${getCategoryBadgeClass(item.category)}`}>
                                {getCategoryLabel(item.category)}
                              </span>
                            </div>
                            <span className="text-[10px] font-extrabold text-slate-400">
                              {item.count}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>


            {/* Panel footer */}
            <div className="border-t border-slate-100 px-4 py-3">
              <p className="text-[10px] text-slate-400 text-center">
                SIPKK · Sistem Informasi PKK
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── Marker Pin Popup (Titik Panggilan 119 - Ikon Orang) ── */}
      {markerPopup && (
        <div
          className="absolute z-20 w-[310px] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_16px_48px_rgba(0,0,0,0.16)] transition-all duration-200 animate-in fade-in zoom-in-95"
          style={{
            left: Math.min(markerPopup.x + 10, (mapContainerRef.current?.offsetWidth || 800) - 325),
            top: Math.max(markerPopup.y - 10, 8),
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 p-3 pb-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                String(markerPopup.data.status_penanganan_code || markerPopup.data.status_penanganan || '').toLowerCase().includes('selesai')
                  ? 'bg-teal-100 text-teal-800'
                  : markerPopup.data.is_krisis === 1 || String(markerPopup.data.kategori_bencana) === '1' || String(markerPopup.data.kategori_layanan || '').toLowerCase().includes('emergency')
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                <User className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-800">
                    Titik Panggilan 119
                  </span>
                  {(markerPopup.data.status_penanganan || markerPopup.data.status_penanganan_code) && (
                    <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      String(markerPopup.data.status_penanganan || markerPopup.data.status_penanganan_code).toLowerCase().includes('selesai')
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {markerPopup.data.status_penanganan || markerPopup.data.status_penanganan_code}
                    </span>
                  )}
                </div>
                <h4 className="mt-1 text-[13px] font-extrabold text-slate-900 leading-snug break-words">
                  {markerPopup.data.kategori_layanan || markerPopup.data.jenis_layanan || formatDisasterName(markerPopup.data.jenis_bencana) || 'Panggilan Darurat Medis'}
                </h4>
              </div>
            </div>
            <button
              onClick={() => setMarkerPopup(null)}
              className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition shrink-0 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Info rows */}
          <div className="p-3 space-y-2 text-[11px] text-slate-600">
            {/* Keterangan / Keluhan Kejadian (seperti "Terjadi gigitan ular berbisa") */}
            {(markerPopup.data.keterangan || (markerPopup.data.raw_psc as any)?.keterangan) && (
              <div className="rounded-xl border border-amber-200/90 bg-amber-50/70 p-2.5 text-slate-800">
                <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-amber-900 mb-0.5">
                  <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />
                  Keterangan Kejadian
                </div>
                <p className="text-[11px] font-medium leading-relaxed text-slate-700 italic">
                  &ldquo;{markerPopup.data.keterangan || (markerPopup.data.raw_psc as any)?.keterangan}&rdquo;
                </p>
              </div>
            )}

            {/* No. Telepon Pemanggil / Pelapor */}
            {(markerPopup.data.telp || (markerPopup.data.raw_psc as any)?.telp) && (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
                <span className="text-slate-500 font-medium flex items-center gap-1.5 text-[10px] uppercase">
                  <Phone className="h-3 w-3 text-emerald-600" /> Kontak Pelapor
                </span>
                <a
                  href={`tel:${markerPopup.data.telp || (markerPopup.data.raw_psc as any)?.telp}`}
                  className="font-mono font-bold text-teal-800 hover:text-teal-950 underline"
                >
                  {markerPopup.data.telp || (markerPopup.data.raw_psc as any)?.telp}
                </a>
              </div>
            )}

            {/* Waktu Lapor */}
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Waktu Lapor</span>
              <span className="font-semibold text-slate-800 text-right">
                {markerPopup.data.tgl_kejadian || '—'}
              </span>
            </div>

            {/* Lokasi */}
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Lokasi</span>
              <span className="font-semibold text-slate-800 text-right leading-tight max-w-[190px]">
                {markerPopup.data.nama_lokasi || markerPopup.data.alamat || markerPopup.data.nama_desa || [markerPopup.data.kecamatan && `Kec. ${markerPopup.data.kecamatan}`, markerPopup.data.kabupaten].filter(Boolean).join(', ') || '—'}
              </span>
            </div>

            {/* Ambulans Ditugaskan */}
            {(markerPopup.data.nomor_kendaraan || markerPopup.data.nama_petugas_ambulan) && (
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Armada Ambulans</span>
                <span className="font-semibold text-sky-800 text-right text-[10px] leading-tight max-w-[190px]">
                  {markerPopup.data.nomor_kendaraan ? `[${markerPopup.data.nomor_kendaraan}] ` : ''}
                  {markerPopup.data.nama_petugas_ambulan || '-'}
                </span>
              </div>
            )}

            {/* RS Rujukan */}
            {(markerPopup.data.rumahsakit_rujukan || (markerPopup.data.raw_psc as any)?.rumahsakit_rujukan) && (
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">RS Rujukan</span>
                <span className="font-semibold text-emerald-800 text-right text-[10px] leading-tight max-w-[190px]">
                  {markerPopup.data.rumahsakit_rujukan || (markerPopup.data.raw_psc as any)?.rumahsakit_rujukan}
                </span>
              </div>
            )}

            {/* Waktu Respons */}
            {(markerPopup.data.waktu_respons_label || markerPopup.data.waktu_respons || markerPopup.data.response_time_minutes) && (
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Waktu Respons</span>
                <span className="font-semibold text-slate-800 text-right text-[10px]">
                  {markerPopup.data.waktu_respons_label || `${markerPopup.data.waktu_respons || markerPopup.data.response_time_minutes} menit`}
                </span>
              </div>
            )}
          </div>

          {/* Footer — Detail button */}
          {!String(markerPopup.data.kode_trans || '').includes('-loc-') && (
            <div className="border-t border-slate-100 p-2.5">
              <button
                onClick={() => {
                  if (onSelectEvent) {
                    onSelectEvent(markerPopup.data)
                  }
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-700 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-teal-800 cursor-pointer"
              >
                LIHAT DETAIL PANGGILAN
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Ambulance Unit Popup ── */}
      {ambulancePopup && (
        <div
          className="absolute z-20 w-[280px] rounded-2xl border border-sky-200 bg-white/95 backdrop-blur-md shadow-[0_12px_40px_rgba(2,132,199,0.18)] p-3 text-xs animate-in fade-in zoom-in-95 duration-200"
          style={{
            left: Math.min(ambulancePopup.x + 10, (mapContainerRef.current?.offsetWidth || 800) - 295),
            top: Math.max(ambulancePopup.y - 10, 8),
          }}
        >
          <div className="flex items-start justify-between border-b border-slate-100 pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="p-1 rounded-lg bg-sky-100 text-sky-700">
                <Ambulance className="h-4 w-4" />
              </span>
              <div>
                <h4 className="font-extrabold text-slate-900 leading-tight">
                  {ambulancePopup.data.no_kendaraan || 'Ambulans 119'}
                </h4>
                <span className="text-[10px] text-slate-500 font-mono">
                  {ambulancePopup.data.kode_ambulan || 'Unit Ambulans'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setAmbulancePopup(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1.5 text-[11px] text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-500">Unit PSC:</span>
              <span className="font-bold text-slate-800">{ambulancePopup.data.nama_psc || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status Operasional:</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                {ambulancePopup.data.status_aktif === '1' || ambulancePopup.data.status_aktif === 1 ? 'Siaga / Aktif' : String(ambulancePopup.data.status_aktif || 'Aktif')}
              </span>
            </div>
            {ambulancePopup.data.vendor_gps && (
              <div className="flex justify-between">
                <span className="text-slate-500">Pelacak GPS:</span>
                <span className="font-semibold text-sky-700">{ambulancePopup.data.vendor_gps}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hospital & Referral Facility Popup ── */}
      {hospitalPopup && (
        <div
          className="absolute z-20 w-[280px] rounded-2xl border border-emerald-200 bg-white/95 backdrop-blur-md shadow-[0_12px_40px_rgba(5,150,105,0.18)] p-3 text-xs animate-in fade-in zoom-in-95 duration-200"
          style={{
            left: Math.min(hospitalPopup.x + 10, (mapContainerRef.current?.offsetWidth || 800) - 295),
            top: Math.max(hospitalPopup.y - 10, 8),
          }}
        >
          <div className="flex items-start justify-between border-b border-slate-100 pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="p-1 rounded-lg bg-emerald-100 text-emerald-700">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <h4 className="font-extrabold text-slate-900 leading-tight">
                  {hospitalPopup.data.nama}
                </h4>
                <span className="text-[10px] text-emerald-700 font-semibold">
                  {hospitalPopup.data.nama_subjenis || 'Faskes Rujukan'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setHospitalPopup(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1.5 text-[11px] text-slate-600">
            <div className="text-slate-700 leading-snug">
              {hospitalPopup.data.alamat || '—'}
            </div>
            {hospitalPopup.data.telp && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-500">Telepon:</span>
                <a
                  href={`tel:${hospitalPopup.data.telp}`}
                  className="font-bold text-teal-700 hover:underline"
                >
                  {hospitalPopup.data.telp}
                </a>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500">Status Rujukan:</span>
              <span className="font-bold text-emerald-700">
                {hospitalPopup.data.rujukan === 'Ya' ? 'Faskes Rujukan Terdaftar' : 'Tersedia'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── EOC Faskes / Posko / Disaster Interactive Popup ── */}
      {eocPopup && (
        <div
          className="absolute z-20 w-[300px] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_16px_48px_rgba(0,0,0,0.18)] animate-in fade-in zoom-in-95 duration-200 text-xs overflow-hidden"
          style={{
            left: Math.min(Math.max(12, eocPopup.x - 150), (mapContainerRef.current?.offsetWidth || 800) - 315),
            top: Math.max(12, Math.min(eocPopup.y + 16, (mapContainerRef.current?.offsetHeight || 600) - 380)),
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 p-3.5 pb-3 bg-slate-50/70">
            <div className="min-w-0 flex-1">
              {/* Only show badge for Earthquake, TCK, or Shelter. Faskes/RS badges removed as requested */}
              {(eocPopup.type === 'earthquake' || eocPopup.type === 'volcano' || eocPopup.type === 'tck' || eocPopup.type === 'shelter') && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                  eocPopup.type === 'earthquake'
                    ? 'bg-red-100 text-red-800 border border-red-300 font-black'
                    : eocPopup.type === 'volcano'
                      ? 'bg-orange-100 text-orange-800 border border-orange-300 font-black'
                      : eocPopup.type === 'tck'
                        ? 'bg-teal-50 text-teal-800 border border-teal-200'
                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                  {eocPopup.type === 'earthquake'
                    ? (eocPopup.earthquakeInfo?.isMainshock ? '⚡ Episentrum Gempa Utama' : '⚡ Titik Gempa Susulan')
                    : eocPopup.type === 'volcano'
                      ? `🌋 ${eocPopup.volcanoInfo?.status || 'Gunung Api'}`
                      : eocPopup.type === 'tck'
                        ? 'Relawan TCK Kemkes RI'
                        : 'Posko Kesehatan & Darurat'}
                </span>
              )}
              <h4 className={`text-sm font-black text-slate-900 leading-snug ${(eocPopup.type === 'earthquake' || eocPopup.type === 'tck' || eocPopup.type === 'shelter') ? 'mt-1.5' : 'mt-0'}`}>
                {eocPopup.type === 'tck' ? maskPersonName(eocPopup.name) : eocPopup.name}
              </h4>
              {eocPopup.type === 'tck' && eocPopup.details?.golongan && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-teal-100/80 text-teal-800 rounded">
                    {eocPopup.details.golongan}
                  </span>
                  {eocPopup.details.spesifikasi && (
                    <span className="text-[9.5px] font-semibold text-slate-600 truncate">
                      {eocPopup.details.spesifikasi}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setEocPopup(null)}
              className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition shrink-0"
              title="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-3.5 space-y-2.5 text-slate-650 max-h-[360px] overflow-y-auto">
            {eocPopup.address && (
              <div className="flex items-start gap-2 text-[11px]">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="font-semibold text-slate-700 leading-snug">{eocPopup.address}</span>
              </div>
            )}

            {eocPopup.type === 'tck' && (
              <div className="space-y-1.5 bg-teal-50/50 p-2.5 rounded-xl border border-teal-100 text-[11px]">
                {eocPopup.details?.pekerjaan && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-slate-500 font-medium shrink-0 text-[10px] uppercase w-16">Faskes/Unit:</span>
                    <strong className="text-slate-800">{eocPopup.details.pekerjaan}</strong>
                  </div>
                )}
                {eocPopup.details?.nama_tim_emt && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-slate-500 font-medium shrink-0 text-[10px] uppercase w-16">Tim EMT:</span>
                    <strong className="text-teal-900">{eocPopup.details.nama_tim_emt}</strong>
                  </div>
                )}
                {eocPopup.details?.organisasi && eocPopup.details.organisasi !== eocPopup.details.nama_tim_emt && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-slate-500 font-medium shrink-0 text-[10px] uppercase w-16">Klaster:</span>
                    <strong className="text-slate-700">{eocPopup.details.organisasi}</strong>
                  </div>
                )}
              </div>
            )}

            {eocPopup.distance !== undefined && eocPopup.distance > 0 && (
              <div className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[10px] font-bold border ${eocPopup.isTerdampak
                  ? 'bg-rose-50/70 border-rose-100/80 text-rose-900'
                  : 'bg-teal-50/70 border-teal-100/80 text-teal-900'
                }`}>
                <span>Jarak dari Titik Bencana:</span>
                <span className={`font-black text-[11px] ${eocPopup.isTerdampak ? 'text-rose-800' : 'text-teal-800'}`}>± {eocPopup.distance} km</span>
              </div>
            )}

            {/* Informasi Kerusakan untuk Faskes Terdampak */}
            {eocPopup.isTerdampak && eocPopup.dampakInfo && (() => {
              const d = eocPopup.dampakInfo
              const hasBerat = (d.rusak_berat || 0) > 0
              const hasSedang = (d.rusak_sedang || 0) > 0
              const hasRingan = (d.rusak_ringan || 0) > 0
              const kondisiLabel = hasBerat ? 'Rusak Berat' : hasSedang ? 'Rusak Sedang' : hasRingan ? 'Rusak Ringan' : (d.kondisi_faskes || d.status || 'Terdampak')
              const kondisiColor = hasBerat ? 'text-rose-700 bg-rose-50 border-rose-200' : hasSedang ? 'text-orange-700 bg-orange-50 border-orange-200' : 'text-amber-700 bg-amber-50 border-amber-200'
              return (
                <div className="space-y-1.5 rounded-xl border border-rose-200 bg-rose-50/60 p-2.5 text-[11px]">
                  <div className="text-[10px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="h-3 w-3" />
                    Kondisi Kerusakan Dilaporkan
                  </div>
                  {/* Tingkat Kerusakan Struktural */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Tingkat Kerusakan:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${kondisiColor}`}>
                      {kondisiLabel}
                    </span>
                  </div>
                  {/* Detail Unit Rusak */}
                  {(hasBerat || hasSedang || hasRingan) && (
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      {hasBerat && (
                        <div className="rounded-lg bg-rose-100 border border-rose-200 p-1.5 text-center">
                          <span className="block text-[8.5px] font-bold text-rose-600 uppercase">Berat</span>
                          <span className="text-[12px] font-black text-rose-800">{d.rusak_berat}</span>
                        </div>
                      )}
                      {hasSedang && (
                        <div className="rounded-lg bg-orange-100 border border-orange-200 p-1.5 text-center">
                          <span className="block text-[8.5px] font-bold text-orange-600 uppercase">Sedang</span>
                          <span className="text-[12px] font-black text-orange-800">{d.rusak_sedang}</span>
                        </div>
                      )}
                      {hasRingan && (
                        <div className="rounded-lg bg-amber-100 border border-amber-200 p-1.5 text-center">
                          <span className="block text-[8.5px] font-bold text-amber-600 uppercase">Ringan</span>
                          <span className="text-[12px] font-black text-amber-800">{d.rusak_ringan}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Status Fungsi Pelayanan */}
                  {d.fungsi_pelayanan && (
                    <div className="flex items-start gap-1.5 pt-1 border-t border-rose-100">
                      <span className="text-slate-500 font-medium shrink-0">Fungsi Layanan:</span>
                      <span className="font-bold text-rose-800 leading-snug">{d.fungsi_pelayanan}</span>
                    </div>
                  )}
                  {d.kondisi_faskes && !d.fungsi_pelayanan && (
                    <div className="flex items-start gap-1.5 pt-1 border-t border-rose-100">
                      <span className="text-slate-500 font-medium shrink-0">Kondisi:</span>
                      <span className="font-bold text-rose-800 leading-snug">{d.kondisi_faskes}</span>
                    </div>
                  )}
                </div>
              )
            })()}

            {eocPopup.type === 'volcano' && eocPopup.volcanoInfo && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className="rounded-xl p-2.5 text-center border"
                    style={{
                      backgroundColor: `${eocPopup.volcanoInfo.statusColor}15`,
                      borderColor: `${eocPopup.volcanoInfo.statusColor}40`,
                    }}
                  >
                    <span className="text-[9px] font-black uppercase block" style={{ color: eocPopup.volcanoInfo.statusColor }}>
                      Tingkat Status
                    </span>
                    <span className="text-sm font-black block mt-0.5" style={{ color: eocPopup.volcanoInfo.statusColor }}>
                      {eocPopup.volcanoInfo.status}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-center">
                    <span className="text-[9px] font-black uppercase text-slate-500 block">Ketinggian</span>
                    <span className="text-sm font-black text-slate-800 block mt-0.5">
                      {eocPopup.volcanoInfo.elevation} mdpl
                    </span>
                    <span className="text-[8.5px] font-bold text-slate-400 block">Meter DPL</span>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-[11px]">
                  {eocPopup.volcanoInfo.hazardRadiusKm > 0 && (
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                      <span className="text-slate-500 font-medium">Radius Bahaya:</span>
                      <span className="font-bold text-rose-700">
                        {eocPopup.volcanoInfo.hazardRadiusKm} km dari kawah
                      </span>
                    </div>
                  )}
                  <div className="border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-medium block mb-1">Rekomendasi PVMBG:</span>
                    <p className="text-[10px] text-slate-700 leading-relaxed font-medium">
                      {eocPopup.volcanoInfo.rekomendasi}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-slate-500 font-medium">Sumber Data:</span>
                    <span className="font-bold text-teal-800 text-[10px]">
                      MAGMA Indonesia (PVMBG ESDM)
                    </span>
                  </div>
                </div>

                <a
                  href={eocPopup.volcanoInfo.link || 'https://magma.esdm.go.id/v1/gunung-api/laporan'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Buka Laporan Resmi MAGMA ESDM
                </a>
              </div>
            )}

            {eocPopup.type === 'earthquake' && eocPopup.earthquakeInfo && (
              <div className="space-y-2.5">
                {/* Seismic Key Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-center">
                    <span className="text-[9px] font-black uppercase text-red-600 block">Magnitudo</span>
                    <span className="text-xl font-black text-red-700 block mt-0.5">
                      M {eocPopup.earthquakeInfo.magnitude.toFixed(1)}
                    </span>
                    <span className="text-[8.5px] font-bold text-red-500 block">Skala Richter</span>
                  </div>
                  <div className="rounded-xl bg-orange-50 border border-orange-200 p-2.5 text-center">
                    <span className="text-[9px] font-black uppercase text-orange-600 block">Kedalaman</span>
                    <span className="text-xl font-black text-orange-800 block mt-0.5">
                      {eocPopup.earthquakeInfo.depth} km
                    </span>
                    <span className="text-[8.5px] font-bold text-orange-500 block">
                      {eocPopup.earthquakeInfo.depth <= 70 ? 'Dangkal (< 70km)' : 'Menengah'}
                    </span>
                  </div>
                </div>

                {/* Details List */}
                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-[11px]">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-medium">Waktu Kejadian:</span>
                    <span className="font-bold text-slate-800">
                      {eocPopup.earthquakeInfo.time} {eocPopup.earthquakeInfo.dateLabel && `(${eocPopup.earthquakeInfo.dateLabel})`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-medium">Tipe Guncangan:</span>
                    <span className={`px-2 py-0.2 rounded-full font-black text-[9px] border ${eocPopup.earthquakeInfo.isMainshock
                        ? 'bg-red-100 text-red-800 border-red-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                      {eocPopup.earthquakeInfo.isMainshock ? 'Gempa Utama (Mainshock)' : 'Gempa Susulan'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-medium">Koordinat:</span>
                    <span className="font-mono font-bold text-slate-700 text-[10px]">
                      {eocPopup.lat.toFixed(4)}°, {eocPopup.lng.toFixed(4)}°
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-slate-500 font-medium">Sumber Data:</span>
                    <span className="font-bold text-teal-800 text-[10px]">
                      {eocPopup.earthquakeInfo.source || 'USGS & BMKG'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Metrics Grid (for Faskes/Shelter) */}
            {eocPopup.type !== 'tck' && eocPopup.type !== 'earthquake' && (
              <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                {eocPopup.details?.kapasitas ? (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                    <span className="text-slate-400 block uppercase font-bold text-[8.5px]">Kapasitas TT</span>
                    <span className="font-extrabold text-slate-800 text-[11px]">{eocPopup.details.kapasitas} Bed</span>
                  </div>
                ) : null}

                {eocPopup.details?.dokter || eocPopup.details?.perawat ? (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                    <span className="text-slate-400 block uppercase font-bold text-[8.5px]">Tenaga Medis</span>
                    <span className="font-extrabold text-slate-800 text-[11px]">
                      {[
                        eocPopup.details.dokter ? `${eocPopup.details.dokter} Dr` : null,
                        eocPopup.details.perawat ? `${eocPopup.details.perawat} Ns` : null
                      ].filter(Boolean).join(' · ') || 'Siaga'}
                    </span>
                  </div>
                ) : null}

                {eocPopup.details?.ambulans ? (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                    <span className="text-slate-400 block uppercase font-bold text-[8.5px]">Ambulans</span>
                    <span className="font-extrabold text-slate-800 text-[11px]">{eocPopup.details.ambulans} Unit</span>
                  </div>
                ) : null}

                {eocPopup.details?.pengungsi_jiwa ? (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                    <span className="text-slate-400 block uppercase font-bold text-[8.5px]">Warga Ditampung</span>
                    <span className="font-extrabold text-purple-800 text-[11px]">{eocPopup.details.pengungsi_jiwa} Jiwa</span>
                  </div>
                ) : null}

                {eocPopup.details?.operasional && !isFloodEocMode && (
                  <div className="col-span-2 rounded-lg bg-emerald-50/50 border border-emerald-100 p-1.5 flex items-center justify-between text-[10px]">
                    <span className="text-emerald-700 font-bold">Status Kesiapan:</span>
                    <span className="font-extrabold text-emerald-800">{eocPopup.details.operasional}</span>
                  </div>
                )}
              </div>
            )}

            {/* ─── Identifikasi Kondisi Pasien (Triase IGD & Rawat) ─── */}
            {(eocPopup.type === 'hospital' || eocPopup.type === 'clinic' || eocPopup.type === 'pustu' || eocPopup.isTerdampak) && (() => {
              const triage = getFaskesTriageData(eocPopup.rawItem, eocPopup.name, faskesList)
              if (!triage) return null

              const totalPatients = triage.total || (triage.merah + triage.kuning + triage.hijau + triage.hitam)
              const hasPatients = totalPatients > 0

              return (
                <div className="mt-2.5 pt-2.5 border-t border-slate-150 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-800 flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5 text-rose-600" />
                      Kondisi Pasien (Triase)
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${triage.merah > 0
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : hasPatients
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                      {hasPatients ? `Total: ${totalPatients} Pasien` : '0 Pasien'}
                    </span>
                  </div>

                  {/* 4 Kolom Triase Mini Badge Grid */}
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div className="rounded-lg bg-rose-50 border border-rose-200/90 p-1.5 flex flex-col items-center justify-center">
                      <span className="block text-[8px] font-black text-rose-600 uppercase leading-none">Merah</span>
                      <span className="text-[13px] font-black text-rose-700 mt-0.5 block leading-tight">{triage.merah}</span>
                      <span className="text-[7.5px] text-rose-500 font-bold block leading-none mt-0.5">Kritis</span>
                    </div>
                    <div className="rounded-lg bg-amber-50 border border-amber-200/90 p-1.5 flex flex-col items-center justify-center">
                      <span className="block text-[8px] font-black text-amber-700 uppercase leading-none">Kuning</span>
                      <span className="text-[13px] font-black text-amber-800 mt-0.5 block leading-tight">{triage.kuning}</span>
                      <span className="text-[7.5px] text-amber-600 font-bold block leading-none mt-0.5">Mendesak</span>
                    </div>
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200/90 p-1.5 flex flex-col items-center justify-center">
                      <span className="block text-[8px] font-black text-emerald-700 uppercase leading-none">Hijau</span>
                      <span className="text-[13px] font-black text-emerald-800 mt-0.5 block leading-tight">{triage.hijau}</span>
                      <span className="text-[7.5px] text-emerald-600 font-bold block leading-none mt-0.5">Ringan</span>
                    </div>
                    <div className="rounded-lg bg-slate-100 border border-slate-300 p-1.5 flex flex-col items-center justify-center">
                      <span className="block text-[8px] font-black text-slate-700 uppercase leading-none">Hitam</span>
                      <span className="text-[13px] font-black text-slate-900 mt-0.5 block leading-tight">{triage.hitam}</span>
                      <span className="text-[7.5px] text-slate-500 font-bold block leading-none mt-0.5">Meninggal</span>
                    </div>
                  </div>

                  {triage.catatan ? (
                    <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-amber-50/80 border border-amber-200 text-[10px] text-amber-900 leading-tight">
                      <strong className="font-bold text-amber-950">Catatan:</strong> {triage.catatan}
                    </div>
                  ) : null}
                </div>
              )
            })()}

            {/* List Relawan TCK yang siaga di Faskes Ini (Cross-Reference) */}
            {(eocPopup.type === 'hospital' || eocPopup.type === 'clinic' || eocPopup.type === 'pustu') && (() => {
              const matchedTck = (tckList || []).filter((r: any) => {
                const occ = String(r.pekerjaan || '').toLowerCase()
                const fName = String(eocPopup.name || '').toLowerCase()
                return (occ && (fName.includes(occ) || occ.includes(fName))) ||
                  (r.kab_kota && String(eocPopup.address || '').toLowerCase().includes(String(r.kab_kota).toLowerCase()))
              })

              if (matchedTck.length === 0) return null

              return (
                <div className="mt-2.5 pt-2.5 border-t border-slate-150">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase text-teal-800 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                      Relawan TCK Siaga ({matchedTck.length})
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">TCK Kemkes RI</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-teal-50">
                    {matchedTck.map((tck: any, tIdx: number) => {
                      const cleanPhone = String(tck.nomor_telp || '').replace(/[^0-9]/g, '')
                      const displayName = tck.nama && String(tck.nama).trim() !== '' && tck.nama !== '-'
                        ? tck.nama
                        : (tck.nama_relawan || tck.nama_lengkap || (tck.spesifikasi && tck.spesifikasi !== '-' ? `Relawan (${tck.spesifikasi})` : 'Relawan TCK'))
                      const displayRole = (tck.spesifikasi && tck.spesifikasi !== '-')
                        ? tck.spesifikasi
                        : (tck.golongan && tck.golongan !== '-'
                          ? tck.golongan
                          : (tck.pekerjaan && tck.pekerjaan !== '-' ? tck.pekerjaan : 'Tenaga Medis'))
                      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}?text=Halo%20${encodeURIComponent(displayName)},%20kami%20menghubungi%20dari%20EOC%20SIPKK%20Kemenkes%20terkait%20penanganan%20kejadian%20bencana.` : ''
                      return (
                        <div key={tIdx} className="flex items-center justify-between p-2 rounded-lg bg-teal-50/60 hover:bg-teal-50 border border-teal-100/80 text-[10px] transition">
                          <div className="min-w-0 pr-1.5 flex-1">
                            <strong className="text-slate-800 truncate block font-bold leading-tight">{displayName}</strong>
                            <span className="text-teal-700 text-[9px] block truncate font-medium mt-0.5">{displayRole}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                if (onSelectRouteTarget) {
                                  onSelectRouteTarget({
                                    ...tck,
                                    latitude: eocPopup.lat,
                                    longitude: eocPopup.lng
                                  }, 'tck')
                                }
                                setEocPopup(null)
                              }}
                              className="px-2 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-bold text-[9.5px] transition shadow-xs"
                              title="Set Rute ke Dokter/Relawan Ini"
                            >
                              Rute
                            </button>
                            {cleanPhone && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9.5px] transition shadow-xs"
                                title="Chat WhatsApp"
                              >
                                WA
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-100 p-2.5 bg-slate-50/50 flex gap-2">
            {(eocPopup.type === 'earthquake' || eocPopup.type === 'volcano') ? (
              <div className="w-full flex gap-2">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${eocPopup.lat},${eocPopup.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl text-white py-2 text-[11px] font-bold shadow-xs transition ${
                    eocPopup.type === 'volcano' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Buka Titik Koordinat di Google Maps
                </a>
              </div>
            ) : eocPopup.isTerdampak ? (
              /* Faskes Terdampak: tidak bisa dijadikan rute, tampilkan peringatan + link lokasi */
              <>
                <div className="flex-1 flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-2.5 py-2 text-[10px] font-bold text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Tidak dapat dijadikan tujuan rute — faskes ini sedang terdampak bencana</span>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${eocPopup.lat},${eocPopup.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 px-3 py-2 text-[11px] font-bold transition shrink-0"
                  title="Lihat di Google Maps"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Lokasi
                </a>
              </>
            ) : eocPopup.type !== 'disaster' ? (
              <>
                <button
                  onClick={() => {
                    if (onSelectRouteTarget) {
                      onSelectRouteTarget(eocPopup.rawItem, eocPopup.type as any)
                    }
                    setEocPopup(null)
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white py-2 text-[11px] font-bold shadow-xs transition"
                >
                  <Compass className="h-3.5 w-3.5" />
                  {eocPopup.type === 'tck' ? 'Rute ke TCK' : 'Rute Taktis'}
                </button>
                {eocPopup.type === 'tck' && eocPopup.details?.nomor_telp && (
                  <a
                    href={`https://wa.me/${String(eocPopup.details.nomor_telp).replace(/[^0-9]/g, '').startsWith('0') ? '62' + String(eocPopup.details.nomor_telp).replace(/[^0-9]/g, '').slice(1) : String(eocPopup.details.nomor_telp).replace(/[^0-9]/g, '')}?text=Halo%20${encodeURIComponent(eocPopup.name)},%20kami%20menghubungi%20dari%20EOC%20SIPKK%20Kemenkes.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-[11px] font-bold transition shadow-xs"
                    title="Hubungi WhatsApp"
                  >
                    WA
                  </a>
                )}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${eocPopup.lat},${eocPopup.lng}&travelmode=driving`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 px-3 py-2 text-[11px] font-bold transition"
                  title="Buka di Google Maps"
                >
                  <Globe className="h-3.5 w-3.5 text-teal-700" />
                  G-Maps
                </a>
              </>
            ) : (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${eocPopup.lat},${eocPopup.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white py-2 text-[11px] font-bold shadow-xs transition"
              >
                <MapPin className="h-3.5 w-3.5" />
                Lihat di Google Maps
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Polygon Popup (Province / Kabupaten Click) ── */}
      {activePopup && (
        <div className="absolute right-4 top-14 z-20 w-[330px] sm:w-[380px] max-h-[540px] flex flex-col rounded-2xl border border-teal-300/80 bg-white/95 backdrop-blur-md p-4 shadow-[0_16px_50px_rgba(15,118,110,0.18)] transition-all duration-300 animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-2.5 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="inline-block rounded-full bg-teal-100 text-teal-800 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                  Detail {activePopup.type}
                </span>
                <span className="inline-block rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold">
                  Data Terbuka
                </span>
              </div>
              <h4 className="text-base font-black uppercase tracking-wider text-slate-900 truncate">
                {activePopup.name}
              </h4>
            </div>
            <button
              onClick={() => setActivePopup(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              title="Tutup Detail"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Ringkasan Statistik 2x2 Grid PSC 119 ── */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* Total Panggilan */}
            <div className="rounded-xl bg-teal-50/90 p-2.5 border border-teal-200/70">
              <p className="text-[9.5px] font-extrabold text-teal-800 uppercase tracking-wide">Total Panggilan</p>
              <p className="text-lg font-black text-teal-950">
                {(activePopup.stats.totalEvents ?? 0).toLocaleString('id-ID')} <span className="text-[10px] font-bold text-teal-700">Panggilan</span>
              </p>
            </div>

            {/* Gawat Darurat / Trauma */}
            <div className="rounded-xl bg-rose-50/90 p-2.5 border border-rose-200/70">
              <p className="text-[9.5px] font-extrabold text-rose-800 uppercase tracking-wide">Gadar / Trauma</p>
              <p className="text-lg font-black text-rose-950">
                {(activePopup.stats.totalEmergency ?? 0).toLocaleString('id-ID')} <span className="text-[10px] font-bold text-rose-700">Kasus</span>
              </p>
            </div>

            {/* Ambulans Dikerahkan */}
            <div className="rounded-xl bg-amber-50/90 p-2.5 border border-amber-200/70">
              <p className="text-[9.5px] font-extrabold text-amber-800 uppercase tracking-wide">Dispatch Ambulans</p>
              <p className="text-lg font-black text-amber-950">
                {(activePopup.stats.totalAmbulans ?? 0).toLocaleString('id-ID')} <span className="text-[10px] font-bold text-amber-700">Armada</span>
              </p>
            </div>

            {/* Selesai Ditangani */}
            <div className="rounded-xl bg-emerald-50/90 p-2.5 border border-emerald-200/70">
              <p className="text-[9.5px] font-extrabold text-emerald-800 uppercase tracking-wide">Selesai Ditangani</p>
              <p className="text-lg font-black text-emerald-950">
                {(activePopup.stats.totalSelesai ?? 0).toLocaleString('id-ID')} <span className="text-[10px] font-bold text-emerald-700">Selesai</span>
              </p>
            </div>
          </div>

          {/* ── Detail Content List (Scrollable) ── */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[220px]">
            {activePopup.type === 'provinsi' ? (
              <>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                  Sebaran Panggilan per Kab/Kota:
                </p>
                {activePopup.stats.breakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Tidak ada panggilan tercatat di wilayah ini.</p>
                ) : (
                  <div className="space-y-1.5">
                    {activePopup.stats.breakdown.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center rounded-lg bg-slate-50 p-2 text-xs border border-slate-100">
                        <span className="font-semibold text-slate-700 truncate max-w-[180px]">{item.name}</span>
                        <div className="flex items-center gap-1.5">
                          {item.emergency ? (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              {item.emergency} gadar
                            </span>
                          ) : null}
                          <span className="font-extrabold text-teal-800 bg-teal-50/60 border border-teal-200/60 px-1.5 py-0.5 rounded-md">
                            {item.count} panggilan
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Faskes / Rumah Sakit Jejaring Rujukan */}
                {activePopup.stats.faskesList && activePopup.stats.faskesList.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-teal-600" />
                      Jejaring RS &amp; Fasyankes Rujukan ({activePopup.stats.faskesList.length} Unit):
                    </p>
                    <div className="space-y-1.5">
                      {activePopup.stats.faskesList.map((f: any, idx: number) => (
                        <div key={idx} className="rounded-xl border border-teal-100 bg-teal-50/40 p-2 text-xs">
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-slate-800 text-[11px] truncate">{f.nama || f.nama_faskes}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-medium">
                            {f.kecamatan && <span>Kec. {f.kecamatan}</span>}
                            {f.tt_tersedia && <span>• {f.tt_tersedia} TT</span>}
                            {f.telp && <span>• Telp: {f.telp}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Log Panggilan Kedaruratan Terkini */}
                {activePopup.stats.eventsList && activePopup.stats.eventsList.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Log Panggilan Kedaruratan Terkini ({activePopup.stats.eventsList.length}):
                    </p>
                    <div className="space-y-1.5">
                      {activePopup.stats.eventsList.map((item: any, idx: number) => (
                        <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-teal-800">{item.kategori_layanan || item.jenis_layanan || formatDisasterName(item.jenis_bencana) || 'Panggilan Medis'}</span>
                            <span className="text-[10px] text-slate-400">{item.tgl_kejadian}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500">
                            {item.kecamatan && <span>Kec. {item.kecamatan}</span>}
                            {item.desa && <span>, {item.desa}</span>}
                          </div>
                          <div className="mt-1 flex items-center justify-between border-t border-dashed border-slate-200 pt-1">
                            <span className="text-[10px] text-slate-400">Status Tindak Lanjut:</span>
                            <span className="font-bold text-emerald-700">{item.status_penanganan_code || 'Selesai'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Footer */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2">
            {activePopup.featureExtent && (
              <button
                onClick={() => {
                  if (mapInstanceRef.current && activePopup.featureExtent) {
                    mapInstanceRef.current.getView().fit(activePopup.featureExtent, { padding: [70, 70, 70, 70], duration: 600 })
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 py-2 text-xs font-bold text-white shadow-xs transition active:scale-[0.98]"
              >
                <Compass className="w-3.5 h-3.5" />
                Fokus Wilayah
              </button>
            )}

            {activePopup.type === 'provinsi' && (
              <button
                onClick={() => {
                  onSelectProvinceRef.current?.(activePopup.name)
                  setActivePopup(null)
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 py-2 text-xs font-bold text-white shadow-xs transition"
              >
                Lihat Detail Provinsi &rarr;
              </button>
            )}

            <button
              onClick={() => setActivePopup(null)}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ── Legend (bottom-left) ── */}
      {((showWindLegend && showWindy) || showRegionLegend || showCasualtyLegend) && (
        <div className="absolute bottom-4 left-4 max-w-[280px] sm:max-w-[320px] rounded-2xl border border-teal-200/90 bg-white/95 backdrop-blur-md p-3.5 shadow-[0_8px_30px_rgba(15,118,110,0.15)] space-y-3 z-10 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-teal-700" />
              <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Legenda Peta Spasial</span>
            </div>
            <button
              onClick={() => {
                setShowWindLegend(false)
                setShowRegionLegend(false)
                setShowCasualtyLegend(false)
              }}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition"
              title="Tutup Legenda (Bisa diaktifkan lagi di Pengaturan Peta)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Wind Speed & Direction Legend */}
          {showWindLegend && showWindy && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 flex items-center gap-1">
                  <Wind className="h-3 w-3 text-teal-650" />
                  Aliran &amp; Kecepatan Angin (GFS)
                </span>
              </div>

              {/* Gradient Bar */}
              <div className="h-2 w-full rounded-full bg-gradient-to-r from-[rgb(15,60,140)] via-[rgb(85,160,115)] via-[rgb(215,195,60)] via-[rgb(210,125,35)] to-[rgb(185,35,10)] shadow-inner" />
              <div className="flex justify-between text-[8.5px] font-bold text-slate-500 px-0.5">
                <span>0 km/j</span>
                <span>20 km/j</span>
                <span>40 km/j</span>
                <span>&gt;60 km/j</span>
              </div>

              {/* Color Categories */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[9.5px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#55a073] shrink-0 border border-slate-200" />
                  <span className="text-slate-700 font-semibold">🟢 Hijau: Normal / Tenang</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#d7c33c] shrink-0 border border-slate-200" />
                  <span className="text-slate-700 font-semibold">🟡 Kuning: Sedang</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#b9230a] shrink-0 border border-slate-200" />
                  <span className="text-slate-700 font-semibold">🔴 Merah: Kencang / Bahaya</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#730012] shrink-0 border border-slate-200" />
                  <span className="text-slate-700 font-semibold">🟣 Ungu: Badai Ekstrem</span>
                </div>
              </div>

              <div className="bg-teal-50/60 rounded-lg p-1.5 border border-teal-100 text-[9px] text-teal-800 leading-tight">
                🧭 <strong>Mata Angin:</strong> Garis partikel bergerak mengikuti arah tiupan angin (dari hulu ke hilir tujuan).
              </div>
            </div>
          )}

          {/* Choropleth legend */}
          {showRegionLegend && (
            <div className="border-t border-slate-100 pt-2">
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#0f766e]">{markerTitle}</p>
              <div className="space-y-1">
                {choroplethLegend.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full border border-slate-200 shadow-xs" style={{ background: b.color }} />
                    <span className="text-[10px] font-medium text-slate-700">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pin Marker (Panggilan, Ambulans, RS) legend */}
          {showCasualtyLegend && (
            <div className="border-t border-slate-100 pt-2 space-y-2">
              <div>
                <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-teal-800">
                  Ikon Layer Peta PSC 119
                </p>
                <div className="grid grid-cols-1 gap-1.5 text-[9.5px]">
                  <div className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white shadow-xs">
                      <User className="h-2.5 w-2.5" />
                    </span>
                    <span className="text-slate-700 font-semibold">Titik Panggilan 119 (Ikon Orang)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white shadow-xs">
                      <Ambulance className="h-2.5 w-2.5" />
                    </span>
                    <span className="text-slate-700 font-semibold">Armada Ambulans PSC</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                      <Building2 className="h-2.5 w-2.5" />
                    </span>
                    <span className="text-slate-700 font-semibold">Rumah Sakit Rujukan</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                  Status Titik Panggilan
                </p>
                <div className="grid grid-cols-3 gap-1 text-[9px]">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-600 shrink-0" />
                    <span className="text-slate-700 font-medium">Emergency</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-slate-700 font-medium">Diproses</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-teal-700 shrink-0" />
                    <span className="text-slate-700 font-medium">Selesai</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


    </div>
  )
}
