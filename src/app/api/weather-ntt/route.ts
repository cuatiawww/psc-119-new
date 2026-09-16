import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 300

interface WeatherKabupaten {
  kabupaten: string
  lat: number
  lng: number
  temp: number
  humidity: number
  windSpeed: number
  windDirection: number
  weatherCode: number
  condition: string
  iconType: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'heavy_rain' | 'thunderstorm'
  description: string
  warningStatus: 'Aman' | 'Waspada Hujan' | 'Waspada Angin Kencang' | 'Waspada Gelombang'
}

const NTT_LOCATIONS = [
  { kabupaten: 'Flores Timur', lat: -8.3421, lng: 122.9814 },
  { kabupaten: 'Sikka', lat: -8.6214, lng: 122.2155 },
  { kabupaten: 'Ende', lat: -8.8415, lng: 121.6582 },
  { kabupaten: 'Nagekeo', lat: -8.6752, lng: 121.2891 },
  { kabupaten: 'Ngada', lat: -8.7891, lng: 120.9664 },
  { kabupaten: 'Manggarai', lat: -8.6148, lng: 120.4632 },
  { kabupaten: 'Manggarai Timur', lat: -8.8033, lng: 120.5982 },
  { kabupaten: 'Manggarai Barat', lat: -8.5142, lng: 119.8924 },
  { kabupaten: 'Kota Kupang', lat: -10.1772, lng: 123.607 },
]

function mapWmoCode(code: number) {
  if (code === 0) return { condition: 'Cerah', iconType: 'sunny' as const, warning: 'Aman' as const }
  if (code === 1 || code === 2) return { condition: 'Cerah Berawan', iconType: 'partly_cloudy' as const, warning: 'Aman' as const }
  if (code === 3) return { condition: 'Berawan Tebal', iconType: 'cloudy' as const, warning: 'Aman' as const }
  if (code >= 45 && code <= 48) return { condition: 'Berkabut', iconType: 'cloudy' as const, warning: 'Aman' as const }
  if (code >= 51 && code <= 55) return { condition: 'Gerimis Ringan', iconType: 'rain' as const, warning: 'Aman' as const }
  if (code >= 61 && code <= 65) return { condition: 'Hujan Sedang', iconType: 'rain' as const, warning: 'Waspada Hujan' as const }
  if (code >= 80 && code <= 82) return { condition: 'Hujan Lebat / Deras', iconType: 'heavy_rain' as const, warning: 'Waspada Hujan' as const }
  if (code >= 95 && code <= 99) return { condition: 'Hujan Petir & Angin Kencang', iconType: 'thunderstorm' as const, warning: 'Waspada Angin Kencang' as const }
  return { condition: 'Berawan', iconType: 'partly_cloudy' as const, warning: 'Aman' as const }
}

let cachedWeatherData: { timestamp: number; data: WeatherKabupaten[]; summary: any } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

export async function GET() {
  const now = Date.now()
  if (cachedWeatherData && now - cachedWeatherData.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      source: 'cache',
      updated_at: new Date(cachedWeatherData.timestamp).toISOString(),
      summary: cachedWeatherData.summary,
      data: cachedWeatherData.data,
    })
  }

  try {
    const latitude = NTT_LOCATIONS.map((location) => location.lat.toFixed(4)).join(',')
    const longitude = NTT_LOCATIONS.map((location) => location.lng.toFixed(4)).join(',')
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&timezone=Asia%2FMakassar`
    const response = await fetch(url, { next: { revalidate: 300 } })

    if (response.ok) {
      const payload = await response.json()
      const results = Array.isArray(payload) ? payload : [payload]
      const data: WeatherKabupaten[] = results.map((item: any, index: number) => {
        const location = NTT_LOCATIONS[index] || { kabupaten: `Wilayah ${index + 1}`, lat: item.latitude, lng: item.longitude }
        const current = item.current || {}
        const temp = Math.round(Number(current.temperature_2m ?? 29))
        const humidity = Math.round(Number(current.relative_humidity_2m ?? 75))
        const windSpeed = Math.round(Number(current.wind_speed_10m ?? 14))
        const windDirection = Math.round(Number(current.wind_direction_10m ?? 120))
        const weatherCode = Number(current.weather_code ?? 1)
        const mapped = mapWmoCode(weatherCode)
        return {
          kabupaten: location.kabupaten,
          lat: location.lat,
          lng: location.lng,
          temp,
          humidity,
          windSpeed,
          windDirection,
          weatherCode,
          condition: mapped.condition,
          iconType: mapped.iconType,
          description: `${mapped.condition}, Angin ${windSpeed} km/jam`,
          warningStatus: windSpeed > 30 ? 'Waspada Angin Kencang' : mapped.warning,
        }
      })
      const avg = (selector: (item: WeatherKabupaten) => number) => Math.round(data.reduce((sum, item) => sum + selector(item), 0) / Math.max(data.length, 1))
      const summary = {
        provinsi: 'NUSA TENGGARA TIMUR',
        avg_temp: avg((item) => item.temp),
        avg_humidity: avg((item) => item.humidity),
        avg_wind_speed: avg((item) => item.windSpeed),
        predominant_condition: 'Cerah Berawan',
        status_cuaca_umum: avg((item) => item.windSpeed) > 25 ? 'Waspada Gelombang & Angin Kencang' : 'Kondisi Cuaca Cukup Kondusif',
      }
      cachedWeatherData = { timestamp: now, data, summary }
      return NextResponse.json({ success: true, source: 'open-meteo-live', updated_at: new Date(now).toISOString(), summary, data })
    }
  } catch (error) {
    console.warn('[API weather-ntt] Fetch error:', error)
  }

  return NextResponse.json({
    success: false,
    source: 'live_unavailable',
    updated_at: new Date(now).toISOString(),
    summary: null,
    data: [],
    message: 'Data cuaca BMKG / Open-Meteo sedang tidak tersedia',
  })
}
