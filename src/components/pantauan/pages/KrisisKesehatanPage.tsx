'use client'

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Activity, Flame, Shield, Users, Database, Plus, RefreshCw, Layers, ShieldAlert, HeartPulse, Stethoscope, Table } from 'lucide-react'
import PantauanPageTemplate, { PantauanStatWidget } from '../PantauanPageTemplate'
import { WindLayer } from 'ol-wind'

type JSONObject = Record<string, unknown>

type RSItem = {
  nama?: string;
  name?: string;
  kode?: string;
  koders?: string;
  alamat?: string;
  telp?: string;
  no_telp?: string;
  longitude?: string | number;
  latitude?: string | number;
  lon?: string | number;
  lat?: string | number;
}

type NakesItem = {
  nama?: string;
  alamat?: string;
  longitude?: string | number;
  latitude?: string | number;
  lon?: string | number;
  lat?: string | number;
}

type BencanaEventItem = {
  id_event?: number;
  tgl_kejadian?: string;
  nama_bencana?: string;
  nama_kecamatan?: string;
  jml_meninggal?: number;
  jml_hilang?: number;
  jml_luka_berat?: number;
  jml_luka_ringan?: number;
  jml_pengungsi?: number;
  jml_korban_total?: number;
  icon_filename?: string;
  icon_url?: string;
  points?: unknown;
  content_html?: string;
}

type LayerGroup = {
  group: string;
  layers: { id: string; name: string; visible: boolean }[];
}

type VisibilityLike = {
  getVisible?: () => boolean;
  setVisible?: (v: boolean) => void;
  get?: (k: string) => unknown;
  set?: (k: string, v: unknown) => void;
}

type OLMapLike = {
  setTarget?: (t: HTMLElement | null) => void;
  updateSize?: () => void;
  getLayers?: () => { getArray: () => VisibilityLike[] };
  getView?: () => { fit?: (extent: unknown, opt?: JSONObject) => void };
  addOverlay?: (o: unknown) => void;
  on?: (evt: string, cb: (e: unknown) => void) => void;
  forEachFeatureAtPixel?: (
    pixel: unknown,
    cb: (feature: unknown) => boolean | void,
    opt?: JSONObject
  ) => void;
}

type VectorSourceLike = {
  clear: () => void;
  addFeatures: (f: unknown[]) => void;
  addFeature: (f: unknown) => void;
}

type WindLayerLike = VisibilityLike & {
  appendTo?: (map: unknown) => void;
  on?: (evt: string, cb: () => void) => void;
}

type OLOverylayLike = { setPosition?: (coord: unknown) => void }

// ===== Helpers =====
function isObject(v: unknown): v is JSONObject {
  return typeof v === 'object' && v !== null
}
function isArray<T = unknown>(v: unknown): v is T[] {
  return Array.isArray(v)
}
function pickDataArray<T>(json: unknown): T[] {
  if (isArray<T>(json)) return json
  if (isObject(json) && isArray<T>((json as any).data)) return (json as any).data as T[]
  return []
}
function toNum(v: unknown): number {
  const s = String(v ?? '').trim().replace(',', '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : NaN
}
function validLonLat(lon: number, lat: number): boolean {
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lon >= -180 &&
    lon <= 180 &&
    lat >= -90 &&
    lat <= 90
  )
}
async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return (await res.json()) as unknown
}
function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
function fmtDateId(dateStr?: string): string {
  if (!dateStr) return '-'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return escHtml(dateStr)
  return `${m[3]}-${m[2]}-${m[1]}`
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const found = document.querySelector<HTMLScriptElement>(`script[data-src="${src}"]`)
    if (found) {
      if (found.getAttribute('data-loaded') === '1') resolve()
      else found.addEventListener('load', () => resolve(), { once: true })
      return
    }

    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.defer = true
    s.setAttribute('data-src', src)
    s.addEventListener('load', () => {
      s.setAttribute('data-loaded', '1')
      resolve()
    })
    s.addEventListener('error', () => reject(new Error(`Gagal load script: ${src}`)))
    document.head.appendChild(s)
  })
}

function loadCssOnce(href: string): void {
  const found = document.querySelector<HTMLLinkElement>(`link[data-href="${href}"]`)
  if (found) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = href
  l.setAttribute('data-href', href)
  document.head.appendChild(l)
}

function destroyWindLayerSafely(wl: WindLayerLike | null) {
  if (!wl) return
  try { wl.setVisible?.(false) } catch {}

  const obj = wl as unknown as Record<string, unknown>
  const tryCall = (k: string, arg?: unknown) => {
    const fn = obj[k]
    if (typeof fn === 'function') {
      try { (fn as (a?: unknown) => void)(arg) } catch {}
    }
  }

  tryCall('stop')
  tryCall('destroy')
  tryCall('dispose')
  tryCall('remove')
  tryCall('setMap', null)
  tryCall('setTarget', null)
}

