'use client'

import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import OlMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import XYZ from 'ol/source/XYZ'
import TileArcGISRest from 'ol/source/TileArcGISRest'
import GeoJSON from 'ol/format/GeoJSON'
import { Fill, Stroke, Style, Circle as CircleStyle, Icon, Text as OlText } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import CircleGeom from 'ol/geom/Circle'
import Overlay from 'ol/Overlay'
import { defaults as defaultControls } from 'ol/control'
import { WindLayer } from 'ol-wind'
import 'ol/ol.css'
import { TvLayerState } from './TvLayerServicesDrawer'

function destroyWindLayerSafely(wl: any) {
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

export interface TvMapEngineRef {
  flyTo: (lng: number, lat: number, zoom?: number) => void
  resetView: () => void
  focusProvince: (provName: string | null) => void
}

export interface MarkerData {
  id?: string
  kode_trans?: string
  tgl_kejadian?: string
  jenis_bencana?: string
  kategori_bencana?: string
  nama?: string
  lat: number
  lng: number
  provinsi?: string
  kabupaten?: string
  nama_desa?: string
  kecamatan?: string
  total_korban?: number
  meninggal?: number
  luka?: number
  luka_berat?: number
  luka_ringan?: number
  pengungsi?: number
  terdampak?: number
  titik_posko?: number
  icon_file?: string
  is_krisis?: number
}

export interface FaskesItem {
  id?: string
  nama_rs?: string
  nama_faskes?: string
  nama?: string
  jenis_faskes?: string
  jenis?: string
  jenis_sarana?: string
  subjenis?: string
  kode_sarana?: string
  kode_satusehat?: string
  kabupaten: string
  kecamatan?: string
  lat: number
  lng: number
  triase_merah?: number
  triase_kuning?: number
  triase_hijau?: number
  triase_hitam?: number
  total?: number
  total_pasien?: number
  status?: string
  igd?: string
}

export interface PoskoItem {
  id?: string
  nama?: string
  nama_pos?: string
  kabupaten: string
  kecamatan?: string
  latitude?: number
  longitude?: number
  lat?: number
  lng?: number
  pengungsi?: number
  jiwa?: number
  kapasitas?: number
  pj_kontak?: string
}

export interface EarthquakePoint {
  lat: number
  lng: number
  magnitude: number
  depth: number
  place: string
  time?: string
  dateStr?: string
  dateLabel?: string
  distKm?: number
  isMainshock?: boolean
  mmi?: string | number
}

interface WilayahItem {
  provinsi: string
  count: number
  total_korban?: number
}

interface TvMapEngineProps {
  markers: MarkerData[]
  faskesList?: FaskesItem[]
  poskoList?: PoskoItem[]
  earthquakePoints?: EarthquakePoint[]
  routeCoords?: number[][]
  wilayahList?: WilayahItem[]
  bmkgGempas?: any[]
  layers: TvLayerState
  initialCenter?: [number, number]
  initialZoom?: number
  onSelectMarker: (marker: any, type?: 'disaster' | 'faskes' | 'posko' | 'earthquake') => void
}

const cleanKey = (name?: string | null) => {
  if (!name) return ''
  let cleaned = name
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/^(KABUPATEN|KAB|KOTA|PROVINSI|PROV|PRO|DAERAH ISTIMEWA|DI|DKI)\s*/gi, '')
    .trim()

  if (cleaned.includes('JAKARTA')) return 'JAKARTA'
  if (cleaned.includes('YOGYAKARTA')) return 'YOGYAKARTA'
  if (cleaned.includes('BANGKA')) return 'BANGKABELITUNG'
  if (cleaned.includes('KEPULAUAN RIAU') || cleaned === 'KEPRI') return 'KEPULAUANRIAU'
  if (cleaned === 'NTB' || cleaned.includes('NUSA TENGGARA BARAT')) return 'NUSATENGGARABARAT'
  if (cleaned === 'NTT' || cleaned.includes('NUSA TENGGARA TIMUR')) return 'NUSATENGGARATIMUR'

  return cleaned.replace(/[^A-Z0-9]/g, '')
}

const getFeatureName = (feature: any) => {
  if (!feature) return ''
  const props = feature.getProperties() || {}
  const keys = ['nama_kab', 'NAMA_KAB', 'kabupaten', 'KABUPATEN', 'provinsi', 'PROVINSI', 'nama_prov', 'WADMPR', 'NAME_1', 'NAMOBJ', 'Propinsi', 'nama']
  for (const key of keys) {
    if (props[key] !== undefined && props[key] !== null && String(props[key]).trim() !== '') {
      return String(props[key]).trim()
    }
  }
  return ''
}

const choroplethColor = (count: number, opacity: number = 0.82) => {
  if (count === 0) return `rgba(241, 245, 249, ${opacity * 0.5})`
  if (count <= 25) return `rgba(234, 179, 8, ${opacity})`        // Kuning (1 - 25)
  if (count <= 75) return `rgba(249, 115, 22, ${opacity})`       // Oranye (26 - 75)
  if (count <= 200) return `rgba(239, 68, 68, ${opacity})`       // Coral Red (76 - 200)
  return `rgba(185, 28, 28, ${opacity})`                         // Deep Crimson Red (> 200)
}

