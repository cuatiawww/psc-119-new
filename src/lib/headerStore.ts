import { create } from 'zustand'

interface HeaderState {
  title: string
  description: string
  lastUpdated: string
  sourceLabel: string
  sourceUrl: string
  setHeader: (data: {
    title: string
    description?: string
    lastUpdated?: string
    sourceLabel?: string
    sourceUrl?: string
  }) => void
  resetHeader: () => void
}

export const useHeaderStore = create<HeaderState>((set) => ({
  title: 'DASHBOARD PSC 119 — SPGDT KEMENKES RI',
  description: 'Sistem Informasi Terpadu Pemantauan Panggilan Gawat Darurat, Ambulans, dan Rujukan RS 119',
  lastUpdated: '',
  sourceLabel: 'PSC 119 KEMENKES',
  sourceUrl: 'https://psc.kemkes.go.id',
  setHeader: (data) => set({
    title: data.title,
    description: data.description || '',
    lastUpdated: data.lastUpdated || '',
    sourceLabel: data.sourceLabel || '',
    sourceUrl: data.sourceUrl || '',
  }),
  resetHeader: () => set({
    title: 'DASHBOARD PSC 119 — SPGDT KEMENKES RI',
    description: 'Sistem Informasi Terpadu Pemantauan Panggilan Gawat Darurat, Ambulans, dan Rujukan RS 119',
    lastUpdated: '',
    sourceLabel: 'PSC 119 KEMENKES',
    sourceUrl: 'https://psc.kemkes.go.id',
  }),
}))