function forceRefreshMap(map: OLMapLike | null) {
  if (!map) return
  try { map.updateSize?.() } catch {}
  try { (map as any).renderSync?.() } catch {}

  requestAnimationFrame(() => {
    try { map.updateSize?.() } catch {}
    try { (map as any).renderSync?.() } catch {}
  })
}

type LonLat = { lon: number; lat: number }

function pickLonLatFromAny(v: any): LonLat | null {
  if (Array.isArray(v) && v.length >= 2) {
    const lon = toNum(v[0])
    const lat = toNum(v[1])
    if (validLonLat(lon, lat)) return { lon, lat }
    if (validLonLat(lat, lon)) return { lon: lat, lat: lon }
    return null
  }
  if (v && typeof v === 'object') {
    const lon = toNum(v.lon ?? v.lng ?? v.longitude)
    const lat = toNum(v.lat ?? v.latitude)
    if (validLonLat(lon, lat)) return { lon, lat }
    if (validLonLat(lat, lon)) return { lon: lat, lat: lon }
  }
  return null
}

function extractEventPoints(points: unknown): LonLat[] {
  const out: LonLat[] = []
  const push = (p: LonLat | null) => {
    if (!p) return
    if (!validLonLat(p.lon, p.lat)) return
    out.push(p)
  }

  const walk = (x: any) => {
    if (x == null) return
    if (x.type === 'FeatureCollection' && Array.isArray(x.features)) {
      x.features.forEach((f: any) => walk(f))
      return
    }
    if (x.type === 'Feature') {
      walk(x.geometry)
      return
    }
    if (x.type === 'Point') {
      push(pickLonLatFromAny(x.coordinates))
      return
    }
    if (x.type === 'MultiPoint' && Array.isArray(x.coordinates)) {
      x.coordinates.forEach((c: any) => push(pickLonLatFromAny(c)))
      return
    }
    if (Array.isArray(x)) {
      x.forEach((it) => {
        const p = pickLonLatFromAny(it)
        if (p) push(p)
        else walk(it)
      })
      return
    }
    if (typeof x === 'object') {
      if (Array.isArray(x.titik)) x.titik.forEach((it: any) => push(pickLonLatFromAny(it)))
      if (Array.isArray(x.points)) x.points.forEach((it: any) => push(pickLonLatFromAny(it)))
      if (Array.isArray(x.data)) x.data.forEach((it: any) => push(pickLonLatFromAny(it)))
      if (x.coordinates) push(pickLonLatFromAny(x.coordinates))
      if (x.geometry) walk(x.geometry)
      push(pickLonLatFromAny(x))
    }
  }

  walk(points)

  const seen = new Set<string>()
  return out.filter((p) => {
    const k = `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function buildPopupEventEoc(row: BencanaEventItem) {
  const tgl = fmtDateId(row.tgl_kejadian)
  const meninggal = Number(row.jml_meninggal ?? 0) || 0
  const hilang = Number(row.jml_hilang ?? 0) || 0
  const lukaB = Number(row.jml_luka_berat ?? 0) || 0
  const lukaR = Number(row.jml_luka_ringan ?? 0) || 0
  const pengungsi = Number(row.jml_pengungsi ?? 0) || 0
  const total = Number(row.jml_korban_total ?? (meninggal + hilang + lukaB + lukaR + pengungsi)) || 0

  return `
  <div style="min-width:280px;max-width:360px">
    <div style="font-weight:800;font-size:14px;margin-bottom:6px;color:#1e293b">${escHtml(row.nama_bencana ?? 'Bencana Event')}</div>
    <div style="font-size:12px;line-height:1.5;color:#334155">
      <div><b>Waktu:</b> ${escHtml(tgl)}</div>
      <div><b>Kecamatan:</b> ${escHtml(row.nama_kecamatan ?? '-')}</div>
      <hr style="margin:8px 0;border:none;border-top:1px solid #e2e8f0"/>
      <div style="font-weight:700;margin-bottom:4px;color:#0f172a">Dampak Korban:</div>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:2px 0">Meninggal Dunia</td><td style="text-align:right;color:#ef4444"><b>${meninggal.toLocaleString('id-ID')}</b></td></tr>
        <tr><td style="padding:2px 0">Hilang</td><td style="text-align:right;color:#f97316"><b>${hilang.toLocaleString('id-ID')}</b></td></tr>
        <tr><td style="padding:2px 0">Luka Berat</td><td style="text-align:right;color:#facc15"><b>${lukaB.toLocaleString('id-ID')}</b></td></tr>
        <tr><td style="padding:2px 0">Luka Ringan</td><td style="text-align:right;color:#eab308"><b>${lukaR.toLocaleString('id-ID')}</b></td></tr>
        <tr><td style="padding:2px 0">Mengungsi</td><td style="text-align:right;color:#3b82f6"><b>${pengungsi.toLocaleString('id-ID')}</b></td></tr>
        <tr style="border-top:1px solid #e2e8f0"><td style="padding:4px 0;font-weight:700">Total Korban</td><td style="text-align:right;font-weight:700;color:#1e293b"><b>${total.toLocaleString('id-ID')}</b></td></tr>
      </table>
    </div>
  </div>`
}

export default function KrisisKesehatanPage() {
  const elMapRef = useRef<HTMLDivElement | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const mapRef = useRef<OLMapLike | null>(null)
  const layerIndexRef = useRef<Map<string, VisibilityLike>>(new Map())
  const windLayerRef = useRef<WindLayerLike | null>(null)

  const popupRef = useRef<{
    overlay: OLOverylayLike;
    el: HTMLDivElement;
    content: HTMLDivElement;
  } | null>(null)

  const popupElRef = useRef<HTMLDivElement | null>(null)
  const popupContentRef = useRef<HTMLDivElement | null>(null)

  const [layerGroups, setLayerGroups] = useState<LayerGroup[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showLayerPanel, setShowLayerPanel] = useState(false)
  const [isFs, setIsFs] = useState(false)
  const [loading, setLoading] = useState(true)

  // Dynamic statistics
  const [statBencana, setStatBencana] = useState(0)
  const [statRs, setStatRs] = useState(0)
  const [statPkm, setStatPkm] = useState(0)
  const [statNakes, setStatNakes] = useState(0)
  const [statNonNakes, setStatNonNakes] = useState(0)
  
  // Table feed
  const [activeEvents, setActiveEvents] = useState<BencanaEventItem[]>([])

  const EP = useMemo(() => ({
    rs: '/api/rs',
    pkm: '/api/pkm',
    nakes: '/api/nakes',
    nonNakes: '/api/non-nakes',
    bencanaEvent: '/api/bencana-event',
    gfs: '/api/gfs'
  }), [])

  const refreshOlSize = useCallback(() => {
    const m = mapRef.current as any
    try { m?.updateSize?.() } catch {}
    requestAnimationFrame(() => { try { m?.updateSize?.() } catch {} })
  }, [])

  function toggleFullscreen() {
    setIsFs((v) => {
      const next = !v
      setTimeout(refreshOlSize, 0)
      return next
    })
  }

  const loadMapData = useCallback(async () => {
    const el = elMapRef.current
    if (!el) return

    try {
      setLoading(true)
      setError(null)

      loadCssOnce('/vendor/ol.css')
      await loadScriptOnce('/vendor/ol.js')

      if (!window.ol || !isObject(window.ol)) {
        throw new Error('OpenLayers (window.ol) tidak tersedia di sistem.')
      }

      const ol = window.ol

      const olProj = (ol.proj as JSONObject) ?? {}
      const olExtent = (ol.extent as JSONObject) ?? {}
      const olStyle = (ol.style as JSONObject) ?? {}
      const olInteraction = (ol.interaction as JSONObject) ?? {}
      const olControl = (ol.control as JSONObject) ?? {}
      const olSource = (ol.source as JSONObject) ?? {}
      const olLayer = (ol.layer as JSONObject) ?? {}
      const olGeom = (ol.geom as JSONObject) ?? {}

      const transformExtent = olProj.transformExtent as any
      const fromLonLat = olProj.fromLonLat as any

      const createEmpty = olExtent.createEmpty as any
      const extend = olExtent.extend as any

      const SourceTileArcGISRest = olSource.TileArcGISRest as any
      const SourceVector = olSource.Vector as any
      const SourceCluster = olSource.Cluster as any
      const SourceOSM = olSource.OSM as any

      const LayerTile = olLayer.Tile as any
      const LayerVector = olLayer.Vector as any

      const View = ol.View as any
      const MapCtor = ol.Map as any
      const Overlay = ol.Overlay as any
      const Feature = ol.Feature as any
      const Point = olGeom.Point as any

      const Style = olStyle.Style as any
      const Icon = olStyle.Icon as any
      const Fill = olStyle.Fill as any
      const Stroke = olStyle.Stroke as any
      const Text = olStyle.Text as any
      const CircleStyle = olStyle.Circle as any

      const DragPan = olInteraction.DragPan as any
      const defaultsInteractions = olInteraction.defaults as any
      const defaultsControls = olControl.defaults as any

      // Base basemap OSM
      const osmSource = new SourceOSM()
      const layerOSM = new LayerTile({ source: osmSource, visible: true })
      layerOSM.set?.('id', 'basemap_osm')
      layerOSM.set?.('name', 'OpenStreetMap')
      layerOSM.set?.('group', 'Basemap')
      layerOSM.set?.('baselayer', true)

      // BNPB MapServer helper
      async function isArcGisServiceOk(url: string): Promise<boolean> {
        try {
          const sep = url.includes('?') ? '&' : '?'
          const res = await fetch(`${url}${sep}f=pjson`, { method: 'GET', signal: AbortSignal.timeout(3000) })
          return res.ok
        } catch {
          return false
        }
      }

      async function makeBnpbLayer(id: string, name: string, group: string, url: string, visible = false, opacity = 1) {
        const ok = await isArcGisServiceOk(url)
        if (!ok) return null
        const src = new SourceTileArcGISRest({ ratio: 1, params: {}, url, projection: 'EPSG:3857' })
        const layer = new LayerTile({ source: src, visible, opacity })
        layer.set?.('id', id)
        layer.set?.('name', name)
        layer.set?.('group', group)
        return layer
      }

      const BNPB_SERVICES = {
        admin: 'https://gis.bnpb.go.id/server/rest/services/inarisk/batas_administrasi/MapServer',
        hillshade: 'https://gis.bnpb.go.id/server/rest/services/Basemap/Indo_Hillshade/MapServer',
        kepadatan2020: 'https://gis.bnpb.go.id/server/rest/services/Basemap/Kepadatan_penduduk_2020/MapServer',
      }

      const bnpbLayers: any[] = []
      const loadedAdmin = await makeBnpbLayer('bnpb_admin', 'Batas Administrasi BNPB', 'BNPB Layers', BNPB_SERVICES.admin, true)
      if (loadedAdmin) bnpbLayers.push(loadedAdmin)

      const loadedHill = await makeBnpbLayer('bnpb_hill', 'Indo Hillshade', 'BNPB Layers', BNPB_SERVICES.hillshade, false, 0.5)
      if (loadedHill) bnpbLayers.push(loadedHill)

      // Data Bencana Vector
      const eventSrc = new SourceVector({ features: [] })
      const eventLayer = new LayerVector({
        source: eventSrc,
        visible: true,
        style: (feature: any) => {
          const iconUrl = feature.get?.('icon_url') || 'https://pusatkrisis.kemkes.go.id/spasial/images/bencana.png'
          return [new Style({ image: new Icon({ src: iconUrl, scale: 0.9, anchor: [0.5, 1] }), zIndex: 90 })]
        }
      })
      eventLayer.set?.('id', 'bencana_event')
      eventLayer.set?.('name', 'Kejadian Bencana')
      eventLayer.set?.('group', 'Pemantauan')

      // Cluster factory
      function makeClusterStyleFactory(iconUrl: string, circleColor: string) {
        const cache: Record<number, any> = {}
        return (feature: any) => {
          const members = feature.get?.('features')
          const size = Array.isArray(members) ? members.length : 1

          if (size === 1) {
            return new Style({ image: new Icon({ src: iconUrl, scale: 0.9, anchor: [0.5, 1] }) })
          }

          if (!cache[size]) {
            const radius = Math.min(12 + Math.log(size) * 5, 26)
            cache[size] = [
              new Style({
                image: new CircleStyle({
                  radius,
                  fill: new Fill({ color: circleColor }),
                  stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
                }),
              }),
              new Style({
                image: new Icon({ src: iconUrl, anchor: [0.5, 0.5], scale: 0.6 }),
              }),
              new Style({
                text: new Text({
                  text: String(size),
                  fill: new Fill({ color: '#ffffff' }),
                  stroke: new Stroke({ color: 'rgba(0,0,0,0.6)', width: 3 }),
                  offsetY: radius * 0.4,
                  font: 'bold 11px Inter, sans-serif'
                }),
              }),
            ]
          }
          return cache[size]
        }
      }

      function makeClusterLayer(id: string, name: string, group: string, iconUrl: string, circleColor: string) {
        const vector = new SourceVector({ features: [] })
        const cluster = new SourceCluster({ distance: 40, source: vector })
        const layer = new LayerVector({
          source: cluster,
          visible: true,
          style: makeClusterStyleFactory(iconUrl, circleColor)
        })
        layer.set?.('id', id)
        layer.set?.('name', name)
        layer.set?.('group', group)
        return { layer, vector }
      }

      const rs = makeClusterLayer('rs', 'Rumah Sakit Siaga', 'Fasilitas Kesehatan', 'https://pusatkrisis.kemkes.go.id/spasial/images/rumah_sakit.png', 'rgba(239, 68, 68, 0.75)')
      const pkm = makeClusterLayer('pkm', 'Puskesmas Siaga', 'Fasilitas Kesehatan', 'https://pusatkrisis.kemkes.go.id/spasial/images/puskesmas.png', 'rgba(34, 197, 94, 0.75)')
      const nakes = makeClusterLayer('nakes', 'Nakes Cadangan', 'Sumber Daya Cadangan', 'https://tenagacadangankesehatan.kemkes.go.id/web/app_asset/icon/map_icon/nakes.png', 'rgba(59, 130, 246, 0.75)')
      const nonNakes = makeClusterLayer('nonNakes', 'Relawan Cadangan', 'Sumber Daya Cadangan', 'https://tenagacadangankesehatan.kemkes.go.id/web/app_asset/icon/map_icon/non_nakes.png', 'rgba(168, 85, 247, 0.75)')

      const view = new View({
        center: fromLonLat([118.0, -2.0]),
        zoom: 5,
        maxZoom: 19
      })

      while (el.firstChild) el.removeChild(el.firstChild)

      const map = new MapCtor({
        target: el,
        layers: [layerOSM, ...bnpbLayers, eventLayer, rs.layer, pkm.layer, nakes.layer, nonNakes.layer],
        view,
        controls: defaultsControls({ attribution: false, rotate: false }),
        interactions: defaultsInteractions({ rotate: false })
      })

      mapRef.current = map

      // Resize observer
      roRef.current?.disconnect()
      roRef.current = new ResizeObserver(() => forceRefreshMap(map))
      roRef.current.observe(el)

      // Dynamic Popup Setup
      const popupEl = popupElRef.current
      const popupContent = popupContentRef.current
      if (popupEl && popupContent) {
        const overlay = new Overlay({ element: popupEl, autoPan: true, autoPanAnimation: { duration: 200 } })
        map.addOverlay(overlay)
        popupRef.current = { overlay, el: popupEl, content: popupContent }

        map.on('singleclick', (evt: any) => {
          let handled = false
          const opts = {
            hitTolerance: 6,
            layerFilter: (ly: any) => {
              const src = ly.getSource?.()
              return src && typeof src.clear === 'function'
            }
          }

          map.forEachFeatureAtPixel(evt.pixel, (f: any) => {
            const members = f.get?.('features')
            if (Array.isArray(members) && members.length > 1) {
              const ext = createEmpty()
              members.forEach((m: any) => {
                const geom = m.getGeometry?.()
                if (geom) extend(ext, geom.getExtent())
              })
              map.getView()?.fit(ext, { duration: 250, padding: [50, 50, 50, 50], maxZoom: 13 })
              handled = true
              return true
            }

            const real = Array.isArray(members) && members.length ? members[0] : f
            const type = real.get?.('type')
            const name = real.get?.('name')
            const alamat = real.get?.('alamat')
            const telp = real.get?.('telp')
            const kode = real.get?.('kode')
            const html = real.get?.('content_html')

            if (popupRef.current) {
              if (type === 'Rumah Sakit') {
                popupRef.current.content.innerHTML = `
                  <div class="space-y-1 text-slate-700 min-w-[200px]">
                    <div class="font-bold text-teal-800 text-sm">${escHtml(name)}</div>
                    <div class="text-xs"><b>Kode:</b> ${escHtml(kode)}</div>
                    <div class="text-xs"><b>Alamat:</b> ${escHtml(alamat)}</div>
                    <div class="text-xs"><b>Telpon:</b> ${escHtml(telp)}</div>
                  </div>`
              } else if (type === 'Puskesmas') {
                popupRef.current.content.innerHTML = `
                  <div class="space-y-1 text-slate-700 min-w-[200px]">
                    <div class="font-bold text-emerald-800 text-sm">${escHtml(name)}</div>
                    <div class="text-xs"><b>Kode:</b> ${escHtml(kode)}</div>
                    <div class="text-xs"><b>Alamat:</b> ${escHtml(alamat)}</div>
                  </div>`
              } else if (html) {
                popupRef.current.content.innerHTML = html
              } else {
                popupRef.current.content.innerHTML = `<div class="font-bold">${escHtml(name)}</div>`
              }

              popupRef.current.el.style.display = 'block'
              popupRef.current.overlay.setPosition?.(evt.coordinate)
              handled = true
              return true
            }
          }, opts)

          if (!handled && popupRef.current) {
            popupRef.current.el.style.display = 'none'
          }
        })
      }

      // Wind layer via npm ol-wind (try-catch, 404 safe)
      try {
        const windData = await fetchJSON(EP.gfs)
        const baseVelocity = 0.01;
        const windLayer = new WindLayer(windData as any, {
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
        windLayer.set?.('id', 'wind')
        windLayer.set?.('name', 'Pola Aliran Angin')
        windLayer.set?.('group', 'Meteorologi')
        ;(windLayer as any).setVisible?.(false)
        
        ;(windLayer as any).appendTo?.(map) ?? (map as any).addLayer(windLayer)
        try {
          if (typeof (windLayer as any).stop === 'function') {
            (windLayer as any).stop()
          }
        } catch {}
        windLayerRef.current = windLayer as any
      } catch (e) {
        console.warn('GFS Wind layer failed to load (Optional). Error:', e)
      }

      // Fetch actual data
      const [rsRes, pkmRes, nakesRes, nonNakesRes, eventRes] = await Promise.allSettled([
        fetchJSON(EP.rs),
        fetchJSON(EP.pkm),
        fetchJSON(EP.nakes),
        fetchJSON(EP.nonNakes),
        fetchJSON(EP.bencanaEvent)
      ])

      // Parse RS
      if (rsRes.status === 'fulfilled' && rsRes.value) {
        const data = pickDataArray<RSItem>(rsRes.value)
        setStatRs(data.length)
        const feats = data.map(item => {
          const lon = toNum(item.longitude ?? item.lon)
          const lat = toNum(item.latitude ?? item.lat)
          return new Feature({
            geometry: new Point(fromLonLat([lon, lat])),
            type: 'Rumah Sakit',
            name: item.nama ?? item.name ?? '',
            kode: item.kode ?? item.koders ?? '',
            alamat: item.alamat ?? '',
            telp: item.telp ?? ''
          })
        }).filter(f => validLonLat(toNum(f.getGeometry()?.getCoordinates()?.[0]), toNum(f.getGeometry()?.getCoordinates()?.[1])))
        rs.vector.addFeatures(feats)
      }

      // Parse PKM
      if (pkmRes.status === 'fulfilled' && pkmRes.value) {
        const data = pickDataArray<RSItem>(pkmRes.value)
        setStatPkm(data.length)
        const feats = data.map(item => {
          const lon = toNum(item.longitude ?? item.lon)
          const lat = toNum(item.latitude ?? item.lat)
          return new Feature({
            geometry: new Point(fromLonLat([lon, lat])),
            type: 'Puskesmas',
            name: item.nama ?? item.name ?? '',
            kode: item.kode ?? item.koders ?? '',
            alamat: item.alamat ?? ''
          })
        }).filter(f => validLonLat(toNum(f.getGeometry()?.getCoordinates()?.[0]), toNum(f.getGeometry()?.getCoordinates()?.[1])))
        pkm.vector.addFeatures(feats)
      }

      // Parse Nakes
      if (nakesRes.status === 'fulfilled' && nakesRes.value) {
        const data = pickDataArray<NakesItem>(nakesRes.value)
        setStatNakes(data.length)
        const feats = data.map(item => {
          const lon = toNum(item.longitude ?? item.lon)
          const lat = toNum(item.latitude ?? item.lat)
          return new Feature({
            geometry: new Point(fromLonLat([lon, lat])),
            type: 'Nakes',
            name: item.nama ?? '',
            alamat: item.alamat ?? ''
          })
        }).filter(f => validLonLat(toNum(f.getGeometry()?.getCoordinates()?.[0]), toNum(f.getGeometry()?.getCoordinates()?.[1])))
        nakes.vector.addFeatures(feats)
      }

      // Parse NonNakes
      if (nonNakesRes.status === 'fulfilled' && nonNakesRes.value) {
        const data = pickDataArray<NakesItem>(nonNakesRes.value)
        setStatNonNakes(data.length)
        const feats = data.map(item => {
          const lon = toNum(item.longitude ?? item.lon)
          const lat = toNum(item.latitude ?? item.lat)
          return new Feature({
            geometry: new Point(fromLonLat([lon, lat])),
            type: 'NonNakes',
            name: item.nama ?? '',
            alamat: item.alamat ?? ''
          })
        }).filter(f => validLonLat(toNum(f.getGeometry()?.getCoordinates()?.[0]), toNum(f.getGeometry()?.getCoordinates()?.[1])))
        nonNakes.vector.addFeatures(feats)
      }

      // Parse Bencana Events
      if (eventRes.status === 'fulfilled' && eventRes.value) {
        const data = pickDataArray<BencanaEventItem>(eventRes.value)
        setStatBencana(data.length)
        setActiveEvents(data)

        const feats: any[] = []
        data.forEach(row => {
          const pts = extractEventPoints(row.points)
          pts.forEach(p => {
            feats.push(new Feature({
              geometry: new Point(fromLonLat([p.lon, p.lat])),
              type: 'bencana-event',
              name: row.nama_bencana ?? 'Bencana',
              icon_url: row.icon_url,
              content_html: row.content_html || buildPopupEventEoc(row)
            }))
          })
        })
        eventSrc.addFeatures(feats)
      }

      // Build layers dynamic index
      const idxMap = new Map<string, any>()
      map.getLayers().getArray().forEach((ly: any) => {
        const id = ly.get?.('id')
        if (id) idxMap.set(id, ly)
      })
      layerIndexRef.current = idxMap

      // Dynamic Layer Group UI listing
      const groups: Record<string, LayerGroup> = {}
      map.getLayers().getArray().forEach((ly: any) => {
        const id = ly.get?.('id')
        if (!id) return
        const name = ly.get?.('name') || id
        const group = ly.get?.('group') || 'Basemap'
        const visible = !!ly.getVisible?.()

        if (!groups[group]) groups[group] = { group, layers: [] }
        groups[group].layers.push({ id, name, visible })
      })
      setLayerGroups(Object.values(groups))

      forceRefreshMap(map)
      setLoading(false)

    } catch (err: any) {
      setError(err.message || 'Gagal menyiapkan peta EOC OpenLayers.')
      setLoading(false)
    }
  }, [EP])

  useEffect(() => {
    loadMapData()
    return () => {
      destroyWindLayerSafely(windLayerRef.current)
      roRef.current?.disconnect()
      if (mapRef.current) {
        try { mapRef.current.setTarget?.(null) } catch {}
      }
    }
  }, [loadMapData])

  function toggleLayer(id: string) {
    const ly = layerIndexRef.current.get(id)
    if (!ly) return
    const next = !ly.getVisible?.()
    ly.setVisible?.(next)

    // Special handling for wind layer animation loop
    if (id === 'wind') {
      try {
        if (next) {
          if (typeof (ly as any).start === 'function') {
            (ly as any).start()
          }
        } else {
          if (typeof (ly as any).stop === 'function') {
            (ly as any).stop()
          }
        }
      } catch (err) {
        console.warn('Gagal memproses start/stop WindLayer:', err)
      }
    }

    setLayerGroups(prev =>
      prev.map(g => ({
        ...g,
        layers: g.layers.map(l => l.id === id ? { ...l, visible: next } : l)
      }))
    )
    forceRefreshMap(mapRef.current)
  }

  const statWidgets = (
    <>
      <PantauanStatWidget
        icon={Flame}
        iconBg="bg-red-50 text-red-600 border border-red-100"
        label="Bencana Aktif"
        value={statBencana}
        sub="Kejadian Terpantau EOC"
      />
      <PantauanStatWidget
        icon={HeartPulse}
        iconBg="bg-teal-50 text-teal-600 border border-teal-100"
        label="Rumah Sakit Siaga"
        value={statRs}
        sub="Penyedia Layanan Rujukan"
      />
      <PantauanStatWidget
        icon={Stethoscope}
        iconBg="bg-emerald-50 text-emerald-600 border border-emerald-100"
        label="Puskesmas Siaga"
        value={statPkm}
        sub="Penyedia Layanan Primer"
      />
      <PantauanStatWidget
        icon={Users}
        iconBg="bg-blue-50 text-blue-600 border border-blue-100"
        label="Tenaga Cadangan"
        value={statNakes + statNonNakes}
        sub={`${statNakes} Medis • ${statNonNakes} Relawan`}
      />
      <PantauanStatWidget
        icon={Database}
        iconBg="bg-slate-50 text-slate-600 border border-slate-100"
        label="EOC Source"
        value="SIPKK API"
        sub="Integrasi Real-time"
      />
    </>
  )

  const mapContent = (
    <div className={`relative w-full ${isFs ? 'fixed inset-0 z-[9999] h-screen bg-slate-900' : 'h-[500px]'}`}>
      <div ref={elMapRef} className="h-full w-full" />

      {/* Control Layer Toggle Button */}
      <button
        onClick={() => setShowLayerPanel(v => !v)}
        className="absolute top-4 right-4 z-[1000] p-2 bg-white/95 rounded-xl border border-slate-200 shadow-md hover:bg-slate-50 text-slate-700 transition"
        title="Daftar Layer"
      >
        <Layers className="h-4.5 w-4.5" />
      </button>

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-4 right-4 z-[1000] p-2 bg-white/95 rounded-xl border border-slate-200 shadow-md hover:bg-slate-50 text-slate-700 transition"
        title={isFs ? 'Keluar Layar Penuh' : 'Layar Penuh'}
      >
        <span className="text-sm font-bold">{isFs ? '⤫' : '⤢'}</span>
      </button>

      {/* Layer Control Panel */}
      {showLayerPanel && (
        <div className="absolute top-4 right-14 z-[1000] w-72 max-h-[380px] overflow-y-auto bg-white/95 rounded-2xl border border-slate-200/80 p-4 shadow-xl backdrop-blur-sm transition-all duration-300">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-3">
            <Layers className="h-4 w-4 text-slate-500" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Pengaturan Layer</h4>
          </div>
          
          <div className="space-y-4">
            {layerGroups.map(g => (
              <div key={g.group} className="space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{g.group}</div>
                <div className="space-y-1">
                  {g.layers.map(l => (
                    <button
                      key={l.id}
                      onClick={() => toggleLayer(l.id)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition"
                    >
                      <span>{l.name}</span>
                      <div className={`h-4.5 w-8 rounded-full transition-colors flex items-center p-0.5 ${l.visible ? 'bg-teal-500 justify-end' : 'bg-slate-200 justify-start'}`}>
                        <div className="h-3.5 w-3.5 rounded-full bg-white shadow-sm" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Popups Container */}
      <div ref={popupElRef} className="absolute bg-white/95 border border-slate-200/80 rounded-2xl shadow-xl p-4 text-xs text-slate-600 backdrop-blur-sm min-w-[240px] pointer-events-auto" style={{ display: 'none' }}>
        <div ref={popupContentRef} />
      </div>
    </div>
  )

  const bottomContent = (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Table className="h-5 w-5 text-teal-600" />
          <h3 className="font-bold text-slate-800">Daftar Kejadian Bencana EOC Terkini</h3>
        </div>
        <span className="text-xs text-slate-400 font-semibold">Menampilkan hingga 15 kejadian terbaru</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
              <th className="py-3 px-4">Tanggal</th>
              <th className="py-3 px-4">Jenis Bencana</th>
              <th className="py-3 px-4">Lokasi</th>
              <th className="py-3 px-4 text-center text-red-500">Meninggal</th>
              <th className="py-3 px-4 text-center text-orange-500">Hilang</th>
              <th className="py-3 px-4 text-center text-yellow-600">Luka Berat</th>
              <th className="py-3 px-4 text-center text-blue-500">Pengungsi</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeEvents.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">Tidak ada data bencana aktif.</td>
              </tr>
            ) : (
              activeEvents.slice(0, 15).map(event => (
                <tr key={event.id_event} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-600">{fmtDateId(event.tgl_kejadian)}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      {event.icon_url && <img src={event.icon_url} alt="" className="h-5 w-5 object-contain" />}
                      <span className="font-bold text-slate-800">{event.nama_bencana}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-medium">Kec. {event.nama_kecamatan || '-'}</td>
                  <td className="py-3.5 px-4 text-center font-bold text-red-600">{event.jml_meninggal?.toLocaleString('id-ID') || 0}</td>
                  <td className="py-3.5 px-4 text-center font-bold text-orange-500">{event.jml_hilang?.toLocaleString('id-ID') || 0}</td>
                  <td className="py-3.5 px-4 text-center font-bold text-yellow-600">{event.jml_luka_berat?.toLocaleString('id-ID') || 0}</td>
                  <td className="py-3.5 px-4 text-center font-bold text-blue-500">{event.jml_pengungsi?.toLocaleString('id-ID') || 0}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => {
                        const pts = extractEventPoints(event.points)
                        if (pts.length && mapRef.current) {
                           const ol = window.ol as any
                           const fromLonLat = ol?.proj?.fromLonLat
                           const coord = fromLonLat?.([pts[0].lon, pts[0].lat])
                           if (coord) {
                             mapRef.current?.getView?.()?.fit?.([coord[0] - 2000, coord[1] - 2000, coord[0] + 2000, coord[1] + 2000], { duration: 500, maxZoom: 14 })
                           }
                        }
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md transition"
                    >
                      Fokus Peta
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <PantauanPageTemplate
      title="Peta Krisis Kesehatan EOC"
      description="Dashboard monitoring kejadian bencana, kesiapan fasilitas kesehatan, dan mobilisasi tenaga cadangan kesehatan (TCK) Indonesia."
      sourceLabel="Emergency Operations Center (EOC) Kemenkes"
      icon={Activity}
      loading={loading}
      error={error}
      onRefresh={loadMapData}
      statWidgets={statWidgets}
      mapContent={mapContent}
      bottomContent={bottomContent}
    />
  )
}
