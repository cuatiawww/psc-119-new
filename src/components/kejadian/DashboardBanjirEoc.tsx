'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  CloudRain,
  Droplets,
  AlertTriangle,
  Activity,
  Heart,
  Users,
  ShieldAlert,
  HelpCircle,
  Building2,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Sparkles,
  ChevronRight,
  TrendingUp,
  MapPin,
  Flame,
  ArrowRight,
  Stethoscope,
  Info,
  Phone,
  Search,
  BookOpen,
  Navigation
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts'

// OpenLayers imports
import OlMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { fromLonLat } from 'ol/proj'
import { Style, Icon as OlIcon, Stroke } from 'ol/style'
import 'ol/ol.css'

export default function DashboardBanjirEoc() {
  // ── BMKG API Weather Simulation States ──
  const [rainfall24h, setRainfall24h] = useState(115) // mm per 24 hours
  const [rainfall72h, setRainfall72h] = useState(240) // mm per 72 hours
  const [selectedKabupaten, setSelectedKabupaten] = useState('Tapanuli Tengah')

  // Map & Route States
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<OlMap | null>(null)
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('rsud')
  
  // Public search states
  const [userLocationQuery, setUserLocationQuery] = useState('')
  const [searchResult, setSearchResult] = useState<any[] | null>(null)
  const [activeEducationTab, setActiveEducationTab] = useState<'lepto' | 'water' | 'snake'>('lepto')

  // Health EOC Thresholds & Trigger States
  const alertStatus = useMemo(() => {
    if (rainfall24h > 150) {
      return {
        level: 'AWAS',
        color: 'text-rose-400 border-rose-500 bg-rose-950/40',
        badgeBg: 'bg-rose-500 text-white animate-pulse',
        desc: 'Evakuasi faskes terancam & posko kesehatan aktif penuh.',
        levelCode: 4,
      }
    } else if (rainfall24h > 100) {
      return {
        level: 'SIAGA',
        color: 'text-amber-400 border-amber-500 bg-amber-950/40',
        badgeBg: 'bg-amber-500 text-slate-950 font-bold',
        desc: 'Curah hujan ekstrem. Aktivasi EMT & kesiapan buffer logistik.',
        levelCode: 3,
      }
    } else if (rainfall24h > 50) {
      return {
        level: 'WASPADA',
        color: 'text-yellow-400 border-yellow-500 bg-yellow-950/40',
        badgeBg: 'bg-yellow-400 text-slate-950 font-semibold',
        desc: 'Peningkatan debit air terdeteksi. Siagakan logistik kesehatan.',
        levelCode: 2,
      }
    } else {
      return {
        level: 'AMAN',
        color: 'text-emerald-400 border-emerald-500 bg-emerald-950/40',
        badgeBg: 'bg-emerald-500 text-white',
        desc: 'Parameter curah hujan terpantau normal.',
        levelCode: 1,
      }
    }
  }, [rainfall24h])

  // Coordinates Database (Tapanuli Tengah local coordinates)
  const points = useMemo(() => [
    { id: 'flood', name: 'Pusat Genangan Banjir (Pandan)', coords: [98.8472, 1.6833], color: '#ef4444', type: 'flood' },
    { id: 'rsud', name: 'RSUD Pandan', coords: [98.8465, 1.6828], color: '#3b82f6', type: 'hospital' },
    { id: 'pinangsori', name: 'Puskesmas Pinangsori', coords: [98.9167, 1.5583], color: '#10b981', type: 'clinic' },
    { id: 'barus', name: 'Puskesmas Barus', coords: [98.4000, 2.0333], color: '#f59e0b', type: 'clinic' },
    { id: 'posko', name: 'Pos Kesehatan Pengungsian GOR', coords: [98.8500, 1.6850], color: '#14b8a6', type: 'shelter' }
  ], [])

  // Detailed Routing Route Lines (follows simple geographic bends for realistic look)
  const routesDb: Record<string, number[][]> = useMemo(() => ({
    rsud: [
      [98.8472, 1.6833], // start center
      [98.8468, 1.6830], // bend
      [98.8465, 1.6828]  // rsud pandan
    ],
    posko: [
      [98.8472, 1.6833],
      [98.8485, 1.6840],
      [98.8500, 1.6850]
    ],
    pinangsori: [
      [98.8472, 1.6833],
      [98.8650, 1.6500],
      [98.8900, 1.6000],
      [98.9167, 1.5583]
    ],
    barus: [
      [98.8472, 1.6833],
      [98.7500, 1.7600],
      [98.6000, 1.8800],
      [98.5000, 1.9600],
      [98.4000, 2.0333]
    ]
  }), [])

  // Faskes Data
  const faskesData = useMemo(() => {
    const mult = alertStatus.levelCode
    return [
      { id: 'rsud', name: 'RSUD Pandan', type: 'Rumah Sakit', status: mult >= 4 ? 'Terisolasi' : 'Operational', bor: mult >= 4 ? 92 : mult >= 3 ? 84 : 65, water: 'Genset & Air Bersih Aman', distance: '0.2 km', duration: '1 mnt (Ambulans)' },
      { id: 'pinangsori', name: 'Puskesmas Pinangsori', type: 'Puskesmas', status: mult >= 3 ? 'Kebanjiran' : 'Operational', bor: 0, water: 'Tergenang 40cm', distance: '16.0 km', duration: '18 mnt (Ambulans)' },
      { id: 'barus', name: 'Puskesmas Barus', type: 'Puskesmas', status: mult >= 4 ? 'Kebanjiran' : mult >= 3 ? 'Terisolasi' : 'Operational', bor: 0, water: 'Akses Terputus', distance: '65.0 km', duration: '75 mnt (Ambulans)' },
      { id: 'posko', name: 'Pos Kesehatan Pengungsian GOR', type: 'Posko Darurat', status: 'Operational', bor: 0, water: 'Normal', distance: '0.4 km', duration: '2 mnt' }
    ]
  }, [alertStatus])

  // Routing card data based on selected id
  const activeRouteInfo = useMemo(() => {
    const data = faskesData.find(f => f.id === selectedFacilityId)
    if (!data) return null

    let status = 'Rute Normal / Aman'
    let statusColor = 'text-emerald-400'
    let desc = 'Jalur lalu lintas clear, aman dilewati ambulans dan tim medis.'
    let steps = [
      'Titik Kejadian Banjir Pandan',
      'Masuk ke Jl. Pandan Raya (200m)',
      `Tiba di lokasi ${data.name}`
    ]

    if (selectedFacilityId === 'pinangsori' && alertStatus.levelCode >= 3) {
      status = 'Genangan di Jalur Lintas'
      statusColor = 'text-amber-400 animate-pulse'
      desc = 'Terdapat genangan air 20-30cm di Jl. Lintas Sumatera. Kendaraan roda 4 tinggi / Truk SAR direkomendasikan.'
      steps = [
        'Titik Kejadian Banjir Pandan',
        'Jalan Lintas Sumatera (Hati-hati genangan)',
        'Melalui bypass Pinangsori',
        `Tiba di ${data.name}`
      ]
    } else if (selectedFacilityId === 'barus' && alertStatus.levelCode >= 3) {
      status = 'Akses Terputus / Jembatan Amblas'
      statusColor = 'text-rose-400 animate-pulse font-extrabold'
      desc = 'Akses jembatan Barus amblas diterjang luapan air sungai. Gunakan jalur memutar alternatif melintasi perbukitan Sibolga.'
      steps = [
        'Titik Kejadian Banjir Pandan',
        'Putar balik menuju Sibolga Utara',
        'Melintasi Jalur Alternatif Bukit Barisan (Ekstra hati-hati longsor)',
        `Tiba di ${data.name}`
      ]
    }

    return {
      ...data,
      status,
      statusColor,
      desc,
      steps
    }
  }, [selectedFacilityId, faskesData, alertStatus])

  // dynamic SVG icon helper for OpenLayers
  const getSvgIcon = (color: string, type: string) => {
    let innerIcon = '<circle cx="12" cy="10" r="3" fill="' + color + '"/>'
    if (type === 'hospital') {
      innerIcon = '<path d="M12 7v6M9 10h6" stroke="#ffffff" stroke-width="2.5"/>'
    } else if (type === 'clinic') {
      innerIcon = '<path d="M12 7v6M9 10h6" stroke="#ffffff" stroke-width="2.5"/>'
    } else if (type === 'shelter') {
      innerIcon = '<path d="M12 6l5 4v6H7v-6l5-4z" stroke="#ffffff" stroke-width="2"/>'
    } else if (type === 'flood') {
      innerIcon = '<path d="M12 7v5M12 16h.01" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>'
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="38" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" fill="${color}" opacity="0.95"/>${innerIcon}</svg>`
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
  }

  // ── OPENLAYERS MAP EFFECT ──
  useEffect(() => {
    if (!mapRef.current) return

    // Clear previous map if any
    const oldContainer = mapRef.current
    oldContainer.innerHTML = ''

    const vectorSource = new VectorSource()

    // 1. Draw points
    points.forEach((pt) => {
      const feat = new Feature({
        geometry: new Point(fromLonLat(pt.coords)),
        name: pt.name,
        id: pt.id
      })
      feat.setStyle(new Style({
        image: new OlIcon({
          src: getSvgIcon(pt.color, pt.type),
          scale: 0.95,
          anchor: [0.5, 1]
        })
      }))
      vectorSource.addFeature(feat)
    })

    // 2. Draw route line if active
    if (selectedFacilityId && routesDb[selectedFacilityId]) {
      const lineCoords = routesDb[selectedFacilityId].map(c => fromLonLat(c))
      const routeFeat = new Feature({
        geometry: new LineString(lineCoords)
      })
      routeFeat.setStyle(new Style({
        stroke: new Stroke({
          color: '#38bdf8', // sky-400
          width: 4,
          lineDash: [6, 8]
        })
      }))
      vectorSource.addFeature(routeFeat)
    }

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      zIndex: 10
    })

    const map = new OlMap({
      target: oldContainer,
      layers: [
        new TileLayer({
          source: new OSM({
            // Darker overlay styling simulated by map container opacity/invert if desired, 
            // but vanilla OSM is best for clear visibility
          })
        }),
        vectorLayer
      ],
      view: new View({
        center: fromLonLat([98.8472, 1.6833]), // center near Pandan
        zoom: selectedFacilityId === 'barus' ? 10 : selectedFacilityId === 'pinangsori' ? 11 : 14,
        maxZoom: 17,
        minZoom: 9
      })
    })

    // Click handler to select markers
    map.on('singleclick', (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f)
      if (feature) {
        const id = feature.get('id')
        if (id && id !== 'flood') {
          setSelectedFacilityId(id)
        }
      }
    })

    setMapInstance(map)

    return () => {
      map.setTarget(undefined)
    }
  }, [points, selectedFacilityId, routesDb])

  // Public nearest search handler
  const handleNearestSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!userLocationQuery.trim()) {
      setSearchResult(null)
      return
    }

    // Simulate sorting faskes based on user search string
    const q = userLocationQuery.toLowerCase()
    let filtered = [...faskesData]
    if (q.includes('gor') || q.includes('pandan') || q.includes('dekat')) {
      filtered = [
        faskesData.find(f => f.id === 'posko')!,
        faskesData.find(f => f.id === 'rsud')!,
        faskesData.find(f => f.id === 'pinangsori')!,
        faskesData.find(f => f.id === 'barus')!
      ]
    } else if (q.includes('barus') || q.includes('jauh')) {
      filtered = [
        faskesData.find(f => f.id === 'barus')!,
        faskesData.find(f => f.id === 'pinangsori')!,
        faskesData.find(f => f.id === 'rsud')!,
        faskesData.find(f => f.id === 'posko')!
      ]
    }
    setSearchResult(filtered.filter(Boolean))
  }

  // Chart Data: Status Faskes Breakdown
  const faskesStatusChart = useMemo(() => {
    const operational = faskesData.filter(f => f.status === 'Operational').length
    const kebanjiran = faskesData.filter(f => f.status === 'Kebanjiran').length
    const terisolasi = faskesData.filter(f => f.status === 'Terisolasi').length
    return [
      { name: 'Operasional', value: operational, color: '#10b981' },
      { name: 'Kebanjiran', value: kebanjiran, color: '#ef4444' },
      { name: 'Terisolasi', value: terisolasi, color: '#f59e0b' }
    ]
  }, [faskesData])

  // Mock Data: Pos Kesehatan & Victims count
  const statsKorban = useMemo(() => {
    const baseMult = alertStatus.levelCode
    if (baseMult === 1) {
      return { meninggal: 0, lukaBerat: 0, lukaRingan: 3, pengungsi: 45, poskoAktif: 1, emtDeployed: 1 }
    }
    return {
      meninggal: Math.floor(baseMult * 1.5 - 1),
      lukaBerat: Math.floor(baseMult * 3.5),
      lukaRingan: Math.floor(baseMult * 12.5),
      pengungsi: baseMult * 185,
      poskoAktif: Math.max(1, baseMult - 1),
      emtDeployed: baseMult === 4 ? 4 : baseMult === 3 ? 3 : 2
    }
  }, [alertStatus])

  // Chart Data: Epidemiological Disease Surveillance (7 Days Trend)
  const diseaseTrendData = useMemo(() => {
    const factor = alertStatus.levelCode
    return [
      { day: 'H-6', Diare: 8 * factor, Leptospirosis: 0, ISPA: 12 * factor, PenyakitKulit: 15 * factor },
      { day: 'H-5', Diare: 12 * factor, Leptospirosis: 0, ISPA: 18 * factor, PenyakitKulit: 22 * factor },
      { day: 'H-4', Diare: 15 * factor, Leptospirosis: factor > 2 ? 1 : 0, ISPA: 25 * factor, PenyakitKulit: 30 * factor },
      { day: 'H-3', Diare: 22 * factor, Leptospirosis: factor > 2 ? 2 : 0, ISPA: 34 * factor, PenyakitKulit: 42 * factor },
      { day: 'H-2', Diare: 31 * factor, Leptospirosis: factor > 2 ? 3 : 1, ISPA: 45 * factor, PenyakitKulit: 55 * factor },
      { day: 'H-1', Diare: 45 * factor, Leptospirosis: factor > 3 ? 6 : 2, ISPA: 58 * factor, PenyakitKulit: 78 * factor },
      { day: 'Hari Ini', Diare: 62 * factor, Leptospirosis: factor > 3 ? 9 : 4, ISPA: 82 * factor, PenyakitKulit: 94 * factor }
    ]
  }, [alertStatus])

  // Mock Data: Buffer stock logistik kesehatan
  const logisticsData = useMemo(() => {
    const factor = alertStatus.levelCode
    return [
      { item: 'Doxycycline (Anti-Leptospirosis)', stock: Math.max(12, 100 - factor * 22), limit: 25, unit: 'box' },
      { item: 'Oralit & Cairan Infus', stock: Math.max(20, 100 - factor * 18), limit: 30, unit: 'karton' },
      { item: 'Kaporit / Penjernih Air', stock: Math.max(15, 100 - factor * 20), limit: 20, unit: 'sak' },
      { item: 'MP-ASI & Nutrisi Balita', stock: Math.max(8, 100 - factor * 15), limit: 15, unit: 'karton' },
      { item: 'APAR & Emergency Hygiene Kit', stock: Math.max(40, 100 - factor * 10), limit: 30, unit: 'paket' }
    ]
  }, [alertStatus])

  // Actionable Protocols Based on EOC Status
  const eocProtocols = useMemo(() => {
    const code = alertStatus.levelCode
    const protocols = [
      { id: 1, text: 'Monitor data curah hujan BMKG berkala (tiap 6 jam).', minLevel: 1, done: true },
      { id: 2, text: 'Kirim notifikasi waspada ke Dinkes & Puskesmas Tapanuli Tengah.', minLevel: 2, done: code >= 2 },
      { id: 3, text: 'Kondisikan buffer stock logistik obat-obatan diare & kaporit.', minLevel: 2, done: code >= 2 },
      { id: 4, text: 'Deploy Tim EMT (Emergency Medical Team) ke posko pengungsian utama.', minLevel: 3, done: code >= 3 },
      { id: 5, text: 'Buka Pos Kesehatan Darurat di dekat area genangan banjir.', minLevel: 3, done: code >= 3 },
      { id: 6, text: 'Evakuasi pasien kritis dari Puskesmas Pinangsori ke RSUD Pandan.', minLevel: 4, done: code >= 4 },
      { id: 7, text: 'Mobilisasi obat spesifik kencing tikus (Doxycycline) skala prioritas.', minLevel: 4, done: code >= 4 }
    ]
    return protocols.filter(p => code >= p.minLevel)
  }, [alertStatus])

  return (
    <div className="w-full bg-slate-950 text-slate-100 p-4 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
      {/* ── HEADER SECTION ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-teal-400 font-extrabold text-xs uppercase tracking-widest">
            <span className="h-2 w-2 rounded-full bg-teal-500 animate-ping"></span>
            HEOC Command Center
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight mt-1 uppercase">
            Dashboard EOC Kesehatan: Bencana Banjir
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Analisis kesiapan faskes, logistik obat, dan pemantauan penyakit pasca banjir di {selectedKabupaten}
          </p>
        </div>

        {/* Warning Indicator */}
        <div className={`flex items-center gap-4.5 border rounded-2xl px-5 py-3 transition-colors duration-300 ${alertStatus.color}`}>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status Kesiagaan EOC</div>
            <div className="text-sm font-semibold mt-0.5 text-slate-200">{alertStatus.desc}</div>
          </div>
          <span className={`px-4.5 py-2.5 rounded-xl text-lg font-black tracking-widest ${alertStatus.badgeBg}`}>
            {alertStatus.level}
          </span>
        </div>
      </div>

      {/* ── INTEGRASI BMKG SIMULATOR ── */}
      <section className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-1 max-w-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders className="h-4 w-4 text-teal-400" />
              INTEGRASI API PERINGATAN DINI CUACA BMKG (SIMULATOR)
            </h3>
            <p className="text-xs text-slate-450 leading-relaxed font-semibold">
              Curah hujan aktual dijadikan pemicu langsung kesiapsiagaan kesehatan. Ambang batas ekstrem **&gt;100 mm/24 jam** menetapkan status **SIAGA** sektor kesehatan. Geser penggeser di bawah untuk mensimulasikan kenaikan banjir.
            </p>
          </div>

          {/* Interactive Sliders */}
          <div className="flex flex-wrap items-center gap-6 w-full lg:w-auto">
            <div className="flex-1 min-w-[200px] bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-slate-400">Curah Hujan 24 Jam:</span>
                <span className={rainfall24h > 100 ? 'text-amber-400 font-black' : 'text-teal-400'}>{rainfall24h} mm</span>
              </div>
              <input
                type="range"
                min="10"
                max="250"
                value={rainfall24h}
                onChange={(e) => setRainfall24h(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
              <div className="flex justify-between text-[9px] text-slate-550 mt-1">
                <span>10mm (Normal)</span>
                <span className="text-amber-500 font-semibold">100mm (Siaga)</span>
                <span className="text-rose-500 font-semibold">150mm (Awas)</span>
              </div>
            </div>

            <div className="flex-1 min-w-[200px] bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-slate-400">Akumulasi 72 Jam:</span>
                <span className="text-sky-400">{rainfall72h} mm</span>
              </div>
              <input
                type="range"
                min="30"
                max="500"
                value={rainfall72h}
                onChange={(e) => setRainfall72h(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[9px] text-slate-550 mt-1">
                <span>30mm</span>
                <span>250mm</span>
                <span>500mm</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE SPATIAL MAP & ROUTING ── */}
      <section className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-6 bg-slate-900/35 border border-slate-800 p-5 rounded-2xl">
        
        {/* Spatial Map Div */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Navigation className="h-4 w-4 text-teal-400" />
              Peta Lokasi Faskes & Rute Penyelamatan
            </h3>
            <span className="text-[10px] bg-slate-800 text-slate-450 font-semibold px-2 py-0.5 rounded-full">
              Peta Interaktif OpenLayers
            </span>
          </div>

          <div className="relative border border-slate-800 rounded-2xl overflow-hidden bg-slate-900">
            {/* The actual map target */}
            <div ref={mapRef} className="h-[360px] w-full" />
            
            {/* Legend inside map */}
            <div className="absolute bottom-3 left-3 z-20 bg-slate-950/85 border border-slate-800 rounded-xl p-2.5 text-[9px] font-semibold space-y-1.5">
              <span className="text-slate-400 font-bold block mb-1">LEGENDA PETA</span>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500 inline-block"></span> Pusat Banjir</div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block"></span> RSUD Rujukan</div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span> Puskesmas</div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-500 inline-block"></span> Posko Kesehatan</div>
              <div className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-sky-400 inline-block border-t border-dashed border-sky-300"></span> Rute Penyelamatan</div>
            </div>
          </div>
        </div>

        {/* Route Guidance Details Card */}
        <div className="space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detail Rute Aktif</span>
              <span className="text-[10px] text-teal-400 font-semibold">HEOC Dispatch Center</span>
            </div>

            {activeRouteInfo ? (
              <div className="space-y-3 bg-slate-950/65 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-md font-black text-white">{activeRouteInfo.name}</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mt-0.5">{activeRouteInfo.type}</p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 font-bold rounded-lg border bg-slate-900 border-slate-800`}>
                    Jarak: {activeRouteInfo.distance}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-slate-900">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Durasi Evakuasi</span>
                    <span className="text-slate-100 font-bold">{activeRouteInfo.duration}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Kondisi Jalur</span>
                    <span className={`font-black ${activeRouteInfo.statusColor}`}>{activeRouteInfo.status}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Petunjuk Arah Respon</span>
                  <p className="text-xs text-slate-350 leading-relaxed">{activeRouteInfo.desc}</p>
                  <div className="mt-2 space-y-1 text-[11px]">
                    {activeRouteInfo.steps.map((s, sidx) => (
                      <div key={sidx} className="flex items-center gap-2 text-slate-400">
                        <span className="h-4 w-4 bg-slate-800 text-[9px] rounded-full flex items-center justify-center font-bold text-teal-400 shrink-0">
                          {sidx + 1}
                        </span>
                        <span className="truncate">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 bg-slate-950/20 border border-slate-900/50 rounded-xl text-slate-500">
                <Navigation className="h-8 w-8 mx-auto text-slate-700 mb-2 stroke-[1.5]" />
                <p className="text-xs">Klik salah satu faskes di peta atau di daftar sebelah kiri untuk memproyeksikan rute penyelamatan.</p>
              </div>
            )}
          </div>

          {/* Quick List Selection Trigger */}
          <div className="space-y-2">
            <span className="text-[10px] font-black text-slate-500 block uppercase tracking-wider">Pilih Faskes Rujukan</span>
            <div className="flex flex-wrap gap-1.5">
              {faskesData.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFacilityId(f.id)}
                  className={`px-3 py-2 text-xs rounded-xl border text-left transition ${
                    selectedFacilityId === f.id
                      ? 'bg-teal-700 text-white border-teal-600 shadow-sm'
                      : 'bg-slate-950/40 text-slate-350 border-slate-800 hover:border-slate-750'
                  }`}
                >
                  <span className="font-bold">{f.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </section>

      {/* ── STATS CARDS GRID ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pengungsi */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-sky-950 text-sky-400 flex items-center justify-center border border-sky-800/50 font-bold">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Pengungsi Terdata</p>
            <h4 className="text-2xl font-black text-white mt-1">{statsKorban.pengungsi.toLocaleString('id-ID')} jiwa</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Tersebar di {statsKorban.poskoAktif} titik pengungsian</p>
          </div>
        </div>

        {/* Card 2: Korban Sakit / Luka */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-rose-950 text-rose-400 flex items-center justify-center border border-rose-800/50 font-bold">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Korban Luka / Cedera</p>
            <h4 className="text-2xl font-black text-rose-450 mt-1">{statsKorban.lukaBerat + statsKorban.lukaRingan} jiwa</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Meninggal: {statsKorban.meninggal} | Luka Berat: {statsKorban.lukaBerat}</p>
          </div>
        </div>

        {/* Card 3: Tim EMT Lapangan */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-teal-950 text-teal-400 flex items-center justify-center border border-teal-800/50 font-bold">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tim EMT Lapangan</p>
            <h4 className="text-2xl font-black text-white mt-1">{statsKorban.emtDeployed} Tim Medis</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Siap siaga pertolongan pertama darurat</p>
          </div>
        </div>

        {/* Card 4: Faskes Kebanjiran */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-950 text-amber-400 flex items-center justify-center border border-amber-800/50 font-bold">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Faskes Terdampak</p>
            <h4 className="text-2xl font-black text-amber-400 mt-1">
              {faskesData.filter(f => f.status !== 'Operational').length} / {faskesData.length} Unit
            </h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Hambatan operasional terdeteksi</p>
          </div>
        </div>
      </section>

      {/* ── PUBLIC HELP DESK (Pencarian Faskes Terdekat & Hotline) ── */}
      <section className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-6 bg-slate-900/35 border border-slate-800 p-5 rounded-2xl">
        
        {/* Nearest Search Tool */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Search className="h-4 w-4 text-teal-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Cari Fasilitas Kesehatan Terdekat (Layanan Publik)
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-semibold">
            Gunakan alat bantu cari faskes terdekat untuk menemukan Puskesmas atau Posko Kesehatan yang bebas dari banjir dan masih beroperasi normal di sekitar koordinat Anda.
          </p>

          <form onSubmit={handleNearestSearch} className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-550" />
              <input
                type="text"
                placeholder="Ketik lokasi Anda (misal: 'Gor Pandan', 'Barus', 'Dusun 3')..."
                value={userLocationQuery}
                onChange={(e) => setUserLocationQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 h-11 pl-10 pr-4 text-xs font-semibold rounded-xl text-slate-100 placeholder:text-slate-600 focus:border-teal-500 outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold uppercase rounded-xl flex items-center gap-1.5 transition active:scale-95 shrink-0"
            >
              <span>CARI FASKES</span>
            </button>
          </form>

          {/* Search Result List */}
          {searchResult && (
            <div className="space-y-2 p-3 bg-slate-950/40 border border-slate-850 rounded-xl max-h-[160px] overflow-y-auto">
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Hasil Pencarian Faskes Terdekat</span>
              {searchResult.length > 0 ? (
                searchResult.map((res, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-900/60 last:border-0">
                    <div>
                      <span className="font-bold text-slate-200">{res.name}</span>
                      <span className="text-[10px] text-slate-550 block mt-0.5">Jarak: {res.distance} • Status: {res.water}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      res.status === 'Operational' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50' : 'bg-red-950/50 text-rose-450 border border-rose-900/50'
                    }`}>
                      {res.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic text-center py-2">Tidak ditemukan data faskes terdekat.</p>
              )}
            </div>
          )}
        </div>

        {/* Emergency Hotline Numbers */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Phone className="h-4 w-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Kontak Hotline Darurat Kesehatan EOC
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-semibold">
            Hubungi kontak tanggap krisis di bawah untuk permohonan mobilisasi ambulans, bantuan medis darurat, atau suplai obat-obatan pos pengungsian.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <a href="tel:119" className="flex items-center justify-between p-3 bg-slate-950/65 border border-slate-850 hover:border-slate-700 transition rounded-xl">
              <div>
                <span className="font-bold text-slate-200">Ambulans Kemenkes</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Layanan Bebas Pulsa</span>
              </div>
              <span className="text-emerald-400 font-extrabold text-sm">119</span>
            </a>
            <div className="flex items-center justify-between p-3 bg-slate-950/65 border border-slate-850 rounded-xl">
              <div>
                <span className="font-bold text-slate-200">Posko Krisis EOC</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Whatsapp Respon Cepat</span>
              </div>
              <span className="text-teal-400 font-extrabold">0811-1234-5678</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-950/65 border border-slate-850 rounded-xl">
              <div>
                <span className="font-bold text-slate-200">RSUD Pandan</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">IGD & UGD Rujukan</span>
              </div>
              <span className="text-slate-300 font-bold">(0631) 371-110</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-950/65 border border-slate-850 rounded-xl">
              <div>
                <span className="font-bold text-slate-200">Dinkes Tapanuli Tengah</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Posko Lapangan Banjir</span>
              </div>
              <span className="text-slate-300 font-bold">(0631) 371-224</span>
            </div>
          </div>
        </div>

      </section>

      {/* ── CORE PANEL LAYOUT (2 COLUMNS) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* PANEL LEFT: STATUS FASKES & BOR CAPACITY */}
        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-500" />
              STATUS OPERASIONAL & KAPASITAS FASKES RUJUKAN
            </h3>
            <span className="text-[10px] bg-slate-800 text-slate-450 px-2 py-0.5 rounded-full font-bold">
              Real-time update
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[5fr_7fr] gap-6">
            {/* Status Breakdown (PieChart) */}
            <div className="flex flex-col items-center justify-center border border-slate-800/60 bg-slate-950/40 p-3 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400 mb-2 uppercase">Sebaran Faskes</span>
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={faskesStatusChart}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={60}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {faskesStatusChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', color: '#fff', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 text-[10px] mt-2 font-semibold">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-500 inline-block"></span> Normal</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-red-500 inline-block"></span> Banjir</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-500 inline-block"></span> Terisolasi</span>
              </div>
            </div>

            {/* List Faskes Terdampak */}
            <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
              {faskesData.map((f, idx) => {
                let badgeColor = 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60'
                if (f.status === 'Kebanjiran') badgeColor = 'bg-red-950/50 text-red-400 border-red-800/60'
                if (f.status === 'Terisolasi') badgeColor = 'bg-amber-950/50 text-amber-400 border-amber-800/60'

                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-xs hover:border-slate-700 transition">
                    <div>
                      <div className="font-bold text-slate-100">{f.name}</div>
                      <div className="text-[10px] text-slate-550 flex items-center gap-1 mt-0.5">
                        <span>{f.type}</span>
                        <span>•</span>
                        <span className="text-slate-400">{f.water}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {f.bor > 0 && (
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${f.bor > 80 ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-slate-800 text-slate-350'}`}>
                          BOR: {f.bor}%
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider ${badgeColor}`}>
                        {f.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* PANEL RIGHT: SURVEILANS PENYAKIT PASCA BANJIR */}
        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-5 w-5 text-teal-400" />
              SURVEILANS PENYAKIT SENSITIF BANJIR (POTENSI KLB)
            </h3>
            <span className="text-[10px] bg-teal-950/80 text-teal-400 border border-teal-900 px-2.5 py-0.5 rounded-full font-bold">
              Tren Harian Kasus
            </span>
          </div>

          <div className="h-[180px] w-full bg-slate-950/40 border border-slate-800/80 p-3 rounded-xl">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={diseaseTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', color: '#fff', borderRadius: 8 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 9, paddingTop: 6 }} />
                <Line type="monotone" dataKey="Diare" stroke="#ef4444" strokeWidth={2} name="Kasus Diare" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Leptospirosis" stroke="#eab308" strokeWidth={2} name="Leptospirosis" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="PenyakitKulit" stroke="#10b981" strokeWidth={2} name="Penyakit Kulit" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="ISPA" stroke="#3b82f6" strokeWidth={2} name="ISPA" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ── LOWER PANEL LAYOUT (2 COLUMNS) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* LOGISTIK OBAT & BUFFER STOCK KESEHATAN */}
        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Droplets className="h-5 w-5 text-sky-400" />
              STATUS BUFFER STOCK KESEHATAN & OBAT BANJIR
            </h3>
            <span className="text-[10px] text-slate-400">Unit Distribusi: EOC Log</span>
          </div>

          <div className="space-y-3">
            {logisticsData.map((l, idx) => {
              const pct = l.stock
              let barColor = 'bg-teal-500'
              if (pct < l.limit) barColor = 'bg-rose-500'
              else if (pct < l.limit * 1.5) barColor = 'bg-amber-500'

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-200">{l.item}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Stok: <strong className={pct < l.limit ? 'text-rose-400 font-extrabold' : 'text-slate-100'}>{pct}%</strong> (Batas Aman: {l.limit}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                    <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* KARTU AKSI PROTOKOL EOC KESEHATAN */}
        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-teal-400" />
              PROTOKOL INSTANS PENGENDALIAN EOC KESEHATAN
            </h3>
            <span className="text-[10px] bg-slate-800 text-teal-400 font-bold px-2 py-0.5 rounded-full border border-teal-900">
              {eocProtocols.filter(p => p.done).length} / {eocProtocols.length} Selesai
            </span>
          </div>

          <div className="space-y-2.5">
            {eocProtocols.map((p) => (
              <div
                key={p.id}
                className={`flex items-start gap-3 p-3 rounded-xl border text-xs leading-relaxed transition ${
                  p.done
                    ? 'bg-teal-950/25 border-teal-800/50 text-slate-350'
                    : 'bg-slate-950/30 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border text-white transition ${
                    p.done ? 'bg-teal-600 border-teal-500' : 'border-slate-700 hover:border-teal-500'
                  }`}
                >
                  {p.done && <CheckCircle2 className="h-3 w-3 stroke-[3]" />}
                </button>
                <div className="flex-1">
                  <span className={p.done ? 'line-through text-slate-500 font-medium' : 'font-bold text-slate-200'}>
                    {p.text}
                  </span>
                  <div className="mt-1 flex items-center gap-2 text-[10px]">
                    <span className={`px-1.5 py-0.2 rounded font-black uppercase ${
                      p.minLevel === 4 ? 'bg-rose-950/80 text-rose-400 border border-rose-900' :
                      p.minLevel === 3 ? 'bg-amber-950/80 text-amber-400 border border-amber-900' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      LVL {p.minLevel}
                    </span>
                    <span className="text-slate-500">Kebutuhan respon tanggap darurat</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── PUBLIC EDUCATION GUIDES (Edukasi Kesehatan Bencana) ── */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
          <BookOpen className="h-5 w-5 text-teal-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Panduan Edukasi & Informasi Kesehatan Pengungsian (Bantuan Publik)
          </h3>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-900 pb-2">
          <button
            onClick={() => setActiveEducationTab('lepto')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeEducationTab === 'lepto' ? 'bg-teal-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            Pencegahan Leptospirosis
          </button>
          <button
            onClick={() => setActiveEducationTab('water')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeEducationTab === 'water' ? 'bg-teal-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            Air Bersih Darurat
          </button>
          <button
            onClick={() => setActiveEducationTab('snake')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeEducationTab === 'snake' ? 'bg-teal-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            Gigitan Ular / Hewan Berbisa
          </button>
        </div>

        {/* Active education content */}
        <div className="text-xs leading-relaxed text-slate-300 p-4 bg-slate-950/40 border border-slate-850 rounded-xl min-h-[120px]">
          {activeEducationTab === 'lepto' && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Bahaya Bakteri Urine Tikus (Leptospirosis)
              </h4>
              <p>Leptospirosis ditularkan melalui air banjir yang tercemar urine hewan pengerat (tikus) pembawa bakteri. Bakteri masuk melalui luka terbuka pada kulit atau selaput lendir.</p>
              <ul className="list-disc list-inside space-y-1 mt-2 text-slate-400">
                <li>Selalu gunakan alas kaki (sepatu bot karet) saat beraktivitas di daerah banjir.</li>
                <li>Cuci tangan dan kaki memakai sabun setelah kontak dengan air banjir.</li>
                <li>Tutup luka terbuka dengan perban tahan air sebelum terpapar genangan.</li>
                <li>Segera kunjungi Pos Kesehatan jika Anda demam mendadak tinggi disertai nyeri betis parah.</li>
              </ul>
            </div>
          )}
          {activeEducationTab === 'water' && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Droplets className="h-4 w-4 text-sky-400" />
                Panduan Desinfeksi & Pengolahan Air Bersih Darurat
              </h4>
              <p>Kelangkaan air bersih memicu kejadian luar biasa (KLB) Diare dan Kolera di pengungsian. Gunakan penjernih air jika sumber air keruh.</p>
              <ul className="list-disc list-inside space-y-1 mt-2 text-slate-400">
                <li>Gunakan tablet kaporit / PAC penjernih air sesuai dosis (1 tablet untuk 20 Liter air).</li>
                <li>Biarkan air mengendap selama 30 menit sebelum digunakan untuk MCK.</li>
                <li><strong>Wajib direbus mendidih sempurna</strong> selama minimal 1-3 menit sebelum diminum.</li>
                <li>Simpan air matang dalam wadah tertutup rapat untuk menghindari kontaminasi ulang.</li>
              </ul>
            </div>
          )}
          {activeEducationTab === 'snake' && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                Pertolongan Pertama Gigitan Ular di Area Banjir
              </h4>
              <p>Air banjir memaksa ular keluar dari sarang aslinya untuk mencari tempat kering, meningkatkan risiko kontak dengan manusia.</p>
              <ul className="list-disc list-inside space-y-1 mt-2 text-slate-400">
                <li><strong>Imobilisasi (Diamkan):</strong> Jangan gerakkan anggota tubuh yang digigit ular. Ikat memakai bidai kayu longgar untuk menekan penyebaran bisa.</li>
                <li>Jangan menyedot bisa ular dengan mulut atau menyayat luka gigitan.</li>
                <li>Segera hubungi hotline EOC (119) atau evakuasi ke RSUD Pandan yang memiliki persediaan Serum Antibisa Ular (SABU).</li>
                <li>Ingat/foto ciri-ciri ular jika memungkinkan untuk membantu penentuan antibisa yang tepat.</li>
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* ── BOTTOM INFO BRAND ── */}
      <div className="flex items-center gap-2 bg-slate-900/30 border border-slate-900 rounded-xl p-3 text-[11px] text-slate-450">
        <Info className="h-4 w-4 text-teal-400 shrink-0" />
        <span>
          <strong>Catatan Operasional:</strong> Data curah hujan terintegrasi otomatis via sensor BMKG API, kalkulasi BOR dan Faskes dikirimkan berkala oleh dinas kesehatan setempat (Dinkes) dan Rumah Sakit rujukan melalui modul interoperabilitas internal SIPKK.
        </span>
      </div>

    </div>
  )
}
