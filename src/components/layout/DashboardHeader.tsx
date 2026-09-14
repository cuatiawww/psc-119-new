'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/lib/authStore'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
import {
  Bell,
  Brain,
  ChevronDown,
  ChevronRight,
  Download,
  Flame,
  LogOut,
  MapPinned,
  Menu,
  Settings,
  ShieldCheck,
  UserCircle,
  X,
  RefreshCw,
  Clock,
  LayoutGrid,
  Network,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  Info,
  // PANTAUAN icons
  Shield,
  Newspaper,
  Wind,
  Globe,
  TreePine,
  Cloud,
  Activity,
  Mountain,
  Layers,
  Users,
  Key,
  FileText,
} from 'lucide-react'
import { buildApiUrl } from '@/lib/utils/api'
import { useHeaderStore } from '@/lib/headerStore'
import { useNotificationItems, useNotificationSound } from '@/hooks/useNotification'


type DashboardHeaderProps = {
  onToggleSidebar: () => void
}

type DashboardSidebarProps = {
  open: boolean
  onClose: () => void
}

type SidebarMenuItem = {
  label: string
  href: string
  icon: any
  isExternal?: boolean
}

type SidebarMenuGroup = {
  title: string
  items: SidebarMenuItem[]
  collapsible?: boolean
}

const sidebarMenu: SidebarMenuGroup[] = [
  {
    title: 'DASHBOARD EOC',
    items: [
      { label: 'DASHBOARD EOC', href: '/', icon: Flame },
      { label: 'GEMPA BUMI PROV. NTT', href: '/gempa-ntt', icon: Activity },
      { label: 'UNDUH LAPORAN BENCANA', href: '/unduh-laporan', icon: Download },
      { label: 'INFOGRAFIS AI (PDF)', href: '/infografis-ai', icon: FileText },
    ],
  },
  {
    title: 'MONITORING & NLP',
    items: [
      { 
        label: 'CRAWLING MEDIA MONITORING', 
        href: process.env.NEXT_PUBLIC_MEDIA_MONITORING_URL || '#', 
        icon: Newspaper,
        isExternal: true
      },
      { 
        label: 'DATA MODELING NLP', 
        href: process.env.NEXT_PUBLIC_NLP_URL || '#', 
        icon: Brain,
        isExternal: true
      },
    ],
  },
  {
    title: 'TENTANG DASHBOARD',
    items: [
      { label: 'INTEROPERABILITAS', href: '/interoperabilitas', icon: Network },
    ],
  },
]

const notificationsData = [
  {
    id: 1,
    title: 'Krisis Banjir Bandang',
    description: 'Terjadi banjir bandang di Bandung. 12 korban luka, faskes tergenang.',
    time: '2m',
    icon: Flame,
    iconBg: 'bg-red-50 text-red-600 border-red-100',
    unread: true,
  },
  {
    id: 2,
    title: 'Siaga Gempa Bumi',
    description: 'Terjadi gempa bumi di Sulawesi. 2 korban luka, faskes rusak sedang.',
    time: '1h',
    icon: Activity,
    iconBg: 'bg-orange-50 text-orange-600 border-orange-100',
    unread: false,
  },
  {
    id: 3,
    title: 'Peringatan KLB Diare',
    description: 'Kasus diare Tangerang melebihi ambang batas normal.',
    time: '1j',
    icon: Bell,
    iconBg: 'bg-purple-50 text-purple-600 border-purple-100',
    unread: true,
  },
  {
    id: 4,
    title: 'Evakuasi Tanah Longsor',
    description: 'Evakuasi pengungsi mandiri sedang berlangsung di posko Bogor.',
    time: '3j',
    icon: MapPinned,
    iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
    unread: false,
  },
  {
    id: 5,
    title: 'Logistik Darurat NTT',
    description: 'Faskes melaporkan kekurangan stok obat-obatan darurat.',
    time: '1h',
    icon: Settings,
    iconBg: 'bg-teal-50 text-teal-600 border-teal-100',
    unread: false,
  },
]

// Helper function to format time ago
const getTimeAgo = (date: Date): string => {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'sekarang'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  
  return date.toLocaleDateString('id-ID')
}

