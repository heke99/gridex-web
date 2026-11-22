import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser=await chromium.launch({headless:true})
const origin=process.env.GRIDEX_AUDIT_ORIGIN ?? 'http://127.0.0.1:3211'
try {
 const page=await browser.newPage()
 let applications=0,switches=0
 await page.clock.install()
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort()
  if(url.pathname.startsWith('/api/checkout/applications/')){
   applications++
   const signed = applications > 1
   return route.fulfill({ json: { data: {
    status: signed ? 'completed' : 'processing', stage: 'test', missing_customer_action: false, updated_at: null,
    customer_number: signed ? 'CUSTOMER-AUDIT' : null,
    requested_start_date: '2026-12-05', confirmed_start_date: signed ? '2026-12-14' : null,
    checkout: {
     page_state: 'processing', customer_action_required: false,
     agreement: {
      status: signed ? 'signed' : null, contract_number: signed ? 'CONTRACT-AUDIT' : null,
      signed_at: signed ? '2026-11-22T23:30:00Z' : null,
      withdrawal_deadline_at: signed ? '2026-12-06T23:59:00Z' : null,
      signature_snapshot_sha256: null,
     },
     confirmation_email: { expected: true, status: signed ? 'delivered' : 'queued' },
    },
   } } })
  }
  if(url.pathname==='/api/checkout/switch-status'){
   switches++;return route.fulfill({status:410,json:{error:{code:'expired_result'}}})
  }
  return route.continue()
 })
 await page.goto(origin+'/audit-status',{waitUntil:'networkidle',timeout:60000})
 await page.waitForFunction(()=>document.documentElement.dataset.auditReady==='true')
 await page.getByText('Avtalsbekräftelsen är köad.',{exact:true}).waitFor()
 await page.getByRole('heading', { name: 'Din ansökan behandlas' }).waitFor()
 await page.getByText('Avtalet behandlas fortfarande.', { exact: true }).waitFor()
 await page.getByText('Önskat startdatum 2026-12-05', { exact: true }).waitFor()
 assert.equal(await page.locator('[data-application-status]').getAttribute('data-application-status'),'processing')
 await page.clock.pauseAt(new Date(Date.now()+1000))
 await page.clock.runFor(60000)
 await page.getByText('Avtalsbekräftelsen har levererats till mottagarens mejlserver.',{exact:true}).waitFor()
 await page.getByRole('heading', { name: 'Ditt avtal är klart' }).waitFor()
 await page.getByText('CONTRACT-AUDIT', { exact: true }).waitFor()
 await page.getByText('CUSTOMER-AUDIT', { exact: true }).waitFor()
 await page.getByText(/Avtalet är signerat.*00:30/).waitFor()
 await page.getByText(/Ångerfristen löper till.*00:59 svensk tid/).waitFor()
 assert.equal(await page.getByText('Avtalet behandlas fortfarande.', { exact: true }).count(), 0)
 await page.getByText('Bekräftat startdatum 2026-12-14', { exact: true }).waitFor()
 assert.equal(await page.getByText('Önskat startdatum 2026-12-05', { exact: true }).count(), 0)
 assert.equal(await page.locator('[data-application-status]').getAttribute('data-application-status'),'completed')
 assert.equal(applications,2);assert.equal(switches,1)
 await page.clock.runFor(600000)
 assert.equal(applications,2);assert.equal(switches,1)
 console.log('PASSED F05/F13: checkout controls current display, email delivery refreshes, and terminal/expired states stop polling')
 console.log('PASSED GW56: a confirmed start date replaces the clearly labeled requested date')
 console.log('PASSED GW44: verified signing updates the headline, contract number and Swedish withdrawal deadline together')
 await page.close()

 const recovery = await browser.newPage()
 const clockStart = new Date('2026-11-22T10:00:00Z')
 const frozenAt = new Date(clockStart.getTime() + 1_000)
 const httpDate = new Date(frozenAt.getTime() + 240_000).toUTCString()
 const calls = { application: 0, switch: 0 }
 await recovery.clock.install({ time: clockStart })
 await recovery.clock.pauseAt(frozenAt)
 await recovery.route('**/*', route => {
  const url = new URL(route.request().url())
  if (url.hostname !== '127.0.0.1') return route.abort()
  const application = url.pathname.startsWith('/api/checkout/applications/')
  if (!application && url.pathname !== '/api/checkout/switch-status') return route.continue()
  const n = ++calls[application ? 'application' : 'switch']
  if (n === 1) return route.fulfill({ status: 429, headers: { 'Retry-After': application ? '240' : httpDate }, json: {} })
  if (n === 2) return route.fulfill({ status: 503, json: {} })
  return route.fulfill({ json: { data: application
   ? { status: 'completed', stage: 'test', missing_customer_action: false, updated_at: null }
   : { status: 'completed', label: 'Bytet klart i testet', message: 'Klart', updated_at: null, terminal: true },
  } })
 })
 await recovery.goto(origin + '/audit-status', { waitUntil: 'networkidle', timeout: 60_000 })
 await recovery.getByText('Aktuell status kunde inte hämtas. Din teckning är fortfarande registrerad.', { exact: true }).waitFor()
 assert.deepEqual(calls, { application: 1, switch: 1 })
 await recovery.clock.runFor(120_000)
 await recovery.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  document.dispatchEvent(new Event('visibilitychange'))
  window.dispatchEvent(new Event('online'))
 })
 await recovery.clock.runFor(119_999)
 assert.deepEqual(calls, { application: 1, switch: 1 }, 'both Retry-After forms prevent early retries')
 await recovery.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  document.dispatchEvent(new Event('visibilitychange'))
 })
 await recovery.clock.runFor(10_000)
 assert.deepEqual(calls, { application: 1, switch: 1 }, 'overdue polls wait while hidden')
 const retrying = [
  recovery.waitForResponse(response => response.url().includes('/api/checkout/applications/') && response.status() === 503),
  recovery.waitForResponse(response => response.url().includes('/api/checkout/switch-status') && response.status() === 503),
 ]
 await recovery.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  document.dispatchEvent(new Event('visibilitychange'))
  window.dispatchEvent(new Event('online'))
 })
 await Promise.all(retrying)
 await recovery.waitForLoadState('networkidle')
 assert.deepEqual(calls, { application: 2, switch: 2 }, 'both due polls resume once on simultaneous events')
 await recovery.clock.runFor(239_999)
 assert.deepEqual(calls, { application: 2, switch: 2 }, '503 without a header uses the current local backoff')
 await recovery.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }))
 await recovery.clock.runFor(10_000)
 assert.deepEqual(calls, { application: 2, switch: 2 }, 'overdue polls wait while offline')
 await recovery.evaluate(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  window.dispatchEvent(new Event('online'))
 })
 await recovery.getByText('Bytet klart i testet', { exact: true }).waitFor()
 await recovery.locator('[data-application-status="completed"]').waitFor()
 assert.deepEqual(calls, { application: 3, switch: 3 })
 await recovery.clock.runFor(600_000)
 await recovery.evaluate(() => window.dispatchEvent(new Event('online')))
 assert.deepEqual(calls, { application: 3, switch: 3 }, 'terminal polls stay stopped after online events')
 console.log('PASSED GW134/GW135: server delays, backoff, visibility, reconnect and single-flight polling on both status cards')
}finally{await browser.close()}
