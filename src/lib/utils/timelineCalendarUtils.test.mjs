import test from 'node:test'
import assert from 'node:assert/strict'
import {
  toIsoDate,
  parseDateFlexible,
  formatIndonesianDate,
  computeSiagaRange,
  normalizeLogs,
  groupLogsByDate,
  generateCalendarGrid,
  filterLogs
} from './timelineCalendarUtils.js'

test('TDD 1: toIsoDate should format Date object to YYYY-MM-DD correctly', () => {
  const d = new Date(2026, 7, 19) // Month index 7 = August
  assert.equal(toIsoDate(d), '2026-08-19')
  
  const d2 = new Date(2026, 0, 5) // Month index 0 = January
  assert.equal(toIsoDate(d2), '2026-01-05')
})

test('TDD 2: parseDateFlexible should handle various date formats reliably', () => {
  // YYYY-MM-DD
  const p1 = parseDateFlexible('2026-08-19')
  assert.ok(p1)
  assert.equal(p1.getFullYear(), 2026)
  assert.equal(p1.getMonth(), 7)
  assert.equal(p1.getDate(), 19)

  // YYYY-MM-DD HH:mm:ss
  const p2 = parseDateFlexible('2026-08-19 14:30:00')
  assert.ok(p2)
  assert.equal(p2.getFullYear(), 2026)
  assert.equal(p2.getDate(), 19)

  // DD-MM-YYYY
  const p3 = parseDateFlexible('19-08-2026')
  assert.ok(p3)
  assert.equal(p3.getFullYear(), 2026)
  assert.equal(p3.getMonth(), 7)
  assert.equal(p3.getDate(), 19)

  // String with WIB
  const p4 = parseDateFlexible('19 Aug 2026 10:00 WIB')
  assert.ok(p4)
  assert.equal(p4.getFullYear(), 2026)

  // Null or empty
  assert.equal(parseDateFlexible(null), null)
  assert.equal(parseDateFlexible(''), null)
})

test('TDD 3: computeSiagaRange should compute exactly 14 consecutive days starting from T0', () => {
  const incidentDate = new Date(2026, 7, 10) // 10 August 2026
  const siagaMap = computeSiagaRange(incidentDate, 14)

  assert.equal(siagaMap.size, 14)

  // Day 1 (H+0)
  assert.equal(siagaMap.has('2026-08-10'), true)
  assert.equal(siagaMap.get('2026-08-10'), 0)

  // Day 2 (H+1)
  assert.equal(siagaMap.has('2026-08-11'), true)
  assert.equal(siagaMap.get('2026-08-11'), 1)

  // Day 14 (H+13)
  assert.equal(siagaMap.has('2026-08-23'), true)
  assert.equal(siagaMap.get('2026-08-23'), 13)

  // Day 15 should NOT be in 14-day siaga range
  assert.equal(siagaMap.has('2026-08-24'), false)
  // Day before should NOT be in siaga range
  assert.equal(siagaMap.has('2026-08-09'), false)
})

test('TDD 4: normalizeLogs & groupLogsByDate should standardize dates without side-effects', () => {
  const sampleLogs = [
    { tgl: '10 Aug 2026 08:00 WIB', raw_date: '2026-08-10 08:00:00', judul: 'Laporan Awal Kejadian' },
    { tgl: '12 Aug 2026 14:00 WIB', raw_date: '2026-08-12 14:00:00', judul: 'Update Korban Luka' },
    { tgl: '12 Aug 2026 18:00 WIB', raw_date: '2026-08-12 18:00:00', judul: 'Verifikasi Dinkes Prov' },
  ]

  const normalized = normalizeLogs(sampleLogs, '2026-08-10')
  assert.equal(normalized.length, 3)
  assert.equal(normalized[0].date_only, '2026-08-10')
  assert.equal(normalized[1].date_only, '2026-08-12')
  assert.equal(normalized[2].date_only, '2026-08-12')

  const grouped = groupLogsByDate(normalized)
  assert.equal(grouped.get('2026-08-10')?.length, 1)
  assert.equal(grouped.get('2026-08-12')?.length, 2)
  assert.equal(grouped.get('2026-08-11'), undefined)
})

test('TDD 5: generateCalendarGrid should produce complete 35 or 42 cell grid with accurate flags', () => {
  const currentMonth = new Date(2026, 7, 1) // August 2026
  const incidentIso = '2026-08-10'
  const siagaRange = computeSiagaRange(new Date(2026, 7, 10), 14)
  const logsByDate = new Map([
    ['2026-08-10', [{ judul: 'Awal' }]],
    ['2026-08-12', [{ judul: 'Up1' }, { judul: 'Up2' }]]
  ])

  const cells = generateCalendarGrid(currentMonth, incidentIso, siagaRange, logsByDate, '2026-08-12')

  assert.ok(cells.length === 35 || cells.length === 42)

  // Check Incident Cell (2026-08-10)
  const incidentCell = cells.find(c => c.iso === '2026-08-10')
  assert.ok(incidentCell)
  assert.equal(incidentCell.isIncident, true)
  assert.equal(incidentCell.isSiaga, true)
  assert.equal(incidentCell.siagaDayIndex, 0)
  assert.equal(incidentCell.logCount, 1)

  // Check Selected Cell (2026-08-12)
  const selectedCell = cells.find(c => c.iso === '2026-08-12')
  assert.ok(selectedCell)
  assert.equal(selectedCell.isSelected, true)
  assert.equal(selectedCell.isSiaga, true)
  assert.equal(selectedCell.siagaDayIndex, 2)
  assert.equal(selectedCell.logCount, 2)

  // Check Cell outside siaga range (2026-08-25)
  const nonSiagaCell = cells.find(c => c.iso === '2026-08-25')
  assert.ok(nonSiagaCell)
  assert.equal(nonSiagaCell.isSiaga, false)
  assert.equal(nonSiagaCell.isIncident, false)
})

test('TDD 6: filterLogs should accurately filter by date and search without mutating', () => {
  const sampleLogs = [
    { tgl: '10 Aug 2026', date_only: '2026-08-10', judul: 'Pembuatan Laporan Awal', user_name: 'Budi' },
    { tgl: '12 Aug 2026', date_only: '2026-08-12', judul: 'Update Korban RHA', user_name: 'Siti' },
    { tgl: '12 Aug 2026', date_only: '2026-08-12', judul: 'Verifikasi Dinkes', user_name: 'Ahmad' },
  ]

  // Filter 'all'
  const allLogs = filterLogs(sampleLogs, 'all')
  assert.equal(allLogs.length, 3)

  // Filter specific date
  const filtered12 = filterLogs(sampleLogs, '2026-08-12')
  assert.equal(filtered12.length, 2)

  // Filter empty date
  const filtered15 = filterLogs(sampleLogs, '2026-08-15')
  assert.equal(filtered15.length, 0)

  // Filter with search query
  const searched = filterLogs(sampleLogs, 'all', 'Verifikasi')
  assert.equal(searched.length, 1)
  assert.equal(searched[0].judul, 'Verifikasi Dinkes')
})

test('TDD 7: formatIndonesianDate should format month in Indonesian', () => {
  assert.equal(formatIndonesianDate('2026-08-19'), '19 Agustus 2026')
  assert.equal(formatIndonesianDate('2026-01-01'), '1 Januari 2026')
  assert.equal(formatIndonesianDate('2026-12-31'), '31 Desember 2026')
})
