import assert from 'node:assert/strict'
import {
  fetchDailySpotAverageFromElprisetJustNu,
  fetchMonthlySpotAverageFromElprisetJustNu,
  stockholmDateParts,
} from '../lib/gridex/pricing/elprisetjustnu.ts'

const originalFetch = globalThis.fetch

function quarterEntries(values, date) {
  return Array.from({ length: 96 }, (_, index) => {
    const value = values[index % values.length]
    const startMinute = index * 15
    const startHour = Math.floor(startMinute / 60)
    const startMin = startMinute % 60
    const endMinute = startMinute + 15
    const endHour = Math.floor(endMinute / 60)
    const endMin = endMinute % 60
    const iso = (hour, minute) => `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+02:00`
    return {
      SEK_per_kWh: value,
      EUR_per_kWh: value / 10,
      EXR: 10,
      time_start: iso(startHour, startMin),
      time_end: iso(endHour, endMin),
    }
  })
}

try {
  globalThis.fetch = async (url) => {
    const value = String(url)
    const date = value.match(/\/(\d{2}-\d{2})_SE3\.json$/)?.[1]
    const data = date === '07-01'
      ? quarterEntries([1, 1, 1, 1], '2026-07-01')
      : date === '07-02'
        ? quarterEntries([0, 0, 0, 0], '2026-07-02')
        : date === '07-20'
          ? quarterEntries([1, 2, -1, 0], '2026-07-20')
          : []
    return {
      status: data.length ? 200 : 404,
      ok: Boolean(data.length),
      async json() { return data },
    }
  }

  const daily = await fetchDailySpotAverageFromElprisetJustNu({
    year: 2026,
    month: 7,
    day: 20,
    priceArea: 'SE3',
  })
  assert.ok(daily)
  assert.equal(daily.avgSpotOre, 50, 'negative quarter prices must remain part of the average')
  assert.equal(daily.samples, 96)
  assert.equal(daily.intervalMinutes, 15)
  assert.equal(daily.sourceSamples, 96)
  assert.equal(daily.sourceIntervalMinutes, 15)
  assert.equal(daily.avgSpotEurPerKwh, 0.05)
  assert.equal(daily.exchangeRate, 10)
  assert.equal(daily.periodStart, '2026-07-20')

  const hourly = await fetchDailySpotAverageFromElprisetJustNu({
    year: 2026,
    month: 7,
    day: 20,
    priceArea: 'SE3',
    reportingIntervalMinutes: 60,
  })
  assert.ok(hourly)
  assert.equal(hourly.avgSpotOre, 50, 'hour aggregation must preserve the duration-weighted day average')
  assert.equal(hourly.samples, 24)
  assert.equal(hourly.intervalMinutes, 60)
  assert.equal(hourly.sourceSamples, 96)
  assert.equal(hourly.sourceIntervalMinutes, 15)

  const monthToDate = await fetchMonthlySpotAverageFromElprisetJustNu({
    year: 2026,
    month: 7,
    throughDay: 2,
    priceArea: 'SE3',
  })
  assert.ok(monthToDate)
  assert.equal(monthToDate.avgSpotOre, 50)
  assert.equal(monthToDate.samples, 192)
  assert.equal(monthToDate.periodStart, '2026-07-01')
  assert.equal(monthToDate.periodEnd, '2026-07-02')
  assert.equal(monthToDate.intervalMinutes, 15)
  assert.equal(monthToDate.sourceSamples, 192)
  assert.equal(monthToDate.sourceIntervalMinutes, 15)

  await assert.rejects(
    fetchMonthlySpotAverageFromElprisetJustNu({
      year: 2026,
      month: 7,
      throughDay: 3,
      priceArea: 'SE3',
    }),
    /saknar prisdata.*dag 3/i,
    'a partial month must never silently produce a misleading average',
  )

  assert.deepEqual(
    stockholmDateParts(new Date('2026-07-20T22:30:00.000Z')),
    { year: 2026, month: 7, day: 21 },
    'market dates must follow Europe/Stockholm rather than server UTC',
  )
} finally {
  globalThis.fetch = originalFetch
}

console.log('Elprisetjustnu API tests passed')
