import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Strict Indonesia Bounding Box
const ID_BOUNDS = {
  minlat: -11.5,
  maxlat: 6.5,
  minlon: 95.0,
  maxlon: 141.0,
}

// Foreign country keywords to exclude strictly to Indonesia only
const FOREIGN_KEYWORDS = [
  'philippines',
  'timor leste',
  'timor-leste',
  'papua new guinea',
  'malaysia',
  'singapore',
  'australia',
  'palau',
  'vietnam',
  'thailand',
]

function isStrictlyIndonesia(place: string, lat: number, lng: number): boolean {
  if (lat < ID_BOUNDS.minlat || lat > ID_BOUNDS.maxlat) return false
  if (lng < ID_BOUNDS.minlon || lng > ID_BOUNDS.maxlon) return false

  const p = (place || '').toLowerCase()
  return !FOREIGN_KEYWORDS.some((kw) => p.includes(kw))
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '30', 10)
    const minmagnitude = searchParams.get('minmagnitude') || '4.5'
    const customStart = searchParams.get('starttime')
    const customEnd = searchParams.get('endtime')
    const limit = searchParams.get('limit') || '300'

    // Compute start time
    let starttime = customStart
    if (!starttime) {
      const startDate = new Date(Date.now() - (isNaN(days) ? 30 : days) * 24 * 60 * 60 * 1000)
      starttime = startDate.toISOString().split('T')[0] // 'YYYY-MM-DD'
    }

    const usgsUrl = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query')
    usgsUrl.searchParams.set('format', 'geojson')
    usgsUrl.searchParams.set('minmagnitude', minmagnitude)
    usgsUrl.searchParams.set('minlatitude', String(ID_BOUNDS.minlat))
    usgsUrl.searchParams.set('maxlatitude', String(ID_BOUNDS.maxlat))
    usgsUrl.searchParams.set('minlongitude', String(ID_BOUNDS.minlon))
    usgsUrl.searchParams.set('maxlongitude', String(ID_BOUNDS.maxlon))
    usgsUrl.searchParams.set('starttime', starttime)
    if (customEnd) {
      usgsUrl.searchParams.set('endtime', customEnd)
    }
    usgsUrl.searchParams.set('limit', limit)
    usgsUrl.searchParams.set('orderby', 'time')

    const response = await fetch(usgsUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PSC119-Indonesia-DisasterMap/1.0',
      },
      next: { revalidate: 300 }, // 5 min cache
    })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: `USGS upstream error: ${response.status}` },
        { status: 502 }
      )
    }

    const geojson = await response.json()
    const features: any[] = Array.isArray(geojson.features) ? geojson.features : []

    // Filter strictly to Indonesia
    const idFeatures = features.filter((f) => {
      const coords = f.geometry?.coordinates || []
      const lng = coords[0]
      const lat = coords[1]
      const place = f.properties?.place || ''
      return isStrictlyIndonesia(place, lat, lng)
    })

    // Find max magnitude for mainshock determination
    let maxMag = -1
    let mainshockIdx = 0
    idFeatures.forEach((f, idx) => {
      const mag = Number(f.properties?.mag || 0)
      if (mag > maxMag) {
        maxMag = mag
        mainshockIdx = idx
      }
    })

    const now = Date.now()
    const earthquakePoints = idFeatures.map((f, idx) => {
      const coords = f.geometry?.coordinates || [0, 0, 10]
      const lng = Number(coords[0] || 0)
      const lat = Number(coords[1] || 0)
      const depth = Math.round(Number(coords[2] || 10))
      const mag = Number(f.properties?.mag || 0)
      const place = String(f.properties?.place || 'Wilayah Indonesia')
      const timeMs = Number(f.properties?.time || now)
      const eventDate = new Date(timeMs)

      // Time in WIB (UTC+7)
      const timeStr = eventDate.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jakarta',
      }) + ' WIB'

      const dateStr = eventDate.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      })

      const diffDays = Math.floor((now - timeMs) / (1000 * 60 * 60 * 24))
      let dateLabel = ''
      if (diffDays === 0) dateLabel = 'Hari ini'
      else if (diffDays === 1) dateLabel = 'Kemarin'
      else if (diffDays < 7) dateLabel = `${diffDays} hari lalu`
      else dateLabel = dateStr

      const isMainshock = idx === mainshockIdx

      return {
        id: f.id,
        lat,
        lng,
        depth,
        magnitude: mag,
        place,
        time: timeStr,
        dateStr,
        dateLabel,
        distKm: 0,
        isMainshock,
        mmi: f.properties?.mmi ? Number(f.properties.mmi) : undefined,
        tsunami: f.properties?.tsunami ? Number(f.properties.tsunami) : 0,
        url: f.properties?.url || undefined,
        sig: f.properties?.sig,
      }
    })

    return NextResponse.json(
      {
        success: true,
        count: earthquakePoints.length,
        params: {
          days,
          minmagnitude: Number(minmagnitude),
          starttime,
          region: 'Indonesia Only',
        },
        data: earthquakePoints,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=120',
        },
      }
    )
  } catch (error: any) {
    console.error('[API gempa-usgs] Error:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
