import assert from 'node:assert/strict'
const root = new URL('../../../', import.meta.url)
const { getLivePriceSummary, fetchDayAheadPrices } = await import(new URL('lib/gridex/livePrices.ts', root))
const { fetchDailySpotAverageFromElprisetJustNu } = await import(new URL('lib/gridex/pricing/elprisetjustnu.ts', root))
process.env.TZ = 'UTC'
const originalFetch = globalThis.fetch
try {
  const urls = []
  globalThis.fetch = async url => { urls.push(String(url)); return new Response('[]',{status:200}) }
  await fetchDayAheadPrices({ area:'SE3', date:'2026-10-06' })
  assert.ok(urls.at(-1).endsWith('/2026/10-05_SE3.json'))
  await getLivePriceSummary({supabase:{},area:'SE3',date:'2026-10-06',now:new Date('2026-10-06T10:00:00Z')})
  assert.ok(urls.at(-1).endsWith('/2026/10-04_SE3.json'))
  console.log('CONFIRMED F21: direct day fetch requests 2026-10-05 for 2026-10-06; summary reparses and requests 2026-10-04 in UTC')

  const old = [{SEK_per_kWh:1, time_start:'2026-10-04T22:00:00Z',time_end:'2026-10-04T23:00:00Z'}]
  globalThis.fetch = async () => new Response(JSON.stringify(old))
  const stale = await getLivePriceSummary({supabase:{},area:'SE3',date:'2026-10-06',now:new Date('2026-10-06T10:00:00Z')})
  assert.equal(stale.current.timeEnd, '2026-10-04T23:00:00Z')
  assert.ok(Date.parse(stale.current.timeEnd)<Date.parse('2026-10-06T10:00:00Z'))
  console.log('CONFIRMED F22: expired interval is exposed as current without freshness rejection')

  const start = Date.parse('2026-10-05T22:00:00Z')
  const entries = Array.from({length:23},(_,i)=>({SEK_per_kWh:1,
    time_start:new Date(start+i*3600000).toISOString(),time_end:new Date(start+(i+1)*3600000).toISOString()}))
  globalThis.fetch = async () => new Response(JSON.stringify(entries))
  const incomplete = await fetchDailySpotAverageFromElprisetJustNu({year:2026,month:10,day:6,priceArea:'SE3'})
  assert.equal(incomplete.samples,23)
  console.log('CONFIRMED F23: 23-hour truncated normal Stockholm day is accepted as complete and contributes to averages')

  globalThis.fetch = async () => new Response(JSON.stringify([{SEK_per_kWh:null,
    time_start:'2026-10-06T10:00:00Z',time_end:'2026-10-06T11:00:00Z'}]))
  const missing = await getLivePriceSummary({supabase:{},area:'SE3',date:'2026-10-06',now:new Date('2026-10-06T10:30:00Z')})
  assert.equal(missing.current.sekPerKwh,0)
  console.log('CONFIRMED F23: missing SEK_per_kWh=null is normalized as a genuine zero spot price')
} finally { globalThis.fetch = originalFetch }
