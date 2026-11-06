import assert from 'node:assert/strict'
import { chromium, firefox } from 'playwright'

const origin = process.env.GRIDEX_JOURNEY_ORIGIN
assert.ok(origin?.startsWith('http://127.0.0.1:'), 'isolated browser origin required')
const engine = process.env.GRIDEX_JOURNEY_BROWSER ?? 'chromium'
assert.ok(['chromium', 'firefox'].includes(engine))
const browser = await ({ chromium, firefox })[engine].launch({ headless: true })
let checks = 0
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport })
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => { if (!error.message.includes('Synthetic OPS outage')) errors.push(error.message) })
    const mode = value => context.addCookies([{ name: 'journey-mode', value, url: origin }])
    await mode('fixed')
    for (const path of ['/mina-sidor', '/dashboard', '/dashboard/contracts']) {
      await page.goto(origin + path, { waitUntil: 'networkidle', timeout: 60000 })
      assert.equal(new URL(page.url()).pathname, path, 'fixture auth boundary unexpectedly redirected')
      const prices = page.getByRole('region', { name: 'Dina avtalspriser' })
      await prices.getByText('86,25 öre/kWh', { exact: true }).waitFor()
      await prices.getByText('0 kr/faktura', { exact: true }).waitFor()
      await prices.getByText('SE2', { exact: true }).waitFor()
      console.log(`PASS ${viewport.width}px ${path}: original contract prices`)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${path}: horizontal overflow at ${viewport.width}px`)
      checks++
    }
    await mode('variable')
    await page.goto(origin + '/dashboard/contracts', { waitUntil: 'networkidle' })
    assert.equal(await page.getByText('Fast energipris', { exact: true }).count(), 0)
    await page.getByText('3,5 öre/kWh', { exact: true }).waitFor()
    checks++
    await mode('empty')
    await page.goto(origin + '/mina-sidor', { waitUntil: 'networkidle' })
    await page.getByRole('link', { name: 'Teckna ett elavtal', exact: true }).waitFor()
    assert.equal(await page.getByRole('link', { name: 'Begär datautdrag' }).getAttribute('href'), '/dashboard/privacy')
    await page.getByRole('link', { name: 'koppla ett befintligt kundkonto', exact: true }).click()
    await page.getByLabel('Kundnummer', { exact: true }).waitFor()
    checks++
    await mode('invalid-date')
    await page.goto(origin + '/mina-sidor', { waitUntil: 'networkidle' })
    await page.getByRole('region', { name: 'Dina avtalspriser' }).waitFor()
    checks++
    await mode('outage')
    await page.goto(origin + '/mina-sidor', { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Vi kunde inte koppla dina kunduppgifter' }).waitFor()
    await mode('fixed')
    await page.getByRole('button', { name: 'Försök igen', exact: true }).click()
    await page.getByRole('region', { name: 'Dina avtalspriser' }).waitFor()
    checks++
    await mode('guest')
    await page.goto(origin + '/mina-sidor', { waitUntil: 'networkidle' })
    assert.equal(new URL(page.url()).pathname, '/login')
    checks++
    await mode('fixed')
    for (const customerType of ['private', 'business']) {
      await page.goto(origin + '/checkout-fixture', { waitUntil: 'networkidle', timeout: 60000 })
      if (customerType === 'business') await page.getByRole('button', { name: 'Prova företagskund' }).click()
      await page.getByRole('button', { name: 'Granska teckningen', exact: true }).click()
      await page.getByText('Kontrollera uppgifterna', { exact: true }).waitFor()
      assert.equal(await page.getByRole('heading', { name: 'Granska innan du tecknar' }).count(), 0)
      for (const [id, value] of Object.entries({ first_name: 'Syntetisk', last_name: 'Kund', personal_number: '19900101-0017', phone: '0701234567' })) await page.locator('#' + id).fill(value)
      if (customerType === 'business') {
        for (const [id, value] of Object.entries({ company_name: 'Syntetiskt Test AB', organization_number: '556016-0680', company_signer_role: 'Testansvarig' })) await page.locator('#' + id).fill(value)
        await page.getByRole('checkbox', { name: 'Jag bekräftar att personen ovan har rätt att företräda företaget och ingå elavtalet.' }).check()
      }
      await page.getByRole('button', { name: 'Granska teckningen', exact: true }).click()
      await page.getByRole('heading', { name: 'Granska innan du tecknar', exact: true }).waitFor()
      const submit = page.getByRole('button', { name: 'Teckna elavtal', exact: true })
      assert.equal(await submit.isDisabled(), true, 'acceptance must be explicit')
      const consents = page.locator('input[type=checkbox][name^="legal_acceptance:"]')
      assert.ok(await consents.count() > 0)
      for (const consent of await consents.all()) await consent.check()
      await submit.click()
      await page.getByText('Syntetiskt avbrott. Försök igen med samma uppgifter.', { exact: true }).waitFor()
      for (const consent of await consents.all()) assert.equal(await consent.isChecked(), true, 'a failed action must preserve accepted controlled consents for the unchanged retry')
      console.log(`PASS ${viewport.width}px ${customerType}: first rejected action retains its review state`)
      await submit.click()
      await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid=captured-submissions]').textContent).length >= 2)
      const attempts = JSON.parse(await page.getByTestId('captured-submissions').textContent())
      assert.equal(attempts.length, 2, 'one action per click')
      assert.deepEqual(attempts[0], attempts[1], 'unchanged retry must preserve the full evidence and operation ID')
      assert.equal(attempts[0].customer_type, customerType)
      assert.equal(attempts[0].pricing_snapshot_token, 'synthetic-local-price-evidence')
      assert.equal(attempts[0]['legal_acceptance:agreement'], 'on')
      assert.ok(attempts[0].legal_bundle_version)
      await page.getByRole('button', { name: 'Tillbaka', exact: true }).click()
      await page.getByRole('button', { name: 'Granska teckningen', exact: true }).click()
      await page.getByRole('button', { name: 'Teckna elavtal', exact: true }).click()
      await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid=captured-submissions]').textContent).length >= 3)
      const afterNavigation = JSON.parse(await page.getByTestId('captured-submissions').textContent())
      assert.deepEqual(afterNavigation[0], afterNavigation[2], 'review navigation must not turn an unchanged retry into a new application')
      await page.getByRole('button', { name: 'Tillbaka', exact: true }).click()
      await page.locator('#phone').fill('0701234568')
      await page.getByRole('button', { name: 'Granska teckningen', exact: true }).click()
      assert.notEqual(await page.locator('input[name=submission_attempt_id]').inputValue(), attempts[0].submission_attempt_id, 'changed details need a distinct operation')
      await page.getByRole('button', { name: 'Prova nya villkor', exact: true }).click()
      for (const consent of await consents.all()) assert.equal(await consent.isChecked(), false, 'a new legal bundle requires new explicit consent')
      assert.equal(await page.getByRole('button', { name: 'Teckna elavtal', exact: true }).isDisabled(), true)
      console.log(`PASS ${viewport.width}px ${customerType}: validation, consent and stable retry through back/review`)
      checks++
    }
    assert.deepEqual(errors, [], `unexpected browser errors at ${viewport.width}px`)
    await context.close()
  }
  console.log(JSON.stringify({ passed: true, browser: engine, environments: ['desktop', 'mobile'], scenarioRuns: checks, mode: 'real Next pages and signup form; synthetic external ports; no actual contracts or email' }))
} finally { await browser.close() }