// Helper function to resolve icon components based on string names (dynamic fallback)
const getMenuIcon = (name: string) => {
  const lowercaseName = name?.toLowerCase() || ''
  if (lowercaseName.includes('dashboard') || lowercaseName.includes('home')) return Flame
  if (lowercaseName.includes('pantauan') || lowercaseName.includes('krisis') || lowercaseName.includes('activity') || lowercaseName.includes('peta')) return Activity
  if (lowercaseName.includes('login') || lowercaseName.includes('register')) return LayoutGrid
  if (lowercaseName.includes('verifikasi')) return ShieldCheck
  if (lowercaseName.includes('setting') || lowercaseName.includes('pengaturan')) return Settings
  if (lowercaseName.includes('shield')) return Shield
  if (lowercaseName.includes('newspaper')) return Newspaper
  if (lowercaseName.includes('wind')) return Wind
  if (lowercaseName.includes('globe')) return Globe
  if (lowercaseName.includes('tree') || lowercaseName.includes('karhutla')) return TreePine
  if (lowercaseName.includes('cloud') || lowercaseName.includes('cuaca')) return Cloud
  if (lowercaseName.includes('mountain') || lowercaseName.includes('gunung')) return Mountain
  if (lowercaseName.includes('layer') || lowercaseName.includes('tanah')) return Layers
  if (lowercaseName.includes('lock') || lowercaseName.includes('key')) return Key
  if (lowercaseName.includes('file') || lowercaseName.includes('document')) return FileText
  if (lowercaseName.includes('help') || lowercaseName.includes('info')) return Info
  return LayoutGrid
}

const isLocalRoute = (route: string) => {
  const r = route?.toLowerCase() || ''
  return r.includes('pantauan/') || r === '/' || r === ''
}

const normalizeLocalRoute = (route: string) => {
  const r = route?.toLowerCase() || ''
  if (r.includes('pantauan/krisis-kesehatan')) return '/pantauan/krisis-kesehatan'
  return '/'
}

const buildExternalRoute = (route: string, token: string | null) => {
  const backendUrl = process.env.NEXT_PUBLIC_SIPKK_BACKEND_BASE_URL || 'http://localhost/sipkk-baru'
  if (route.startsWith('http')) return route
  const cleanRoute = route.trim().replace(/^\/+/, '')
  if (token) {
    return `${backendUrl}/index.php?r=site/sso-login&token=${token}&redirect=${encodeURIComponent(cleanRoute)}`
  }
  return `${backendUrl}/index.php?r=${cleanRoute}`
}

