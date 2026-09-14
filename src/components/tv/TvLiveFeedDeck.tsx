'use client'

import React, { useState, useMemo } from 'react'
import {
  BellRing,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Search,
  CloudLightning,
  ShieldAlert,
  Clock,
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

interface TvLiveFeedDeckProps {
  peringatanDiniList?: BmkgNowcastAlert[]
  isKpiCollapsed?: boolean
  onSelectAlert?: (alert: BmkgNowcastAlert) => void
  onSelectProvince?: (provName: string) => void
}

export default function TvLiveFeedDeck({
  peringatanDiniList = [],
  isKpiCollapsed = false,
  onSelectAlert,
  onSelectProvince,
}: TvLiveFeedDeckProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const alerts = Array.isArray(peringatanDiniList) ? peringatanDiniList : []

  // Filter alerts by search query
  const filteredAlerts = useMemo(() => {
    return alerts.filter((item) => {
      const q = searchQuery.toLowerCase().trim()
      if (!q) return true
      return (
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.provinsi && item.provinsi.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.event && item.event.toLowerCase().includes(q))
      )
    })
  }, [alerts, searchQuery])

  return (
    <div
      className={`fixed left-2 sm:left-3 bottom-12 z-25 transition-all duration-300 pointer-events-none ${
        isCollapsed ? 'w-10 sm:w-11' : 'w-76 sm:w-84 xl:w-90 2xl:w-96 max-w-[calc(50vw-16px)]'
      } ${isKpiCollapsed ? 'top-[68px] sm:top-[74px]' : 'top-[192px] sm:top-[198px] 2xl:top-[206px]'}`}
    >
      <div className="relative h-full flex flex-col pointer-events-auto bg-white/95 backdrop-blur-xl border border-[#bedbda] rounded-xl sm:rounded-2xl shadow-[0_8px_24px_rgba(4,125,120,0.1)] overflow-hidden text-slate-800">
        {/* ── Deck Header (Exact Original Style) ── */}
        <div className="p-2 sm:p-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2">
          {!isCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1 rounded-lg bg-teal-50 text-[#047D78] border border-teal-200 shadow-xs shrink-0">
                <BellRing className="h-3.5 w-3.5 text-[#047D78]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[11px] sm:text-xs font-black tracking-wider text-[#047D78] uppercase truncate">
                  PERINGATAN DINI CUACA (CAP)
                </h3>
                <p className="text-[9.5px] sm:text-[10px] text-slate-500 font-bold truncate">
                  {filteredAlerts.length} Notifikasi Aktif BMKG Nowcast
                </p>
              </div>
            </div>
          )}

          {/* Collapse/Expand button */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-teal-800 transition-all shadow-xs cursor-pointer"
            title={isCollapsed ? 'Buka Panel' : 'Ciutkan Panel'}
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-[#047D78]" /> : <ChevronLeft className="h-3.5 w-3.5 text-[#047D78]" />}
          </button>
        </div>

        {/* ── Collapsed view icon bar ── */}
        {isCollapsed ? (
          <div className="flex-1 flex flex-col items-center gap-3 py-4 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="p-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-[#047D78] border border-teal-200 transition-all shadow-xs"
              title="Peringatan Dini Cuaca"
            >
              <BellRing className="h-4 w-4 text-[#047D78]" />
            </button>
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all shadow-xs"
              title="Cuaca Ekstrem"
            >
              <CloudLightning className="h-4 w-4 text-amber-600" />
            </button>
          </div>
        ) : (
          <>
            {/* ── Search Bar (Exact Original Style) ── */}
            <div className="p-2 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari provinsi, kabupaten, kecamatan..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#047D78] focus:bg-white transition-all font-semibold"
                />
              </div>
            </div>

            {/* ── Peringatan Dini Stream List (Exact Original Card Styling) ── */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar bg-slate-50/40">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs font-semibold">
                  Tidak ada data peringatan dini cuaca aktif.
                </div>
              ) : (
                filteredAlerts.map((alert, idx) => (
                  <div
                    key={alert.id || idx}
                    onClick={() => {
                      onSelectAlert?.(alert)
                      if (alert.provinsi) onSelectProvince?.(alert.provinsi)
                    }}
                    className="group relative p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50/40 hover:border-emerald-300 transition-all duration-200 cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-xl bg-teal-50 text-[#047D78] border border-teal-200 group-hover:bg-[#047D78] group-hover:text-white transition-colors shrink-0">
                          <CloudLightning className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-800 truncate">
                            {alert.title}
                          </h4>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 font-medium">
                            <MapPin className="h-2.5 w-2.5 text-[#047D78] shrink-0" />
                            <span className="truncate">{alert.provinsi || ''}</span>
                          </div>
                        </div>
                      </div>

                      <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                        {alert.event || 'Peringatan Dini'}
                      </span>
                    </div>

                    {/* Description (Wilayah terdampak) */}
                    {alert.description && (
                      <p className="text-[10px] text-slate-600 font-medium mt-1.5 line-clamp-3 leading-relaxed">
                        {alert.description}
                      </p>
                    )}

                    {/* Meta info & Action */}
                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9.5px]">
                      <span className="text-slate-500 font-bold flex items-center gap-1 truncate">
                        <Clock className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                        <span className="truncate">{alert.pubDate || ''}</span>
                      </span>
                      <span className="text-[#047D78] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform shrink-0">
                        Fokus Wilayah &rarr;
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── BMKG Attribution Footer ── */}
            <div className="p-2 border-t border-slate-200 bg-slate-50/80 text-center">
              <p className="text-[9px] text-slate-500 font-bold">
                Sumber: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
