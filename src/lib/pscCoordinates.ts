export type PscCoordinateAxis = 'latitude' | 'longitude'

const COORDINATE_LIMITS: Record<PscCoordinateAxis, readonly [number, number]> = {
  latitude: [-90, 90],
  longitude: [-180, 180],
}

/**
 * Parse koordinat mentah dari API PSC tanpa menerima nilai parsial seperti
 * `1.2abc`, NaN, Infinity, atau nilai 0 yang dipakai API sebagai placeholder.
 */
export function parsePscCoordinate(value: unknown, axis: PscCoordinateAxis): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null

  const parsed = Number(String(value).trim())
  const [min, max] = COORDINATE_LIMITS[axis]

  if (!Number.isFinite(parsed) || parsed === 0 || parsed < min || parsed > max) return null
  return parsed
}

export function hasValidPscCoordinates(lat: unknown, lng: unknown): boolean {
  return parsePscCoordinate(lat, 'latitude') !== null && parsePscCoordinate(lng, 'longitude') !== null
}
