'use client'

import React, { useState } from 'react'
import {
  Flame,
  MapPin,
  X,
  Building2,
  Tent,
  Activity,
  Navigation,
  Clock,
  ArrowRight,
  ShieldAlert,
  FileText,
  Share2,
  Check,
} from 'lucide-react'

export interface SpotlightItem {
  type?: 'disaster' | 'faskes' | 'posko' | 'earthquake'
  id?: string
  nama?: string
  nama_rs?: string
  nama_pos?: string
  jenis_bencana?: string
  kabupaten?: string
  kecamatan?: string
  provinsi?: string
  tgl_kejadian?: string
  lat: number
  lng: number
  total_korban?: number
  meninggal?: number
  luka?: number
  luka_berat?: number
  luka_ringan?: number
  pengungsi?: number
  terdampak?: number
  titik_posko?: number
  triase_merah?: number
  triase_kuning?: number
  triase_hijau?: number
  triase_hitam?: number
  total?: number
  status?: string
  igd?: string
  magnitude?: number
  depth?: number | string
  place?: string
  time?: string
  mmi?: string
  potensi?: string
  shakemapUrl?: string
  source?: string
}

export interface RouteInfo {
  distance: number // km
  duration: number // minutes
  targetName: string
  targetType?: string
}

interface TvSpotlightCardProps {
  item: SpotlightItem | null
  routeInfo?: RouteInfo | null
  onClose: () => void
  onStartRoute?: (item: SpotlightItem) => void
  onClearRoute?: () => void
}

