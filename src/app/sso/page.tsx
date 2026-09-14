'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore, type User } from '@/lib/authStore'
import { Loader2, AlertCircle } from 'lucide-react'

/**
 * SSO Landing Page — menerima token + user dari backend Yii2.
 *
 * Alur:
 *   1. Backend redirect ke /sso?token=<JWT>&user=<base64>
 *   2. Halaman ini decode, simpan ke localStorage, lalu redirect ke /
 */
export default function SsoPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params    = new URLSearchParams(window.location.search)
    const token     = params.get('token')
    const userB64   = params.get('user')   // URLSearchParams.get() sudah URL-decode otomatis

    const eventId   = params.get('id') || params.get('event') || params.get('kode_trans')

    // Validasi params wajib ada
    if (!token || !userB64) {
      setError('Parameter SSO tidak lengkap. Silakan kembali dan coba lagi.')
      return
    }

    try {
      // Decode base64 → UTF-8 JSON (pakai TextDecoder untuk handle karakter Unicode)
      const binary  = window.atob(userB64)
      const bytes   = Uint8Array.from(binary, (c) => c.charCodeAt(0))
      const jsonStr = new TextDecoder('utf-8').decode(bytes)
      const user    = JSON.parse(jsonStr) as User

      // Simpan ke store (localStorage + Zustand)
      login(token, user)

      // Redirect ke dashboard setelah localStorage committed (bawa id jika ada)
      const targetPath = eventId ? `/?id=${encodeURIComponent(eventId)}` : '/'
      router.replace(targetPath)
    } catch (err) {
      console.error('[SSO] Gagal memproses token:', err)
      setError('Gagal memproses sesi SSO. Silakan login manual.')
    }
  }, [login, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f0f7f7] p-4 text-center">
      <div className="w-full max-w-sm rounded-3xl border border-[#c8dedd] bg-white p-8 shadow-[0_20px_60px_rgba(15,118,110,0.10)]">

        {error ? (
          /* ── Error State ── */
          <div className="space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="text-xl font-bold text-slate-900">Autentikasi Gagal</h2>
            <p className="text-sm text-slate-500">{error}</p>
            <a
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-700 px-6 text-sm font-bold text-white transition hover:bg-teal-800"
            >
              Kembali ke Login
            </a>
          </div>
        ) : (
          /* ── Loading State ── */
          <div className="space-y-4">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-teal-700" />
            <h2 className="text-xl font-bold text-slate-900">Menghubungkan Sesi...</h2>
            <p className="text-sm text-slate-500">
              Mohon tunggu, kami sedang mentransfer sesi login Anda dengan aman.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
