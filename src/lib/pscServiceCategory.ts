export type PscServiceCategory = 'Emergency' | 'Non Emergency' | 'Non Category'

// Master jenis layanan PSC 119:
// 1 = Emergency, 2 = Non Emergency, 3 = Non Category.
const SERVICE_CATEGORY_BY_ID: Record<string, PscServiceCategory> = {
  '1': 'Emergency',
  '2': 'Non Emergency',
  '3': 'Non Category',
}

type PscServiceCategoryInput = {
  jenis_layanan?: unknown
  id_jenis_layanan?: unknown
}

/**
 * Satu sumber klasifikasi untuk KPI card, marker, dan popup detail.
 * jenis_layanan menjadi sumber utama; id_jenis_layanan dipakai sebagai fallback.
 */
export function getPscServiceCategory({
  jenis_layanan,
  id_jenis_layanan,
}: PscServiceCategoryInput): PscServiceCategory {
  const label = String(jenis_layanan ?? '').trim().toLowerCase()

  if (SERVICE_CATEGORY_BY_ID[label]) return SERVICE_CATEGORY_BY_ID[label]
  if (label.includes('non') && (label.includes('category') || label.includes('kategori'))) return 'Non Category'
  if (label.includes('non') && label.includes('emergency')) return 'Non Emergency'
  if (label.includes('emergency')) return 'Emergency'

  return SERVICE_CATEGORY_BY_ID[String(id_jenis_layanan ?? '').trim()] || 'Non Category'
}
