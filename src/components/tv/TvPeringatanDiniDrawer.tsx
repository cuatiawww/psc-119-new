'use client'

import React, { useState, useMemo } from 'react'
import {
  BellRing,
  X,
  Search,
  CloudLightning,
  ShieldAlert,
  Clock,
  MapPin,
  ExternalLink,
  Volume2,
  VolumeX,
  Compass,
  AlertTriangle,
  Waves,
  Wind,
} from 'lucide-react'

export interface BmkgNowcastAlert {
  id?: string
  title: string
  provinsi: string
  link?: string
  description: string
  author?: string
  pubDate?: string
  event?: string
  severity?: string
  urgency?: string
  certainty?: string
  headline?: string
  senderName?: string
  source?: string
  [key: string]: any
}

interface TvPeringatanDiniDrawerProps {
  isOpen: boolean
  onClose: () => void
  peringatanDiniList?: BmkgNowcastAlert[]
  onSelectProvince?: (provName: string) => void
  onSelectLocation?: (lng: number, lat: number, zoom?: number) => void
}

export default function TvPeringatanDiniDrawer({
  isOpen,
  onClose,
  peringatanDiniList = [],
  onSelectProvince,
  onSelectLocation,
}: TvPeringatanDiniDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'ntt' | 'hujan' | 'angin' | 'gelombang'>('all')

  const alerts = Array.isArray(peringatanDiniList) ? peringatanDiniList : []

  // Filter alerts by search query and category
  const filteredAlerts = useMemo(() => {
    return alerts.filter((item) => {
      const q = searchQuery.toLowerCase().trim()
      const titleLower = (item.title || '').toLowerCase()
      const provLower = (item.provinsi || '').toLowerCase()
      const descLower = (item.description || '').toLowerCase()
      const eventLower = (item.event || '').toLowerCase()

      const matchesSearch =
        !q ||
        titleLower.includes(q) ||
        provLower.includes(q) ||
        descLower.includes(q) ||
        eventLower.includes(q)

      if (!matchesSearch) return false

      if (selectedFilter === 'ntt') {
        return provLower.includes('nusa tenggara timur') || provLower.includes('ntt') || descLower.includes('flores') || descLower.includes('kupang')
      }
      if (selectedFilter === 'hujan') {
        return titleLower.includes('hujan') || descLower.includes('hujan') || eventLower.includes('hujan')
      }
      if (selectedFilter === 'angin') {
        return titleLower.includes('angin') || descLower.includes('angin') || eventLower.includes('angin') || titleLower.includes('petir') || descLower.includes('petir')
      }
      if (selectedFilter === 'gelombang') {
        return titleLower.includes('gelombang') || descLower.includes('gelombang') || titleLower.includes('maritim') || descLower.includes('laut')
      }

      return true
    })
  }, [alerts, searchQuery, selectedFilter])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto flex justify-end">
      {/* ── Backdrop ── */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* ── Slide-over Drawer Panel ── */}
      <div className="relative w-full sm:w-[480px] md:w-[540px] xl:w-[600px] h-full bg-white/95 backdrop-blur-2xl border-l border-[#bedbda] shadow-2xl flex flex-col z-10 text-slate-800 animate-slide-left">
        
        {/* ── Header ── */}
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-rose-50/80 via-white to-teal-50/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700 border border-rose-200 shadow-xs shrink-0">
              <BellRing className="h-5 w-5 text-rose-600 animate-swing" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-wider text-rose-700 uppercase truncate">
                  PERINGATAN DINI CUACA (CAP)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs">
                  {filteredAlerts.length}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold truncate">
                BMKG Nowcast & Sistem Peringatan Dini Cuaca Ekstrem Terverifikasi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-all shadow-xs cursor-pointer shrink-0"
            title="Tutup Notifikasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Search & Filter Controls ── */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/80 space-y-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari provinsi, kabupaten, kecamatan, cuaca..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all font-semibold shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition shadow-2xs cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Semua ({alerts.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('ntt')}
              className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition shadow-2xs cursor-pointer ${
                selectedFilter === 'ntt'
                  ? 'bg-teal-700 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Prov. NTT
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('hujan')}
              className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition shadow-2xs cursor-pointer ${
                selectedFilter === 'hujan'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Hujan Sedang/Lebat
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('angin')}
              className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition shadow-2xs cursor-pointer ${
                selectedFilter === 'angin'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Kilat & Angin
            </button>
          </div>
        </div>

        {/* ── Alerts Stream List ── */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-50/50">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <BellRing className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-slate-600">Tidak ada notifikasi peringatan dini aktif yang cocok.</p>
              <p className="text-[10px] text-slate-400">Silakan ubah filter atau kata kunci pencarian Anda.</p>
            </div>
          ) : (
            filteredAlerts.map((alert, idx) => {
              const isNtt = (alert.provinsi || '').toLowerCase().includes('nusa tenggara timur') || (alert.title || '').toLowerCase().includes('ntt')
              
              return (
                <div
                  key={alert.id || idx}
                  className={`p-3.5 rounded-2xl border bg-white transition-all shadow-xs hover:shadow-md ${
                    isNtt
                      ? 'border-teal-300 ring-1 ring-teal-200/50 hover:border-teal-400'
                      : 'border-slate-200 hover:border-rose-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-xl border shrink-0 ${
                        isNtt
                          ? 'bg-teal-50 text-teal-700 border-teal-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        <CloudLightning className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                          {alert.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 mt-1 font-semibold">
                          <MapPin className="h-3 w-3 text-[#047D78] shrink-0" />
                          <span className="truncate">{alert.provinsi || 'Indonesia'}</span>
                          {isNtt && (
                            <span className="px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 text-[9px] font-black uppercase">
                              Wilayah Pantauan Utama
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 shrink-0 uppercase tracking-wider">
                      {alert.event || 'WASPADA CUACA'}
                    </span>
                  </div>

                  {/* Description / Affected Areas */}
                  {alert.description && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-700 leading-relaxed font-medium">
                      <p className="line-clamp-4">{alert.description}</p>
                    </div>
                  )}

                  {/* Meta Details & Action Buttons */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[10.5px]">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold min-w-0 truncate">
                      <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate">{alert.pubDate || 'Terkini'}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {alert.link && (
                        <a
                          href={alert.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center gap-1 transition"
                          title="Buka Informasi Lengkap BMKG"
                        >
                          <span>BMKG</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (alert.provinsi) {
                            onSelectProvince?.(alert.provinsi)
                          }
                          onClose()
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#047D78] hover:bg-[#036561] text-white font-extrabold text-[10px] flex items-center gap-1 transition shadow-2xs cursor-pointer"
                        title="Fokuskan Peta ke Wilayah Ini"
                      >
                        <Compass className="h-3 w-3" />
                        <span>Fokus Wilayah</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/90 flex items-center justify-between text-[10px] text-slate-500 font-bold">
          <span>Sumber Resmi: BMKG (CAP Nowcast Protocol)</span>
          <span className="flex items-center gap-1 text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Realtime Live Sync
          </span>
        </div>
      </div>
    </div>
  )
}
