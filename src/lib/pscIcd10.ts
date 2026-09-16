type PscIcd10Input = {
  icd_10?: unknown
  spesifikasi_layanan?: unknown
  kategori_layanan?: unknown
  keluhan?: unknown
}

const cleanValue = (value: unknown) => String(value ?? '').trim()

const isPlaceholderOrServiceLabel = (value: string) => {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!normalized || normalized === 'n/a' || normalized === '-' || normalized === 'null') return true
  if (['emergency', 'non emergency', 'non category', 'non kategori'].includes(normalized)) return true
  return /ambul(?:an|ans|ance)|\bgadar\b|gawat darurat\s*119/i.test(normalized)
}

export const isValidPscIcd10Value = (value: unknown) => {
  const text = cleanValue(value)
  return Boolean(text) && !isPlaceholderOrServiceLabel(text)
}

/**
 * Menghasilkan label ICD-10 dari diagnosis yang tersedia.
 * Field jenis layanan/armada tidak pernah dijadikan diagnosis.
 */
export function resolvePscIcd10(input: PscIcd10Input): string | null {
  const providedIcd = cleanValue(input.icd_10)
  if (providedIcd && isValidPscIcd10Value(providedIcd)) return providedIcd

  const clinicalText = [input.spesifikasi_layanan, input.kategori_layanan, input.keluhan]
    .map(cleanValue)
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (/kll|kecelakaan|laka/.test(clinicalText)) return 'V01-V99 (Kecelakaan Transportasi / KLL)'
  if (/kejang|epilepsi|konvulsi/.test(clinicalText)) return 'R56 (Kejang & Konvulsi Akut)'
  if (/jantung|dada|cardiac/.test(clinicalText)) return 'I20-I25 (Kedaruratan Kardiovaskular)'
  if (/sesak|napas|asma/.test(clinicalText)) return 'J45-J98 (Gangguan Saluran Pernapasan)'
  if (/luka|robek|fraktur|patah/.test(clinicalText)) return 'S00-T14 (Cedera & Trauma Fisik)'
  if (/kia|ibu|bersalin|hamil/.test(clinicalText)) return 'O00-O99 (Kedaruratan Maternal & Neonatal)'
  if (/rawat|perawat/.test(clinicalText)) return 'Z76 (Pelayanan Medik & Keperawatan)'
  if (/non trauma/.test(clinicalText)) return 'R00-R99 (Gejala & Tanda Medis Akut)'
  if (/salah sambung|palsu/.test(clinicalText)) return 'Z00 (Konsultasi Non-Klinis)'
  if (/banjir|gempa|longsor|tsunami|erupsi|puting beliung|kebakaran/.test(clinicalText)) {
    return 'T75.8 (Dampak Medis Kedaruratan Bencana Alam)'
  }

  return null
}
