'use client'

import React, { useState } from 'react'
import {
  Flame,
  Skull,
  HeartPulse,
  HelpCircle,
  Users,
  ShieldAlert,
  Hospital,
  ChevronUp,
  ChevronDown,
  TrendingUp,
} from 'lucide-react'

interface SummaryData {
  total_bencana: number
  total_krisis?: number
  total_meninggal: number
  total_luka: number
  total_hilang: number
  total_pengungsi: number
  total_terdampak: number
}

interface TvKpiCardsProps {
  summary: SummaryData
  isLoading?: boolean
  selectedPeriodLabel?: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export default function TvKpiCards({
  summary,
  isLoading = false,
  selectedPeriodLabel = 'Tahun Ini (Nasional)',
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}: TvKpiCardsProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed
  const handleToggle = onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed))

  const formatNum = (n?: number) => (n ?? 0).toLocaleString('id-ID')

  const cards = [
    {
      id: 'meninggal',
      label: 'KORBAN MENINGGAL',
      value: summary.total_meninggal,
      unit: 'Jiwa',
      icon: Skull,
      color: 'text-red-600',
      iconBg: 'bg-red-50 text-red-600 border-red-200',
      badgeBg: 'bg-red-50 text-red-700 border-red-200',
      tag: 'Korban Jiwa',
      pulse: summary.total_meninggal > 0,
    },
    {
      id: 'luka',
      label: 'LUKA-LUKA',
      value: summary.total_luka,
      unit: 'Jiwa',
      icon: HeartPulse,
      color: 'text-amber-600',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      tag: 'Rawat Inap/Jalan',
    },
    {
      id: 'pengungsi',
      label: 'PENGUNGSI',
      value: summary.total_pengungsi,
      unit: 'Jiwa',
      icon: Users,
      color: 'text-sky-600',
      iconBg: 'bg-sky-50 text-sky-600 border-sky-200',
      badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
      tag: 'Titik Pengungsi',
    },
    {
      id: 'terdampak',
      label: 'POPULASI TERDAMPAK',
      value: summary.total_terdampak,
      unit: 'Jiwa',
      icon: ShieldAlert,
      color: 'text-teal-800',
      iconBg: 'bg-teal-50 text-teal-800 border-teal-200',
      badgeBg: 'bg-teal-50 text-teal-800 border-teal-200',
      tag: 'Populasi Krisis',
    },
  ]

  return (
    <div className="fixed top-[56px] sm:top-[60px] 2xl:top-[64px] left-2 right-2 sm:left-3 sm:right-3 z-35 pointer-events-none transition-all duration-300">
      <div className="max-w-[1680px] mx-auto flex flex-col items-center">
        {/* Toggle Collapse Button */}
        <button
          type="button"
          onClick={handleToggle}
          className="pointer-events-auto mb-1 flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/95 hover:bg-slate-50 border border-[#bedbda] text-[9.5px] font-extrabold text-slate-700 hover:text-teal-800 shadow-sm transition-all cursor-pointer"
        >
          <span>{isCollapsed ? 'TAMPILKAN RINGKASAN KPI' : 'SEMBUNYIKAN KPI'}</span>
          {isCollapsed ? <ChevronDown className="h-3 w-3 text-teal-600" /> : <ChevronUp className="h-3 w-3 text-teal-600" />}
        </button>

        {!isCollapsed && (
          <div className="pointer-events-auto grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2 w-full animate-in fade-in slide-in-from-top-2 duration-200">
            {cards.map((card) => {
              const IconComponent = card.icon
              return (
                <div
                  key={card.id}
                  className="relative overflow-hidden rounded-xl bg-white/95 backdrop-blur-xl border border-[#bedbda] p-2 sm:p-2.5 shadow-[0_4px_14px_rgba(20,120,116,0.06)] hover:shadow-[0_6px_20px_rgba(20,120,116,0.12)] hover:border-teal-400 transition-all duration-200 hover:scale-[1.01] text-slate-800"
                >
                  <div className="relative z-10 flex flex-col justify-between h-full gap-1 sm:gap-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`p-1 rounded-lg border ${card.iconBg}`}>
                          <IconComponent className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </div>
                        <span className="text-[9px] sm:text-[9.5px] 2xl:text-[10px] font-black tracking-wider text-slate-600 uppercase truncate">
                          {card.label}
                        </span>
                      </div>

                      {card.pulse && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between gap-1">
                      <span className={`font-mono text-base sm:text-lg 2xl:text-xl font-black tracking-tight ${card.color}`}>
                        {isLoading ? (
                          <span className="animate-pulse opacity-50">...</span>
                        ) : (
                          formatNum(card.value)
                        )}
                      </span>
                      <span className="text-[9px] font-bold text-slate-500">
                        {card.unit}
                      </span>
                    </div>

                    <div className="pt-1 border-t border-slate-100">
                      <span className="text-[8.5px] sm:text-[9px] font-bold text-slate-500 truncate block">
                        {card.tag}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
