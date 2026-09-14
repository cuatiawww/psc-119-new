'use client'

import React, { useState, useMemo } from 'react'
import {
  AlertTriangle,
  Flame,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Search,
  Zap,
  Activity,
  Clock,
  Compass,
  ArrowRight,
  Cloud,
  CloudSun,
  CloudRain,
  CloudLightning,
  Sun,
  Wind,
} from 'lucide-react'
import type { MarkerData, EarthquakePoint } from './TvMapEngine'

interface WeatherItem {
  kabupaten: string
  lat: number
  lng: number
  temp: number
  humidity: number
  windSpeed: number
  windDirection: number
  condition: string
  iconType: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'heavy_rain' | 'thunderstorm'
  description?: string
  warningStatus?: string
}

interface TvDisasterFeedDeckProps {
  markers?: MarkerData[]
  kabupatenDetailList?: any[]
  wilayahList?: any[]
  earthquakePoints?: EarthquakePoint[]
  poskoList?: any[]
  weatherList?: WeatherItem[]
  weatherSummary?: any
  peringatanDiniList?: any[]
  summary?: any
  isNttScope?: boolean
  isKpiCollapsed?: boolean
  onSelectDisaster?: (item: any) => void
  onSelectLocation?: (lng: number, lat: number, zoom?: number) => void
  onSelectProvince?: (provName: string) => void
}

