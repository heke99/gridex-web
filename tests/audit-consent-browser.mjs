import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  const analyticsRequests = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    analyticsRequests.push(url.hostname)
    return route.abort()
  })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Synthetic storage restriction', 'SecurityError') },
    })
  })
  const origin = process.env.GRIDEX_AUDIT_ORIGIN ?? 'http://127.0.0.1:3211'
  await page.goto(origin + '/audit-consent', { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Samtyckesprov' }).waitFor()
  await page.getByText('Vi använder cookies').waitFor()
  await page.getByRole('button', { name: 'Acceptera', exact: true }).first().click()
  await page.getByText('Accepterat', { exact: true }).waitFor()
  await page.getByText('Vi använder cookies').waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Nollställ valet' }).click()
  await page.getByText('Vi använder cookies').waitFor()
  await page.getByRole('button', { name: 'Avvisa', exact: true }).first().click()
  await page.getByText('Avvisat', { exact: true }).waitFor()
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('Vi använder cookies').waitFor()
  assert.deepEqual(errors, [])
  assert.deepEqual(analyticsRequests, [])
  for (const [stored, label] of [['accepted', 'Accepterat'], ['rejected', 'Avvisat']]) {
    const savedPage = await browser.newPage()
    const warnings = []
    savedPage.on('pageerror', error => warnings.push(error.message))
    savedPage.on('console', message => {
      if (message.type() === 'error' && /hydrat|#418/i.test(message.text())) warnings.push(message.text())
    })
    await savedPage.addInitScript(value => localStorage.setItem('gridex_cookie_consent', value), stored)
    const scripts = Promise.withResolvers()
    await savedPage.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.hostname !== '127.0.0.1') return route.fulfill({ body: '', contentType: 'application/javascript' })
      if (route.request().resourceType() === 'script') await scripts.promise
      return route.continue()
    })
    try {
      await savedPage.goto(origin + '/audit-consent', { waitUntil: 'commit' })
      await savedPage.getByText('Läser cookieval…', { exact: true }).waitFor()
      assert.equal(await savedPage.getByText('Vi använder cookies').count(), 0)
    } finally {
      scripts.resolve()
    }
    await savedPage.getByText(label, { exact: true }).waitFor()
    assert.equal(await savedPage.getByText('Vi använder cookies').count(), 0)
    assert.deepEqual(warnings, [])
    await savedPage.close()
  }
  const privateNavigations = [
    ['/teckna-avtal?checkout=synthetic-checkout-secret#synthetic-address', '/teckna-avtal'],
    ['/teckna-avtal/tack?result=synthetic-receipt-secret#synthetic-receipt', '/teckna-avtal/tack'],
    ['/login?next=%2Fdashboard%2Finvoices%3Fref%3Dsynthetic-login-secret#synthetic-login', '/login'],
  ]
  for (const [privateUrl, expectedPath] of privateNavigations) {
    const measured = await browser.newPage()
    await measured.route('**/*', route => {
      return new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.fulfill({ body: '', contentType: 'application/javascript' })
    })
    await measured.addInitScript(path => {
      localStorage.setItem('gridex_cookie_consent', 'accepted')
      history.replaceState(history.state, '', path)
    }, privateUrl)
    await measured.goto(origin + '/audit-consent', {
      referer: origin + '/previous?checkout=synthetic-referrer-secret',
    })
    await measured.waitForFunction(() => window.dataLayer?.some(entry => entry[0] === 'event' && entry[1] === 'page_view'))
    const events = await measured.evaluate(() => window.dataLayer
      .filter(entry => entry[0] === 'event' && entry[1] === 'page_view')
      .map(entry => entry[2]))
    assert.ok(events.length > 0)
    for (const event of events) {
      assert.equal(event.page_path, expectedPath)
      assert.equal(event.page_location, origin + expectedPath)
      assert.equal(event.page_referrer, origin)
      assert.doesNotMatch(JSON.stringify(event), /synthetic-/)
    }
    await measured.close()
  }
  console.log('PASSED GW115: page views omit checkout, receipt, login and referrer references')
  console.log('PASSED GW117: both saved consent values hydrate from a neutral state without a banner flash')
  console.log('PASSED GW116: blocked browser storage keeps consent controls usable and marketing disabled')
} finally {
  await browser.close()
}
