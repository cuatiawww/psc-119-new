'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore, type User } from '@/lib/authStore'
import { Loader2, AlertCircle } from 'lucide-react'

/**
 * SSO landing page. Token dari URL selalu diverifikasi server-to-server ke
 * psc-119; data user dari browser tidak pernah dipercaya.
 */
export default function SsoPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (!token) {
      setError('Parameter SSO tidak lengkap. Silakan kembali dan coba lagi.')
      return
    }

    const verify = async () => {
      try {
        const response = await fetch('/api/sso/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ token }),
          cache: 'no-store',
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok || !payload?.success || !payload?.token || !payload?.user) {
          throw new Error(payload?.message || 'Token SSO tidak valid atau sudah kedaluwarsa.')
        }

        let user = payload.user as User
        const kodePsc = String(user.kode_psc || '').trim().toUpperCase()

        // Ambil wilayah resmi dari API PSC agar dashboard otomatis sesuai akun.
        if (kodePsc) {
          try {
            const centerResponse = await fetch(`/api/psc/centers?kode_psc=${encodeURIComponent(kodePsc)}`, { cache: 'no-store' })
            const centerPayload = await centerResponse.json().catch(() => null)
            const center = centerPayload?.data?.[0]
            if (center) {
              const provinsi = String(center.provinsi || '').trim()
              const kabupaten = String(center.kabupaten || '').trim()
              user = {
                ...user,
                wilayah_scope: {
                  mode: 'kabupaten',
                  access_label: `${user.nama_lengkap}${kabupaten || provinsi ? ` (${kabupaten || 'Wilayah'}, ${provinsi || 'Indonesia'})` : ''}`,
                  cakupan: { id: 'kabupaten-kota', value: 'kabupaten-kota', label: 'KABUPATEN/KOTA', locked: true },
                  provinsi: { id: center.kd_prop || '', value: provinsi.toLowerCase(), label: provinsi, locked: true, options: [{ id: center.kd_prop || '', label: provinsi }] },
                  kabupaten: { id: center.kd_kab || '', value: kabupaten.toLowerCase(), label: kabupaten, locked: true, options: [{ id: center.kd_kab || '', label: kabupaten }] },
                },
              }
            }
          } catch (centerError) {
            console.warn('[SSO] Wilayah PSC tidak berhasil dimuat:', centerError)
          }
        }

        login(payload.token, user)
        router.replace(kodePsc ? `/?kode_psc=${encodeURIComponent(kodePsc)}` : '/')
      } catch (err) {
        console.error('[SSO] Gagal memproses token:', err)
        setError(err instanceof Error ? err.message : 'Gagal memproses sesi SSO. Silakan login manual.')
      }
    }

    verify()
  }, [login, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f0f7f7] p-4 text-center">
      <div className="w-full max-w-sm rounded-3xl border border-[#c8dedd] bg-white p-8 shadow-[0_20px_60px_rgba(15,118,110,0.10)]">
        {error ? (
          <div className="space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="text-xl font-bold text-slate-900">Autentikasi Gagal</h2>
            <p className="text-sm text-slate-500">{error}</p>
            <a href="/login" className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-700 px-6 text-sm font-bold text-white transition hover:bg-teal-800">
              Kembali ke Login
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-teal-700" />
            <h2 className="text-xl font-bold text-slate-900">Menghubungkan Sesi...</h2>
            <p className="text-sm text-slate-500">Mohon tunggu, kami sedang memverifikasi akun PSC Anda.</p>
          </div>
        )}
      </div>
    </div>
  )
}
