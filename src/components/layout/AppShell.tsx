'use client'

import { useCallback, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/authStore'
import DashboardHeader, { DashboardSidebar } from './DashboardHeader'
import Footer from './Footer'
import { NotificationProvider } from '@/components/NotificationProvider'
import CookieConsent from './CookieConsent'
import { Loader2 } from 'lucide-react'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  const pathname = usePathname()
  const { isAuthenticated, isGuest, isInitialized, initialize } = useAuthStore()

  const publicRoutes = ['/login', '/register', '/forgot-password', '/sso']
  const isPublicRoute = publicRoutes.includes(pathname)
  const isTvRoute =
    pathname === '/tv' ||
    pathname?.startsWith('/tv/') ||
    pathname === '/dashboard-eoc/tv' ||
    pathname?.startsWith('/dashboard-eoc/tv') ||
    pathname?.endsWith('/tv') ||
    pathname?.includes('/tv/')

  useEffect(() => {
    initialize()
  }, [initialize])

  // Intercept global fetch to automatically prefix basePath to relative api calls
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
      if (basePath && !window.hasOwnProperty('__fetch_intercepted__')) {
        const originalFetch = window.fetch
        window.fetch = function (input, init) {
          if (typeof input === 'string' && input.startsWith('/api/')) {
            return originalFetch(`${basePath}${input}`, init)
          }
          if (input instanceof URL && input.pathname.startsWith('/api/')) {
            return originalFetch(`${basePath}${input.pathname}${input.search}`, init)
          }
          return originalFetch(input, init)
        }
        Object.defineProperty(window, '__fetch_intercepted__', {
          value: true,
          writable: false,
          configurable: false
        })
      }
    }
  }, [])

  const isGempaNttRoute = Boolean(
    pathname &&
    (
      pathname.toLowerCase().includes('gempa-ntt') ||
      pathname.toLowerCase().includes('gempa_ntt') ||
      pathname.toLowerCase().includes('prov-ntt') ||
      pathname.toLowerCase().includes('ntt') ||
      pathname.toLowerCase().includes('gempa')
    )
  )

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbffff]">
        <Loader2 className="h-8 w-8 animate-spin text-[#047D78]" />
      </div>
    )
  }

  if (isTvRoute) {
    return <main className="h-screen w-screen overflow-hidden bg-slate-950">{children}</main>
  }

  if (isPublicRoute) {
    return <main className="min-h-screen bg-slate-50">{children}</main>
  }

  if (!isAuthenticated && !isGuest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbffff]">
        <Loader2 className="h-8 w-8 animate-spin text-[#047D78]" />
      </div>
    )
  }

  return (
    <NotificationProvider>
      <main className="min-h-screen">
        {!isGempaNttRoute && <DashboardSidebar open={sidebarOpen} onClose={closeSidebar} />}
        <DashboardHeader onToggleSidebar={() => setSidebarOpen((open) => !open)} />
        {children}
        <Footer />
        {!isGempaNttRoute && <CookieConsent />}
      </main>
    </NotificationProvider>
  )
}

