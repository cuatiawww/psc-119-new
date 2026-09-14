import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pantauan — Dashboard SIPKK Kemenkes RI',
  description: 'Halaman pantauan kondisi bencana dan lingkungan meliputi BNPB, cuaca, gempa bumi, gunung berapi, karhutla, dan lainnya.',
}

export default function PantauanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
