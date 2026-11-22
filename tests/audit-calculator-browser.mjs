// Run against the isolated audit page in /tmp/gridex-audit-source only.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const origin = process.env.GRIDEX_AUDIT_ORIGIN ?? 'http://127.0.0.1:3211'
const browser = await chromium.launch({ headless:true })
try {
  const page = await browser.newPage({viewport:{width:1280,height:1000}})
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      get() { throw new DOMException('Synthetic storage restriction', 'SecurityError') },
    })
  })
  let resolveQuote
  let receivedQuote
  const quoteSeen = new Promise(r=>{receivedQuote=r})
  const quoteRelease = new Promise(r=>{resolveQuote=r})
  let releaseHandoff
  const heldHandoff = new Promise(resolve => { releaseHandoff = resolve })
  let releaseCancelledHandoff
  const cancelledHandoff = new Promise(resolve => { releaseCancelledHandoff = resolve })
  const handoffs = []
  let requested
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.abort()
    if (url.pathname === '/api/checkout/energy-area/resolve') return route.fulfill({json:{data:{
      status:'verified',price_area_code:'SE3',resolution_id:'resolution_audit',resolution_token:'synthetic-area-token',
      valid_until:new Date(Date.now()+30*60_000).toISOString(), capabilities:{pricing_ready:true},
      price_area_assurance:{status:'verified',price_area:'SE3',unique_price_area_count:1},
    }}})
    if (url.pathname === '/api/checkout/quote') {
      requested = route.request().postDataJSON(); receivedQuote(); await quoteRelease
      return route.fulfill({json:{data:{
        contract:{name:'Syntetiskt avtal',slug:'offer_audit',offer_reference:'offer_audit',contractType:'fixed'},
        resolution_id:'resolution_audit',valid_until:'2099-01-01T00:00:00Z',customer_type:'private',
        settlement:{model:'fixed_price',customer_accepts:'fixed_energy_price',energy_price_locked_at_signup:true,
          uses_actual_metered_consumption:true,market_data_role:'not_applicable',settlement_resolution:'fixed'},
        area_price_reference:null,priceArea:'SE3',kwh:100,annual_consumption_kwh:1200,pricePerKwhOre:100,
        totalMonthlyCostSek:149,totalMonthlyCostInclVatSek:186.25,assumptions:[],
        energy_direction:'consumption',production_pricing:null,price_option_reference:'option_audit',
        invoice_delivery_method:'e_invoice',site_count:1,selected_component_references:[],
        pricing_token:'synthetic-signed-pricing', start_date:'2026-10-06',requested_start_mode:'earliest_possible',is_binding:true,
      }}})
    }
    if (url.pathname === '/api/checkout/context') {
      handoffs.push(route.request().postDataJSON())
      if (handoffs.length === 1) {
        await heldHandoff
        return route.fulfill({ status: 503, json: { error: 'Synthetic outage' } })
      }
      if (handoffs.length === 3) await cancelledHandoff
      return route.fulfill({ json: { checkout_token: 'synthetic-checkout' } })
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({json:{authenticated:false,data:null}})
    return route.continue()
  })
  await page.goto(origin+'/audit-price',{waitUntil:'networkidle',timeout:60000})

  await page.waitForFunction(() => document.documentElement.dataset.auditReady === 'true')
  assert.equal(await page.locator('#calculator-address').getAttribute('maxlength'), '180')
  assert.match(await page.locator('#calculator-address-limit').textContent(), /180 tecken/)
  const business = page.getByRole('radio', { name: 'Företag', exact: true })
  const personal = page.getByRole('radio', { name: 'Privatkund', exact: true })
  await business.check()
  assert.equal(await business.isChecked(), true)
  await personal.check()
  await page.getByRole('button',{name:'Hämta pris',exact:true}).click()
  await quoteSeen
  assert.equal(requested.address,'Gammal gata 1')
  const cancelledQuote = page.waitForEvent('requestfailed', {
    predicate: request => new URL(request.url()).pathname === '/api/checkout/quote',
  })
  await page.locator('#calculator-address').fill('Ny gata 2')
  assert.equal(await page.getByTestId('audit-result').textContent(),'null')
  assert.match((await cancelledQuote).failure().errorText, /ERR_ABORTED/)
  resolveQuote()
  await page.waitForTimeout(250)
  assert.equal(await page.getByTestId('audit-result').textContent(),'null')
  assert.equal(await page.locator('#calculator-address').inputValue(),'Ny gata 2')
  assert.equal(handoffs.length, 0)
  await page.getByRole('button', { name: 'Hämta pris', exact: true }).click()
  await page.getByText('Skapar teckningslänken…').waitFor()
  const quote = JSON.parse(await page.getByTestId('audit-result').textContent())
  assert.equal(quote.totalMonthlyCostInclVatSek, 186.25)
  assert.equal(await page.getByRole('link', { name: 'Teckna elavtal' }).count(), 0)
  releaseHandoff()
  const retry = page.getByRole('button', { name: 'Försök skapa teckningslänken igen' })
  await retry.waitFor()
  assert.equal(JSON.parse(await page.getByTestId('audit-result').textContent()).totalMonthlyCostInclVatSek, 186.25)
  assert.equal(await page.getByRole('link', { name: 'Teckna elavtal' }).count(), 0)
  await retry.click()
  const signup = page.getByRole('link', { name: 'Teckna elavtal' })
  await signup.waitFor()
  assert.equal(await signup.getAttribute('href'), '/teckna-avtal?checkout=synthetic-checkout')
  assert.equal(handoffs.length, 2)
  assert.deepEqual(handoffs[0], handoffs[1])
  await page.getByRole('button', { name: 'Hämta pris', exact: true }).click()
  await page.getByText('Skapar teckningslänken…').waitFor()
  const contextFailure = page.waitForEvent('requestfailed', {
    predicate: request => new URL(request.url()).pathname === '/api/checkout/context',
  })
  await page.locator('#calculator-address').fill('Ny gata 3')
  assert.match((await contextFailure).failure().errorText, /ERR_ABORTED/)
  releaseCancelledHandoff()
  assert.equal(await page.getByRole('link', { name: 'Teckna elavtal' }).count(), 0)
  assert.equal(await page.getByTestId('audit-result').textContent(), 'null')
  assert.deepEqual(errors, [])
  console.log('PASSED GW42: checkout works without browser session storage')
  console.log('PASSED GW95: replaced quote and checkout requests are aborted')
  console.log('PASSED GW94: quote remains visible while checkout is pending or failed, and retry reuses the signed submission')
  console.log('PASSED F26: an old quote response cannot restore pricing after its address changes')
} finally { await browser.close() }
