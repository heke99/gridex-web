import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEnergyAreaLookup, assertQuoteMatchesArea, energyAreaLookupKey } from '../lib/website/energyAreaLookup.ts'

const address = { postal_code: '11122', city: 'Teststad', address: 'Syntetisk gata 1', requested_start_mode: 'earliest_possible', requested_start_date: null }
function resolution(area = 'SE3', now = Date.now()) {
  return { price_area_code: area, resolution_id: 'resolution_synthetic', resolution_token: 'synthetic-area-token',
    valid_until: new Date(now + 60 * 60_000).toISOString(), capabilities: { pricing_ready: true },
    price_area_assurance: { status: 'verified', price_area: area, unique_price_area_count: 1 } }
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

test('concurrent area checks share one request; a valid response is reused without sharing instances', async () => {
  let calls = 0
  const pending = deferred()
  const lookup = createEnergyAreaLookup(async () => { calls++; return pending.promise })
  const first = lookup.get(address), second = lookup.get(address)
  assert.equal(first, second)
  pending.resolve(resolution())
  assert.deepEqual(await first, await second)
  await lookup.get({ ...address, postal_code: '111 22', city: ' Teststad ' })
  assert.equal(calls, 1)
  const separate = createEnergyAreaLookup(async () => { calls++; return resolution() })
  await separate.get(address)
  assert.equal(calls, 2, 'different browser widgets never share a token/address cache')
})

test('changing address aborts an old request and its late reply cannot replace the new cache', async () => {
  const slow = deferred(); let oldSignal, calls = 0
  const lookup = createEnergyAreaLookup(async (input, options) => {
    calls++
    if (input.address === address.address) { oldSignal = options.signal; return slow.promise }
    return resolution('SE4')
  })
  const old = lookup.get(address)
  const rejected = assert.rejects(old, reason => reason.name === 'AbortError')
  const nextAddress = { ...address, address: 'Syntetisk gata 2' }
  assert.equal((await lookup.get(nextAddress)).price_area_code, 'SE4')
  assert.equal(oldSignal.aborted, true)
  slow.resolve(resolution('SE1'))
  await rejected
  assert.equal((await lookup.get(nextAddress)).price_area_code, 'SE4')
  assert.equal(calls, 2)
})

test('expired results and the Web token TTL cap require a fresh request', async () => {
  let clock = Date.now(), calls = 0
  const lookup = createEnergyAreaLookup(async () => { calls++; return resolution('SE2', clock) }, () => clock)
  await lookup.get(address)
  clock += 28 * 60_000
  await lookup.get(address)
  assert.equal(calls, 1)
  clock += 2 * 60_000
  await lookup.get(address)
  assert.equal(calls, 2, 'upstream valid_until must not outlive the capped local token')
})

test('ambiguous, malformed, blocked or expired answers cannot authorize pricing or enter the cache', async () => {
  const valid = resolution()
  const invalid = [null, {}, { ...valid, price_area_code: 'SE9' }, { ...valid, resolution_token: null },
    { ...valid, resolution_id: 123 }, { ...valid, valid_until: 'invalid' }, { ...valid, valid_until: '2000-01-01T00:00:00Z' },
    { ...valid, capabilities: { pricing_ready: false } },
    ...[{ status: 'ambiguous' }, { price_area: 'SE1' }, { unique_price_area_count: 2 }].map(patch => ({ ...valid, price_area_assurance: { ...valid.price_area_assurance, ...patch } })),
  ]
  for (const value of invalid) {
    let calls = 0
    const lookup = createEnergyAreaLookup(async () => { calls++; return value })
    await assert.rejects(lookup.get(address), /Elområdet kunde inte bekräftas/)
    await assert.rejects(lookup.get(address))
    assert.equal(calls, 2, 'failed responses are never cached as verified areas')
  }
})

test('estimated but uniquely authorized areas are valid, without becoming verified assurance', async () => {
  const value = resolution('SE1')
  value.price_area_assurance.status = 'estimated'
  assert.equal((await createEnergyAreaLookup(async () => value).get(address)).price_area_assurance.status, 'estimated')
})

test('requested start changes belong to a distinct resolution input', () => {
  assert.notEqual(energyAreaLookupKey(address), energyAreaLookupKey({ ...address, requested_start_mode: 'specific_date', requested_start_date: '2026-12-01' }))
})

test('unresponsive address checks are bounded and cancelled', async () => {
  let signal
  const lookup = createEnergyAreaLookup(async (_input, options) => new Promise((_done, reject) => {
    signal = options.signal
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }), Date.now, 10)
  await assert.rejects(lookup.get(address), /tog för lång tid/)
  assert.equal(signal.aborted, true)
})

test('actual HTTP adapter rejects429/HTML/malformed bodies and forwards cancellation', async () => {
  const previous = globalThis.fetch; let calls = 0, forwarded
  try {
    globalThis.fetch = async (_url, init) => { calls++; forwarded = init.signal; return new Response(JSON.stringify({ error: 'För många adresskontroller. Vänta en stund och försök igen.' }), { status: 429, headers: { 'Content-Type': 'application/json' } }) }
    const lookup = createEnergyAreaLookup()
    await assert.rejects(lookup.get(address), /För många adresskontroller/)
    assert.equal(calls, 1, 'rate limits never start a retry loop')
    assert.ok(forwarded instanceof AbortSignal)
    for (const response of [() => new Response('<html>proxy</html>', { headers: { 'Content-Type': 'text/html' } }), () => new Response('{}', { headers: { 'Content-Type': 'application/json' } })]) {
      globalThis.fetch = async () => response()
      await assert.rejects(lookup.get(address), /Elområdet kunde inte bekräftas/)
    }
  } finally { globalThis.fetch = previous }
})

test('quote identity and both area fields must match the resolved address before handoff', () => {
  const area = resolution('SE2')
  const preview = { priceArea: 'SE2', price_area_code: 'SE2', contract: { offer_reference: 'offer_synthetic' } }
  assert.doesNotThrow(() => assertQuoteMatchesArea(preview, area, 'offer_synthetic'))
  for (const wrong of [{ ...preview, priceArea: 'SE3' }, { ...preview, price_area_code: 'SE3' }, { ...preview, contract: { offer_reference: 'other_offer' } }]) assert.throws(() => assertQuoteMatchesArea(wrong, area, 'offer_synthetic'), /Priset stämmer inte/)
})
