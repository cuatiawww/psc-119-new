'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, LogIn } from 'lucide-react'
import { useAuthStore } from '@/lib/authStore'

const productionLoginUrl = 'https://psc.kemkes.go.id/site/login'
const localLoginUrl = 'http://localhost/psc-119/site/login'
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
const localAsset = (path: string) => `${basePath}/${path.replace(/^\/+/, '')}`

function getPscLoginUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_PSC_LOGIN_URL?.trim()
  if (configuredUrl) return configuredUrl

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return localLoginUrl
    }
  }

  return productionLoginUrl
}

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, isInitialized, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      router.replace('/')
    }
  }, [isInitialized, isAuthenticated, router])

  const handlePscRedirect = () => {
    window.location.assign(getPscLoginUrl())
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f0f7f7] px-5 py-8">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-950 via-teal-900 to-[#0e6b65] opacity-[0.08]" />

      <section className="relative w-full max-w-[520px] rounded-[24px] border border-[#c8dedd] bg-white p-7 text-center shadow-[0_20px_60px_rgba(15,118,110,0.12)] sm:p-10">
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-white px-4 py-2.5 shadow-sm">
            <Image
              src={localAsset('Logo-Kemenkes.png')}
              alt="Logo Kemenkes RI"
              width={140}
              height={42}
              className="h-9 w-auto object-contain"
              priority
            />
            <div className="border-l border-teal-200 pl-3 text-left">
              <p className="text-xs font-black uppercase tracking-wider text-teal-800">PSC 119</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Kemenkes RI</p>
            </div>
          </div>
        </div>

        <span className="inline-block rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
          Portal Akses Terpadu
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Login melalui aplikasi PSC 119
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
          Form login pada dashboard ini sudah dinonaktifkan. Silakan masuk melalui aplikasi PSC 119 untuk melanjutkan.
        </p>

        <button
          type="button"
          onClick={handlePscRedirect}
          className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-extrabold uppercase tracking-[0.08em] text-white shadow-[0_8px_24px_rgba(15,118,110,0.28)] transition hover:bg-teal-800 hover:shadow-[0_10px_28px_rgba(15,118,110,0.36)] active:scale-[0.99]"
        >
          <LogIn className="h-[18px] w-[18px]" />
          Lanjut ke Login PSC 119
          <ArrowUpRight className="h-4 w-4" />
        </button>

        <div className="mt-6 border-t border-slate-100 pt-5 text-xs text-slate-500">
          <p className="mb-3 font-semibold">Pilihan alamat login PSC:</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-5">
            <a
              href={productionLoginUrl}
              className="font-bold text-teal-700 hover:text-teal-900 hover:underline"
            >
              PSC Produksi
            </a>
            <a
              href={localLoginUrl}
              className="font-bold text-teal-700 hover:text-teal-900 hover:underline"
            >
              PSC Lokal
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
