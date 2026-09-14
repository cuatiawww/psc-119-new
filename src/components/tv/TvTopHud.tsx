'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Activity,
  Layers,
  Maximize,
  Minimize,
  RefreshCw,
  Volume2,
  VolumeX,
  ArrowLeft,
  Radio,
  BellRing,
} from 'lucide-react'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

interface TvTopHudProps {
  onToggleLayers: () => void
  isLayersOpen: boolean
  onToggleAlerts?: () => void
  isAlertsOpen?: boolean
  alertsCount?: number
  soundEnabled: boolean
  onToggleSound: () => void
  refreshCountdown: number
  refreshInterval: number
  onManualRefresh: () => void
  isLoading: boolean
  activeSpotlightName?: string | null
  currentTourProvince?: string | null
  autoProvinceTour?: boolean
  onToggleProvinceTour?: () => void
}

export default function TvTopHud({
  onToggleLayers,
  isLayersOpen,
  onToggleAlerts,
  isAlertsOpen = false,
  alertsCount = 0,
  soundEnabled,
  onToggleSound,
  refreshCountdown,
  refreshInterval,
  onManualRefresh,
  isLoading,
  activeSpotlightName,
  currentTourProvince,
  autoProvinceTour,
  onToggleProvinceTour,
}: TvTopHudProps) {
  const [wibStr, setWibStr] = useState('')
  const [witaStr, setWitaStr] = useState('')
  const [witStr, setWitStr] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Realtime digital clock with 3 Indonesian timezones (WIB, WITA, WIT)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()

      const formatT = (tz: string) => {
        try {
          return new Intl.DateTimeFormat('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: tz,
          }).format(now)
        } catch {
          return ''
        }
      }

      setWibStr(`${formatT('Asia/Jakarta')} WIB`)
      setWitaStr(`${formatT('Asia/Makassar')} WITA`)
      setWitStr(`${formatT('Asia/Jayapura')} WIT`)

      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ]
      setDateStr(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`)
    }

    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fullscreen state handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
        setIsFullscreen(false)
      }
    }
  }

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  // Calculate refresh progress percentage
  const refreshPercent = Math.max(0, Math.min(100, ((refreshInterval - refreshCountdown) / refreshInterval) * 100))

  return (
    <header className="fixed top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-3 z-40 flex items-center justify-between gap-2 sm:gap-4 pointer-events-none">
      {/* ── Left Branding Section ── */}
      <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3 bg-white/95 backdrop-blur-xl border border-[#bedbda] rounded-xl sm:rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 shadow-[0_8px_24px_rgba(4,125,120,0.09)] text-slate-800">
        <Link
          href="/"
          className="group flex items-center justify-center h-9 w-9 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-[#047D78] transition-all shadow-xs"
          title="Kembali ke Dashboard Utama"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        </Link>

        <div className="flex items-center gap-3">
          <Image
            src={`${basePath}/Logo-Kemenkes.png`}
            alt="Kementerian Kesehatan RI"
            width={120}
            height={38}
            className="h-8 w-auto object-contain shrink-0"
            priority
          />
          <div className="h-7 w-px bg-slate-200 hidden sm:block" />
          <div className="flex flex-col">
            <span className="font-extrabold tracking-wider text-sm text-[#047D78]">
              DASHBOARD GEMPA BUMI - PROV. NTT
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 max-w-[480px] truncate">
              Analisis spasial kejadian bencana dan dampaknya terhadap sumber daya kesehatan di wilayah PROV. NUSA TENGGARA TIMUR.
            </span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-200">
          <span className="text-[10px] text-[#047D78] font-extrabold uppercase tracking-wider">Pemantauan Wilayah:</span>
          <span className="text-xs font-black text-[#047D78] bg-teal-50 border border-teal-300 px-2.5 py-0.5 rounded-xl truncate max-w-[280px]">
            PROV. NTT (8 KABUPATEN TERDAMPAK)
          </span>
        </div>
      </div>

      {/* ── Middle Live Digital Clock (3 Timezones: WIB, WITA, WIT without icon) ── */}
      <div className="pointer-events-auto hidden md:flex items-center gap-3 bg-white/95 backdrop-blur-xl border border-[#bedbda] rounded-2xl px-4 py-1.5 shadow-[0_8px_24px_rgba(4,125,120,0.09)] text-slate-800">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 font-mono text-sm sm:text-base font-black tracking-wider text-[#047D78]">
            <span>{wibStr || '--:--:-- WIB'}</span>
            <span className="text-slate-300 font-normal">•</span>
            <span>{witaStr || '--:--:-- WITA'}</span>
            <span className="text-slate-300 font-normal">•</span>
            <span>{witStr || '--:--:-- WIT'}</span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 mt-0.5">
            {dateStr || 'Memuat waktu...'}
          </span>
        </div>
      </div>

      {/* ── Right Quick Controls Deck ── */}
      <div className="pointer-events-auto flex items-center gap-2 bg-white/95 backdrop-blur-xl border border-[#bedbda] rounded-2xl p-1.5 shadow-[0_8px_24px_rgba(4,125,120,0.09)] text-slate-800">

        {/* Tombol Notifikasi Peringatan Dini BMKG */}
        <button
          type="button"
          onClick={onToggleAlerts}
          className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition-all shadow-xs cursor-pointer ${
            isAlertsOpen
              ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20 ring-2 ring-rose-300'
              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 hover:border-rose-300'
          }`}
          title="Buka / Tutup Notifikasi Peringatan Dini BMKG"
        >
          <div className="relative flex items-center justify-center">
            <BellRing className={`h-3.5 w-3.5 ${isAlertsOpen ? 'text-white' : 'text-rose-600'}`} />
            {alertsCount > 0 && !isAlertsOpen && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
              </span>
            )}
          </div>
          <span className="hidden lg:inline">Peringatan Dini</span>
          {alertsCount > 0 && (
            <span
              className={`flex items-center justify-center h-4 min-w-[18px] px-1 text-[9.5px] font-black rounded-full shadow-2xs ${
                isAlertsOpen ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
              }`}
            >
              {alertsCount}
            </span>
          )}
        </button>

        {/* Pengaturan Peta Drawer Toggle */}
        <button
          type="button"
          onClick={onToggleLayers}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition-all shadow-xs cursor-pointer ${
            isLayersOpen
              ? 'bg-[#047D78] text-white border-[#047D78] shadow-md shadow-[#047D78]/20'
              : 'bg-teal-50 hover:bg-teal-100 text-[#047D78] border-teal-200'
          }`}
          title="Buka / Tutup Pengaturan Peta"
        >
          <Layers className={`h-3.5 w-3.5 ${isLayersOpen ? 'text-white' : 'text-[#047D78]'}`} />
          <span className="hidden lg:inline">Pengaturan Peta</span>
        </button>

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center justify-center h-8 w-8 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-[#047D78] transition-all shadow-xs"
          title={isFullscreen ? 'Keluar Fullscreen (Esc)' : 'Tampilan Layar Penuh (F11)'}
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
      </div>
    </header>
  )
}
