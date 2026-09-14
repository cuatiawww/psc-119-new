'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole, LogIn, UserRound, RefreshCw } from 'lucide-react'
import { useAuthStore, type User } from '@/lib/authStore'
import { buildApiUrl } from '@/lib/utils/api'

type LoginResponse = {
  success?: boolean
  message?: string
  token?: string
  user?: User
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
const localAsset = (path: string) => `${basePath}/${path.replace(/^\/+/, '')}`
const backendBaseUrl = (process.env.NEXT_PUBLIC_SIPKK_BACKEND_BASE_URL || 'https://sipkk-new.mediaciptainformasi.co.id').replace(/\/+$/, '')
const backendHost = new URL(backendBaseUrl).host

// Helper to format assets URL from backend
const getAssetUrl = (url: string) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    if (url.startsWith('data:')) return url
    const parsed = new URL(url)
    const path = parsed.pathname.replace(/^\/+/, '')
    if (parsed.hostname === backendHost && path.startsWith(`${backendHost}/`)) {
      parsed.pathname = `/${path.slice(backendHost.length + 1)}`
    }
    return parsed.toString()
  }
  const path = url.replace(/^\/+/, '')
  return `${backendBaseUrl}/${path.startsWith(`${backendHost}/`) ? path.slice(backendHost.length + 1) : path}`
}


