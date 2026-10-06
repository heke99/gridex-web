// Run against the isolated audit page in /tmp/gridex-audit-source only.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'
const browser = await chromium.launch({ headless:true })
try {
  const page = await browser.newPage({viewport:{width:1280,height:1000}})
  let resolveQuote
  let receivedQuote
  const quoteSeen = new Promise(r=>{receivedQuote=r})
  const quoteRelease = new Promise(r=>{resolveQuote=r})
  let requested
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.abort()
    if (url.pathname === '/api/checkout/energy-area/resolve') return route.fulfill({json:{data:{
      status:'verified',price_area_code:'SE3',resolution_id:'resolution_audit',resolution_token:'synthetic-area-token',
    }}})
    if (url.pathname === '/api/checkout/quote') {
      requested = route.request().postDataJSON(); receivedQuote(); await quoteRelease
      return route.fulfill({json:{data:{
        contract:{name:'Syntetiskt avtal',slug:'offer_audit',offer_reference:'offer_audit',contractType:'fixed'},
        priceArea:'SE3',kwh:100,annual_consumption_kwh:1200,pricePerKwhOre:100,
        totalMonthlyCostSek:149,totalMonthlyCostInclVatSek:186.25,assumptions:[],
        energy_direction:'consumption',production_pricing:null,price_option_reference:'option_audit',
        invoice_delivery_method:'e_invoice',site_count:1,selected_component_references:[],
        start_date:'2026-10-06',requested_start_mode:'earliest_possible',is_binding:true,
      }}})
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({json:{authenticated:false,data:null}})
    return route.continue()
  })
  await page.goto('http://127.0.0.1:3211/audit-price',{waitUntil:'networkidle',timeout:60000})
  await page.getByRole('button',{name:'Hämta pris',exact:true}).click()
  await quoteSeen
  assert.equal(requested.address,'Gammal gata 1')
  await page.locator('#calculator-address').fill('Ny gata 2')
  assert.equal(await page.getByTestId('audit-result').textContent(),'null')
  resolveQuote()
  await page.waitForFunction(()=>document.querySelector('[data-testid="audit-result"]')?.textContent !== 'null')
  const result = JSON.parse(await page.getByTestId('audit-result').textContent())
  assert.equal(await page.locator('#calculator-address').inputValue(),'Ny gata 2')
  assert.equal(result.contract.offer_reference,'offer_audit')
  assert.equal(result.totalMonthlyCostInclVatSek,186.25)
  const evidence = {request_address:requested.address,current_input_address:await page.locator('#calculator-address').inputValue(),
    old_quote_rendered_again:true,rendered_gross_total:result.totalMonthlyCostInclVatSek}
  await writeFile('/tmp/gridex-calculator-browser-evidence.json',JSON.stringify(evidence,null,2))
  await page.screenshot({path:'/tmp/gridex-calculator-stale-result.png',fullPage:true})
  console.log('CONFIRMED F26: real browser restores quote for old address after customer changes address while quote request is pending')
} finally { await browser.close() }
