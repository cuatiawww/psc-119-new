'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const TvDashboardContainer = dynamic(
  () => import('@/components/tv/TvDashboardContainer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-[#fbffff]">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#047D78]" />
          <p className="text-sm font-bold tracking-widest text-[#047D78] uppercase">
            Memuat Video Wall Command Center EOC...
          </p>
        </div>
      </div>
    ),
  }
)

export default function TvNttGempaPage() {
  return <TvDashboardContainer scopeProvinsi="NUSA TENGGARA TIMUR" />
}
