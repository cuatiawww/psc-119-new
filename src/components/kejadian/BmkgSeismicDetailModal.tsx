'use client'

import React, { useMemo, useEffect } from 'react'
import {
  X,
  Activity,
  CheckCircle2
} from 'lucide-react'

interface BmkgSeismicDetailModalProps {
  isOpen: boolean
  onClose: () => void
  eventData: any
  seismicResult: any
  bmkgGempa: any
  earthquakeTimeline: any[]
}

export default function BmkgSeismicDetailModal({
  isOpen,
  onClose,
  eventData,
  seismicResult,
  bmkgGempa,
  earthquakeTimeline
}: BmkgSeismicDetailModalProps) {
  const mainMag = useMemo(() => {
    const raw = parseFloat(eventData?.magnitudo || bmkgGempa?.Magnitude || bmkgGempa?.magnitude || '0')
    return !isNaN(raw) && raw > 0 ? raw : 0
  }, [eventData, bmkgGempa])

  // Build the complete chronological list of days from disaster start to date now
  const allDaysData = useMemo(() => {
    const nowWib = new Date()
    const wibOffset = 7 * 60 * 60 * 1000
    const todayWibIso = new Date(nowWib.getTime() + wibOffset).toISOString().slice(0, 10)

    if (Array.isArray(earthquakeTimeline) && earthquakeTimeline.length > 0) {
      return earthquakeTimeline.map((item: any, idx: number) => {
        const itemDate = item.date ? new Date(item.date) : null
        const dateIso = itemDate && !isNaN(itemDate.getTime()) ? itemDate.toISOString().slice(0, 10) : (item.dateStr || '')
        const isEventDay = item.offset === 0 || item.isPeak || idx === 0
        const isToday = dateIso === todayWibIso
        const peakMag = parseFloat(String(item.topLabel || '').replace(/[^\d.]/g, '')) || 0

        return {
          dateStr: dateIso || `day-${idx}`,
          dayName: item.dayName || (itemDate && !isNaN(itemDate.getTime()) ? itemDate.toLocaleDateString('id-ID', { weekday: 'short' }).toUpperCase() : `H+${idx}`),
          dateLabel: item.dateLabel || (itemDate && !isNaN(itemDate.getTime()) ? itemDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : `Hari ${idx + 1}`),
          isEventDay,
          isToday,
          peakMag,
          topLabel: item.topLabel || '-',
          bottomLabel: item.bottomLabel || 'Tidak ada rekaman'
        }
      })
    }

    const startStr = eventData?.tgl_kejadian_riil || eventData?.tgl_kejadian || ''
    const startDate = startStr ? new Date(startStr) : new Date()
    const validStart = !isNaN(startDate.getTime()) ? startDate : new Date()

    const rawMmi = eventData?.skala_mmi || bmkgGempa?.Dirasakan || ''
    const rawMmiMatch = String(rawMmi).match(/([I|V|X]+(\s*-\s*[I|V|X]+)?)/i)
    const mmiShort = rawMmiMatch ? `${rawMmiMatch[1]} MMI` : ''

    const daysList = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(validStart)
      d.setDate(validStart.getDate() + i)
      const dateIso = d.toISOString().slice(0, 10)

      const apiItem = Array.isArray(seismicResult?.timeline)
        ? seismicResult.timeline.find((t: any) => t.dateStr === dateIso || t.offset === i)
        : null

      let topLabel = '-'
      let bottomLabel = 'Tidak ada rekaman'
      let peakMag = 0

      if (i === 0) {
        if (mainMag > 0) {
          topLabel = `M ${mainMag.toFixed(1)}`
          bottomLabel = mmiShort ? `${mmiShort} (Utama)` : 'Gempa Utama'
          peakMag = mainMag
        } else if (apiItem && apiItem.magnitude > 0) {
          topLabel = apiItem.topLabel
          bottomLabel = apiItem.bottomLabel
          peakMag = apiItem.magnitude
        }
      } else if (apiItem && apiItem.magnitude > 0) {
        topLabel = apiItem.topLabel
        bottomLabel = apiItem.bottomLabel
        peakMag = apiItem.magnitude
      }

      daysList.push({
        dateStr: dateIso,
        dayName: d.toLocaleDateString('id-ID', { weekday: 'short' }).toUpperCase(),
        dateLabel: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        isEventDay: i === 0,
        isToday: dateIso === todayWibIso,
        peakMag,
        topLabel,
        bottomLabel
      })
    }
    return daysList
  }, [earthquakeTimeline, eventData, bmkgGempa, seismicResult, mainMag])

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header (Tanpa Icon Box di Samping Judul) */}
        <div className="px-6 py-4 border-b border-slate-200/90 bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight uppercase">
                TREN AKTIVITAS SEISMIK & GEMPA SUSULAN BMKG DI KEJADIAN
              </h2>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-200 border border-teal-300/30">
                REALTIME BMKG & INATEWS
              </span>
            </div>
            <p className="text-xs text-teal-100/80 mt-0.5">
              Pantauan runtutan aktivitas gempa bumi harian dari gempa utama hingga fase peluruhan seismik terverifikasi BMKG &amp; InaTEWS.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-teal-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Murni Barisan Card Timeline dari Awal s.d Hari Ini */}
        <div className="p-6 bg-slate-50/50 overflow-x-auto">
          <div className="flex items-center gap-2.5 pb-2 overflow-x-auto min-w-full">
            {allDaysData.map((day) => {
              const isEvent = day.isEventDay
              const isToday = day.isToday

              return (
                <div
                  key={day.dateStr}
                  className={`flex flex-col items-center justify-between py-3 px-2 rounded-2xl border text-center shrink-0 w-[84px] sm:w-[94px] min-h-[155px] shadow-xs transition-all ${
                    isEvent
                      ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-300/60 text-rose-900 shadow-sm'
                      : isToday
                      ? 'bg-teal-50/80 border-teal-300 ring-1 ring-teal-300/60 text-teal-950'
                      : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50/90'
                  }`}
                >
                  {/* Day of Week */}
                  <span className={`text-[10px] sm:text-[11px] font-black uppercase leading-none ${
                    isEvent ? 'text-rose-700' : isToday ? 'text-teal-800' : 'text-slate-500'
                  }`}>
                    {day.dayName}
                  </span>

                  {/* Day Date */}
                  <span className={`text-xs sm:text-[13px] font-black leading-tight mt-1 ${
                    isEvent ? 'text-rose-950 font-extrabold' : isToday ? 'text-teal-950 font-extrabold' : 'text-slate-900'
                  }`}>
                    {day.dateLabel}
                  </span>

                  {/* Center Seismic Pulse Icon */}
                  <div className="my-2.5 shrink-0 flex items-center justify-center">
                    <Activity
                      className={`h-5 w-5 ${
                        isEvent
                          ? 'text-rose-600 animate-bounce'
                          : day.peakMag >= 5.0
                          ? 'text-amber-600'
                          : day.peakMag >= 4.0
                          ? 'text-amber-500'
                          : 'text-amber-600'
                      }`}
                    />
                  </div>

                  {/* Magnitude & Sub-label */}
                  <div className="w-full">
                    <span className={`text-[11px] sm:text-xs font-black block leading-none ${
                      isEvent ? 'text-rose-900 font-black' : isToday ? 'text-teal-900 font-bold' : 'text-slate-900'
                    }`}>
                      {day.topLabel}
                    </span>
                    <span className={`text-[9.5px] sm:text-[10px] font-bold block leading-tight mt-1 truncate ${
                      isEvent ? 'text-rose-700 font-black' : isToday ? 'text-teal-700 font-bold' : 'text-slate-500'
                    }`}>
                      {day.bottomLabel}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              <span className="font-bold text-slate-700">Gempa Utama{mainMag > 0 ? ` (M ${mainMag.toFixed(1)})` : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="font-bold text-slate-700">Gempa Susulan</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              <span className="font-bold text-slate-700">Fase Peluruhan</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-slate-400 pl-2 border-l border-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>Sumber: BMKG &amp; InaTEWS</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-teal-800 text-white hover:bg-teal-700 font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
