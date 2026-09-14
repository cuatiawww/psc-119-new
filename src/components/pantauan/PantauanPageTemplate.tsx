'use client'

import { useEffect } from 'react'
import { Loader2, RefreshCw, ExternalLink } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useHeaderStore } from '@/lib/headerStore'

// ─── Stat Widget ─────────────────────────────────────────────────────────────

interface PantauanStatWidgetProps {
  icon: LucideIcon
  iconBg: string   // Tailwind bg + text classes e.g. 'bg-red-100 text-red-600'
  label: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
}

export function PantauanStatWidget({
  icon: Icon,
  iconBg,
  label,
  value,
  sub,
  trend,
  trendLabel,
}: PantauanStatWidgetProps) {
  const trendColor =
    trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-emerald-500' : 'text-slate-400'

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && trendLabel && (
          <span className={`text-xs font-semibold ${trendColor}`}>{trendLabel}</span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-800 leading-tight">
        {typeof value === 'number' ? value.toLocaleString('id-ID') : value}
      </p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}

// ─── Page Template ────────────────────────────────────────────────────────────

interface PantauanPageTemplateProps {
  /** Judul halaman (e.g. "Pantauan BNPB") */
  title: string
  /** Deskripsi singkat */
  description?: string
  /** Nama sumber data */
  sourceLabel?: string
  /** URL sumber data */
  sourceUrl?: string
  /** Ikon untuk header section */
  icon?: LucideIcon
  /** Warna tema ikon header */
  iconBg?: string
  /** Kapan data terakhir diperbarui */
  lastUpdated?: string
  /** Fungsi refresh */
  onRefresh?: () => void
  /** Status loading global */
  loading?: boolean
  /** Pesan error global */
  error?: string | null
  /** Widget statistik (array of JSX) */
  statWidgets?: React.ReactNode
  /** Konten peta (Leaflet / embed) */
  mapContent?: React.ReactNode
  /** Konten bawah (chart, tabel, dsb) */
  bottomContent?: React.ReactNode
  /** Konten samping kanan peta */
  sideContent?: React.ReactNode
}

export default function PantauanPageTemplate({
  title,
  description,
  sourceLabel,
  sourceUrl,
  icon: Icon,
  iconBg = 'bg-teal-100 text-teal-700',
  lastUpdated,
  onRefresh,
  loading = false,
  error = null,
  statWidgets,
  mapContent,
  bottomContent,
  sideContent,
}: PantauanPageTemplateProps) {
  const { setHeader, resetHeader } = useHeaderStore()

  useEffect(() => {
    setHeader({
      title,
      description,
      lastUpdated,
      sourceLabel,
      sourceUrl,
    })
    return () => resetHeader()
  }, [title, description, lastUpdated, sourceLabel, sourceUrl, setHeader, resetHeader])

  return (
    <div className="min-h-screen bg-[#f0f7f7] pt-6 pb-10">
      {/* ── Main Content ── */}
      <div className="w-full px-6 py-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Action Bar */}
        {onRefresh && (
          <div className="flex justify-end">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>
        )}

        {/* Stat Widgets Row */}
        {statWidgets && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {statWidgets}
          </div>
        )}

        {/* Map + Side Panel */}
        {(mapContent || sideContent) && (
          <div className={`grid gap-5 ${sideContent ? 'lg:grid-cols-[1fr_320px]' : 'grid-cols-1'}`}>
            {/* Map */}
            {mapContent && (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {loading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-2xl">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                  </div>
                )}
                {mapContent}
              </div>
            )}

            {/* Side Content */}
            {sideContent && (
              <div className="space-y-4">{sideContent}</div>
            )}
          </div>
        )}

        {/* Bottom Content (charts, tables, feeds) */}
        {bottomContent && (
          <div>{bottomContent}</div>
        )}
      </div>
    </div>
  )
}