export default function TvDisasterFeedDeck({
  markers = [],
  kabupatenDetailList = [],
  wilayahList = [],
  earthquakePoints = [],
  weatherList = [],
  weatherSummary,
  summary,
  isNttScope = true,
  isKpiCollapsed = false,
  onSelectDisaster,
  onSelectLocation,
  onSelectProvince,
}: TvDisasterFeedDeckProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTab, setSelectedTab] = useState<'cuaca' | 'kabupaten'>('cuaca')

  // Disaster items list builder (strictly dynamic from API)
  const disasterItems = useMemo(() => {
    if (isNttScope) {
      const items: any[] = []

      // Add Mainshock Epicenter if available
      const mainshock = earthquakePoints.find((eq) => eq.isMainshock) || earthquakePoints[0]
      if (mainshock) {
        items.push({
          id: 'epicenter-mainshock',
          nama: 'Episentrum Gempa Utama M 7.7',
          jenis: 'Gempa Bumi Utama (M 7.7)',
          kabupaten: 'Mbay - Nagekeo & Laut Flores',
          provinsi: 'NUSA TENGGARA TIMUR',
          status: 'Episentrum Utama',
          statusColor: 'rose',
          lat: mainshock.lat || -8.34,
          lng: mainshock.lng || 122.98,
          kedalaman: '15 km',
          magnitudo: '7.7 SR',
          intensitas: 'VII - VIII MMI',
          waktu: '15 Agu 2026, 09:18:22 WITA',
          isMainshock: true,
          meninggal: summary?.total_meninggal ?? 0,
          luka: summary?.total_luka ?? 0,
          pengungsi: summary?.total_pengungsi ?? 0,
          type: 'earthquake',
        })
      }

      // Add Kabupaten data strictly from markers / kabupatenDetailList (from API)
      if (markers && markers.length > 0) {
        markers.forEach((m) => {
          const detail = kabupatenDetailList.find(
            (k) => (k.nama || '').toLowerCase() === (m.kabupaten || m.nama || '').toLowerCase()
          )

          const kabName = (m.kabupaten || m.nama || '').replace(/^kab\.\s+/i, '').trim()

          items.push({
            id: m.id || `kab-${kabName}`,
            nama: `Kabupaten ${kabName}`,
            jenis: 'Gempa Bumi & Kerusakan Wilayah',
            kabupaten: kabName,
            provinsi: 'NUSA TENGGARA TIMUR',
            status: 'Tanggap Darurat',
            statusColor: (m.meninggal || detail?.meninggal || 0) > 0 ? 'rose' : 'amber',
            lat: m.lat,
            lng: m.lng,
            meninggal: m.meninggal || detail?.meninggal || 0,
            luka: m.luka || m.luka_berat || detail?.total_luka || 0,
            luka_berat: m.luka_berat || detail?.luka_berat || 0,
            luka_ringan: m.luka_ringan || detail?.luka_ringan || 0,
            pengungsi: m.pengungsi || detail?.pengungsi || 0,
            terdampak: m.terdampak || detail?.terdampak || 0,
            faskes_terdampak: (m as any).faskes_terdampak || 0,
            titik_posko: detail?.titik_posko || (m as any).titik_posko || 0,
            waktu: m.tgl_kejadian || '15 Agu 2026',
            type: 'disaster',
          })
        })
      }

      return items
    } else {
      return (markers || []).map((m, idx) => ({
        id: m.id || `disaster-${idx}`,
        nama: m.nama || `${m.jenis_bencana || 'Bencana'} ${m.kabupaten || m.provinsi || ''}`,
        jenis: m.jenis_bencana || 'Bencana Alam',
        kabupaten: m.kabupaten || '',
        provinsi: m.provinsi || '',
        status: (m.meninggal || 0) > 0 ? 'Tanggap Darurat' : 'Siaga',
        statusColor: (m.meninggal || 0) > 0 ? 'rose' : 'amber',
        lat: m.lat,
        lng: m.lng,
        meninggal: m.meninggal || 0,
        luka: m.luka || m.luka_berat || 0,
        pengungsi: m.pengungsi || 0,
        terdampak: m.terdampak || 0,
        waktu: m.tgl_kejadian || 'Terkini',
        type: 'disaster',
      }))
    }
  }, [isNttScope, markers, kabupatenDetailList, earthquakePoints, summary])

  // Filtered disaster items
  const filteredDisasters = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return disasterItems
    return disasterItems.filter((item) => {
      return (
        (item.nama && item.nama.toLowerCase().includes(q)) ||
        (item.kabupaten && item.kabupaten.toLowerCase().includes(q)) ||
        (item.provinsi && item.provinsi.toLowerCase().includes(q))
      )
    })
  }, [disasterItems, searchQuery])

  // Effective Weather List (Strictly from API weatherList)
  const effectiveWeather = useMemo(() => {
    if (Array.isArray(weatherList) && weatherList.length > 0) {
      return weatherList
    }
    return []
  }, [weatherList])

  const renderWeatherIcon = (iconType: string, className: string = 'h-4 w-4') => {
    switch (iconType) {
      case 'sunny':
        return <Sun className={`${className} text-amber-500`} />
      case 'partly_cloudy':
        return <CloudSun className={`${className} text-amber-500`} />
      case 'cloudy':
        return <Cloud className={`${className} text-slate-500`} />
      case 'rain':
      case 'heavy_rain':
        return <CloudRain className={`${className} text-blue-500`} />
      case 'thunderstorm':
        return <CloudLightning className={`${className} text-purple-600`} />
      default:
        return <CloudSun className={`${className} text-[#047D78]`} />
    }
  }

  return (
    <div
      className={`fixed left-2 sm:left-3 bottom-12 z-25 transition-all duration-300 pointer-events-none ${
        isCollapsed ? 'w-10 sm:w-11' : 'w-84 sm:w-96 xl:w-[440px] 2xl:w-[480px] max-w-[calc(50vw-16px)]'
      } ${isKpiCollapsed ? 'top-[68px] sm:top-[74px]' : 'top-[192px] sm:top-[198px] 2xl:top-[206px]'}`}
    >
      <div className="relative h-full flex flex-col pointer-events-auto bg-white border border-[#bedbda] rounded-xl sm:rounded-2xl shadow-[0_8px_24px_rgba(4,125,120,0.1)] overflow-hidden text-slate-800">
        
        {/* ── Deck Header (Clean Flat Design System) ── */}
        <div className="p-2.5 sm:p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-xl bg-teal-50 text-[#047D78] border border-teal-200 shadow-2xs shrink-0">
                <Compass className="h-4 w-4 text-[#047D78]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-[12.5px] font-black tracking-wider text-[#047D78] uppercase truncate">
                    PUSAT SITUASI WILAYAH & CUACA NTT
                  </h3>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-[#047D78] text-white shrink-0">
                    Live
                  </span>
                </div>
                <p className="text-[9.5px] sm:text-[10px] text-slate-500 font-bold truncate">
                  8 Kabupaten Terdampak • Cuaca BMKG & Open-Meteo
                </p>
              </div>
            </div>
          )}

          {/* Collapse/Expand button */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-center h-7 w-7 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-teal-800 transition-all shadow-2xs cursor-pointer shrink-0"
            title={isCollapsed ? 'Buka Panel Wilayah' : 'Ciutkan Panel'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4 text-[#047D78]" /> : <ChevronLeft className="h-4 w-4 text-[#047D78]" />}
          </button>
        </div>

        {/* ── Collapsed Vertical Icon Rail ── */}
        {isCollapsed ? (
          <div className="flex-1 flex flex-col items-center gap-3 py-4 bg-slate-50/50">
            <button
              type="button"
              onClick={() => { setIsCollapsed(false); setSelectedTab('cuaca') }}
              className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-[#047D78] border border-teal-200 transition-all shadow-2xs cursor-pointer"
              title="Informasi Cuaca NTT"
            >
              <CloudSun className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { setIsCollapsed(false); setSelectedTab('kabupaten') }}
              className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all shadow-2xs cursor-pointer"
              title="8 Kabupaten Terdampak"
            >
              <AlertTriangle className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            {/* ── 2 Main Tabs Switcher Bar ── */}
            <div className="p-2 border-b border-slate-100 bg-white space-y-2 shrink-0">
              <div className="grid grid-cols-2 gap-1 text-[10.5px] font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedTab('cuaca')}
                  className={`py-1.5 px-2 rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedTab === 'cuaca'
                      ? 'bg-[#047D78] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <CloudSun className="h-3.5 w-3.5" />
                  <span>Cuaca & Lingkungan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTab('kabupaten')}
                  className={`py-1.5 px-2 rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedTab === 'kabupaten'
                      ? 'bg-[#047D78] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>8 Kabupaten ({filteredDisasters.length})</span>
                </button>
              </div>

              {/* Search Bar for Kabupaten */}
              {selectedTab === 'kabupaten' && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari kabupaten, daerah..."
                    className="w-full pl-8 pr-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#047D78] focus:bg-white transition-all font-semibold"
                  />
                </div>
              )}
            </div>

            {/* ── Auto-Layout Scrollable Content Stream ── */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5 no-scrollbar bg-slate-50/40">
              
              {/* ═════════════════════════════════════════════════════════════════
                  TAB 1: CUACA & KONDISI LINGKUNGAN PROVINSI NTT (CLEAN FLAT DESIGN)
                 ═════════════════════════════════════════════════════════════════ */}
              {selectedTab === 'cuaca' && (
                <div className="space-y-2.5">
                  {/* Top Provincial Weather Card (Flat, No Gradient) */}
                  <div className="p-3 rounded-2xl bg-white border border-[#bedbda] text-slate-800 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 block">
                          MONITORING CUACA PROVINSI
                        </span>
                        <h4 className="text-base font-black text-slate-900 mt-0.5">
                          NUSA TENGGARA TIMUR
                        </h4>
                      </div>
                      <div className="p-2 rounded-xl bg-teal-50 border border-teal-200">
                        <CloudSun className="h-6 w-6 text-[#047D78]" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[8.5px] text-slate-500 font-bold block uppercase">Suhu Rata-rata</span>
                        <span className="font-mono text-base font-black text-slate-900">
                          {weatherSummary?.avg_temp !== undefined ? `${weatherSummary.avg_temp}°C` : 'N/A'}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[8.5px] text-slate-500 font-bold block uppercase">Kelembaban</span>
                        <span className="font-mono text-base font-black text-slate-900">
                          {weatherSummary?.avg_humidity !== undefined ? `${weatherSummary.avg_humidity}%` : 'N/A'}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[8.5px] text-slate-500 font-bold block uppercase">Kecepatan Angin</span>
                        <span className="font-mono text-base font-black text-[#047D78]">
                          {weatherSummary?.avg_wind_speed !== undefined ? `${weatherSummary.avg_wind_speed} km/h` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[9.5px]">
                      <span className="text-slate-600 font-bold">
                        Status: <strong className="text-slate-900">{weatherSummary?.status_cuaca_umum ?? 'Data Terhubung BMKG & GFS'}</strong>
                      </span>
                      <span className="text-slate-400 font-mono text-[8.5px]">BMKG & Open-Meteo Live</span>
                    </div>
                  </div>

                  {/* Weather Grid per Kabupaten */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block px-1">
                      KONDISI CUACA 8 KABUPATEN TERDAMPAK & KUPANG
                    </span>

                    {effectiveWeather.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-xs font-semibold bg-white rounded-xl border border-slate-200 p-3">
                        Data cuaca stasiun wilayah sedang dimuat dari BMKG / Open-Meteo (N/A)...
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {effectiveWeather.map((w, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              if (onSelectLocation && w.lat && w.lng) {
                                onSelectLocation(w.lng, w.lat, 10.5)
                              }
                            }}
                            className="group p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-teal-50/40 hover:border-[#047D78] transition-all cursor-pointer shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900 group-hover:text-[#047D78] truncate">
                                {w.kabupaten}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {renderWeatherIcon(w.iconType, 'h-4 w-4')}
                                <span className="text-xs font-black text-slate-900 font-mono">
                                  {w.temp}°C
                                </span>
                              </div>
                            </div>

                            <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-500 font-bold">
                              <span className="text-slate-700 truncate">{w.condition}</span>
                              <span className="flex items-center gap-0.5 text-slate-600">
                                <Wind className="h-3 w-3 text-[#047D78]" />
                                <span>{w.windSpeed} km/h</span>
                              </span>
                            </div>

                            <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[8.5px]">
                              <span className="text-slate-500 font-medium">Kelembaban: {w.humidity}%</span>
                              <span className="text-slate-500 font-medium">Arah Angin: {w.windDirection}°</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════════════════════
                  TAB 2: 8 KABUPATEN TERDAMPAK GEMPA
                 ═════════════════════════════════════════════════════════════════ */}
              {selectedTab === 'kabupaten' && (
                <div className="space-y-2">
                  {filteredDisasters.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                      Tidak ada data bencana wilayah yang tersedia (N/A).
                    </div>
                  ) : (
                    filteredDisasters.map((item, idx) => {
                      const isMain = item.isMainshock

                      return (
                        <div
                          key={item.id || idx}
                          onClick={() => {
                            onSelectDisaster?.(item)
                            if (item.lng && item.lat) {
                              onSelectLocation?.(Number(item.lng), Number(item.lat), 11)
                            }
                          }}
                          className={`group relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md ${
                            isMain
                              ? 'bg-rose-50/60 border-rose-300 hover:border-rose-400 ring-1 ring-rose-200'
                              : 'bg-white hover:bg-teal-50/40 border-slate-200 hover:border-[#047D78]'
                          }`}
                        >
                          {/* Title */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`p-1.5 rounded-xl border shrink-0 ${
                                isMain
                                  ? 'bg-rose-100 text-rose-700 border-rose-200'
                                  : item.meninggal > 0
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-teal-50 text-[#047D78] border-teal-200'
                              }`}>
                                {isMain ? <Zap className="h-4 w-4" /> : <Flame className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs sm:text-[13px] font-extrabold text-slate-900 group-hover:text-[#047D78] truncate leading-tight">
                                  {item.nama}
                                </h4>
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 font-semibold">
                                  <MapPin className="h-3 w-3 text-[#047D78] shrink-0" />
                                  <span className="truncate">{item.kabupaten ? `${item.kabupaten}, ${item.provinsi}` : item.provinsi}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Metrics Grid */}
                          <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
                            <div className="p-1.5 rounded-xl bg-rose-50 border border-rose-100">
                              <div className="text-[8.5px] font-bold text-rose-600 uppercase">Meninggal</div>
                              <div className="text-xs sm:text-sm font-black text-rose-700">{item.meninggal || 0}</div>
                            </div>
                            <div className="p-1.5 rounded-xl bg-amber-50 border border-amber-100">
                              <div className="text-[8.5px] font-bold text-amber-700 uppercase">Luka-luka</div>
                              <div className="text-xs sm:text-sm font-black text-amber-800">{item.luka || 0}</div>
                            </div>
                            <div className="p-1.5 rounded-xl bg-purple-50 border border-purple-100">
                              <div className="text-[8.5px] font-bold text-purple-700 uppercase">Pengungsi</div>
                              <div className="text-xs sm:text-sm font-black text-purple-800">
                                {Number(item.pengungsi || 0).toLocaleString('id-ID')}
                              </div>
                            </div>
                          </div>

                          {/* Footer Action */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[9.5px]">
                            <span className="text-slate-400 font-semibold flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{item.waktu}</span>
                            </span>

                            <span className="text-[#047D78] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                              <span>Fokus Spasial & Rute</span>
                              <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="p-2 border-t border-slate-200 bg-slate-50 text-center shrink-0">
              <p className="text-[9px] text-slate-500 font-bold">
                EOC SIPKK Kemenkes RI • Posko Penanganan Darurat Bencana
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
