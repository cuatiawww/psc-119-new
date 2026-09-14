/**
 * Utilities for Timeline Log & 14-Day Siaga Response Calendar
 * Pure ES module for testability and isolation.
 */

export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export const DAY_NAMES_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export function toIsoDate(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateFlexible(val) {
  if (!val) return null
  const clean = String(val).replace(/\s+WIB/i, '').trim()

  if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(clean)) {
    const parts = clean.split(/[-/ :]/)
    const day = Number(parts[0])
    const month = Number(parts[1]) - 1
    const year = Number(parts[2])
    const hours = parts[3] ? Number(parts[3]) : 0
    const mins = parts[4] ? Number(parts[4]) : 0
    const secs = parts[5] ? Number(parts[5]) : 0
    const d = new Date(year, month, day, hours, mins, secs)
    if (!isNaN(d.getTime())) return d
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.split(/[- :]/)
    const year = Number(parts[0])
    const month = Number(parts[1]) - 1
    const day = Number(parts[2])
    const hours = parts[3] ? Number(parts[3]) : 0
    const mins = parts[4] ? Number(parts[4]) : 0
    const secs = parts[5] ? Number(parts[5]) : 0
    const d = new Date(year, month, day, hours, mins, secs)
    if (!isNaN(d.getTime())) return d
  }

  const d = new Date(clean)
  if (!isNaN(d.getTime())) return d
  return null
}

export function formatIndonesianDate(isoStr) {
  const d = parseDateFlexible(isoStr)
  if (!d) return isoStr
  return `${d.getDate()} ${MONTH_NAMES_ID[d.getMonth()]} ${d.getFullYear()}`
}

export function computeSiagaRange(incidentDate, durationDays = 14) {
  const map = new Map()
  for (let i = 0; i < durationDays; i++) {
    const d = new Date(incidentDate.getFullYear(), incidentDate.getMonth(), incidentDate.getDate() + i)
    map.set(toIsoDate(d), i)
  }
  return map
}

export function normalizeLogs(logs, fallbackIsoDate) {
  return logs.map(l => {
    let iso = l.date_only
    let time = l.time_only
    if (!iso) {
      const d = parseDateFlexible(l.raw_date || l.tgl)
      if (d) {
        iso = toIsoDate(d)
        if (!time) {
          time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`
        }
      } else {
        iso = fallbackIsoDate
      }
    }
    return {
      ...l,
      date_only: iso,
      time_only: time || '00:00 WIB'
    }
  })
}

export function groupLogsByDate(normalizedLogs) {
  const map = new Map()
  normalizedLogs.forEach(log => {
    const k = log.date_only
    const arr = map.get(k) || []
    arr.push(log)
    map.set(k, arr)
  })
  return map
}

export function generateCalendarGrid(
  currentMonth,
  incidentIso,
  siagaRange,
  logsByDate,
  selectedDate
) {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const firstDayIndex = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const cells = []

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthDays - i)
    const iso = toIsoDate(d)
    const isSiaga = siagaRange.has(iso)
    cells.push({
      date: d,
      iso,
      dayNum: d.getDate(),
      isCurrentMonth: false,
      isIncident: iso === incidentIso,
      isSiaga,
      siagaDayIndex: siagaRange.get(iso),
      logCount: logsByDate.get(iso)?.length || 0,
      isSelected: selectedDate === iso
    })
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i)
    const iso = toIsoDate(d)
    const isSiaga = siagaRange.has(iso)
    cells.push({
      date: d,
      iso,
      dayNum: i,
      isCurrentMonth: true,
      isIncident: iso === incidentIso,
      isSiaga,
      siagaDayIndex: siagaRange.get(iso),
      logCount: logsByDate.get(iso)?.length || 0,
      isSelected: selectedDate === iso
    })
  }

  const targetCount = cells.length > 35 ? 42 : 35
  const remaining = targetCount - cells.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i)
    const iso = toIsoDate(d)
    const isSiaga = siagaRange.has(iso)
    cells.push({
      date: d,
      iso,
      dayNum: i,
      isCurrentMonth: false,
      isIncident: iso === incidentIso,
      isSiaga,
      siagaDayIndex: siagaRange.get(iso),
      logCount: logsByDate.get(iso)?.length || 0,
      isSelected: selectedDate === iso
    })
  }

  return cells
}

export function filterLogs(logs, selectedDate, searchQuery) {
  let list = logs
  if (selectedDate !== 'all') {
    list = list.filter(l => l.date_only === selectedDate)
  }
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim()
    list = list.filter(
      l =>
        (l.judul && l.judul.toLowerCase().includes(q)) ||
        (l.deskripsi && l.deskripsi.toLowerCase().includes(q)) ||
        (l.user_name && l.user_name.toLowerCase().includes(q)) ||
        (l.user_level && l.user_level.toLowerCase().includes(q))
    )
  }
  return list
}
