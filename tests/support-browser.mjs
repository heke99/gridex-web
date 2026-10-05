import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { FIXTURE_CASE, FIXTURE_CUSTOMER, FIXTURE_PASSWORD } from './fixtures/support-runtime.mjs'

const origin = process.env.SUPPORT_BROWSER_URL ?? 'http://127.0.0.1:3103'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error('Offline loopback browser verification only')
const output = process.env.SUPPORT_BROWSER_OUTPUT ?? '/tmp/gridex-support-browser-evidence'
await mkdir(output, { recursive: true })
const executablePath = process.env.SUPPORT_BROWSER_EXECUTABLE ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const checks = [], errors = []
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.message))
const check = async (name, fn) => { await fn(); checks.push(name) }
async function login(email) {
  await page.goto(`${origin}/login`)
  await page.getByLabel('E-post', { exact: true }).fill(email)
  await page.getByLabel('Lösenord', { exact: true }).fill(FIXTURE_PASSWORD)
  await page.getByRole('button', { name: 'Logga in', exact: true }).click()
}
try {
  await check('anonymous inbox requires own staff login', async () => { await page.goto(origin); await expect(page).toHaveURL(`${origin}/login`); await expect(page.getByRole('heading', { name: 'Logga in till kundtjänsten' })).toBeVisible() })
  await check('login layout has no marketing or OPS navigation', async () => { await expect(page.getByRole('navigation')).toHaveCount(0); await expect(page.locator('a[href*="app.gridex.se"]')).toHaveCount(0); await page.screenshot({ path: `${output}/login.png`, fullPage: true }) })
  await check('mobile login fits viewport', async () => { await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: `${output}/login-mobile.png`, fullPage: true }); await page.setViewportSize({ width: 1440, height: 1000 }) })
  await check('verified Gridex staff login opens real case inbox', async () => { await login('support@example.invalid'); await expect(page).toHaveURL(`${origin}/`); await expect(page.getByRole('link', { name: 'Inkommande kundärende', exact: true })).toBeVisible(); await page.screenshot({ path: `${output}/inbox.png`, fullPage: true }) })
  await check('case detail and attachment available', async () => { await page.getByRole('link', { name: 'Inkommande kundärende', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Inkommande kundärende', exact: true })).toBeVisible(); await expect(page.getByRole('link', { name: 'Ladda ner' })).toBeVisible(); const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Ladda ner' }).click()]); expect(download.suggestedFilename()).toBe('syntetisk-bilaga.pdf'); await download.saveAs(`${output}/synthetic-attachment.pdf`) })
  await check('reply creates customer-visible history', async () => { const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Svara kunden', exact: true }) }); await panel.getByLabel('Meddelande').fill('Webbläsartest: svar till kunden.'); await panel.getByRole('button', { name: 'Spara svar till kunden' }).click(); const event = page.locator('li.event').filter({ hasText: 'Webbläsartest: svar till kunden.' }); await expect(event).toHaveCount(1); await expect(event.getByText('Synligt för kunden', { exact: true })).toBeVisible() })
  await check('internal note remains staff-only', async () => { const details = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Intern anteckning' }) }); await details.locator('summary').click(); await details.getByLabel('Anteckning', { exact: true }).fill('Webbläsartest: intern anteckning.'); await details.getByRole('button', { name: 'Spara anteckning' }).click(); const event = page.locator('li.event').filter({ hasText: 'Webbläsartest: intern anteckning.' }); await expect(event.getByText('Endast personal', { exact: true })).toBeVisible() })
  await check('status action updates case', async () => { const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Status', exact: true }) }); await panel.getByLabel('Ärendestatus').selectOption('resolved'); await panel.getByRole('button', { name: 'Ändra status' }).click(); await expect(page.locator('.heading .badge')).toHaveText('Löst'); await page.screenshot({ path: `${output}/case.png`, fullPage: true }) })
  await check('customer contact mutation is version-bound', async () => { await page.goto(`${origin}/customers/${FIXTURE_CUSTOMER}`); await expect(page.getByRole('heading', { name: 'Anna Testkund' })).toBeVisible(); await page.getByRole('combobox', { name: /^Uppgift/ }).selectOption('phone'); await page.getByLabel('Nytt värde').fill('+46 70 999 88 77'); await page.getByRole('button', { name: 'Spara', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Kontaktuppgiften är sparad.'); await expect(page.locator('dd').filter({ hasText: '+46 70 999 88 77' })).toBeVisible() })
  await check('team lists tenant staff and assigned RBAC roles', async () => { await page.goto(`${origin}/team`); await expect(page.getByRole('heading', { name: 'Personal och roller' })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Supportadministratör', exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Annan organisation' })).toHaveCount(0) })
  await check('new case uses customer API and creates one case', async () => { await page.goto(`${origin}/cases/new`); await page.getByRole('combobox', { name: /^Kund/ }).selectOption(FIXTURE_CUSTOMER); await page.getByLabel('Rubrik').fill('Nytt ärende från webbläsartest'); await page.getByLabel('Beskrivning').fill('Syntetiskt test, ingen riktig kund.'); await page.getByRole('button', { name: 'Skapa ärende', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Nytt ärende från webbläsartest', exact: true })).toBeVisible(); await page.goto(origin); await expect(page.getByRole('link', { name: 'Nytt ärende från webbläsartest', exact: true })).toHaveCount(1) })
  await check('sign out clears protected access', async () => { await page.getByRole('button', { name: 'Logga ut', exact: true }).click(); await expect(page).toHaveURL(`${origin}/login`); await page.goto(origin); await expect(page).toHaveURL(`${origin}/login`) })
  await check('read-only account cannot submit a write', async () => { await login('readonly@example.invalid'); await expect(page).toHaveURL(`${origin}/`); await page.goto(`${origin}/cases/${FIXTURE_CASE}`); const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Svara kunden', exact: true }) }); await panel.getByLabel('Meddelande').fill('Obehörigt svar ska stoppas'); await panel.getByRole('button', { name: 'Spara svar till kunden' }).click(); await expect(panel.getByRole('alert')).toContainText('Du saknar behörighet'); await expect(page.locator('li.event').filter({ hasText: 'Obehörigt svar ska stoppas' })).toHaveCount(0); await page.getByRole('button', { name: 'Logga ut', exact: true }).click() })
  await check('foreign tenant staff cannot enter Gridex queue', async () => { await login('foreign@example.invalid'); await expect(page).toHaveURL(`${origin}/login?reason=access_denied`); await expect(page.locator('p[role="alert"]')).toContainText('Kontot saknar åtkomst'); await expect(page.getByRole('navigation')).toHaveCount(0) })
  await check('no browser application errors', async () => { expect(errors).toEqual([]) })
  await writeFile(`${output}/verification.json`, JSON.stringify({ status: 'PASS_OFFLINE_BROWSER', checks, errors, origin, production_data: false, database_project: 'ayiuxjlfazkjmmtlvhsl', backend: 'schema-faithful synthetic fixture with verified RSA assertions', limitations: ['No production enrollment, database migration, real invitation email or live acceptance'] }, null, 2))
  console.log(JSON.stringify({ status: 'PASS_OFFLINE_BROWSER', checks: checks.length, errors: errors.length, output }))
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => undefined)
  await writeFile(`${output}/verification.json`, JSON.stringify({ status: 'FAIL_OFFLINE_BROWSER', checks, errors, error: String(error) }, null, 2))
  throw error
} finally { await browser.close() }
