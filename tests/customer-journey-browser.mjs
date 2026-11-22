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
    await mode('invoice-status')
    await page.goto(origin + '/dashboard/invoices', { waitUntil: 'networkidle' })
    for (const [status, label] of Object.entries({ issued: 'Skickad', sent: 'Skickad', paid: 'Betald',
      overdue: 'Förfallen', cancelled: 'Makulerad', credited: 'Krediterad', unknown: 'Status uppdateras' })) {
      const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'TEST-' + status, exact: true }) })
      await card.getByText(label, { exact: true }).waitFor()
      if (status === 'paid') await card.getByText('2026-12-01', { exact: true }).waitFor()
      else assert.equal(await card.getByText('Betalningsdatum', { exact: true }).count(), 0)
    }
    checks++
    const invoicePath = '/api/web/customer/invoices/invoice_synthetic_paid'
    const invoiceJson = await page.request.get(origin + invoicePath)
    assert.equal(invoiceJson.status(), 200)
    const { data: invoice } = await invoiceJson.json()
    assert.equal(invoice.invoice_reference, 'invoice_synthetic_paid')
    assert.equal(invoice.lines[0].description, 'Elförbrukning')
    assert.equal(invoice.documents[0].available, true)
    assert.equal(invoice.documents[1].available, false)
    assert.doesNotMatch(JSON.stringify(invoice), /documents\.example\.invalid/)
    await page.locator('article').filter({ has: page.getByRole('heading', { name: 'TEST-paid', exact: true }) })
      .getByRole('link', { name: 'Visa fakturadetaljer' }).click()
    await page.getByRole('heading', { name: 'Faktura TEST-paid' }).waitFor()
    assert.equal(await page.getByText('Otillgänglig PDF').count(), 0)
    const documentLink = await page.getByRole('link', { name: 'Öppna Faktura-PDF' }).getAttribute('href')
    const documentResponse = await page.request.get(origin + documentLink, { maxRedirects: 0 })
    assert.equal(documentResponse.status(), 302)
    assert.equal(documentResponse.headers().location, 'https://documents.example.invalid/invoice.pdf')
    assert.match(documentResponse.headers()['cache-control'], /private, no-store/)
    await mode('invoice-revoked')
    const revoked = await page.request.get(origin + documentLink, { maxRedirects: 0 })
    assert.ok(revoked.status() >= 400)
    assert.equal(revoked.headers().location, undefined)
    await mode('guest')
    const guestDocument = await page.request.get(origin + documentLink, { maxRedirects: 0 })
    assert.equal(guestDocument.status(), 401)
    assert.equal(guestDocument.headers().location, undefined)
    checks++
    await mode('invoice-page')
    await page.goto(origin + '/dashboard/invoices', { waitUntil: 'networkidle' })
    const moreInvoices = page.getByRole('link', { name: 'Visa fler fakturor' })
    assert.equal(new URL(await moreInvoices.getAttribute('href'), origin).searchParams.get('cursor'), 'opaque+/=')
    await moreInvoices.click()
    await page.getByRole('heading', { name: 'TEST-sent', exact: true }).waitFor()
    assert.equal(await moreInvoices.count(), 0)
    const secondPage = await page.request.get(origin + '/api/web/customer/invoices?cursor=opaque%2B%2F%3D')
    assert.equal(secondPage.status(), 200)
    assert.deepEqual((await secondPage.json()).page, { hasMore: false, nextCursor: null })
    assert.equal((await page.request.get(origin + '/api/web/customer/invoices?cursor=one&cursor=two')).status(), 400)
    checks++
    await mode('start-dates')
    for (const path of ['/mina-sidor', '/dashboard/contracts']) {
      await page.goto(origin + path, { waitUntil: 'networkidle' })
      for (const date of ['2026-12-05', '2026-12-14', '2026-12-15']) await page.getByText(date, { exact: true }).first().waitFor()
    }
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
      await page.getByText('Jag har anläggnings- eller leverantörsuppgifter', { exact: true }).click()
      await page.locator('#facility_id').fill('735999123456789012')
      await page.locator('#current_supplier_name').fill('Syntetisk elleverantör')
      if (customerType === 'private') {
        await page.getByRole('checkbox', { name: 'Använd en separat faktura-e-postadress' }).check()
        await page.getByRole('button', { name: 'Granska teckningen', exact: true }).click()
        await page.locator('#invoice_email').fill('invoice@example.invalid')
        assert.equal(await page.locator('#billing_street').count(), 0)
      } else {
        await page.getByRole('checkbox', { name: 'Använd en separat fakturapostadress' }).check()
        await page.getByRole('button', { name: 'Granska teckningen', exact: true }).click()
        for (const [id, value] of Object.entries({ billing_street: 'Testgatan 1', billing_postal_code: '111 22', billing_city: 'Teststad' })) {
          await page.locator('#' + id).fill(value)
        }
        assert.equal(await page.locator('#invoice_email').count(), 0)
      }
      await page.getByRole('button', { name: 'Granska teckningen', exact: true }).click()
      await page.getByRole('heading', { name: 'Granska innan du tecknar', exact: true }).waitFor()
      const reviewedBilling = customerType === 'private' ? 'invoice@example.invalid' : 'Testgatan 1, 11122 Teststad, SE'
      await page.getByText(reviewedBilling, { exact: true }).waitFor()
      await page.getByText('735999123456789012', { exact: true }).waitFor()
      await page.getByText('Syntetisk elleverantör', { exact: true }).waitFor()
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
      assert.equal(attempts[0].facility_id, '735999123456789012')
      assert.equal(attempts[0].current_supplier_name, 'Syntetisk elleverantör')
      assert.equal(customerType === 'private' ? attempts[0].invoice_email : attempts[0].billing_street, customerType === 'private' ? reviewedBilling : 'Testgatan 1')
      assert.equal(attempts[0].separate_invoice_email, customerType === 'private' ? 'on' : '')
      assert.equal(attempts[0].separate_billing_address, customerType === 'business' ? 'on' : '')
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
      if (customerType === 'business') {
        await page.getByRole('button', { name: 'Prova nya villkor', exact: true }).click()
        for (const consent of await consents.all()) assert.equal(await consent.isChecked(), false, 'a new legal bundle requires new explicit consent')
        assert.equal(await page.getByRole('button', { name: 'Teckna elavtal', exact: true }).isDisabled(), true)
      } else {
        assert.equal(await page.locator('input[name=legal_bundle_version]').inputValue(), '00000000-0000-4000-8000-000000000001')
        await page.getByRole('button', { name: 'Simulera villkorskonflikt' }).click()
        for (const consent of await consents.all()) await consent.check()
        await page.getByRole('button', { name: 'Teckna elavtal', exact: true }).click()
        await page.getByText('Villkoren har ändrats i testet.', { exact: true }).waitFor()
        await page.locator('#first_name').waitFor()
        assert.equal(await page.locator('#first_name').inputValue(), 'Syntetisk')
        await page.getByRole('button', { name: 'Granska teckningen', exact: true }).click()
        assert.equal(await page.getByRole('button', { name: 'Teckna elavtal', exact: true }).count(), 0)
        await page.getByRole('button', { name: 'Beräkna nytt testpris' }).click()
        await page.getByRole('button', { name: 'Granska teckningen', exact: true }).click()
        assert.equal(await page.locator('input[name=pricing_snapshot_token]').inputValue(), 'new-synthetic-price')
        assert.equal(await page.locator('input[name=legal_bundle_version]').inputValue(), '00000000-0000-4000-8000-000000000003')
        for (const consent of await consents.all()) assert.equal(await consent.isChecked(), false)
        assert.equal(await page.getByRole('button', { name: 'Teckna elavtal', exact: true }).isDisabled(), true)
      }
      console.log(`PASS ${viewport.width}px ${customerType}: validation, consent and stable retry through back/review`)
      checks++
    }
    await page.goto(origin + '/checkout-fixture', { waitUntil: 'networkidle', timeout: 60_000 })
    await page.getByRole('button', { name: 'Prova fullmakt utan länk' }).click()
    for (const [id, value] of Object.entries({ first_name: 'Syntetisk', last_name: 'Kund', personal_number: '19900101-0017', phone: '0701234567' })) await page.locator('#' + id).fill(value)
    await page.getByText(/Fullmakten för den här avtalsversionen går inte att öppna/).waitFor()
    assert.equal(await page.getByRole('link', { name: 'kundservice', exact: true }).getAttribute('href'), '/kundservice')
    assert.equal(await page.getByRole('button', { name: 'Granska teckningen', exact: true }).isDisabled(), true)
    assert.equal(await page.locator('#legal-power_of_attorney').count(), 0)
    assert.deepEqual(JSON.parse(await page.getByTestId('captured-submissions').textContent()), [])

    await page.getByRole('button', { name: 'Prova fullmakt med relativ länk' }).click()
    await page.getByRole('button', { name: 'Granska teckningen', exact: true }).click()
    await page.getByRole('heading', { name: 'Granska innan du tecknar', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Prova fullmakt utan länk' }).click()
    assert.equal(await page.getByRole('button', { name: 'Teckna elavtal', exact: true }).isDisabled(), true)
    assert.equal(await page.locator('#legal-power_of_attorney').count(), 0)
    await page.getByRole('button', { name: 'Prova fullmakt med relativ länk' }).click()
    const agreement = page.locator('label[for="legal-agreement"]').getByRole('link')
    const powerOfAttorney = page.locator('label[for="legal-power_of_attorney"]').getByRole('link')
    const bundleId = '00000000-0000-4000-8000-000000000001'
    for (const [link, kind, body] of [
      [agreement, 'agreement', 'Syntetiska avtalsvillkor för låst version'],
      [powerOfAttorney, 'power-of-attorney', 'Syntetisk fullmakt för låst version'],
    ]) {
      const documentUrl = `https://ops.example.invalid/legal/synthetic/${kind}/${bundleId}`
      assert.equal(await link.getAttribute('href'), documentUrl)
      await context.route(documentUrl, route => route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body }))
      const opened = context.waitForEvent('page')
      await link.click()
      const document = await opened
      await document.waitForLoadState('load')
      assert.equal(document.url(), documentUrl)
      assert.equal((await document.locator('body').innerText()).trim(), body)
      await document.close()
    }
    assert.equal(await page.locator('#legal-power_of_attorney').isChecked(), false)
    for (const consent of await page.locator('input[type=checkbox][name^="legal_acceptance:"]').all()) await consent.check()
    await page.getByRole('button', { name: 'Teckna elavtal', exact: true }).click()
    await page.waitForFunction(() => JSON.parse(window.document.querySelector('[data-testid=captured-submissions]').textContent).length === 1)
    const [signed] = JSON.parse(await page.getByTestId('captured-submissions').textContent())
    assert.equal(signed['legal_acceptance:power_of_attorney'], 'on')
    assert.equal(signed.legal_bundle_version, bundleId)
    console.log(`PASS ${viewport.width}px GW48/GW49: missing power of attorney blocks signing and the relative document opens at the OPS origin`)
    checks++
    assert.deepEqual(errors, [], `unexpected browser errors at ${viewport.width}px`)
    await context.close()
  }
  console.log(JSON.stringify({ passed: true, browser: engine, environments: ['desktop', 'mobile'], scenarioRuns: checks, mode: 'real Next pages and signup form; synthetic external ports; no actual contracts or email' }))
} finally { await browser.close() }
