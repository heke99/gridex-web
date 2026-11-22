import assert from 'node:assert/strict'
import {
  fetchDailySpotAverageFromElprisetJustNu,
  fetchMonthlySpotAverageFromElprisetJustNu,
  stockholmDateParts,
} from '../lib/gridex/pricing/elprisetjustnu.ts'

import { getLivePriceSummary } from '../lib/gridex/livePrices.ts'

import { importMonthlySpotPrices, normalizePriceAreas, previousMonth } from '../lib/integrations/spotMarket.ts'

import { GET as monthlyPrice } from '../app/api/elpris/monthly/route.ts'

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
  const input = {
    area: 'SE3',
    date: '2026-07-20',
    now: new Date('2026-07-19T22:05:00.000Z'),
  }
  globalThis.fetch = async () => Response.json(quarterEntries([false, '  ', [], null], input.date))
  const missing = await getLivePriceSummary(input)
  assert.deepEqual(missing.stats, {
    averageSekPerKwh: null,
    averageOrePerKwh: null,
    minSekPerKwh: null,
    maxSekPerKwh: null,
    samples: 0,
  })
  assert.equal(missing.current, null)

  globalThis.fetch = async () => Response.json(quarterEntries([0, '-0,25'], input.date))
  const actual = await getLivePriceSummary(input)
  assert.equal(actual.current?.sekPerKwh, 0)
  assert.equal(actual.stats.minSekPerKwh, -0.25)
  assert.equal(actual.stats.maxSekPerKwh, 0)
  assert.equal(actual.stats.averageSekPerKwh, -0.125)

  const marketDay = quarterEntries([0, -0.25], input.date)
  globalThis.fetch = async () => Response.json([marketDay[0]])
  const incomplete = await getLivePriceSummary(input)
  assert.equal(incomplete.current?.sekPerKwh, 0)
  assert.equal(incomplete.stats.averageSekPerKwh, null)
  assert.equal(incomplete.stats.samples, 1)

  globalThis.fetch = async () => Response.json([...marketDay].reverse())
  assert.equal((await getLivePriceSummary(input)).stats.averageSekPerKwh, -0.125)
  for (const rows of [[marketDay[0], { ...marketDay[0], SEK_per_kWh: 1 }], [{ ...marketDay[0], SEK_per_kWh: 1 }, marketDay[0]]]) {
    globalThis.fetch = async () => Response.json(rows)
    await assert.rejects(getLivePriceSummary(input), { status: 502 })
  }

  assert.deepEqual(previousMonth(new Date('2025-12-31T23:30:00Z')), { year: 2025, month: 12 })
  assert.deepEqual(previousMonth(new Date('2026-06-30T22:30:00Z')), { year: 2026, month: 6 })
  assert.deepEqual(normalizePriceAreas(), ['SE1', 'SE2', 'SE3', 'SE4'])
  assert.deepEqual(normalizePriceAreas([' se1 ', 'SE1']), ['SE1'])
  for (const invalid of [null, [], 'SE1', ['SE1', 'SE0'], [false]]) {
    assert.throws(() => normalizePriceAreas(invalid), { status: 400 })
  }

  const writes = []
  const db = {
    async rpc(name, params) {
      writes.push({ name, params });
      return { data: 'synthetic-sync', error: null };
    },
  };
  const month = { year: 2026, month: 9, areas: ['SE4'] };
  let calls = 0;
  const activeSignals = [];
  globalThis.fetch = async (_url, { signal }) => {
    calls++;
    activeSignals.push(signal);
    if (calls === 1) return new Response(null, { status: 502 });
    await new Promise(resolve => setImmediate(resolve));
    return Response.json([]);
  };
  await assert.rejects(importMonthlySpotPrices(db, month), { status: 502 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 4, 'no further days are scheduled after the first failed fetch');
  assert.ok(activeSignals.every(signal => signal.aborted));
  assert.deepEqual(writes, []);

  globalThis.fetch = async url => {
    const date = String(url).match(/2026\/09-(\d{2})_/)[1];
    if (date === '02') return new Response(null, { status: 404 });
    return Response.json(quarterEntries([0.25], `2026-09-${date}`));
  };
  await assert.rejects(importMonthlySpotPrices(db, month), { status: 502 });
  assert.deepEqual(writes, [], 'a missing day cannot save any monthly basis');
  globalThis.fetch = async url => {
    const date = String(url).match(/2026\/09-(\d{2})_/)[1];
    return Response.json(quarterEntries([0.25], `2026-09-${date}`));
  };
  const complete = await importMonthlySpotPrices(db, month);
  assert.equal(complete.areas[0].avgSpotOre, 25);
  assert.equal(complete.areas[0].samples, 30 * 96);
  assert.equal(writes[0].name, 'gridex_import_monthly_spot_prices');
  assert.equal(writes[0].params.p_publish, false);

  const monthlyRequest = (query = '') => monthlyPrice(new Request(`https://local.invalid/api/elpris/monthly?${query}`))
  globalThis.fetch = () => assert.fail('validation must happen before any provider request')
  for (const [query, field] of [['area=SE99', 'area'], ['year=', 'year'], ['month=13', 'month'], ['month=0xA', 'month']]) {
    const response = await monthlyRequest(query)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).field, field)
  }

  globalThis.fetch = async () => new Response(null, { status: 404 })
  const unpublished = await monthlyRequest('area=SE2&year=2030&month=4')
  assert.equal(unpublished.status, 404)
  assert.equal((await unpublished.json()).code, 'spot_prices_not_published')

  globalThis.fetch = async url => String(url).includes('/07-01_')
    ? Response.json(quarterEntries([0.25], '2030-07-01'))
    : new Response(null, { status: 404 })
  const incompleteMonth = await monthlyRequest('area=SE2&year=2030&month=7')
  assert.equal(incompleteMonth.status, 422)
  assert.equal((await incompleteMonth.json()).code, 'spot_prices_incomplete')

  globalThis.fetch = async () => new Response(null, { status: 502 })
  const providerFailure = await monthlyRequest('area=SE2&year=2030&month=8')
  assert.equal(providerFailure.status, 503)
  assert.equal((await providerFailure.json()).code, 'spot_provider_unavailable')
} finally {
  globalThis.fetch = originalFetch
}

