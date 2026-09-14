'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Globe, MapPin, Building2, ChevronDown, Calendar, CheckCircle2, Check, Clock, CalendarDays, SlidersHorizontal } from 'lucide-react'
import { useAuthStore, type WilayahScope } from '@/lib/authStore'
import { buildRegionsUrl } from '@/lib/utils/api'

type FilterItem = {
  id: string
  icon: 'globe' | 'pin' | 'building' | 'calendar'
  sublabel: string
  defaultValue: string
  options: Array<{ value: string; label: string }>
  locked?: boolean
}

export type FilterSummary = {
  cakupan: string
  provinsi: string
  kabkota: string
  tahun: string
  startDate?: string
  endDate?: string
}

type FilterDropdownBarProps = {
  onSummaryChange?: (summary: FilterSummary) => void
  selectedProvinceName?: string | null
  selectedKabupatenName?: string | null
}

type RegionOption = {
  id?: string | number
  code?: string | number
  name: string
}

const iconStyles: Record<FilterItem['icon'], { bg: string; color: string }> = {
  globe: { bg: 'bg-[#E1F5EE]', color: 'text-[#0F6E56]' },
  pin: { bg: 'bg-[#E6F1FB]', color: 'text-[#185FA5]' },
  building: { bg: 'bg-[#EEEDFE]', color: 'text-[#534AB7]' },
  calendar: { bg: 'bg-[#FDF2F8]', color: 'text-[#DB2777]' },
}

function FilterIcon({ icon, className }: { icon: FilterItem['icon']; className?: string }) {
  if (icon === 'globe') return <Globe className={className} />
  if (icon === 'pin') return <MapPin className={className} />
  if (icon === 'building') return <Building2 className={className} />
  return <Calendar className={className} />
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const SCOPED_MODES: WilayahScope['mode'][] = ['provinsi', 'kabupaten']

function hasValidScopedMode(scope?: WilayahScope): scope is WilayahScope {
  return !!scope && SCOPED_MODES.includes(scope.mode)
}

const MONTH_NAMES = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
]

