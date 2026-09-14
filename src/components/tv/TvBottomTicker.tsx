'use client'

import React from 'react'
import {
  Flame,
  Activity,
  PhoneCall,
  ShieldAlert,
  Radio,
} from 'lucide-react'

interface MarkerItem {
  id?: string
  kode_trans?: string
  tgl_kejadian?: string
  jenis_bencana?: string
  provinsi?: string
  kabupaten?: string
  total_korban?: number
  meninggal?: number
  luka?: number
}

interface BmkgGempa {
  Wilayah?: string
  Magnitude?: string
  Kedalaman?: string
  Jam?: string
  Potensi?: string
  wilayah?: string
  magnitude?: string
  kedalaman?: string
  potensi?: string
  jam?: string
}

interface TvBottomTickerProps {
  markers: MarkerItem[]
  bmkgLatest?: BmkgGempa | null
  summaryTotal?: number
}

export default function TvBottomTicker({
  markers = [],
  bmkgLatest,
  summaryTotal = 0,
}: TvBottomTickerProps) {
  // Build ticker items array
  const tickerItems: Array<{ icon: any; color: string; text: string }> = []

  if (bmkgLatest) {
    const mag = bmkgLatest.Magnitude || bmkgLatest.magnitude || ''
    const wil = bmkgLatest.Wilayah || bmkgLatest.wilayah || ''
    const ked = bmkgLatest.Kedalaman || bmkgLatest.kedalaman || ''
    const pot = bmkgLatest.Potensi || bmkgLatest.potensi || ''

    if (mag && wil) {
      tickerItems.push({
        icon: Activity,
        color: 'text-amber-600',
        text: `GEMPA TERKINI BMKG: M ${mag} • ${wil} ${ked ? `(Kedalaman: ${ked})` : ''} ${pot ? `• ${pot}` : ''}`,
      })
    }
  }

  tickerItems.push({
    icon: ShieldAlert,
    color: 'text-[#047D78]',
    text: `PUSAT KRISIS KESEHATAN KEMENKES RI: Siaga Bencana 24 Jam Aktif • Total ${summaryTotal.toLocaleString('id-ID')} Kejadian Terpantau Nasional`,
  })

  // Recent 5 markers
  markers.slice(0, 5).forEach((m) => {
    const loc = [m.kabupaten, m.provinsi].filter(Boolean).join(', ')
    tickerItems.push({
      icon: Flame,
      color: 'text-orange-600',
      text: `UPDATE BENCANA: ${m.jenis_bencana} di ${loc || 'Wilayah Indonesia'} ${
        (m.total_korban ?? 0) > 0 ? `(${m.total_korban} Korban Terdampak)` : ''
      }`,
    })
  })

  tickerItems.push({
    icon: PhoneCall,
    color: 'text-emerald-700',
    text: `CALL CENTER EOC PUSAT KRISIS KESEHATAN: 08111-222-333 / (021) 5265043 • SIAP MERESPON KRISIS KESEHATAN 24/7`,
  })

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 h-10 bg-white/95 backdrop-blur-xl border-t border-[#bedbda] flex items-center shadow-[0_-4px_20px_rgba(4,125,120,0.06)] text-slate-800 overflow-hidden pointer-events-auto">
      {/* ── Left Indicator Badge ── */}
      <div className="flex items-center gap-2 px-3.5 h-full bg-[#047D78] text-white font-black text-[10px] tracking-wider uppercase shrink-0 shadow-md z-10">
        <Radio className="h-3 w-3 animate-pulse text-teal-200" />
        <span>EOC ALERT STREAM</span>
      </div>

      {/* ── Continuous Marquee Ticker ── */}
      <div className="flex-1 overflow-hidden relative group">
        <div className="flex whitespace-nowrap animate-marquee group-hover:[animation-play-state:paused]">
          {/* Double array for seamless loop */}
          {[...tickerItems, ...tickerItems].map((item, idx) => {
            const IconComponent = item.icon
            return (
              <div key={idx} className="flex items-center gap-2 mx-6 text-xs font-bold text-slate-700">
                <IconComponent className={`h-3.5 w-3.5 ${item.color} shrink-0`} />
                <span>{item.text}</span>
                <span className="text-slate-300 font-black ml-4">•</span>
              </div>
            )
          })}
        </div>
      </div>
    </footer>
  )
}