export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, isInitialized, initialize, login, loginAsGuest } = useAuthStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [bgSrc, setBgSrc] = useState<string>(localAsset('BACKGROUND-SIPKK NEW.png'))
  const [logoSrc, setLogoSrc] = useState<string>(localAsset('logo_putih.png'))
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [captchaKey, setCaptchaKey] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaQuestion, setCaptchaQuestion] = useState('')
  const [captchaValue, setCaptchaValue] = useState('')
  const [loadingCaptcha, setLoadingCaptcha] = useState(false)

  const [settings, setSettings] = useState({
    frontend_app_title: 'Indikator Penilaian Kinerja Faskes',
    frontend_app_subtitle: 'Sistem pemantauan terpadu untuk melihat capaian, sebaran, dan perkembangan fasilitas kesehatan di seluruh wilayah Indonesia.',
    frontend_login_card_title: 'Dashboard Faskes',
    frontend_login_card_subtitle: 'Silakan masuk untuk mengakses data fasilitas kesehatan.',
    frontend_login_note: 'Akses terbatas untuk pengguna yang berwenang.\nHubungi admin jika mengalami kendala masuk.',
    frontend_footer_text: '© 2026 Kementerian Kesehatan Republik Indonesia',
    login_logo: localAsset('logo.png'),
    login_background: localAsset('BACKGROUND-SIPKK NEW.png'),
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(buildApiUrl('/api/settings'))
        const payload = await res.json()
        if (payload?.success && payload?.settings) {
          setSettings(prev => ({
            ...prev,
            ...payload.settings
          }))
          const bg = payload.settings.frontend_login_background || payload.settings.login_background
          if (bg) {
            setBgSrc(getAssetUrl(bg))
          }
          const logo = payload.settings.frontend_login_logo || payload.settings.login_logo
          if (logo) {
            setLogoSrc(getAssetUrl(logo))
          }
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err)
      }
    }
    fetchSettings()
  }, [])

  const fetchCaptcha = useCallback(async () => {
    setLoadingCaptcha(true)
    try {
      const res = await fetch(buildApiUrl('/api/captcha'), {
        method: 'GET',
        cache: 'no-store',
      })
      const payload = await res.json()

      if (!res.ok || !payload?.success) {
        throw new Error('Gagal memuat captcha')
      }

      setCaptchaKey(payload.captcha_key)
      setCaptchaImage(payload.captcha_image || '')
      setCaptchaQuestion(payload.captcha_question || '')
      setCaptchaValue('')
    } catch (err) {
      console.error('Gagal mengambil captcha', err)
      setCaptchaKey('')
      setCaptchaImage('')
      setCaptchaQuestion('')
    } finally {
      setLoadingCaptcha(false)
    }
  }, [])

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      router.replace('/')
    }
  }, [isInitialized, isAuthenticated, router])

  useEffect(() => {
    fetchCaptcha()
  }, [fetchCaptcha])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const cleanUsername = username.trim()
    if (!cleanUsername || !password) {
      setError('Username dan password wajib diisi.')
      return
    }

    if (!captchaValue) {
      setError('Captcha wajib diisi.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(buildApiUrl('/api/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username: cleanUsername,
          password,
          captcha_key: captchaKey,
          captcha_value: captchaValue.trim(),
        }),
      })

      const payload = (await response.json().catch(() => null)) as LoginResponse | null

      if (!response.ok || !payload?.success || !payload.token || !payload.user) {
        fetchCaptcha()
        throw new Error(payload?.message || 'Login gagal. Periksa kembali username, password, dan captcha.')
      }

      login(payload.token, payload.user)
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-[#f0f7f7] lg:grid-cols-[minmax(0,1fr)_520px]">

      {/* ── LEFT: Hero Panel ──────────────────────────────────────────────── */}
      <div className="relative hidden min-h-screen overflow-hidden lg:flex lg:flex-col">
        {/* Background image */}
        <Image
          src={bgSrc || localAsset('BACKGROUND-SIPKK NEW.png')}
          alt="Background SIPKK"
          fill
          priority
          sizes="60vw"
          className="object-cover object-center"
          onError={() => setBgSrc(localAsset('BACKGROUND-SIPKK NEW.png'))}
        />

        {/* Overlay gradient — matches dashboard's teal palette */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-950/80 via-teal-900/65 to-[#0e6b65]/50" />

        {/* Subtle grid texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src={logoSrc || localAsset('logo_putih.png')}
              alt="Logo SIPKK"
              width={180}
              height={50}
              className="h-auto w-[180px] object-contain"
              priority
              onError={() => setLogoSrc(localAsset('logo_putih.png'))}
            />
          </div>

          {/* Main copy */}
          <div className="max-w-xl pb-4">
            <h1 className="mt-4 text-[42px] font-extrabold leading-[1.1] tracking-tight text-white xl:text-[52px]">
              {settings.frontend_app_title}
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-teal-100/80 xl:text-[16px]">
              {settings.frontend_app_subtitle}
            </p>


          </div>

          {/* Footer credit */}
          <p className="text-[12px] text-teal-300/50">
            {settings.frontend_footer_text}
          </p>
        </div>
      </div>

      {/* ── RIGHT: Login Panel ────────────────────────────────────────────── */}
      <section className="flex min-h-screen items-center justify-center bg-[#f0f7f7] px-5 py-8 sm:px-8 lg:bg-white">
        <div className="w-full max-w-[420px]">

          {/* Mobile-only logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image
              src={localAsset('logo.png')}
              alt="Logo SIPKK"
              width={150}
              height={45}
              className="h-auto w-[150px] object-contain"
              priority
              onError={() => setLogoSrc(localAsset('logo.png'))}
            />
          </div>

          {/* Card */}
          <div
            className="w-full rounded-[20px] border border-[#c8dedd] bg-white p-7 shadow-[0_20px_60px_rgba(15,118,110,0.10)] sm:p-8 lg:border-0 lg:shadow-none"
          >
            {/* Header */}
            <div className="mb-7">
              <span className="inline-block rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
                Masuk Akun
              </span>
              <h2 className="mt-3 text-[28px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[32px]">
                {settings.frontend_login_card_title}
              </h2>
              <p className="mt-1.5 text-[14px] text-slate-500">
                {settings.frontend_login_card_subtitle}
              </p>
            </div>

            {/* Divider */}
            <div className="mb-6 h-px bg-slate-100" />

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <label className="mb-1.5 block text-[13px] font-bold text-slate-700">
                  Username
                </label>
                <div
                  className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 transition-all duration-150 focus-within:border-teal-500 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
                >
                  <UserRound className="h-[18px] w-[18px] flex-shrink-0 text-slate-400" />
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
                    placeholder="Masukkan username"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-bold text-slate-700">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[12px] font-semibold text-teal-600 hover:text-teal-750 transition-colors hover:underline"
                  >
                    Lupa password?
                  </Link>
                </div>
                <div
                  className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 transition-all duration-150 focus-within:border-teal-500 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
                >
                  <LockKeyhole className="h-[18px] w-[18px] flex-shrink-0 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
                    placeholder="Masukkan password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Captcha */}
              <div className="space-y-2">
                <label className="block text-[13px] font-bold text-slate-700">
                  Keamanan (Captcha)
                </label>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-12 flex-1 items-center justify-between rounded-xl border border-slate-200 bg-teal-50/50 px-3 font-bold text-slate-700 shadow-inner overflow-hidden">
                    {loadingCaptcha ? (
                      <span className="text-xs font-normal text-slate-400 animate-pulse">Memuat...</span>
                    ) : captchaImage ? (
                      <img
                        src={captchaImage}
                        alt="CAPTCHA"
                        className="h-9 w-[110px] rounded border border-slate-200 object-cover"
                      />
                    ) : captchaQuestion ? (
                      <span className="text-sm font-semibold tracking-widest text-slate-700 select-none">
                        {captchaQuestion}
                      </span>
                    ) : (
                      <span className="text-xs font-normal text-slate-400">Captcha tidak tersedia</span>
                    )}
                    <button
                      type="button"
                      onClick={fetchCaptcha}
                      disabled={loading || loadingCaptcha}
                      className="rounded-lg p-1.5 text-slate-450 hover:bg-teal-50 hover:text-teal-700 transition"
                      title="Segarkan Captcha"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingCaptcha ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={captchaValue}
                    onChange={(e) => setCaptchaValue(e.target.value)}
                    required
                    placeholder="Jawaban"
                    disabled={loading}
                    className="h-12 w-28 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-center text-[15px] font-extrabold text-slate-900 outline-none transition duration-150 placeholder:font-normal placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] font-medium text-red-700">
                  <AlertCircle className="mt-px h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-teal-700 px-4 text-[13px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_8px_24px_rgba(15,118,110,0.28)] transition-all hover:bg-teal-800 hover:shadow-[0_10px_28px_rgba(15,118,110,0.36)] active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                ) : (
                  <LogIn className="h-[18px] w-[18px]" />
                )}
                {loading ? 'Memproses...' : 'Masuk'}
              </button>

              {/* Register Link */}
              <div className="mt-4 text-center text-[13px] text-slate-500">
                Belum punya akun?{' '}
                <Link
                  href="/register"
                  className="font-bold text-teal-600 hover:text-teal-700 transition-colors hover:underline"
                >
                  Daftar sebagai Masyarakat
                </Link>
              </div>

              {/* Divider */}
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-450">Atau</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              {/* Akses Sistem — link ke halaman login admin backend */}
              <div className="mb-4">
                <a
                  href={`${process.env.NEXT_PUBLIC_SIPKK_BACKEND_BASE_URL || 'http://localhost/sipkk-baru'}/index.php?r=site/login`}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 hover:border-teal-300 text-[13px] font-extrabold uppercase tracking-wider transition-all"
                >
                  Akses Sistem
                </a>
              </div>

              {/* Guest Login */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    loginAsGuest()
                    router.replace('/')
                  }}
                  className="inline-flex items-center gap-2 text-[13px] font-extrabold text-teal-700 hover:text-teal-800 transition-colors hover:underline"
                >
                  Masuk sebagai Tamu (Akses Publik)
                </button>
              </div>
            </form>
          </div>

          {/* Footer note */}
          <p className="mt-5 text-center text-[12px] text-slate-400 whitespace-pre-line">
            {settings.frontend_login_note}
          </p>
        </div>
      </section>
    </div>
  )
}
