type PscResponseTimeInput = {
  response_time_minutes?: unknown
  waktu_respons?: unknown
  jam_pelaporan_panggilan?: unknown
  tgl_status_penanganan?: unknown
}

const parseMinutes = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null

  const text = String(value).trim()
  const clock = text.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/)
  const minutes = clock
    ? Number(clock[1]) * 60 + Number(clock[2]) + Number(clock[3] || 0) / 60
    : Number.parseFloat(text)

  return Number.isFinite(minutes) && minutes > 0 && minutes < 600 ? Number(minutes.toFixed(1)) : null
}

/** Memakai waktu_respons resmi bila tersedia, lalu fallback ke log waktu panggilan. */
export function getPscResponseMinutes(input: PscResponseTimeInput): number | null {
  const direct = parseMinutes(input.response_time_minutes) ?? parseMinutes(input.waktu_respons)
  if (direct !== null) return direct

  const callTime = String(input.jam_pelaporan_panggilan ?? '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)?.slice(1).map(Number)
  const statusTime = String(input.tgl_status_penanganan ?? '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)?.slice(1).map(Number)
  if (!callTime || !statusTime) return null

  const callSeconds = callTime[0] * 3600 + callTime[1] * 60 + (callTime[2] || 0)
  const statusSeconds = statusTime[0] * 3600 + statusTime[1] * 60 + (statusTime[2] || 0)
  let difference = statusSeconds - callSeconds
  if (difference < 0) difference += 24 * 3600

  const minutes = difference / 60
  return minutes > 0 && minutes < 600 ? Number(minutes.toFixed(1)) : null
}