export default function TvSpotlightCard({
  item,
  routeInfo,
  onClose,
  onStartRoute,
  onClearRoute,
}: TvSpotlightCardProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!item && !routeInfo) return null

  // ── 1. ACTIVE TACTICAL ROUTE VIEW ──
  if (routeInfo) {
    return (
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-30 max-w-lg sm:max-w-xl w-[calc(100vw-32px)] sm:w-auto pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="relative p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 border border-emerald-500/40 shadow-[0_16px_40px_rgba(4,125,120,0.35)] text-white">
          <button
            type="button"
            onClick={onClearRoute}
            className="absolute top-2.5 right-2.5 h-6 w-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Tutup Rute"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shrink-0">
              <Navigation className="h-5 w-5 animate-pulse" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  RUTE TAKTIS DARURAT
                </span>
                <span className="text-[10px] text-teal-300 font-bold flex items-center gap-1 truncate">
                  <span>Asal: Episentrum</span>
                  <ArrowRight className="h-3 w-3 inline shrink-0" />
                  <span className="truncate">{routeInfo.targetName}</span>
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-center">
                  <span className="text-[8.5px] text-teal-200 block font-bold uppercase tracking-wider">Jarak Tempuh</span>
                  <span className="font-mono text-base font-black text-white">
                    {routeInfo.distance.toFixed(1)} <span className="text-xs text-teal-300 font-bold">km</span>
                  </span>
                </div>

                <div className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-center">
                  <span className="text-[8.5px] text-teal-200 block font-bold uppercase tracking-wider">Estimasi Waktu</span>
                  <span className="font-mono text-base font-black text-emerald-400">
                    {Math.round(routeInfo.duration)} <span className="text-xs text-emerald-300 font-bold">menit</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!item) return null

  const isFaskes = item.type === 'faskes' || !!item.nama_rs
  const isPosko = item.type === 'posko' || !!item.nama_pos
  const isEarthquake = item.type === 'earthquake' || item.magnitude !== undefined
  const isDisaster = !isFaskes && !isPosko && !isEarthquake

  const title = item.nama || item.nama_rs || item.nama_pos || item.jenis_bencana || 'Kejadian Bencana'
  const locationStr = [item.kecamatan && `Kec. ${item.kecamatan}`, item.kabupaten, item.provinsi]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-30 max-w-sm sm:max-w-md 2xl:max-w-lg w-[calc(100vw-32px)] sm:w-auto pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="relative p-3 sm:p-3.5 rounded-2xl bg-white/95 backdrop-blur-2xl border border-teal-400 shadow-[0_12px_36px_rgba(4,125,120,0.18)] text-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2.5 right-2.5 h-6 w-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
          title="Tutup Detail"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-center gap-2.5 pr-8">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              isFaskes
                ? 'bg-teal-50 text-[#047D78]'
                : isPosko
                ? 'bg-cyan-50 text-cyan-700'
                : isEarthquake
                ? 'bg-rose-50 text-rose-600'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {isFaskes ? (
              <Building2 className="h-5 w-5" />
            ) : isPosko ? (
              <Tent className="h-5 w-5" />
            ) : isEarthquake ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <Flame className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isFaskes
                    ? 'bg-teal-100/70 text-[#047D78]'
                    : isPosko
                    ? 'bg-cyan-100/70 text-cyan-800'
                    : isEarthquake
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {isFaskes ? 'FASILITAS KESEHATAN' : isPosko ? 'POSKO PENGUNGSIAN' : isEarthquake ? 'GEMPABUMI BMKG' : 'TITIK KEJADIAN'}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{item.time || item.tgl_kejadian || '-'}</span>
            </div>
            <h4 className="font-extrabold text-sm text-slate-900 truncate mt-0.5">{title}</h4>
            <p className="text-[11px] text-slate-500 font-medium truncate">{locationStr || item.place || '-'}</p>
          </div>
        </div>

        {/* ── Dynamic Metrics & Actions based on type ── */}
        {isFaskes && (
          <>
            <div className="grid grid-cols-4 gap-1 mt-2.5 pt-2.5 border-t border-slate-200 text-center">
              <div className="p-1 rounded-lg bg-rose-50 border border-rose-200">
                <span className="text-[8px] font-bold text-rose-700 block">Merah</span>
                <span className="font-mono text-xs font-black text-rose-800">{item.triase_merah || 0}</span>
              </div>
              <div className="p-1 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-[8px] font-bold text-amber-700 block">Kuning</span>
                <span className="font-mono text-xs font-black text-amber-800">{item.triase_kuning || 0}</span>
              </div>
              <div className="p-1 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-[8px] font-bold text-emerald-700 block">Hijau</span>
                <span className="font-mono text-xs font-black text-emerald-800">{item.triase_hijau || 0}</span>
              </div>
              <div className="p-1 rounded-lg bg-slate-100 border border-slate-200">
                <span className="text-[8px] font-bold text-slate-700 block">Total</span>
                <span className="font-mono text-xs font-black text-slate-900">{item.total || item.total_korban || 0}</span>
              </div>
            </div>

            {onStartRoute && (
              <button
                type="button"
                onClick={() => onStartRoute(item)}
                className="mt-2.5 w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-[#047D78] to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white text-xs font-black shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Buat Rute Taktis ke Faskes Ini</span>
              </button>
            )}
          </>
        )}

        {isPosko && (
          <>
            <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2.5 border-t border-slate-200">
              <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[9px] text-slate-500 block font-bold">Pengungsi</span>
                <span className="font-mono text-sm font-black text-cyan-700">{item.pengungsi || 0} Jiwa</span>
              </div>
              <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[9px] text-slate-500 block font-bold">Koordinat</span>
                <span className="font-mono text-[10px] font-black text-[#047D78] block truncate">
                  {item.lat ? item.lat.toFixed(3) : '-'}, {item.lng ? item.lng.toFixed(3) : '-'}
                </span>
              </div>
              <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[9px] text-slate-500 block font-bold">Status</span>
                <span className="text-[10px] font-black text-emerald-700 block truncate">{item.status || 'Posko Terdaftar'}</span>
              </div>
            </div>

            {onStartRoute && (
              <button
                type="button"
                onClick={() => onStartRoute(item)}
                className="mt-2.5 w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-cyan-700 to-teal-700 hover:from-cyan-800 hover:to-teal-800 text-white text-xs font-black shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Buat Rute Taktis ke Posko Ini</span>
              </button>
            )}
          </>
        )}

        {isEarthquake && (
          <div className="space-y-2 mt-2.5 pt-2.5 border-t border-slate-200">
            <div className="grid grid-cols-3 gap-1.5">
              <div className="p-1.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
                <span className="text-[9px] text-rose-700 block font-bold">Magnitudo</span>
                <span className="font-mono text-base font-black text-rose-800">
                  M {item.magnitude ? item.magnitude.toFixed(1) : '-'}
                </span>
              </div>
              <div className="p-1.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
                <span className="text-[9px] text-amber-700 block font-bold">Kedalaman</span>
                <span className="font-mono text-sm font-black text-amber-800">{item.depth ? `${item.depth}` : '-'}</span>
              </div>
              <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[9px] text-slate-500 block font-bold">Potensi / MMI</span>
                <span className="text-[10px] font-black text-slate-800 block truncate">{item.potensi || item.mmi || '-'}</span>
              </div>
            </div>

            {item.shakemapUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                <img
                  src={item.shakemapUrl}
                  alt="BMKG Shakemap"
                  className="w-full h-28 object-contain bg-black/40"
                  onError={(e) => {
                    ;(e.target as HTMLElement).style.display = 'none'
                  }}
                />
              </div>
            )}

            <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold px-1">
              <span>{item.source || 'Sumber Data: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)'}</span>
              {item.lat && item.lng && (
                <span className="font-mono">{item.lat.toFixed(2)}°, {item.lng.toFixed(2)}°</span>
              )}
            </div>
          </div>
        )}

        {isDisaster && (
          <div className="space-y-2 mt-2.5 pt-2.5 border-t border-slate-200">
            {/* Total Korban Metric */}
            <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[9px] text-slate-500 block font-bold">Total Korban</span>
              <span className="font-mono text-sm sm:text-base font-black text-red-600">
                {item.total_korban || (item.meninggal || 0) + (item.luka || 0) || 0} Jiwa
              </span>
            </div>

            {/* Action Buttons: Renkon & Respon (Temporarily commented out/hidden as requested) */}
            {/*
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open('/renkon', '_blank')
                  }
                }}
                className="py-1.5 px-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-[#047D78] border border-teal-200 text-xs font-black shadow-2xs flex items-center justify-center gap-1 transition-all cursor-pointer text-center"
                title="Buka Rencana Kontinjensi (Renkon)"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Renkon</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open('/respon', '_blank')
                  }
                }}
                className="py-1.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-black shadow-2xs flex items-center justify-center gap-1 transition-all cursor-pointer text-center"
                title="Buka Respon Tanggap Darurat"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-amber-700" />
                <span>Respon</span>
              </button>
            </div>
            */}

            {/* Share Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleShare}
                className="w-full py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-black shadow-2xs flex items-center justify-center gap-1 transition-all cursor-pointer text-center"
                title="Bagikan Tautan Kejadian"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5 text-slate-600" />}
                <span>{copied ? 'Tersalin' : 'Bagikan Informasi'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
