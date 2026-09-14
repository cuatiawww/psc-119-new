'use client'

import Link from 'next/link'
import { Construction, Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[70vh] px-6 py-12 bg-[#fbffff] text-center">
      <div className="max-w-md w-full space-y-8 bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.015)] border-t-4 border-[#047D78] animate-fade-in">
        {/* Animated Construction Icon */}
        <div className="flex justify-center">
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-teal-50 text-[#047D78]">
            <Construction className="h-10 w-10 stroke-[2] animate-pulse" />
            <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-teal-500"></span>
            </span>
          </div>
        </div>

        {/* Header and Explanation */}
        <div className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-wide">
            Sedang Dalam Pengembangan
          </h2>
          <p className="text-sm sm:text-base text-slate-500 font-semibold leading-relaxed">
            Fitur atau modul ini sedang dirancang dan dikembangkan untuk memberikan pelayanan pemantauan krisis kesehatan terbaik bagi Anda.
          </p>
        </div>

        {/* Acknowledgment Label */}
        <div className="rounded-2xl bg-slate-50/80 border border-slate-100/60 py-3.5 px-4 text-xs font-black text-slate-400 uppercase tracking-wider">
          Terima kasih atas kesabaran Anda
        </div>

        {/* Back Actions */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3.5 justify-center">
          <button
            onClick={() => window.history.back()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-6 text-sm font-black uppercase tracking-wider text-slate-700 transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
            <span>Kembali</span>
          </button>
          
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 px-6 text-sm font-black uppercase tracking-wider text-white transition-all hover:-translate-y-0.5 active:scale-[0.98] shadow-md shadow-teal-700/10"
            style={{ backgroundColor: '#047D78' }}
          >
            <Home className="h-4.5 w-4.5" />
            <span>Ke Beranda</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
