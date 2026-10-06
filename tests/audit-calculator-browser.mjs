// Run against the isolated audit page in /tmp/gridex-audit-source only.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const origin = process.env.GRIDEX_AUDIT_ORIGIN ?? 'http://127.0.0.1:3211'
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
  await page.goto(origin+'/audit-price',{waitUntil:'networkidle',timeout:60000})

 await page.waitForFunction(()=>document.documentElement.dataset.auditReady==='true')
  await page.getByRole('button',{name:'Hämta pris',exact:true}).click()
  await quoteSeen
  assert.equal(requested.address,'Gammal gata 1')
  await page.locator('#calculator-address').fill('Ny gata 2')
  assert.equal(await page.getByTestId('audit-result').textContent(),'null')
  resolveQuote()
  await page.waitForResponse(response=>response.url().includes('/api/checkout/quote'))
  await page.waitForTimeout(250)
  assert.equal(await page.getByTestId('audit-result').textContent(),'null')
  assert.equal(await page.locator('#calculator-address').inputValue(),'Ny gata 2')
  console.log('PASSED F26: an old quote response cannot restore pricing after its address changes')
} finally { await browser.close() }
