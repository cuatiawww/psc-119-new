import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pantauan — Dashboard PSC 119 Kemenkes RI',
  description: 'Halaman pantauan kondisi lingkungan terpadu SPGDT PSC 119 Kementerian Kesehatan RI.',
}

export default function PantauanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