console.log('Elprisetjustnu API tests passed')

{
  const { PGlite } = await import('@electric-sql/pglite')
  const { readFile } = await import('node:fs/promises')
  const db = new PGlite()
  try {
    const readMigration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
    const marketSchema = await readMigration('20260602010000_market_price_and_invoice_integrations.sql')
    const portalSchema = await readMigration('20260306_customer_portal_enterprise.sql')
    const migration = await readMigration('20261122091131_atomic_spot_price_import.sql')
    const ddl = (schema, name) => schema.match(new RegExp(`create table if not exists public\\.${name} \\(\\n[\\s\\S]+?\\n\\);`))[0]
    const publish = marketSchema.slice(
      marketSchema.indexOf('create or replace function public.gridex_spot_publish_active_basis('),
      marketSchema.indexOf('drop function if exists public.gridex_spot_rollback_last_publish'),
    )
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql as 'select null::uuid';
      create table public.external_system_connections (id uuid primary key);
      create type public.gridex_sync_status as enum ('queued', 'success', 'dead_letter');
      ${ddl(portalSchema, 'integration_sync_jobs')}
      ${ddl(marketSchema, 'gridex_monthly_spot_prices')}
      ${ddl(marketSchema, 'gridex_spot_basis_config')}
      ${ddl(marketSchema, 'gridex_spot_basis_publish_log')}
      insert into public.gridex_spot_basis_config (active_year, active_month) values (2026, 8);
      ${publish}
      ${migration}
    `)
    const save = (areas, publish = false) => db.query(
      'select public.gridex_import_monthly_spot_prices(2026, 9, $1::jsonb, $2, $3) as job',
      [JSON.stringify(areas), publish, 'syntetisk lokal kontroll'],
    )
    const first = { priceArea: 'SE1', avgSpotOre: -12.5, samples: 2880 }
    await assert.rejects(save([first], true), /all 4 price areas/)
    assert.deepEqual((await db.query('select * from public.gridex_monthly_spot_prices')).rows, [])
    assert.deepEqual((await db.query('select * from public.integration_sync_jobs')).rows, [])

    const complete = [first, ...['SE2', 'SE3', 'SE4'].map(priceArea => ({ priceArea, avgSpotOre: 0, samples: 2880 }))]
    const { rows } = await save(complete, true)
    assert.equal(typeof rows[0].job, 'string')
    const saved = await db.query('select price_area, avg_spot_ore from public.gridex_monthly_spot_prices order by price_area')
    assert.equal(Number(saved.rows[0].avg_spot_ore), -12.5)
    assert.equal(Number(saved.rows[1].avg_spot_ore), 0)
    const active = await db.query('select active_month from public.gridex_spot_basis_config')
    assert.equal(active.rows[0].active_month, 9)
    assert.equal((await db.query('select count(*)::int as count from public.integration_sync_jobs')).rows[0].count, 1)

    await db.exec('alter table public.integration_sync_jobs add constraint synthetic_sync_outage check (false) not valid')
    await assert.rejects(save([{ ...first, avgSpotOre: 55 }]), { code: '23514' })
    const rolledBack = await db.query("select avg_spot_ore from public.gridex_monthly_spot_prices where price_area = 'SE1'")
    assert.equal(Number(rolledBack.rows[0].avg_spot_ore), -12.5)
  } finally {
    await db.close()
  }
}
