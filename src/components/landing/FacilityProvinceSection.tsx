'use client'

import { useState, useRef, useEffect, type ComponentType } from 'react'
import Link from 'next/link'
import { Building2, HeartPulse, Stethoscope } from 'lucide-react'

export type FacilityKey = 'rumahSakit' | 'puskesmas' | 'posyandu'
type FacilityFocus = FacilityKey | 'all'

type ProvinceRow = {
  name: string
  rumahSakit: number
  puskesmas: number
  posyandu: number
}

const rows: ProvinceRow[] = [
  { name: 'DKI Jakarta', rumahSakit: 52, puskesmas: 26, posyandu: 89 },
  { name: 'Jawa Barat',  rumahSakit: 82, puskesmas: 16, posyandu: 79 },
  { name: 'Jawa Tengah', rumahSakit: 42, puskesmas: 24, posyandu: 91 },
  { name: 'Jawa Timur',  rumahSakit: 54, puskesmas: 26, posyandu: 76 },
  { name: 'Banten',      rumahSakit: 33, puskesmas: 30, posyandu: 75 },
]

const FACILITY_KEYS: FacilityKey[] = ['rumahSakit', 'puskesmas', 'posyandu']

const FACILITY_META: Record<FacilityKey, { label: string; color: string }> = {
  rumahSakit: { label: 'Rumah Sakit', color: '#2db9bb' },
  puskesmas:  { label: 'Puskesmas',   color: '#0b7b86' },
  posyandu:   { label: 'Posyandu',    color: '#5c9bd5' },
}
const FACILITY_ICON: Record<FacilityKey, ComponentType<{ className?: string }>> = {
  rumahSakit: Building2,
  puskesmas: Stethoscope,
  posyandu: HeartPulse,
}

type TooltipState = {
  visible: boolean
  x: number
  y: number
  province: string
  key: FacilityKey
  value: number
  pct: number
}

