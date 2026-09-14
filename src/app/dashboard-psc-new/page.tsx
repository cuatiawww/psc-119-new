'use client'

import { Suspense } from 'react'
import DashboardKejadianPage from '@/components/kejadian/DashboardKejadianPage'
import { Loader2 } from 'lucide-react'

function DashboardFallback() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#f4fbfb] p-6 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-teal-600 mb-4" />
      <h2 className="text-lg font-bold text-slate-800">Memuat Dashboard Intelijen PSC 119...</h2>
      <p className="text-sm text-slate-500 mt-1">Menginisialisasi parameter dan sinkronisasi layanan kedaruratan</p>
    </div>
  )
}

export default function DashboardPscNewPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardKejadianPage />
    </Suspense>
  )
}