export default function FilterDropdownBar({ onSummaryChange, selectedProvinceName, selectedKabupatenName }: FilterDropdownBarProps = {}) {
  const userScope = useAuthStore((state) => state.user?.wilayah_scope)
  const isScoped = hasValidScopedMode(userScope)

  const [dynamicProvinces, setDynamicProvinces] = useState<Array<{ value: string; label: string }>>([
    { value: 'semua-provinsi', label: 'Semua Provinsi' },
  ])
  const [dynamicKabkota, setDynamicKabkota] = useState<Array<{ value: string; label: string }>>([
    { value: 'semua-kabkota', label: 'Semua Kab/Kota' },
  ])

  const [loadingProvinces, setLoadingProvinces] = useState(true)
  const [loadingKabkota, setLoadingKabkota] = useState(false)

  // Time Filter Detailed States (2-Column Tabbed Layout)
  const [timeCategoryTab, setTimeCategoryTab] = useState<'tahun' | 'bulan' | 'hari' | 'custom'>('tahun')
  const [selectedYear, setSelectedYear] = useState('2026')
  const [selectedMonth, setSelectedMonth] = useState('7')
  const [selectedMonthYear, setSelectedMonthYear] = useState('2026')
  const [selectedDayPreset, setSelectedDayPreset] = useState('30-hari')
  const [customStartDate, setCustomStartDate] = useState('2026-01-01')
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0])

  const [availableYears, setAvailableYears] = useState<string[]>(['2026', '2025', '2024', '2023', '2022', '2021', '2020'])

  const activeFilterData = useMemo<FilterItem[]>(() => {
    let result: FilterItem[] = []
    if (!isScoped) {
      result = [
        {
          id: 'cakupan',
          icon: 'globe',
          sublabel: 'Cakupan',
          defaultValue: 'nasional',
          options: [
            { value: 'nasional', label: 'Nasional' },
            { value: 'provinsi', label: 'Provinsi' },
            { value: 'kabupaten-kota', label: 'Kabupaten/Kota' },
          ],
        },
        {
          id: 'provinsi',
          icon: 'pin',
          sublabel: 'Provinsi',
          defaultValue: 'semua-provinsi',
          options: loadingProvinces
            ? [{ value: 'semua-provinsi', label: 'Memuat...' }]
            : dynamicProvinces,
        },
        {
          id: 'kabkota',
          icon: 'building',
          sublabel: 'Kab/Kota',
          defaultValue: 'semua-kabkota',
          options: loadingKabkota
            ? [{ value: 'semua-kabkota', label: 'Memuat...' }]
            : dynamicKabkota,
        },
        {
          id: 'tahun',
          icon: 'calendar',
          sublabel: 'Rentang Waktu',
          defaultValue: '2026',
          options: [],
        },
      ]
    } else {
      const scope = userScope as WilayahScope

      const cakupanValue = scope.cakupan.value || scope.mode
      const provinsiValue = scope.provinsi.id ? String(scope.provinsi.id) : slugify(scope.provinsi.label)
      const kabupatenValue = scope.kabupaten.id ? String(scope.kabupaten.id) : slugify(scope.kabupaten.label)
      const kabupatenOptions =
        scope.mode === 'kabupaten'
          ? [
            {
              value: kabupatenValue,
              label: scope.kabupaten.label,
            },
          ]
          : [
            { value: 'semua-kabkota', label: 'Semua Kab/Kota' },
            ...(scope.kabupaten.options || []).map((item) => ({
              value: String(item.id),
              label: item.label,
            })),
          ]

      result = [
        {
          id: 'cakupan',
          icon: 'globe',
          sublabel: 'Cakupan',
          defaultValue: cakupanValue,
          locked: scope.cakupan.locked,
          options: [{ value: cakupanValue, label: scope.cakupan.label }],
        },
        {
          id: 'provinsi',
          icon: 'pin',
          sublabel: 'Provinsi',
          defaultValue: provinsiValue,
          locked: scope.provinsi.locked,
          options: [{ value: provinsiValue, label: scope.provinsi.label }],
        },
        {
          id: 'kabkota',
          icon: 'building',
          sublabel: 'Kab/Kota',
          defaultValue: scope.mode === 'kabupaten' ? kabupatenValue : 'semua-kabkota',
          locked: scope.kabupaten.locked,
          options: kabupatenOptions,
        },
        {
          id: 'tahun',
          icon: 'calendar',
          sublabel: 'Rentang Waktu',
          defaultValue: '2026',
          options: [],
        },
      ]
    }

    return result.map(item => ({
      ...item,
      options: item.options.map(opt => ({
        ...opt,
        label: opt.label.toUpperCase()
      }))
    }))
  }, [isScoped, userScope, dynamicProvinces, dynamicKabkota, loadingProvinces, loadingKabkota])

  const defaultSelected = useMemo(() => {
    if (!isScoped) {
      return {
        cakupan: 'nasional',
        provinsi: 'semua-provinsi',
        kabkota: 'semua-kabkota',
        tahun: '2026',
      }
    }
    const scope = userScope as WilayahScope
    const cakupanValue = scope.cakupan.value || scope.mode
    const provinsiValue = scope.provinsi.id ? String(scope.provinsi.id) : slugify(scope.provinsi.label)
    const kabupatenValue = scope.mode === 'kabupaten'
      ? (scope.kabupaten.id ? String(scope.kabupaten.id) : slugify(scope.kabupaten.label))
      : 'semua-kabkota'
    return {
      cakupan: cakupanValue,
      provinsi: provinsiValue,
      kabkota: kabupatenValue,
      tahun: '2026',
    }
  }, [isScoped, userScope])

  const [selected, setSelected] = useState<Record<string, string>>(defaultSelected)
  const [openId, setOpenId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const lastProvinceNameRef = useRef<string | null | undefined>(undefined)
  const lastKabupatenNameRef = useRef<string | null | undefined>(undefined)

  const defaultSelectedStr = JSON.stringify(defaultSelected)
  useEffect(() => {
    const parsed = JSON.parse(defaultSelectedStr)
    setSelected(parsed)
    setOpenId(null)
  }, [defaultSelectedStr])

  // Synchronize external selectedProvinceName & selectedKabupatenName changes
  useEffect(() => {
    if (lastProvinceNameRef.current === undefined || lastKabupatenNameRef.current === undefined) {
      lastProvinceNameRef.current = selectedProvinceName
      lastKabupatenNameRef.current = selectedKabupatenName
      return
    }

    if (selectedProvinceName !== lastProvinceNameRef.current || selectedKabupatenName !== lastKabupatenNameRef.current) {
      lastProvinceNameRef.current = selectedProvinceName
      lastKabupatenNameRef.current = selectedKabupatenName

      if (selectedProvinceName) {
        const cleanProv = selectedProvinceName.toUpperCase().trim()
        const foundProv = dynamicProvinces.find(
          (p) => p.label.toUpperCase().trim() === cleanProv
        )

        if (foundProv) {
          const nextProv = foundProv.value

          if (selectedKabupatenName) {
            const cleanKab = selectedKabupatenName.toUpperCase().trim()
            const foundKab = dynamicKabkota.find(
              (k) => k.label.toUpperCase().trim() === cleanKab
            )

            if (foundKab) {
              setSelected({
                cakupan: 'kabupaten-kota',
                provinsi: nextProv,
                kabkota: foundKab.value,
                tahun: selected.tahun || '2026',
              })
            } else {
              setSelected((prev) => ({
                ...prev,
                cakupan: 'kabupaten-kota',
                provinsi: nextProv,
                kabkota: 'semua-kabkota',
              }))
            }
          } else {
            setSelected({
              cakupan: 'provinsi',
              provinsi: nextProv,
              kabkota: 'semua-kabkota',
              tahun: selected.tahun || '2026',
            })
          }
        }
      } else {
        setSelected({
          cakupan: 'nasional',
          provinsi: 'semua-provinsi',
          kabkota: 'semua-kabkota',
          tahun: selected.tahun || '2026',
        })
      }
    }
  }, [dynamicKabkota, dynamicProvinces, selectedKabupatenName, selectedProvinceName, selected.tahun])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch provinsi dari API backend
  useEffect(() => {
    if (isScoped) return

    const fetchProvinces = async () => {
      setLoadingProvinces(true)
      try {
        const res = await fetch(buildRegionsUrl())
        const contentType = res.headers.get('content-type') || ''

        if (!res.ok || !contentType.includes('application/json')) {
          throw new Error(`Unexpected response while loading provinces: ${res.status}`)
        }

        const payload = await res.json()
        if (payload?.success && Array.isArray(payload?.data)) {
          const list = [
            { value: 'semua-provinsi', label: 'Semua Provinsi' },
            ...payload.data.map((item: RegionOption) => ({
              value: String(item.code || item.id),
              label: item.name,
            })),
          ]
          setDynamicProvinces(list)
        } else {
          setDynamicProvinces([{ value: 'semua-provinsi', label: 'Semua Provinsi' }])
        }
      } catch (err) {
        console.error('Gagal mengambil data provinsi', err)
        setDynamicProvinces([{ value: 'semua-provinsi', label: 'Semua Provinsi' }])
      } finally {
        setLoadingProvinces(false)
      }
    }
    fetchProvinces()
  }, [isScoped])

  const selectedProvince = selected['provinsi']

  // Fetch kab/kota cascade
  useEffect(() => {
    if (isScoped) return

    if (!selectedProvince || selectedProvince === 'semua-provinsi') {
      setDynamicKabkota([{ value: 'semua-kabkota', label: 'Semua Kab/Kota' }])
      setLoadingKabkota(false)
      return
    }

    const fetchKabkota = async () => {
      setLoadingKabkota(true)
      try {
        const res = await fetch(buildRegionsUrl({ province_id: selectedProvince }))
        const contentType = res.headers.get('content-type') || ''

        if (!res.ok || !contentType.includes('application/json')) {
          throw new Error(`Unexpected response while loading kabkota: ${res.status}`)
        }

        const payload = await res.json()
        if (payload?.success && Array.isArray(payload?.data)) {
          const list = [
            { value: 'semua-kabkota', label: 'Semua Kab/Kota' },
            ...payload.data.map((item: RegionOption) => ({
              value: String(item.code || item.id),
              label: item.name,
            })),
          ]
          setDynamicKabkota(list)
        } else {
          setDynamicKabkota([{ value: 'semua-kabkota', label: 'Semua Kab/Kota' }])
        }
      } catch (err) {
        console.error('Gagal mengambil data kabupaten/kota', err)
        setDynamicKabkota([{ value: 'semua-kabkota', label: 'Semua Kab/Kota' }])
      } finally {
        setLoadingKabkota(false)
      }
    }
    fetchKabkota()
  }, [selectedProvince, isScoped])

  // Fetch available years from backend API
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const res = await fetch('/api/bencana-years')
        const data = await res.json()
        if (data && data.success && Array.isArray(data.data)) {
          const list = data.data.map((y: any) => String(y))
          if (list.length > 0) {
            setAvailableYears(list)
            
            // Set dynamic defaults based on the loaded years
            const latestYear = list[0]
            if (latestYear) {
              setSelectedYear(latestYear)
              setSelectedMonthYear(latestYear)
              setSelected((prev) => ({
                ...prev,
                tahun: latestYear
              }))
            }
          }
        }
      } catch (err) {
        console.error('Gagal mengambil data tahun bencana:', err)
      }
    }
    fetchYears()
  }, [])

  // Formatted Label for the Time Button
  const timeButtonDisplayLabel = useMemo(() => {
    if (timeCategoryTab === 'tahun') {
      return `TAHUN ${selectedYear}`
    }
    if (timeCategoryTab === 'bulan') {
      const monthObj = MONTH_NAMES.find(m => m.value === selectedMonth)
      return `${(monthObj?.label || 'Juli').toUpperCase()} ${selectedMonthYear}`
    }
    if (timeCategoryTab === 'hari') {
      if (selectedDayPreset === 'hari-ini') return 'HARI INI'
      if (selectedDayPreset === '7-hari') return '7 HARI TERAKHIR'
      return '30 HARI TERAKHIR'
    }
    if (timeCategoryTab === 'custom') {
      return `${customStartDate} S.D ${customEndDate}`
    }
    return `TAHUN ${selectedYear}`
  }, [timeCategoryTab, selectedYear, selectedMonth, selectedMonthYear, selectedDayPreset, customStartDate, customEndDate])

  const summary = useMemo<FilterSummary>(() => {
    const provOpt = dynamicProvinces.find((p) => p.value === selected.provinsi)
    const kabOpt = dynamicKabkota.find((k) => k.value === selected.kabkota)

    return {
      cakupan: selected.cakupan || 'nasional',
      provinsi: provOpt ? provOpt.label : selected.provinsi || 'semua-provinsi',
      kabkota: kabOpt ? kabOpt.label : selected.kabkota || 'semua-kabkota',
      tahun: timeButtonDisplayLabel,
      startDate: timeCategoryTab === 'custom' ? customStartDate : undefined,
      endDate: timeCategoryTab === 'custom' ? customEndDate : undefined,
    }
  }, [dynamicKabkota, dynamicProvinces, selected, timeButtonDisplayLabel, timeCategoryTab, customStartDate, customEndDate])

  const handleApply = () => {
    onSummaryChange?.(summary)
  }

  const isInitialMount = useRef(true)

  // Only trigger on initial mount once
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      onSummaryChange?.(summary)
    }
  }, [onSummaryChange, summary])

  return (
    <div ref={rootRef}>
      {/* Single unified label */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
          Filter Wilayah & Waktu
        </p>
      </div>

      {/* Unified pill bar with TERAPKAN button */}
      <div className="grid grid-cols-2 sm:flex sm:items-center rounded-2xl border border-[#e5e7eb] bg-white p-1 sm:p-1.5 gap-y-1 sm:gap-y-0 shadow-sm">
        {activeFilterData.map((filter, idx) => {
          const activeOption = filter.id === 'tahun'
            ? { label: timeButtonDisplayLabel }
            : (filter.options.find((o) => o.value === selected[filter.id]) ?? filter.options[0])

          const isOpen = openId === filter.id
          const { bg, color } = iconStyles[filter.icon]
          const locked = Boolean(filter.locked)

          return (
            <div
              key={filter.id}
              className={`relative flex items-center w-full sm:flex-1
                ${idx % 2 !== 0 ? 'border-l border-slate-100 sm:border-l-0' : ''}
                ${idx >= 2 ? 'border-t border-slate-100 sm:border-t-0' : ''}
              `}
            >
              {/* Divider between segments on desktop */}
              {idx > 0 && (
                <span className="hidden sm:inline-block h-7 w-px flex-shrink-0 bg-[#e5e7eb]" aria-hidden="true" />
              )}

              <button
                type="button"
                onClick={() => {
                  if (!locked) setOpenId(isOpen ? null : filter.id)
                }}
                disabled={locked}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                title={locked ? 'Filter dikunci sesuai wilayah akun' : undefined}
                className={`
                  group flex w-full items-center gap-2 sm:gap-2.5 rounded-xl px-2.5 py-2.5 sm:px-3.5 sm:py-2
                  transition-colors duration-150
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17b7b2]
                  ${isOpen ? 'bg-[#f3f4f6]' : ''}
                  ${locked ? 'cursor-not-allowed bg-[#f8fafc] opacity-80' : 'hover:bg-[#f9fafb]'}
                `}
              >
                {/* Colored icon badge */}
                <span
                  className={`flex h-6.5 w-6.5 sm:h-7 sm:w-7 flex-shrink-0 items-center justify-center rounded-lg ${bg}`}
                  aria-hidden="true"
                >
                  <FilterIcon icon={filter.icon} className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${color}`} />
                </span>

                {/* Sublabel + value stacked */}
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="text-[9px] sm:text-[10px] font-medium leading-none text-[#9ca3af]">
                    {filter.sublabel}
                  </span>
                  <span className="truncate text-xs sm:text-sm font-semibold leading-none text-[#111827]">
                    {activeOption.label}
                  </span>
                </span>

                <ChevronDown
                  className={`
                    ml-auto h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-[#9ca3af]
                    transition-transform duration-200
                    ${isOpen ? 'rotate-180' : ''}
                    ${locked ? 'opacity-30' : ''}
                  `}
                />
              </button>

              {/* Standard Dropdowns (Cakupan, Provinsi, Kab/Kota) */}
              {isOpen && filter.id !== 'tahun' && (
                <div
                  role="listbox"
                  className={`
                    absolute top-[calc(100%+8px)] z-30 min-w-[200px]
                    overflow-hidden rounded-2xl border border-[#e5e7eb]
                    bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]
                    max-h-[300px] overflow-y-auto scrollbar-thin p-1
                    ${idx % 2 !== 0 ? 'right-0' : 'left-0'}
                  `}
                >
                  {filter.options.map((opt) => {
                    const isSelected = opt.value === selected[filter.id]
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setSelected((prev) => {
                            const next = { ...prev, [filter.id]: opt.value }
                            if (filter.id === 'provinsi') {
                              next['kabkota'] = 'semua-kabkota'
                              if (opt.value === 'semua-provinsi') {
                                next['cakupan'] = 'nasional'
                              } else {
                                next['cakupan'] = 'provinsi'
                              }
                            } else if (filter.id === 'kabkota') {
                              if (opt.value === 'semua-kabkota') {
                                if (prev['provinsi'] === 'semua-provinsi') {
                                  next['cakupan'] = 'nasional'
                                } else {
                                  next['cakupan'] = 'provinsi'
                                }
                              } else {
                                next['cakupan'] = 'kabupaten-kota'
                              }
                            } else if (filter.id === 'cakupan') {
                              if (opt.value === 'nasional') {
                                next['provinsi'] = 'semua-provinsi'
                                next['kabkota'] = 'semua-kabkota'
                              } else if (opt.value === 'provinsi') {
                                next['kabkota'] = 'semua-kabkota'
                              }
                            }
                            return next
                          })
                          setOpenId(null)
                        }}
                        className={`
                          flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left rounded-xl
                          text-[12px] transition-colors duration-100 mb-0.5
                          ${isSelected
                            ? 'bg-[#f0fdf9] font-bold text-[#0F6E56]'
                            : 'text-[#374151] hover:bg-[#f9fafb]'
                          }
                        `}
                      >
                        <span
                          className={`
                            h-1.5 w-1.5 flex-shrink-0 rounded-full
                            ${isSelected ? 'bg-[#1D9E75]' : 'bg-transparent'}
                          `}
                        />
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* 2-COLUMN ELEGANT TABBED PANEL FOR TIME FILTER (filter.id === 'tahun') */}
              {isOpen && filter.id === 'tahun' && (
                <div
                  className="absolute top-[calc(100%+8px)] right-0 z-40 w-[360px] sm:w-[440px] rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_16px_40px_rgba(0,0,0,0.16)] text-xs animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1 mb-3">
                    <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-[#047D78]" />
                      Pilih Filter Rentang Waktu
                    </span>

                  </div>

                  <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] gap-3">
                    {/* LEFT COLUMN: Categories */}
                    <div className="space-y-1 border-r border-slate-100 pr-2">
                      {[
                        { id: 'tahun', label: 'Berdasarkan Tahun', icon: Calendar },
                        { id: 'bulan', label: 'Berdasarkan Bulan', icon: CalendarDays },
                        { id: 'hari', label: 'Berdasarkan Hari', icon: Clock },
                        { id: 'custom', label: 'Rentang Custom', icon: SlidersHorizontal },
                      ].map((cat) => {
                        const Icon = cat.icon
                        const isActive = timeCategoryTab === cat.id
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setTimeCategoryTab(cat.id as any)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-[11px] font-bold transition-all ${isActive
                                ? 'bg-[#047D78] text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-100/80'
                              }`}
                          >
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span className="truncate">{cat.label}</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* RIGHT COLUMN: Specific Options */}
                    <div className="pl-1 space-y-2">
                      {/* TAB 1: Berdasarkan Tahun */}
                      {timeCategoryTab === 'tahun' && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pilih Tahun Kejadian:</p>
                          {availableYears.map((yr) => {
                            const isSelected = selectedYear === yr
                            return (
                              <button
                                key={yr}
                                type="button"
                                onClick={() => {
                                  setSelectedYear(yr)
                                  setOpenId(null)
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-bold transition ${isSelected
                                    ? 'bg-teal-50 border border-teal-200 text-[#047D78]'
                                    : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                              >
                                <span>Tahun {yr}</span>
                                {isSelected && <Check className="h-4 w-4 text-[#047D78]" />}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* TAB 2: Berdasarkan Bulan */}
                      {timeCategoryTab === 'bulan' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Tahun:</span>
                            <select
                              value={selectedMonthYear}
                              onChange={(e) => setSelectedMonthYear(e.target.value)}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-800"
                            >
                              {availableYears.map((yr) => (
                                <option key={yr} value={yr}>{yr}</option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-1 max-h-[180px] overflow-y-auto pr-1">
                            {MONTH_NAMES.map((m) => {
                              const isSelected = selectedMonth === m.value
                              return (
                                <button
                                  key={m.value}
                                  type="button"
                                  onClick={() => {
                                    setSelectedMonth(m.value)
                                    setOpenId(null)
                                  }}
                                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-[11px] font-semibold transition ${isSelected
                                      ? 'bg-teal-50 border border-teal-200 font-bold text-[#047D78]'
                                      : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                  <span className="truncate">{m.label}</span>
                                  {isSelected && <Check className="h-3 w-3 text-[#047D78] shrink-0" />}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* TAB 3: Berdasarkan Hari */}
                      {timeCategoryTab === 'hari' && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preset Hari:</p>
                          {[
                            { id: '30-hari', label: '30 Hari Terakhir' },
                            { id: '7-hari', label: '7 Hari Terakhir' },
                            { id: 'hari-ini', label: 'Hari Ini' },
                          ].map((p) => {
                            const isSelected = selectedDayPreset === p.id
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedDayPreset(p.id)
                                  setOpenId(null)
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-bold transition ${isSelected
                                    ? 'bg-teal-50 border border-teal-200 text-[#047D78]'
                                    : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                              >
                                <span>{p.label}</span>
                                {isSelected && <Check className="h-4 w-4 text-[#047D78]" />}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* TAB 4: Custom Rentang Tanggal */}
                      {timeCategoryTab === 'custom' && (
                        <div className="space-y-2 pt-0.5">
                          <p className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">Rentang Tanggal Custom:</p>
                          <div>
                            <label className="text-[10px] text-slate-500 font-bold block mb-1">Dari Tanggal:</label>
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#047D78]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-bold block mb-1">Sampai Tanggal:</label>
                            <input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#047D78]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setOpenId(null)}
                            className="w-full py-2 bg-[#047D78] hover:bg-[#036662] text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-sm transition mt-2 text-center"
                          >
                            Simpan Tanggal
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Action Button: TERAPKAN FILTER */}
        <div className="col-span-2 sm:col-span-1 sm:ml-auto pl-1 sm:pl-2 flex items-center justify-end w-full sm:w-auto">
          <button
            type="button"
            onClick={handleApply}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#047D78] hover:bg-[#036662] px-4 py-2.5 text-xs font-black text-white shadow-md transition active:scale-95 uppercase tracking-wider cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4 text-teal-200 shrink-0" />
            <span>TERAPKAN</span>
          </button>
        </div>
      </div>
    </div>
  )
}
