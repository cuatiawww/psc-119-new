'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// Map slug to dynamic component imports
const pageComponents: Record<string, React.ComponentType> = {
  'krisis-kesehatan': dynamic(() => import('@/components/pantauan/pages/KrisisKesehatanPage'), { ssr: false, loading: () => <PageLoader /> }),
}

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-600" />
        <p className="text-sm text-slate-500 font-semibold">Memuat halaman...</p>
      </div>
    </div>
  )
}

export default function PantauanPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const Component = pageComponents[resolvedParams.slug]
  if (!Component) {
    notFound()
  }
  return <Component />
}
