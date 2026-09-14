import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SIPKK EOC - Command Center Video Wall Mode',
  description: 'Tampilan Layar Penuh (TV Wall) Sistem Informasi Penanggulangan Krisis Kesehatan - Kementerian Kesehatan RI',
}

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#fbffff] text-slate-800">
      {children}
    </div>
  )
}