export default function FacilityProvinceSection({
  activeFacility = 'all',
  title = 'Sebaran Fasilitas Kesehatan per Provinsi',
  description = 'Menampilkan pemetaan distribusi dan jumlah fasilitas kesehatan yang tersebar di setiap provinsi.',
}: {
  activeFacility?: FacilityFocus
  title?: string
  description?: string
}) {
  const [activeKeys, setActiveKeys] = useState<Set<FacilityKey>>(() =>
    activeFacility === 'all' ? new Set(FACILITY_KEYS) : new Set([activeFacility])
  )
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, province: '', key: 'rumahSakit', value: 0, pct: 0,
  })
  const [panel, setPanel] = useState<{ visible: boolean; province: ProvinceRow | null }>({
    visible: false, province: null,
  })
  const [mounted] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanel({ visible: false, province: null })
      }
    }
    if (panel.visible) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [panel.visible])

  function toggleKey(key: FacilityKey) {
    setActiveKeys(prev => {
      if (prev.size === FACILITY_KEYS.length) return new Set([key])
      if (prev.has(key) && prev.size === 1) return new Set(FACILITY_KEYS)
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      if (next.size === 0) return new Set(FACILITY_KEYS)
      return next
    })
  }

  const allActive = activeKeys.size === FACILITY_KEYS.length

  // Max total among all rows for currently active keys — determines longest bar
  const maxVisTotal = Math.max(
    ...rows.map(row =>
      FACILITY_KEYS.filter(k => activeKeys.has(k)).reduce((s, k) => s + row[k], 0)
    )
  )

  return (
    <section className="w-full bg-[#f4f7fb] pb-6">
      <div className="w-full px-4 sm:px-5 lg:px-6">

        {/* Floating tooltip */}
        {tooltip.visible && (
          <div
            className="pointer-events-none fixed z-50 rounded-xl border border-[#d7eaea] bg-white px-3 py-2 text-[12px] leading-relaxed shadow-md"
            style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
          >
            <p className="font-semibold text-[#2f2f2f]">{tooltip.province}</p>
            <p className="text-[#4b4b4b]">
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: FACILITY_META[tooltip.key].color }}
              />
              {FACILITY_META[tooltip.key].label}: <strong>{tooltip.value}</strong> ({tooltip.pct}%)
            </p>
          </div>
        )}

        {/* Detail modal */}
        {panel.visible && panel.province && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
            <div
              ref={panelRef}
              className="mx-4 w-full max-w-sm rounded-[22px] border border-[#d7eaea] bg-white p-6 shadow-2xl"
              style={{ animation: 'panelIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both' }}
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#8aabab]">Total Fasilitas</p>
                  <h4 className="text-[22px] font-bold text-[#2f2f2f]">{panel.province.name}</h4>
                </div>
                <button
                  onClick={() => setPanel({ visible: false, province: null })}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eff7f7] text-[#3a5050] transition hover:bg-[#d7eaea]"
                  aria-label="Tutup"
                >
                  ✕
                </button>
              </div>

              <div className="mb-5 flex items-center justify-center rounded-[14px] bg-[#eff7f7] py-4">
                <div className="text-center">
                  <p className="text-[13px] text-[#8aabab]">Total Keseluruhan</p>
                  <p className="text-[40px] font-bold leading-none text-[#0b7b86]">
                    {FACILITY_KEYS.reduce((s, k) => s + panel.province![k], 0)}
                  </p>
                  <p className="text-[12px] text-[#8aabab]">fasilitas kesehatan</p>
                </div>
              </div>

              <div className="space-y-3">
                {FACILITY_KEYS.map(k => {
                  const val = panel.province![k]
                  const total = FACILITY_KEYS.reduce((s, kk) => s + panel.province![kk], 0)
                  const pct = Math.round((val / total) * 100)
                  return (
                    <div key={k}>
                      <div className="mb-1 flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-2 text-[#3a4040]">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FACILITY_META[k].color }} />
                          {FACILITY_META[k].label}
                        </span>
                        <span className="font-semibold text-[#2f2f2f]">
                          {val} <span className="font-normal text-[#8aabab]">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#eff7f7]">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: mounted ? `${pct}%` : '0%',
                            backgroundColor: FACILITY_META[k].color,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes panelIn {
            from { opacity: 0; transform: scale(0.9) translateY(10px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        <article className="rounded-[22px] border border-[#d7eaea] bg-white px-5 py-5 shadow-[0_10px_30px_rgba(14,119,117,0.05)] sm:px-6 sm:py-6">
          {/* Header + legend */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-[20px] font-bold uppercase leading-tight text-[#2f2f2f] sm:text-[24px]">
                {title}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[#4b4b4b] sm:text-[14px]">
               {description}
              </p>

            </div>

            <div className="flex flex-wrap items-center gap-2 lg:pt-1">
              {FACILITY_KEYS.map(k => {
                const isActive = activeKeys.has(k)
                const isDimmed = !allActive && !isActive
                return (
                  <button
                    key={k}
                    onClick={() => toggleKey(k)}
                    className="flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all duration-200"
                    style={{
                      borderColor: isActive || allActive ? FACILITY_META[k].color : '#d7eaea',
                      backgroundColor: isActive && !allActive ? `${FACILITY_META[k].color}18` : '#ffffff',
                      color: isActive && !allActive ? '#2e4444' : '#4a6060',
                      opacity: isDimmed ? 0.4 : 1,
                    }}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${FACILITY_META[k].color}22`, color: FACILITY_META[k].color }}
                    >
                      {(() => {
                        const Icon = FACILITY_ICON[k]
                        return <Icon className="h-3 w-3" />
                      })()}
                    </span>
                    {FACILITY_META[k].label.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Chart rows */}
          <div className="mt-6 space-y-3">
            {rows.map(row => {
              const visKeys = FACILITY_KEYS.filter(k => activeKeys.has(k))
              const visTotal = visKeys.reduce((s, k) => s + row[k], 0)
              // Bar width is proportional to the row with the highest total
              const barWidthPct = maxVisTotal > 0 ? (visTotal / maxVisTotal) * 100 : 0

              return (
                <div
                  key={row.name}
                  className="group grid cursor-pointer grid-cols-[120px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[140px_minmax(0,1fr)]"
                  onClick={() => setPanel({ visible: true, province: row })}
                >
                  {/* Province name */}
                  <div className="text-[13px] text-[#3a4040] transition-colors group-hover:text-[#0b7b86] sm:text-[14px]">
                    {row.name}
                  </div>

                  {/* Track (full width, grey) — bar inside is proportional */}
                  <div className="relative h-10 rounded-[10px] bg-[#eff7f7] p-1">
                    {/* Proportional bar */}
                    <div
                      className="flex h-full overflow-hidden rounded-[7px] transition-[width] duration-[650ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                      style={{ width: mounted ? `${barWidthPct}%` : '0%' }}
                    >
                      {visKeys.map((k, ki) => {
                        const segPct = visTotal > 0 ? (row[k] / visTotal) * 100 : 0
                        const isFirst = ki === 0
                        const isLast  = ki === visKeys.length - 1
                        return (
                          <div
                            key={k}
                            className="flex items-center justify-center overflow-hidden whitespace-nowrap text-[11px] font-medium text-white transition-[flex] duration-[650ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:brightness-110"
                            style={{
                              flex: segPct,
                              minWidth: segPct > 12 ? 26 : 0,
                              backgroundColor: FACILITY_META[k].color,
                              borderTopLeftRadius:     isFirst ? 6 : 0,
                              borderBottomLeftRadius:  isFirst ? 6 : 0,
                              borderTopRightRadius:    isLast  ? 6 : 0,
                              borderBottomRightRadius: isLast  ? 6 : 0,
                            }}
                            onMouseEnter={e => {
                              e.stopPropagation()
                              const pct = Math.round((row[k] / visTotal) * 100)
                              setTooltip({ visible: true, x: e.clientX, y: e.clientY, province: row.name, key: k, value: row[k], pct })
                            }}
                            onMouseMove={e => { e.stopPropagation(); setTooltip(p => ({ ...p, x: e.clientX, y: e.clientY })) }}
                            onMouseLeave={e => { e.stopPropagation(); setTooltip(p => ({ ...p, visible: false })) }}
                            onClick={e => e.stopPropagation()}
                          >
                            {segPct > 12 ? row[k] : ''}
                          </div>
                        )
                      })}
                    </div>

                    {/* Total count shown at end of bar */}
                    <span
                      className="pointer-events-none absolute top-1/2 -translate-y-1/2 pl-1.5 text-[11px] font-medium text-[#6a9090] transition-[left] duration-[650ms]"
                      style={{ left: `calc(${barWidthPct}% - 4px)` }}
                    >
                      {visTotal}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-5 flex justify-end">
            <Link href="#" className="text-[14px] text-[#3a4040] underline underline-offset-4 hover:text-[#0f8f96]">
              Selengkapnya
            </Link>
          </div>
        </article>
      </div>
    </section>
  )
}
