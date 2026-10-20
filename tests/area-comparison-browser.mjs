import assert from 'node:assert/strict'
import { chromium, firefox } from 'playwright'

const origin = process.env.GRIDEX_AREA_ORIGIN
assert.ok(origin?.startsWith('http://127.0.0.1:'), 'isolated origin required')
const engine = process.env.GRIDEX_AREA_BROWSER ?? 'chromium'
assert.ok(['chromium', 'firefox'].includes(engine))
const browser = await ({ chromium, firefox })[engine].launch({ headless: true })
let checks = 0
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const areaResponse = area => ({
  status: 'verified', price_area_code: area, resolution_id: `resolution_synthetic_${area}`,
  resolution_token: `synthetic-area-token-${area}`, valid_until: new Date(Date.now() + 30 * 60_000).toISOString(),
  price_area_assurance: { status: 'verified', price_area: area, unique_price_area_count: 1, candidate_count: 1, confidence: 1, source: 'address_polygon', source_version: 'synthetic' },
  capabilities: { pricing_ready: true, quote_ready: true, facility_lookup_ready: false, switch_request_creatable: false, switch_dispatch_ready: false },
})

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport })
    const errors = []
    async function fixture(restored = false) {
      const page = await context.newPage()
      const state = { area: 'SE1', mode: 'normal', resolutions: [], quotes: [], handoffs: [], heldArea: null, heldQuote: null }
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/*', async route => {
        const url = new URL(route.request().url())
        if (url.origin !== origin) return route.abort()
        if (url.pathname === '/api/checkout/energy-area/resolve') {
          const body = route.request().postDataJSON()
          state.resolutions.push(body)
          const area = state.area, mode = state.mode, hold = state.heldArea
          if (hold) await hold.promise
          try {
            if (mode === 'rate') return await route.fulfill({ status: 429, headers: { 'Retry-After': '60' }, json: { error: 'För många adresskontroller. Vänta en stund och försök igen.' } })
            if (mode === 'ambiguous') return await route.fulfill({ status: 409, json: { error: 'Adressen behöver kompletteras eller kontrolleras innan priset kan hämtas.' } })
            if (mode === 'html') return await route.fulfill({ contentType: 'text/html', body: '<html>Unexpected proxy body</html>' })
            return await route.fulfill({ json: { data: areaResponse(area) } })
          } catch (error) {
            if (!hold) throw error // An intentionally cancelled held request may no longer be fulfilled.
          }
          return
        }
        if (url.pathname === '/api/checkout/quote') {
          const body = route.request().postDataJSON(); state.quotes.push(body)
          const mode = state.mode, hold = state.heldQuote
          if (hold) await hold.promise
          const area = mode === 'wrong-area' ? 'SE4' : body.price_area_code
          const offer = mode === 'wrong-offer' ? 'offer_wrong' : body.offer_reference
          try { return await route.fulfill({ json: { data: {
            contract: { name: 'Syntetiskt pris', offer_reference: offer, slug: offer, contractType: offer === 'offer_area_fixed' ? 'fixed' : 'spot_monthly' },
            priceArea: area, price_area_code: area, kwh: body.estimated_monthly_kwh, annual_consumption_kwh: body.annual_consumption_kwh,
            pricePerKwhOre: 100, totalMonthlyCostSek: 149, totalMonthlyCostInclVatSek: 186.25,
            energy_direction: 'consumption', production_pricing: null, price_option_reference: 'option_area', area_price_reference: `area_price_${area}`,
            invoice_delivery_method: 'e_invoice', selected_component_references: [], site_count: 1,
            start_date: '2026-12-01', requested_start_mode: body.requested_start_mode, customer_type: body.customer_type,
            pricing_token: `synthetic-price-token-${area}`, pricing_snapshot_reference: `snapshot_${area}`, is_binding: true,
          } } }) } catch (error) { if (!hold) throw error }
          return
        }
        if (url.pathname === '/api/checkout/context') {
          const body = route.request().postDataJSON(); state.handoffs.push(body)
          return route.fulfill({ json: { checkout_token: `synthetic-checkout-${body.price_area_code}` } })
        }
        if (url.pathname.startsWith('/api/')) throw Error('Unexpected fixture API: ' + url.pathname)
        return route.continue()
      })
      await page.goto(origin + (restored ? '/restored-comparison' : '/area-comparison'), { waitUntil: 'networkidle', timeout: 60000 })
      return { page, state }
    }
    const fillAddress = async (page, suffix = '1') => {
      await page.getByLabel('Postnummer', { exact: true }).fill('11122')
      await page.getByLabel('Ort', { exact: true }).fill('Teststad')
      await page.getByLabel('Adress', { exact: true }).fill(`Syntetisk gata ${suffix}`)
    }
    const consumption = async page => {
      await page.getByText('Jag känner till årsförbrukningen', { exact: true }).click()
      await page.locator('#calculator-annual-kwh').fill('1200')
    }
    const fixtureState = async page => JSON.parse(await page.getByTestId('area-fixture-state').textContent())

    // No consumption is needed to see a customer's area. Each area survives the quote/handoff.
    for (const area of ['SE1', 'SE2', 'SE3', 'SE4']) {
      const { page, state } = await fixture(); state.area = area
      await page.getByLabel('Postnummer', { exact: true }).fill('11122')
      await page.waitForTimeout(1000)
      assert.equal(state.resolutions.length, 0, 'incomplete location must not call OPS')
      await fillAddress(page)
      await page.getByText(`Ditt elområde: ${area}`, { exact: true }).waitFor()
      assert.equal(state.resolutions.length, 1, 'debounced automatic area lookup')
      assert.equal(state.quotes.length, 0, 'area display does not assume consumption')
      await consumption(page)
      await page.getByRole('button', { name: 'Hämta pris', exact: true }).click()
      await page.getByRole('link', { name: 'Teckna elavtal', exact: true }).waitFor()
      assert.equal(state.resolutions.length, 1, 'price reuses the valid address control')
      assert.equal(state.quotes[0].price_area_code, area)
      assert.equal(state.handoffs[0].price_area_code, area)
      assert.equal((await fixtureState(page)).result.priceArea, area)
      assert.ok((await page.getByRole('link', { name: 'Teckna elavtal', exact: true }).getAttribute('href')).includes(`synthetic-checkout-${area}`))
      await page.getByRole('button', { name: 'Jämför fler elavtal', exact: true }).click()
      assert.equal(await page.locator('#calculator-address').inputValue(), 'Syntetisk gata 1')
      await page.getByLabel('Elavtal', { exact: true }).selectOption('offer_area_variable')
      await page.getByRole('button', { name: 'Hämta pris', exact: true }).click()
      await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid=area-fixture-state]').textContent).result?.contract?.offer_reference === 'offer_area_variable')
      assert.equal(state.resolutions.length, 1, 'comparing another offer keeps the same address proof')
      assert.equal(state.quotes[1].price_area_code, area)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      checks++; console.log(`PASS ${engine} ${viewport.width}px ${area}: area before consumption, matching price/handoff and comparison`)
      await page.close()
    }

    for (const mode of ['ambiguous', 'rate', 'html']) {
      const { page, state } = await fixture(); state.mode = mode
      await fillAddress(page)
      await page.getByRole('button', { name: 'Kontrollera elområdet igen', exact: true }).waitFor()
      await page.waitForTimeout(1100)
      assert.equal(state.resolutions.length, 1, 'no automatic retry loop after a failed lookup')
      assert.equal((await fixtureState(page)).resolution, null)
      assert.equal(state.quotes.length, 0)
      state.mode = 'normal'; state.area = 'SE2'
      await page.getByRole('button', { name: 'Kontrollera elområdet igen', exact: true }).click()
      await page.getByText('Ditt elområde: SE2', { exact: true }).waitFor()
      checks++; await page.close()
    }

    // In-flight address verification is shared with an immediate price click.
    {
      const { page, state } = await fixture(); state.heldArea = deferred()
      await fillAddress(page); await consumption(page)
      await page.waitForFunction(() => document.querySelector('[aria-busy=true]'))
      await page.getByRole('button', { name: 'Hämta pris', exact: true }).click()
      const held = state.heldArea; state.heldArea = null; state.area = 'SE4'
      await page.getByLabel('Adress', { exact: true }).fill('Ny syntetisk gata 4')
      await page.getByText('Ditt elområde: SE4', { exact: true }).waitFor()
      held.resolve(); await page.waitForTimeout(250)
      assert.equal((await fixtureState(page)).resolution.price_area_code, 'SE4')
      assert.equal(state.resolutions.length, 2, 'one cancelled old request and one new address')
      assert.equal(state.quotes.length, 0, 'cancelled address cannot proceed to quoting')
      checks++; await page.close()
    }

    for (const mode of ['wrong-area', 'wrong-offer']) {
      const { page, state } = await fixture(); state.area = 'SE2'; state.mode = mode
      await fillAddress(page); await consumption(page)
      await page.getByRole('button', { name: 'Hämta pris', exact: true }).click()
      await page.getByText('Priset stämmer inte med adressens elområde och valt avtal. Hämta priset igen.', { exact: true }).waitFor()
      assert.equal((await fixtureState(page)).result, null)
      assert.equal(state.handoffs.length, 0)
      checks++; await page.close()
    }

    // A restored signed commercial quote is not silently recalculated on mount.
    {
      const { page, state } = await fixture(true)
      await page.waitForTimeout(1100)
      assert.equal(state.resolutions.length, 0)
      assert.equal((await fixtureState(page)).result.pricing_token, 'synthetic-original-price-token')
      state.area = 'SE4'
      await page.getByLabel('Adress', { exact: true }).fill('Ändrad syntetisk gata 4')
      await page.getByText('Ditt elområde: SE4', { exact: true }).waitFor()
      assert.equal((await fixtureState(page)).result, null)
      checks++; await page.close()
    }
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log(JSON.stringify({ passed: true, browser: engine, scenarioRuns: checks, mode: 'real calculator and HTTP adapter, synthetic BFF responses, no actual customer/application/email' }))
} finally { await browser.close() }
