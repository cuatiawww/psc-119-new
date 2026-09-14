'use client'

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Shield, Bell, MapPin, X, Check } from 'lucide-react'

export default function CookieConsent() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [userLocationName, setUserLocationName] = useState<string | null>(null)

  // Sembunyikan EWS consent popup khusus pada halaman Gempa NTT
  const isGempaNtt = Boolean(
    pathname &&
    (
      pathname.toLowerCase().includes('gempa-ntt') ||
      pathname.toLowerCase().includes('gempa_ntt') ||
      pathname.toLowerCase().includes('prov-ntt') ||
      pathname.toLowerCase().includes('ntt') ||
      pathname.toLowerCase().includes('gempa')
    )
  )

  useEffect(() => {
    if (isGempaNtt) return

    // Check if user already consented
    if (typeof window !== 'undefined') {
      const consent = localStorage.getItem('ews-cookie-consent')
      if (!consent) {
        // Show after 2 seconds delay for a premium feel
        const timer = setTimeout(() => setShow(true), 2000)
        return () => clearTimeout(timer)
      } else {
        // Retrieve location name if available
        const savedName = localStorage.getItem('user_coords_name')
        if (savedName) setUserLocationName(savedName)
      }
    }
  }, [isGempaNtt])

  if (isGempaNtt) return null

  const handleDecline = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ews-cookie-consent', 'declined')
    }
    setShow(false)
  }

  const handleAcceptAll = () => {
    if (typeof window === 'undefined') return

    localStorage.setItem('ews-cookie-consent', 'accepted')

    // 1. Request Browser Desktop Notification permission
    if ('Notification' in window) {
      void Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification("EWS Kemenkes RI Aktif", {
            body: "Pemberitahuan darurat bencana dan krisis kesehatan akan dikirim secara realtime ke desktop Anda.",
            icon: "/favicon.ico"
          })
        }
      })
    }

    // 2. Request Geolocation permission to save coordinates
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          localStorage.setItem('user_coords', JSON.stringify(coords))
          
          // Reverse-geocode coordinates using open API (OSM Nominatim) to display their city
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=10`)
            if (res.ok) {
              const data = await res.json()
              const address = data.address || {}
              const locationName = address.city || address.town || address.county || address.state || 'Lokasi Anda'
              localStorage.setItem('user_coords_name', locationName)
              setUserLocationName(locationName)
            }
          } catch (e) {
            console.error('Failed to reverse-geocode coordinates:', e)
          }
          
          setShow(false)
        },
        (error) => {
          console.warn('Geolocation permission denied or failed:', error)
          setShow(false)
        },
        { enableHighAccuracy: true }
      )
    } else {
      setShow(false)
    }
  }

  if (!show) {
    if (typeof window !== 'undefined' && localStorage.getItem('ews-cookie-consent') === 'accepted') {
      return (
        <div className="fixed bottom-4 left-4 z-[9990] flex items-center gap-2 bg-white text-slate-800 border border-slate-200 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md animate-in fade-in duration-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          EWS Radius Aktif {userLocationName ? `• ${userLocationName}` : ''}
        </div>
      )
    }
    return null
  }

  return (
    <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-[420px] z-[9999] animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-[0_15px_40px_rgba(0,0,0,0.08)] text-slate-800 relative overflow-hidden">
        
        <div className="space-y-2">
          <h3 className="text-[13px] font-extrabold tracking-wide uppercase text-slate-900">
            Aktifkan Layanan Peringatan Dini (EWS)
          </h3>
          <p className="text-xs text-slate-650 leading-relaxed font-normal">
            Untuk mendeteksi bencana di sekitar Anda secara otomatis, kami memerlukan izin untuk mengakses <strong>Lokasi (GPS)</strong> guna mengukur radius aman, dan <strong>Notifikasi</strong> agar dapat mengirimkan peringatan suara sirine darurat secara realtime ke perangkat Anda.
          </p>
        </div>

        {/* Feature Icons Grid */}
        <div className="grid grid-cols-2 gap-3 mt-4 py-3 border-y border-slate-100 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-teal-700 shrink-0" />
            <span>Sirine & Web Push Realtime</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-sky-600 shrink-0" />
            <span>Deteksi Radius Kerawanan</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-5">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            Lanjutkan tanpa EWS
          </button>
          <button
            onClick={handleAcceptAll}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#047D78] hover:bg-[#03625d] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md shadow-teal-900/10 hover:scale-[1.02]"
          >
            <Check className="h-4 w-4" />
            Aktifkan EWS
          </button>
        </div>

        <button
          onClick={() => setShow(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
