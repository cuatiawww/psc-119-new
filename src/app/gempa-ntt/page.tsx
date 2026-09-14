import { Metadata } from 'next'
import ProvNttBencanaPage from '@/components/kejadian/ProvNttBencanaPage'

export const metadata: Metadata = {
  title: 'Detail Kejadian Gempa Bumi NTT | Dashboard EOC Kemenkes',
  description: 'Pemantauan komprehensif dampak krisis kesehatan gempa bumi, sebaran korban, kerusakan faskes, dan kesiapan logistik darurat di Provinsi Nusa Tenggara Timur (NTT).',
}

export default function Page() {
  return <ProvNttBencanaPage />
}