export function DashboardSidebar({ open, onClose }: DashboardSidebarProps) {
  const pathname = usePathname()
  const { token, user } = useAuthStore()

  // Track expanded groups
  const isPantauanActive = pathname.startsWith('/pantauan')
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => ({
    'DASHBOARD EOC': true,
    'PANTAUAN': true,
    'TENTANG DASHBOARD': true,
  }))

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Tutup sidebar"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-900/35 backdrop-blur-[1px]"
        />
      ) : null}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-[280px] border-r border-slate-100 bg-white text-slate-800 shadow-[2px_0_12px_rgba(0,0,0,0.03)] transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-[4px] bg-[#047D78]" />
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
              <Image
                src={`${basePath}/kemenkes.png`}
                alt="Logo Kementerian Kesehatan"
                width={38}
                height={38}
                className="h-auto w-full"
                priority
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-wide text-slate-800">DASHBOARD EOC</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Kementerian Kesehatan RI</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup sidebar"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="h-[calc(100vh-80px)] space-y-5 overflow-y-auto px-3 py-4">
          {sidebarMenu.map((group) => {
            const isExpanded = expandedGroups[group.title] ?? false

            return (
              <section key={group.title}>
                {/* Group header — clickable to toggle if collapsible */}
                {group.collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className="flex w-full items-center justify-between px-2 py-1 rounded-lg hover:bg-slate-50 transition text-slate-800"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                      {group.title}
                    </p>
                    {isExpanded
                      ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    }
                  </button>
                ) : (
                  <p className="px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    {group.title}
                  </p>
                )}

                {/* Items — hidden if collapsible and not expanded */}
                {(!group.collapsible || isExpanded) && (
                  <div className="mt-2 space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isLocal = !item.isExternal
                      const targetHref = isLocal ? item.href : buildExternalRoute(item.href, token)
                      const active = isLocal && pathname === targetHref

                      if (!isLocal) {
                        return (
                          <a
                            key={item.label}
                            href={targetHref}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.03em] text-slate-600 hover:bg-slate-50 hover:text-[#047D78] transition"
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </a>
                        )
                      }

                      return (
                        <Link
                          key={item.label}
                          href={targetHref}
                          onClick={(event) => {
                            if (item.href === '#') event.preventDefault()
                            else onClose()
                          }}
                          className={`flex w-full items-center gap-3 py-2 px-3 text-xs font-semibold uppercase tracking-[0.03em] transition ${
                            active
                              ? 'bg-teal-50/70 text-[#047D78] font-bold border-l-4 border-[#047D78] rounded-r-xl rounded-l-none'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-[#047D78]'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

export default function DashboardHeader({ onToggleSidebar }: DashboardHeaderProps) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const [notificationsList, setNotificationsList] = useState<any[]>([])
  
  const { token, user, logout, isAuthenticated, isGuest } = useAuthStore()
  const { title: headerTitle, description: headerDesc, lastUpdated, sourceLabel, sourceUrl } = useHeaderStore()
  const { getItems, subscribeToItems, addNotificationItem, markAsRead, clearAll, markAllAsRead } = useNotificationItems()
  const { playSound } = useNotificationSound()
  const [activeRegion, setActiveRegion] = useState('NASIONAL')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const hasUnread = notificationsList.some(n => !n.read)
  
  const isMasyarakat = user?.level_name?.toLowerCase().includes('masyarakat') || false
  const isTamu = !isAuthenticated || isGuest
  const showAksesSistem = !(isMasyarakat || isTamu)

  const handleMarkAllAsRead = () => {
    markAllAsRead()
    window.dispatchEvent(new CustomEvent('sipkk-silence-alert'))
  }

  const handleClearAll = () => {
    clearAll()
    window.dispatchEvent(new CustomEvent('sipkk-silence-alert'))
  }

  // Subscribe to notification items
  useEffect(() => {
    const unsubscribe = subscribeToItems(() => {
      const items = getItems().slice(0, 15)
      console.log('[DashboardHeader] Notifications updated:', items)
      setNotificationsList(items)
    })
    
    // Initial load
    const initialItems = getItems().slice(0, 15)
    console.log('[DashboardHeader] Initial notifications:', initialItems)
    setNotificationsList(initialItems)
    
    return unsubscribe
  }, [subscribeToItems, getItems])

  const handleRefresh = () => {
    setIsRefreshing(true)
    // Clear seen events so new data is detected as new
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('sipkk-dashboard-seen-events-v1')
      } catch {
        // Ignore storage errors
      }
    }
    window.dispatchEvent(new CustomEvent('sipkk-refresh-data'))
    setTimeout(() => {
      setIsRefreshing(false)
    }, 850)
  }


  useEffect(() => {
    if (user?.wilayah_scope) {
      const scope = user.wilayah_scope
      if (scope.mode === 'kabupaten' && scope.kabupaten?.label) {
        setActiveRegion(`${scope.kabupaten.label.toUpperCase()}, PROV. ${scope.provinsi?.label?.toUpperCase()}`)
      } else if (scope.mode === 'provinsi' && scope.provinsi?.label) {
        setActiveRegion(`PROV. ${scope.provinsi.label.toUpperCase()}`)
      }
    }

    const handleRegionChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      setActiveRegion(customEvent.detail)
    }

    window.addEventListener('sipkk-region-changed', handleRegionChange)
    return () => {
      window.removeEventListener('sipkk-region-changed', handleRegionChange)
    }
  }, [user])
  const initialName = isAuthenticated ? (user?.nama_lengkap || user?.username || 'Pengguna') : 'Tamu (Guest)'
  const roleName = isAuthenticated ? (user?.level_name || (user?.level_user_id === 1 ? 'Super Administrator' : 'Admin')) : 'Akses Publik'
  const userEmail = isAuthenticated ? (user?.email || `${user?.username || 'admin'}@faskes.go.id`) : 'guest@faskes.go.id'
  const accessLabel = isAuthenticated ? (user?.wilayah_scope?.access_label || 'Pusat pemantauan nasional fasilitas kesehatan') : 'Pusat pemantauan publik fasilitas kesehatan'

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  }
  const initials = getInitials(initialName)

  const isGempaNttRoute =
    pathname === '/gempa-ntt' ||
    pathname === '/dashboard-eoc/gempa-ntt' ||
    pathname?.includes('gempa-ntt')

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false)
    }

    if (profileOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [profileOpen])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setNotifOpen(false)
    }

    if (notifOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [notifOpen])

  return (
    <header className="w-full max-w-full border-b-2 border-teal-400/25 bg-white overflow-hidden">
      <div className="relative flex min-h-[118px] items-stretch overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-95"
          style={{ backgroundImage: `url('${process.env.NEXT_PUBLIC_BASE_PATH || ''}/${(pathname === '/gempa-ntt' || pathname === '/dashboard-eoc/gempa-ntt' || pathname?.includes('gempa-ntt')) ? 'bg header_ntt.webp' : 'bg header.png'}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/82 to-white/92" />
        <div className="relative grid w-full max-w-full gap-4 sm:gap-5 px-4 py-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            {!(pathname === '/gempa-ntt' || pathname === '/dashboard-eoc/gempa-ntt' || pathname?.includes('gempa-ntt')) && (
              <button
                type="button"
                aria-label="Buka menu"
                onClick={onToggleSidebar}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-5">
              <Image
                src={`${basePath}/Logo-Kemenkes.png`}
                alt="Logo Kemenkes"
                width={170}
                height={62}
                className="h-auto w-[132px] shrink-0 md:w-[168px]"
                priority
              />
              <div className="min-w-0 border-teal-200/80 md:border-l md:pl-5">
                <h1 className="max-w-[720px] text-lg sm:text-2xl md:text-3xl font-extrabold leading-tight tracking-normal text-slate-900 uppercase break-words">
                  {headerTitle}
                </h1>
                <p className="mt-2 max-w-[760px] text-xs leading-relaxed text-slate-600 md:text-sm lg:text-base hidden sm:block">
                  {headerDesc || `Analisis spasial kejadian bencana dan dampaknya terhadap sumber daya kesehatan di wilayah ${activeRegion}.`}
                </p>
                {(lastUpdated || (sourceLabel && sourceUrl)) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-semibold">
                    {lastUpdated && (
                      <span>Diperbarui: {lastUpdated}</span>
                    )}
                    {lastUpdated && sourceLabel && <span className="text-slate-300">|</span>}
                    {sourceLabel && sourceUrl && (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[10px] font-bold text-teal-700 hover:bg-teal-100 transition uppercase tracking-wider"
                      >
                        {sourceLabel}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          {!isGempaNttRoute && (
            <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="relative inline-flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-700 hover:shadow-md disabled:cursor-wait"
                aria-label="Refresh Data"
                title="Refresh Data"
              >
                <RefreshCw className={`h-4 w-4 sm:h-[18px] sm:w-[18px] text-slate-600 ${isRefreshing ? 'animate-spin text-teal-650' : ''}`} />
              </button>
              {showAksesSistem && (
                <a
                  href={buildExternalRoute('site/login', token)}
                  className="relative inline-flex h-10 sm:h-12 items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 sm:px-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-700 hover:shadow-md"
                  title="Akses Sistem"
                >
                  <ExternalLink className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 text-slate-600" />
                  <span className="hidden sm:inline">Akses Sistem</span>
                </a>
              )}
              <div className="relative" ref={notifRef}>
                {hasUnread && (
                  <span className="absolute inset-0 rounded-xl bg-red-500/40 animate-ping pointer-events-none" />
                )}
                <button
                  type="button"
                  onClick={() => setNotifOpen((prev) => !prev)}
                  className={`relative inline-flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-700 hover:shadow-md ${
                    hasUnread
                      ? 'border-red-500 bg-red-50 text-red-650 ring-2 ring-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.35)] animate-[pulse_1s_infinite]'
                      : 'border-slate-200 bg-white/95 text-slate-600'
                  }`}
                  aria-label="Notifikasi"
                >
                  <Bell className={`h-4 w-4 sm:h-[19px] sm:w-[19px] ${hasUnread ? 'animate-bounce text-red-600' : 'text-slate-600'}`} />
                  {notificationsList.length > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4.5 min-w-4.5 sm:h-5 sm:min-w-5 place-items-center rounded-full border-2 border-white bg-red-500 px-0.5 sm:px-1 text-[9px] sm:text-[10px] font-bold text-white">
                      {notificationsList.length > 15 ? '15+' : notificationsList.length}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-14 z-30 w-[320px] sm:w-[380px] rounded-2xl border border-slate-200 bg-white/98 backdrop-blur-md p-4 shadow-[0_12px_40px_rgba(15,118,110,0.15)] flex flex-col animate-in slide-in-from-top-2 duration-155">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">Notifikasi Terbaru</span>
                        {notificationsList.length > 0 && (
                          <span className="rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[9px] font-extrabold text-red-700 uppercase tracking-wide">
                            {notificationsList.length > 15 ? '15+' : notificationsList.length} Baru
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setNotifOpen(false)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* List */}
                    <div className="mt-2 divide-y divide-slate-100 max-h-[350px] overflow-y-auto pr-1 no-scrollbar space-y-1">
                      {notificationsList.length === 0 ? (
                        <div className="py-8 text-center text-slate-400">
                          <Bell className="mx-auto h-8 w-8 mb-2 opacity-30" />
                          <p className="text-sm">Tidak ada notifikasi</p>
                        </div>
                      ) : (
                        notificationsList.map((notif) => {
                          const getIconAndColor = (type: string) => {
                            const configs: Record<string, { icon: any; bg: string; text: string }> = {
                              alert: { icon: AlertTriangle, bg: 'bg-red-50', text: 'text-red-600' },
                              warning: { icon: AlertTriangle, bg: 'bg-orange-50', text: 'text-orange-600' },
                              error: { icon: AlertTriangle, bg: 'bg-red-50', text: 'text-red-600' },
                              success: { icon: CheckCircle2, bg: 'bg-green-50', text: 'text-green-600' },
                              info: { icon: Info, bg: 'bg-blue-50', text: 'text-blue-600' },
                            }
                            return configs[type] || configs.info
                          }

                          const { icon: NotifIcon, bg, text } = getIconAndColor(notif.type)
                          const timeAgo = getTimeAgo(notif.timestamp)

                          return (
                            <div
                              key={notif.id}
                              onClick={() => {
                                markAsRead(notif.id)
                                const remainingUnread = notificationsList.filter(n => n.id !== notif.id && !n.read)
                                if (remainingUnread.length === 0) {
                                  window.dispatchEvent(new CustomEvent('sipkk-silence-alert'))
                                }
                              }}
                              className={`flex items-start gap-3 py-2.5 px-3 transition rounded-xl cursor-pointer ${
                                !notif.read
                                  ? 'bg-teal-50/40 border-l-4 border-teal-650 shadow-sm'
                                  : 'bg-white hover:bg-slate-50 border-l-4 border-slate-200'
                              }`}
                            >
                              {/* Left: Icon */}
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${bg} ${text}`}>
                                <NotifIcon className="h-4.5 w-4.5" />
                              </div>

                              {/* Middle: Title & Desc */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`text-[11px] text-slate-800 truncate leading-tight ${!notif.read ? 'font-extrabold text-[#047D78]' : 'font-semibold text-slate-550'}`}>
                                    {notif.title}
                                  </p>
                                  {/* Right: Time */}
                                  <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-400 whitespace-nowrap pt-0.5 shrink-0">
                                    <Clock className="h-2.5 w-2.5" />
                                    {timeAgo}
                                  </span>
                                </div>
                                <p className="mt-1 text-[10px] text-slate-550 leading-normal line-clamp-2">
                                  {notif.message}
                                </p>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>

                    {/* Footer */}
                    {notificationsList.length > 0 ? (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleMarkAllAsRead}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#047D78] text-[10px] font-extrabold transition text-center uppercase tracking-wider border border-teal-200/60"
                          >
                            Telah Dibaca Semua
                          </button>
                          <button
                            type="button"
                            onClick={handleClearAll}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-750 text-[10px] font-extrabold transition text-center uppercase tracking-wider border border-red-200/60"
                          >
                            Clear Notifikasi
                          </button>
                        </div>
                        <div className="text-center text-[9px] text-slate-400">
                          Menampilkan {notificationsList.length > 15 ? '15+' : notificationsList.length} notifikasi terbaru
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <Link
                href="/unduh-laporan"
                className={`inline-flex h-10 sm:h-12 items-center gap-1.5 sm:gap-2.5 whitespace-nowrap rounded-xl border px-3 sm:px-4 text-[10px] sm:text-xs font-bold uppercase tracking-[0.05em] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  pathname === '/unduh-laporan'
                    ? 'border-teal-600 bg-teal-700 text-white shadow-teal-700/20'
                    : 'border-teal-200 bg-white/95 text-teal-700 hover:bg-teal-50'
                }`}
                title="Halaman Unduh Laporan Bencana"
              >
                <span className={`grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-lg ${
                  pathname === '/unduh-laporan' ? 'bg-teal-800 text-white' : 'bg-teal-50 text-teal-600'
                }`}>
                  <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
                <span className="hidden sm:inline">Unduh Laporan</span>
              </Link>
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="inline-flex h-10 sm:h-12 items-center gap-1.5 sm:gap-2.5 rounded-xl border border-slate-200 bg-white/95 px-2 sm:px-2.5 pr-2.5 sm:pr-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
                >
                  <div className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 text-[10px] sm:text-xs font-extrabold text-white shadow-sm">
                    {initials}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold uppercase tracking-[0.04em] leading-4 text-slate-900">{initialName}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-teal-700">{roleName}</p>
                  </div>
                  <ChevronDown className={`h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-500 transition ${profileOpen ? 'rotate-180' : ''}`} />
                </button>
                {profileOpen ? (
                  isAuthenticated ? (
                    <div className="absolute right-0 top-14 z-30 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 text-sm font-extrabold text-white">
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{initialName}</p>
                            <p className="text-xs text-slate-500">{userEmail}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setProfileOpen(false)}
                          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          aria-label="Tutup"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-teal-700">Akses</p>
                        <p className="mt-0.5 text-xs text-slate-600">{accessLabel}</p>
                      </div>
                      <div className="mt-3 space-y-2">
                        <button type="button" className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-[13px] font-bold uppercase tracking-[0.03em] text-slate-700 transition hover:bg-slate-50">
                          <UserCircle className="h-4 w-4 text-teal-600" />
                          Profil Saya
                        </button>
                        <Link href="/settings" onClick={() => setProfileOpen(false)} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-[13px] font-bold uppercase tracking-[0.03em] text-slate-700 transition hover:bg-slate-50">
                          <Settings className="h-4 w-4 text-teal-600" />
                          Pengaturan Akun
                        </Link>
                        <button 
                          type="button" 
                          onClick={() => {
                            logout()
                            setProfileOpen(false)
                          }}
                          className="flex w-full items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-left text-[13px] font-bold uppercase tracking-[0.03em] text-red-600 transition hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4" />
                          Keluar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute right-0 top-14 z-30 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-extrabold text-slate-800">Akses Pengunjung</p>
                          <p className="text-xs text-slate-500">Silakan login untuk fitur lengkap.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setProfileOpen(false)}
                          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          aria-label="Tutup"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-teal-700">Akses</p>
                        <p className="mt-0.5 text-xs text-slate-600">{accessLabel}</p>
                      </div>
                      <div className="mt-4 space-y-2">
                        <Link 
                          href="/login" 
                          onClick={() => {
                            logout()
                            setProfileOpen(false)
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-teal-800"
                        >
                          Masuk (Login)
                        </Link>
                        <Link 
                          href="/register" 
                          onClick={() => {
                            logout()
                            setProfileOpen(false)
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-teal-700 shadow-sm transition hover:bg-teal-50"
                        >
                          Daftar Sekarang
                        </Link>
                        <button 
                          type="button" 
                          onClick={() => {
                            logout()
                            setProfileOpen(false)
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-red-600 shadow-sm transition hover:bg-red-50"
                        >
                          Keluar Akses Tamu
                        </button>
                      </div>
                    </div>
                  )
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="h-[3px] bg-gradient-to-r from-teal-400/80 via-teal-400/40 to-transparent" />
    </header>
  )
}