const BASEMAP_SOURCES = {
  osm: new OSM(),
  satellite: new XYZ({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attributions: '© Esri World Imagery',
  }),
  terrain: new XYZ({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attributions: '© Esri Topo',
  }),
  light: new XYZ({
    url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
    attributions: '© CartoDB Positron',
  }),
  dark: new XYZ({
    url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
    attributions: '© CartoDB Dark',
  }),
}

const TvMapEngine = forwardRef<TvMapEngineRef, TvMapEngineProps>(function TvMapEngine(
  {
    markers,
    faskesList = [],
    poskoList = [],
    earthquakePoints = [],
    routeCoords = [],
    wilayahList = [],
    bmkgGempas = [],
    layers,
    initialCenter,
    initialZoom,
    onSelectMarker,
  },
  ref
) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<OlMap | null>(null)
  const onSelectMarkerRef = useRef(onSelectMarker)

  useEffect(() => {
    onSelectMarkerRef.current = onSelectMarker
  }, [onSelectMarker])

  // Layer Refs
  const baseMapLayerRef = useRef<TileLayer<any> | null>(null)
  const bnpbAdminRef = useRef<TileLayer<any> | null>(null)
  const bnpbHillshadeRef = useRef<TileLayer<any> | null>(null)
  const bnpbKepadatanRef = useRef<TileLayer<any> | null>(null)
  const bnpbBanjirRef = useRef<TileLayer<any> | null>(null)
  const bnpbGempaRef = useRef<TileLayer<any> | null>(null)
  const bnpbLongsorRef = useRef<TileLayer<any> | null>(null)
  const bnpbKarhutlaRef = useRef<TileLayer<any> | null>(null)
  const indonesiaMaskLayerRef = useRef<VectorLayer<any> | null>(null)
  const provinceLayerRef = useRef<VectorLayer<any> | null>(null)
  const shakingZoneLayerRef = useRef<VectorLayer<any> | null>(null)
  const markerLayerRef = useRef<VectorLayer<any> | null>(null)
  const faskesLayerRef = useRef<VectorLayer<any> | null>(null)
  const poskoLayerRef = useRef<VectorLayer<any> | null>(null)
  const earthquakeLayerRef = useRef<VectorLayer<any> | null>(null)
  const routeLayerRef = useRef<VectorLayer<any> | null>(null)
  const windLayerRef = useRef<any>(null)
  const pulseOverlaysRef = useRef<Overlay[]>([])

  // Dynamic animated radar pulse overlay creator (matching DisasterMap.tsx)
  const createPulseOverlay = useCallback((lng: number, lat: number, type: 'danger' | 'warning' | 'gempa' = 'danger') => {
    const map = mapInstanceRef.current
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
      position: fromLonLat([lng, lat]),
    })

    map.addOverlay(overlay)
    pulseOverlaysRef.current.push(overlay)
  }, [])

  // Expose flyTo, resetView & focusProvince methods to parent
  useImperativeHandle(ref, () => ({
    flyTo: (lng: number, lat: number, zoom: number = 9) => {
      const map = mapInstanceRef.current
      if (!map) return
      map.getView().animate({
        center: fromLonLat([lng, lat]),
        zoom: zoom,
        duration: 1200,
      })
    },
    resetView: () => {
      const map = mapInstanceRef.current
      if (!map) return
      map.getView().animate({
        center: fromLonLat(initialCenter || [118.0149, -2.5489]),
        zoom: initialZoom || 5.1,
        duration: 1200,
      })
    },
    focusProvince: (provName: string | null) => {
      const map = mapInstanceRef.current
      if (!map) return
      if (!provName) {
        map.getView().animate({
          center: fromLonLat([118.0149, -2.5489]),
          zoom: 5.1,
          duration: 1500,
        })
        return
      }

      const pKey = cleanKey(provName)
      const features = provinceLayerRef.current?.getSource()?.getFeatures() || []
      const targetFeature = features.find((f: any) => cleanKey(getFeatureName(f)) === pKey)
      if (targetFeature) {
        const geom = targetFeature.getGeometry()
        if (geom) {
          map.getView().fit(geom.getExtent(), {
            padding: [140, 360, 80, 360],
            duration: 1500,
            maxZoom: 8.5,
          })
          return
        }
      }

      const provMarker = markers.find((m) => cleanKey(m.provinsi) === pKey && m.lat && m.lng)
      if (provMarker) {
        map.getView().animate({
          center: fromLonLat([provMarker.lng, provMarker.lat]),
          zoom: 7.5,
          duration: 1500,
        })
      }
    },
  }))

  // ── Sync Province / Kabupaten Choropleth Styles ──
  const updateProvinceStyles = useCallback(() => {
    // 1. Style Indonesia Mask Layer (Muted Gray for non-NTT provinces)
    const maskLayer = indonesiaMaskLayerRef.current
    if (maskLayer) {
      maskLayer.setStyle((feature: any) => {
        const name = (getFeatureName(feature) || '').toLowerCase()
        const isNtt = name.includes('nusa tenggara timur') || name.includes('ntt')
        if (isNtt) {
          return new Style({
            fill: new Fill({ color: 'rgba(0, 0, 0, 0)' }),
            stroke: new Stroke({ color: '#047D78', width: 2.6 }),
          })
        }
        // Shaded muted slate-gray overlay for all other provinces in Indonesia
        return new Style({
          fill: new Fill({ color: 'rgba(51, 65, 85, 0.42)' }),
          stroke: new Stroke({ color: 'rgba(100, 116, 139, 0.35)', width: 1.0 }),
        })
      })
      maskLayer.changed()
    }

    // 2. Style Focused NTT Kabupaten Layer (Vibrant Choropleth & Prominent Labels)
    const layer = provinceLayerRef.current
    if (!layer) return

    const provCountMap = new Map<string, number>()
    if (Array.isArray(wilayahList) && wilayahList.length > 0) {
      wilayahList.forEach((w) => {
        const k = cleanKey(w.provinsi)
        if (k) provCountMap.set(k, Number(w.count) || Number(w.total_korban) || 0)
      })
    } else if (Array.isArray(markers)) {
      markers.forEach((m) => {
        const k = cleanKey(m.kabupaten || m.provinsi)
        if (k) provCountMap.set(k, (provCountMap.get(k) || 0) + (m.total_korban || 1))
      })
    }

    layer.setStyle((feature: any) => {
      const name = getFeatureName(feature)
      const key = cleanKey(name)
      const count = provCountMap.get(key) || 0
      const baseColor = choroplethColor(count, 0.22)

      return new Style({
        fill: new Fill({ color: baseColor }),
        stroke: new Stroke({
          color: count > 0 ? '#047D78' : '#047D78',
          width: count > 0 ? 2.4 : 1.8,
        }),
        text: new OlText({
          text: count > 0 ? `${name}\n(${count})` : name,
          font: count > 0 ? 'bold 11px Roboto, sans-serif' : 'bold 9.5px Roboto, sans-serif',
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({ color: 'rgba(15, 23, 42, 0.92)', width: 3.2 }),
          textAlign: 'center',
          textBaseline: 'middle',
          offsetY: 0,
        }),
      })
    })
    layer.changed()
  }, [wilayahList, markers])

  // ── Initialize OpenLayers Map ──
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // 1. Basemap Layer
    const baseMapLayer = new TileLayer({
      source: BASEMAP_SOURCES[layers.baseMap] || BASEMAP_SOURCES.osm,
      zIndex: 1,
    })
    baseMapLayerRef.current = baseMapLayer

    // 2. BNPB InaRISK Layers
    const bnpbAdmin = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/inarisk/batas_administrasi/MapServer',
      }),
      visible: layers.bnpbAdmin,
      opacity: 0.85,
      zIndex: 11,
    })
    bnpbAdminRef.current = bnpbAdmin

    const bnpbHillshade = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/Basemap/Indo_Hillshade/MapServer',
      }),
      visible: layers.bnpbHillshade,
      opacity: 0.5,
      zIndex: 3,
    })
    bnpbHillshadeRef.current = bnpbHillshade

    const bnpbKepadatan = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/Basemap/Kepadatan_penduduk_2020/MapServer',
      }),
      visible: layers.bnpbKepadatan,
      opacity: 0.5,
      zIndex: 4,
    })
    bnpbKepadatanRef.current = bnpbKepadatan

    const bnpbBanjir = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/inarisk/layer_bahaya_banjir/ImageServer',
      }),
      visible: layers.bnpbBanjir,
      opacity: 0.6,
      zIndex: 5,
    })
    bnpbBanjirRef.current = bnpbBanjir

    const bnpbGempa = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/inarisk/layer_bahaya_gempabumi/ImageServer',
      }),
      visible: layers.bnpbGempa,
      opacity: 0.7,
      zIndex: 6,
    })
    bnpbGempaRef.current = bnpbGempa

    const bnpbLongsor = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/inarisk/layer_bahaya_tanah_longsor/ImageServer',
      }),
      visible: layers.bnpbLongsor,
      opacity: 0.6,
      zIndex: 7,
    })
    bnpbLongsorRef.current = bnpbLongsor

    const bnpbKarhutla = new TileLayer({
      source: new TileArcGISRest({
        url: 'https://gis.bnpb.go.id/server/rest/services/inarisk/layer_bahaya_kebakaran_hutan_dan_lahan/ImageServer',
      }),
      visible: layers.bnpbKarhutla,
      opacity: 0.6,
      zIndex: 8,
    })
    bnpbKarhutlaRef.current = bnpbKarhutla

    // 2.5. Indonesia Mask Layer (Muted Gray Shading for non-NTT provinces)
    const indonesiaMaskLayer = new VectorLayer({
      source: new VectorSource(),
      visible: true,
      zIndex: 9,
    })
    indonesiaMaskLayerRef.current = indonesiaMaskLayer

    // 3. Province / Kabupaten Boundary Layer (NTT Focus)
    const provinceLayer = new VectorLayer({
      source: new VectorSource(),
      visible: layers.showChoropleth,
      zIndex: 10,
    })
    provinceLayerRef.current = provinceLayer

    // 4. Isoseismal Shaking Rings Layer (Laut Flores M 7.4)
    const shakingZoneLayer = new VectorLayer({
      source: new VectorSource(),
      zIndex: 12,
    })
    shakingZoneLayerRef.current = shakingZoneLayer

    // 5. Tactical Routing Line Layer
    const routeLayer = new VectorLayer({
      source: new VectorSource(),
      zIndex: 15,
    })
    routeLayerRef.current = routeLayer

    // 6. Earthquake / Aftershock Bubble Layer
    const earthquakeLayer = new VectorLayer({
      source: new VectorSource(),
      zIndex: 18,
    })
    earthquakeLayerRef.current = earthquakeLayer

    // 7. Disaster Marker Pins Layer
    const markerLayer = new VectorLayer({
      source: new VectorSource(),
      visible: layers.showMarkers,
      zIndex: 22,
    })
    markerLayerRef.current = markerLayer

    // 8. Faskes Markers Layer
    const faskesLayer = new VectorLayer({
      source: new VectorSource(),
      visible: layers.showFaskes,
      zIndex: 24,
    })
    faskesLayerRef.current = faskesLayer

    // 9. Posko Markers Layer
    const poskoLayer = new VectorLayer({
      source: new VectorSource(),
      visible: layers.showPosko,
      zIndex: 26,
    })
    poskoLayerRef.current = poskoLayer

    // Create OpenLayers Map Instance
    const map = new OlMap({
      target: mapRef.current,
      layers: [
        baseMapLayer,
        bnpbAdmin,
        bnpbHillshade,
        bnpbKepadatan,
        bnpbBanjir,
        bnpbGempa,
        bnpbLongsor,
        bnpbKarhutla,
        indonesiaMaskLayer,
        provinceLayer,
        shakingZoneLayer,
        routeLayer,
        earthquakeLayer,
        markerLayer,
        faskesLayer,
        poskoLayer,
      ],
      view: new View({
        center: fromLonLat(initialCenter || [121.8, -8.55]),
        zoom: initialZoom || 8.5,
        minZoom: 4,
        maxZoom: 18,
      }),
      controls: defaultControls({
        zoom: false,
        rotate: false,
        attribution: false,
      }),
    })

    mapInstanceRef.current = map

    // Load GeoJSON Boundaries (Nationwide Non-NTT Gray Shading + NTT Kabupaten Focus)
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
    const format = new GeoJSON()

    // 1. Load Indonesia Provinces for non-NTT gray shading
    fetch(`${basePath}/indonesia-provinces.geojson`)
      .then((r) => (r.ok ? r.json() : null))
      .then((geoData) => {
        if (!geoData || !indonesiaMaskLayerRef.current) return
        const features = format.readFeatures(geoData, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326',
        })
        const source = indonesiaMaskLayerRef.current.getSource()
        source?.clear()
        source?.addFeatures(features)
        updateProvinceStyles()
      })
      .catch((e) => console.warn('[TV Map] Indonesia mask boundary fetch:', e))

    // 2. Load NTT Kabupaten for focused high-res boundaries & choropleth
    fetch(`${basePath}/data/ntt-kabupaten.geojson`)
      .then((res) => {
        if (!res.ok) throw new Error('NTT GeoJSON not found')
        return res.json()
      })
      .then((geoData) => {
        if (!geoData || !provinceLayerRef.current) return
        const features = format.readFeatures(geoData, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326',
        })
        const source = provinceLayerRef.current.getSource()
        source?.clear()
        source?.addFeatures(features)
        updateProvinceStyles()
      })
      .catch((err) => {
        console.warn('[TV Map] NTT kabupaten boundary fetch error:', err)
      })

    // Map Click Interaction: Select feature and trigger bottom card
    map.on('click', (evt) => {
      let found = false
      map.forEachFeatureAtPixel(evt.pixel, (feature) => {
        if (found) return

        const markerData = feature.get('markerData')
        const itemType = feature.get('itemType') || 'disaster'

        if (markerData) {
          found = true
          onSelectMarkerRef.current?.(markerData, itemType)
        }
      })
    })

    // Setup Windy Layer (GFS)
    async function initWindy() {
      try {
        const res = await fetch(`${basePath}/api/gfs`)
        if (!res.ok) return
        const windData = await res.json()
        const windLayer = new WindLayer(windData as any, {
          zIndex: 9,
          windOptions: {
            velocityScale: 0.015,
            paths: 1600,
            colorScale: [
              'rgb(15,60,140)',
              'rgb(70,150,145)',
              'rgb(85,160,115)',
              'rgb(215,195,60)',
              'rgb(210,125,35)',
              'rgb(185,35,10)',
              'rgb(155,8,12)',
            ],
            lineWidth: 2.2,
            generateParticleOption: true,
          },
          fieldOptions: { wrapX: true },
        } as any)

        if (typeof (windLayer as any).setZIndex === 'function') {
          ;(windLayer as any).setZIndex(9)
        }

        const isVisible = layers.showWindy
        ;(windLayer as any).setVisible?.(isVisible)
        try {
          if (isVisible && typeof (windLayer as any).start === 'function') {
            ;(windLayer as any).start()
          }
        } catch {}

        map.addLayer(windLayer as any)
        if (typeof (windLayer as any).setZIndex === 'function') {
          ;(windLayer as any).setZIndex(9)
        }
        windLayerRef.current = windLayer as any
      } catch (err) {
        console.warn('[TvMapEngine] Windy load error:', err)
      }
    }
    void initWindy()

    return () => {
      map.setTarget(undefined)
      mapInstanceRef.current = null
      if (windLayerRef.current) {
        destroyWindLayerSafely(windLayerRef.current)
        windLayerRef.current = null
      }
    }
  }, [])

  // ── Sync Basemap & BNPB Layers ──
  useEffect(() => {
    if (baseMapLayerRef.current) {
      baseMapLayerRef.current.setSource(BASEMAP_SOURCES[layers.baseMap] || BASEMAP_SOURCES.osm)
    }
  }, [layers.baseMap])

  useEffect(() => {
    bnpbAdminRef.current?.setVisible(layers.bnpbAdmin)
    bnpbHillshadeRef.current?.setVisible(layers.bnpbHillshade)
    bnpbKepadatanRef.current?.setVisible(layers.bnpbKepadatan)
    bnpbBanjirRef.current?.setVisible(layers.bnpbBanjir)
    bnpbGempaRef.current?.setVisible(layers.bnpbGempa)
    bnpbLongsorRef.current?.setVisible(layers.bnpbLongsor)
    bnpbKarhutlaRef.current?.setVisible(layers.bnpbKarhutla)
    provinceLayerRef.current?.setVisible(layers.showChoropleth)
    markerLayerRef.current?.setVisible(layers.showMarkers)
    faskesLayerRef.current?.setVisible(layers.showFaskes)
    poskoLayerRef.current?.setVisible(layers.showPosko)
  }, [layers])

  // ── Sync Windy Layer ──
  useEffect(() => {
    const wl = windLayerRef.current
    if (wl) {
      wl.setVisible(layers.showWindy)
      try {
        if (layers.showWindy) {
          if (typeof wl.start === 'function') wl.start()
        } else {
          if (typeof wl.stop === 'function') wl.stop()
        }
      } catch {}
      try { mapInstanceRef.current?.renderSync?.() } catch {}
    }
  }, [layers.showWindy])

  // ── Re-apply Choropleth ──
  useEffect(() => {
    updateProvinceStyles()
  }, [updateProvinceStyles])

  // ── 1. Disaster Markers (All 8 affected kabupaten in NTT) with Pulse Radar & Radius Rings ──
  useEffect(() => {
    const layer = markerLayerRef.current
    const source = layer?.getSource()
    if (!source) return
    source.clear()

    const map = mapInstanceRef.current
    if (map) {
      pulseOverlaysRef.current.forEach((ov) => map.removeOverlay(ov))
      pulseOverlaysRef.current = []
    }

    const features: Feature[] = []
    const pulseRadius = layers.impactRadiusKm !== undefined ? layers.impactRadiusKm : 1

    markers.forEach((m, idx) => {
      if (!m.lat || !m.lng || isNaN(m.lat) || isNaN(m.lng)) return

      const isEpicenter = idx === 0 || (m.total_korban || 0) > 30

      // Draw pulsing radius circle & trigger radar overlay on disaster markers
      if (pulseRadius !== 0) {
        const radiusList: { km: number; stroke: string; fill: string }[] = []
        if (pulseRadius === -1) {
          // All 5 Rings (1km, 5km, 10km, 25km, 50km)
          radiusList.push(
            { km: 1, stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.22)' },
            { km: 5, stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.18)' },
            { km: 10, stroke: '#eab308', fill: 'rgba(234, 179, 8, 0.14)' },
            { km: 25, stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.10)' },
            { km: 50, stroke: '#047D78', fill: 'rgba(4, 125, 120, 0.08)' }
          )
        } else {
          radiusList.push({
            km: isEpicenter ? pulseRadius : Math.max(2, Math.min(pulseRadius * 0.5, 15)),
            stroke: isEpicenter ? 'rgba(220, 38, 38, 0.85)' : 'rgba(234, 88, 12, 0.75)',
            fill: isEpicenter ? 'rgba(239, 68, 68, 0.16)' : 'rgba(249, 115, 22, 0.12)',
          })
        }

        radiusList.forEach((r) => {
          const circleFeat = new Feature({
            geometry: new CircleGeom(fromLonLat([m.lng, m.lat]), r.km * 1000),
          })
          circleFeat.setStyle(
            new Style({
              fill: new Fill({ color: r.fill }),
              stroke: new Stroke({
                color: r.stroke,
                width: isEpicenter ? 2.4 : 1.8,
                lineDash: isEpicenter ? [6, 6] : [4, 4],
              }),
            })
          )
          features.push(circleFeat)
        })

        // Inner Core Zone for major hotspot
        if (isEpicenter && (pulseRadius >= 5 || pulseRadius === -1)) {
          const innerCoreKm = pulseRadius === -1 ? 2 : Math.max(1, pulseRadius * 0.4)
          const innerCircle = new Feature({
            geometry: new CircleGeom(fromLonLat([m.lng, m.lat]), innerCoreKm * 1000),
          })
          innerCircle.setStyle(
            new Style({
              fill: new Fill({ color: 'rgba(220, 38, 38, 0.22)' }),
              stroke: new Stroke({ color: 'rgba(185, 28, 28, 0.95)', width: 1.8 }),
            })
          )
          features.push(innerCircle)
        }

        // Animated Radar Pulse
        createPulseOverlay(m.lng, m.lat, isEpicenter ? 'danger' : 'warning')
      }

      const feat = new Feature({
        geometry: new Point(fromLonLat([m.lng, m.lat])),
        markerData: { ...m, type: 'disaster' },
        itemType: 'disaster',
      })

      const totalK = m.total_korban || (m.meninggal || 0) + (m.luka || 0) || 0
      const pinFill = totalK > 50 ? '#dc2626' : totalK > 10 ? '#ea580c' : '#047D78'

      feat.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 9,
            fill: new Fill({ color: pinFill }),
            stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
          }),
        })
      )
      features.push(feat)
    })

    source.addFeatures(features)
  }, [markers, layers.impactRadiusKm, createPulseOverlay])

  // ── 2. Isoseismal Shaking Rings & Dynamic Impact Radius Circle ──
  useEffect(() => {
    const layer = shakingZoneLayerRef.current
    const source = layer?.getSource()
    if (!source) return
    source.clear()

    const mainshock = (earthquakePoints || []).find((eq) => eq.isMainshock) || (earthquakePoints || [])[0]
    if (!mainshock || !mainshock.lat || !mainshock.lng) return

    const epicCenter = fromLonLat([mainshock.lng, mainshock.lat])
    const primaryRadiusKm = Math.min(80, Math.max(25, ((mainshock.magnitude || 7.0) - 3) * 12))
    const innerRadiusKm = Math.max(10, primaryRadiusKm * 0.45)

    // Outer Shaking Zone Circle
    const outerCircle = new Feature({
      geometry: new CircleGeom(epicCenter, primaryRadiusKm * 1000),
    })
    outerCircle.setStyle(
      new Style({
        fill: new Fill({ color: 'rgba(220, 38, 38, 0.06)' }),
        stroke: new Stroke({
          color: 'rgba(220, 38, 38, 0.75)',
          width: 2,
          lineDash: [6, 6],
        }),
      })
    )

    // Inner Severe Zone Circle
    const innerCircle = new Feature({
      geometry: new CircleGeom(epicCenter, innerRadiusKm * 1000),
    })
    innerCircle.setStyle(
      new Style({
        fill: new Fill({ color: 'rgba(220, 38, 38, 0.12)' }),
        stroke: new Stroke({
          color: '#dc2626',
          width: 2,
        }),
      })
    )

    // Dynamic Impact Radius Circle (if selected in Layer Services / Quick Control)
    const dynamicCircles: Feature<any>[] = []
    const radiusListToDraw: { km: number; stroke: string; fill: string }[] = []

    if (layers.impactRadiusKm === -1) {
      // All Concentric Impact Rings (1km, 5km, 10km, 25km, 50km)
      radiusListToDraw.push(
        { km: 1, stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.25)' },
        { km: 5, stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.2)' },
        { km: 10, stroke: '#eab308', fill: 'rgba(234, 179, 8, 0.15)' },
        { km: 25, stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.12)' },
        { km: 50, stroke: '#047D78', fill: 'rgba(4, 125, 120, 0.1)' }
      )
    } else if (layers.impactRadiusKm && layers.impactRadiusKm > 0) {
      radiusListToDraw.push({
        km: layers.impactRadiusKm,
        stroke: '#047D78',
        fill: 'rgba(4, 125, 120, 0.18)',
      })
    }

    radiusListToDraw.forEach((r) => {
      const circ = new Feature({
        geometry: new CircleGeom(epicCenter, r.km * 1000),
      })
      circ.setStyle(
        new Style({
          fill: new Fill({ color: r.fill }),
          stroke: new Stroke({
            color: r.stroke,
            width: 2.5,
            lineDash: [6, 6],
          }),
        })
      )
      dynamicCircles.push(circ)
    })

    const getSvgMainshockPin = (mag: number) => {
      const magText = mag > 0 ? (mag >= 10 ? mag.toFixed(0) : mag.toFixed(1)) : '7.7'
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54" fill="none">
        <circle cx="23" cy="20" r="19" fill="rgba(220, 38, 38, 0.25)" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3 3"/>
        <path d="M23 4C14.16 4 7 11.16 7 20C7 31 23 50 23 50S39 31 39 20C39 11.16 31.84 4 23 4Z" fill="#dc2626" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="23" cy="20" r="11" fill="#ffffff"/>
        <text x="23" y="24" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="900" fill="#991b1b">M ${magText}</text>
      </svg>`
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
    }

    // Epicenter Marker Point
    const epicMag = Number(mainshock.magnitude || 7.7)
    const epicPoint = new Feature({
      geometry: new Point(epicCenter),
      markerData: {
        type: 'earthquake',
        nama: mainshock.place
          ? `Episentrum Gempa Utama M ${epicMag.toFixed(1)} - ${mainshock.place}`
          : `Episentrum Gempa Utama M ${epicMag.toFixed(1)}`,
        magnitude: epicMag,
        depth: mainshock.depth || undefined,
        place: mainshock.place || '',
        time: mainshock.time || mainshock.dateStr || '',
        mmi: mainshock.mmi || '',
        lat: mainshock.lat,
        lng: mainshock.lng,
      },
      itemType: 'earthquake',
    })
    epicPoint.setStyle(
      new Style({
        image: new Icon({
          src: getSvgMainshockPin(epicMag),
          scale: 1.0,
          anchor: [0.5, 0.92],
        }),
        zIndex: 100,
      })
    )

    const featureList: Feature<any>[] = [outerCircle, innerCircle, ...dynamicCircles, epicPoint]
    source.addFeatures(featureList)
  }, [earthquakePoints, layers.impactRadiusKm])

  // ── 3. BMKG Real-Time Earthquake Points & Aftershocks ──
  useEffect(() => {
    const layer = earthquakeLayerRef.current
    const source = layer?.getSource()
    if (!source) return
    source.clear()

    const features: Feature[] = []
    const seenPoints = new Set<string>()

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

    const parseGempaCoords = (g: any): { lat: number; lng: number } | null => {
      if (g.lat && g.lng && !isNaN(Number(g.lat)) && !isNaN(Number(g.lng))) {
        return { lat: Number(g.lat), lng: Number(g.lng) }
      }
      if (g.latitude && g.longitude && !isNaN(Number(g.latitude)) && !isNaN(Number(g.longitude))) {
        return { lat: Number(g.latitude), lng: Number(g.longitude) }
      }
      if (g.Coordinates && typeof g.Coordinates === 'string') {
        const parts = g.Coordinates.split(',')
        if (parts.length === 2) {
          const lat = parseFloat(parts[0].trim())
          const lng = parseFloat(parts[1].trim())
          if (!isNaN(lat) && !isNaN(lng)) return { lat, lng }
        }
      }
      if (g.Lintang && g.Bujur) {
        const latStr = String(g.Lintang).toUpperCase().replace(/LS/g, '').replace(/LU/g, '').trim()
        let lat = parseFloat(latStr)
        if (String(g.Lintang).toUpperCase().includes('LS') && lat > 0) lat = -lat

        const lngStr = String(g.Bujur).toUpperCase().replace(/BT/g, '').replace(/BB/g, '').trim()
        const lng = parseFloat(lngStr)
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng }
      }
      return null
    }

    // 1. Plot Seismic Aftershock Points from API
    earthquakePoints.forEach((eq) => {
      if (eq.isMainshock) return // Handled by shakingZoneLayer
      if (!eq.lat || !eq.lng) return

      const mag = Number(eq.magnitude)
      if (isNaN(mag) || mag <= 0) return

      const coordKey = `${eq.lat.toFixed(3)},${eq.lng.toFixed(3)}`
      seenPoints.add(coordKey)

      const pt = fromLonLat([eq.lng, eq.lat])

      const feat = new Feature({
        geometry: new Point(pt),
        markerData: {
          ...eq,
          type: 'earthquake',
          nama: eq.place ? `Gempa Susulan M ${mag.toFixed(1)} - ${eq.place}` : `Gempa Susulan M ${mag.toFixed(1)}`,
          magnitude: mag,
          depth: eq.depth ?? '',
          place: eq.place || '',
          time: eq.time || '',
          source: (eq as any).source || 'BMKG / USGS',
        },
        itemType: 'earthquake',
      })

      feat.setStyle(
        new Style({
          image: new Icon({
            src: getSvgAftershockNode(mag),
            scale: 1.0,
            anchor: [0.5, 0.5],
          }),
          zIndex: Math.round(mag * 10),
        })
      )
      features.push(feat)
    })

    // 2. Plot BMKG Live Gempabumi (autogempa, gempaterkini, gempadirasakan)
    if (Array.isArray(bmkgGempas)) {
      bmkgGempas.forEach((g) => {
        const coords = parseGempaCoords(g)
        if (!coords) return

        const mag = parseFloat(String(g.Magnitude || g.magnitude || ''))
        if (isNaN(mag) || mag <= 0) return

        const coordKey = `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`
        if (seenPoints.has(coordKey)) return
        seenPoints.add(coordKey)

        const wilayah = g.Wilayah || g.Lokasi || g.region || ''
        const kedalaman = g.Kedalaman || g.depth || ''
        const timeStr = `${g.Tanggal || ''} ${g.Jam || g.DateTime || ''}`.trim()

        const feat = new Feature({
          geometry: new Point(fromLonLat([coords.lng, coords.lat])),
          markerData: {
            type: 'earthquake',
            nama: wilayah ? `Gempabumi BMKG M ${mag.toFixed(1)} - ${wilayah}` : `Gempabumi BMKG M ${mag.toFixed(1)}`,
            magnitude: mag,
            depth: kedalaman,
            place: wilayah,
            time: timeStr,
            mmi: g.Dirasakan || '',
            potensi: g.Potensi || '',
            shakemapUrl: g.shakemapUrl || (g.Shakemap ? `https://static.bmkg.go.id/${g.Shakemap}` : null),
            source: 'BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)',
            lat: coords.lat,
            lng: coords.lng,
          },
          itemType: 'earthquake',
        })

        feat.setStyle(
          new Style({
            image: new Icon({
              src: getSvgAftershockNode(mag),
              scale: 1.0,
              anchor: [0.5, 0.5],
            }),
            zIndex: Math.round(mag * 10),
          })
        )
        features.push(feat)
      })
    }

    source.addFeatures(features)
  }, [earthquakePoints, bmkgGempas])

  // ── 4. Faskes Markers (RSUD & Puskesmas NTT with SVG Icons & Sub-Filters) ──
  useEffect(() => {
    const layer = faskesLayerRef.current
    const source = layer?.getSource()
    if (!source) return
    source.clear()

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

    const features: Feature[] = []
    faskesList.forEach((f) => {
      if (!f.lat || !f.lng) return

      const nameLower = (f.nama_rs || f.nama_faskes || f.nama || '').toLowerCase()
      const jenisLower = (f.jenis_faskes || f.jenis || f.jenis_sarana || '').toLowerCase()

      const isRS = jenisLower.includes('rs') || jenisLower.includes('rumah sakit') || nameLower.includes('rsud') || nameLower.includes('rumah sakit') || nameLower.startsWith('rs ')
      const isPuskesmas = jenisLower.includes('puskesmas') || nameLower.includes('puskesmas') || nameLower.includes('pkm')
      const isKlinik = jenisLower.includes('klinik') || nameLower.includes('klinik')
      const isPustu = jenisLower.includes('pustu') || jenisLower.includes('pembantu') || nameLower.includes('pustu')

      // Apply Faskes Type Checkboxes
      if (isRS && layers.faskesRs === false) return
      if (isPuskesmas && layers.faskesPuskesmas === false) return
      if (isKlinik && layers.faskesKlinik === false) return
      if (isPustu && layers.faskesPustu === false) return

      // Apply Siaga Only Filter
      const totalPatients = (f.triase_merah || 0) + (f.triase_kuning || 0) + (f.triase_hijau || 0) + (f.triase_hitam || 0) + (f.total || 0) + (f.total_pasien || 0)
      if (layers.faskesSiagaOnly && totalPatients === 0) return

      const feat = new Feature({
        geometry: new Point(fromLonLat([f.lng, f.lat])),
        markerData: { ...f, type: 'faskes' },
        itemType: 'faskes',
      })

      if (isRS) {
        // Rumah Sakit (RS)
        feat.setStyle(
          new Style({
            image: new Icon({
              src: `${basePath}/rs.svg`,
              size: [102.46, 102.46],
              scale: 0.28,
              anchor: [0.5, 0.5],
            }),
          })
        )
      } else if (isPustu) {
        // Puskesmas Pembantu (Pustu)
        feat.setStyle(
          new Style({
            image: new Icon({
              src: `${basePath}/pustu.svg`,
              size: [102.46, 102.46],
              scale: 0.28,
              anchor: [0.5, 0.5],
            }),
          })
        )
      } else if (isKlinik) {
        // Klinik
        feat.setStyle(
          new Style({
            image: new Icon({
              src: `${basePath}/klinik.svg`,
              size: [102.46, 102.46],
              scale: 0.28,
              anchor: [0.5, 0.5],
            }),
          })
        )
      } else {
        // Puskesmas
        feat.setStyle(
          new Style({
            image: new Icon({
              src: `${basePath}/puskes.svg`,
              size: [102.46, 102.46],
              scale: 0.28,
              anchor: [0.5, 0.5],
            }),
          })
        )
      }

      features.push(feat)
    })

    source.addFeatures(features)
  }, [
    faskesList,
    layers.faskesRs,
    layers.faskesPuskesmas,
    layers.faskesKlinik,
    layers.faskesPustu,
    layers.faskesSiagaOnly,
  ])

  // ── 5. Posko Markers ──
  useEffect(() => {
    const layer = poskoLayerRef.current
    const source = layer?.getSource()
    if (!source) return
    source.clear()

    const features: Feature[] = []
    poskoList.forEach((p) => {
      const lat = p.latitude || p.lat
      const lng = p.longitude || p.lng
      if (!lat || !lng) return

      const feat = new Feature({
        geometry: new Point(fromLonLat([lng, lat])),
        markerData: { ...p, type: 'posko', lat, lng },
        itemType: 'posko',
      })

      feat.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({ color: '#0284c7' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
        })
      )
      features.push(feat)
    })

    source.addFeatures(features)
  }, [poskoList])

  // ── 6. Tactical Route Polyline ──
  useEffect(() => {
    const layer = routeLayerRef.current
    const source = layer?.getSource()
    if (!source) return
    source.clear()

    if (!Array.isArray(routeCoords) || routeCoords.length < 2) return

    const transformedCoords = routeCoords.map((c) => fromLonLat([c[0], c[1]]))
    const routeLine = new Feature({
      geometry: new LineString(transformedCoords),
    })

    // Glowing cyan/emerald tactical route stroke
    routeLine.setStyle(
      new Style({
        stroke: new Stroke({
          color: '#10b981',
          width: 4.5,
        }),
      })
    )

    source.addFeature(routeLine)
  }, [routeCoords])

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#fbffff]">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  )
})

export default TvMapEngine
