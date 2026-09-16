import { NextResponse } from 'next/server'

// Fallback ringan agar layer Windy tetap dapat dirender ketika provider GFS eksternal timeout.
function generateFallbackGfsWind() {
  const nx = 49
  const ny = 23
  const count = nx * ny
  const uData = new Array<number>(count)
  const vData = new Array<number>(count)

  for (let y = 0; y < ny; y++) {
    const lat = 10 - y
    for (let x = 0; x < nx; x++) {
      const lon = 94 + x
      const idx = y * nx + x
      uData[idx] = Number((Math.sin(lat * 0.2) * 4.5 + Math.cos(lon * 0.1) * 2 + 3.5).toFixed(2))
      vData[idx] = Number((Math.cos(lat * 0.15) * 3 + Math.sin(lon * 0.2) * 1.5 + 1.8).toFixed(2))
    }
  }

  const nowIso = new Date().toISOString()
  const header = (parameterNumber: number, parameterNumberName: string) => ({
    parameterCategory: 2,
    parameterNumber,
    parameterUnit: 'm.s-1',
    parameterNumberName,
    refTime: nowIso,
    nx,
    ny,
    lo1: 94,
    la1: 10,
    lo2: 142,
    la2: -12,
    dx: 1,
    dy: 1,
  })

  return [
    { header: header(2, 'U-component_of_wind'), data: uData },
    { header: header(3, 'V-component_of_wind'), data: vData },
  ]
}

export const runtime = 'nodejs'
export const revalidate = 300

export async function GET() {
  const primaryUrl = 'https://opsroom.sipongidata.my.id/api/gfs'

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    const response = await fetch(primaryUrl, {
      signal: controller.signal,
      next: { revalidate: 300 },
    })
    clearTimeout(timeoutId)

    if (response.ok) {
      const payload = await response.json()
      const data = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
      if (Array.isArray(data) && data.length >= 2) return NextResponse.json(data)
    }
  } catch {
    // Provider eksternal bersifat opsional; fallback menjaga Windy tidak mendapat 404.
  }

  return NextResponse.json(generateFallbackGfsWind())
}
