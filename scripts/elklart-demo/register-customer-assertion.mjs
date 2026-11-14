import { readFile, open, lstat, rename } from 'node:fs/promises'
import { createHash, createPublicKey, X509Certificate, randomBytes } from 'node:crypto'
import { chromium } from 'playwright'

const runtime = '/workspace/elklart-runtime'
const attemptId = new Date().toISOString().replace(/[:.]/g, '-')
const descriptorPath = `${runtime}/portal/customer-assertion-registration.json`
async function readPrivateJson(path) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error('Private runtime JSON required.')
  return JSON.parse(await readFile(path, 'utf8'))
}
const descriptor = await readPrivateJson(descriptorPath)
if (descriptor.registrationState !== 'prepared_only_not_registered') throw new Error('Refusing to replace an already registered assertion descriptor.')
const { administrator: account } = await readPrivateJson(`${runtime}/ops/accounts.json`)
const status = await readPrivateJson(`${runtime}/ops/status.json`)
if (status.API_URL !== 'http://127.0.0.1:54321') throw new Error('Unexpected dedicated OPS API origin.')
const certificate = new X509Certificate(await readFile(`${runtime}/tls/server.pem`))
const spki = createHash('sha256').update(certificate.publicKey.export({ type: 'spki', format: 'der' })).digest('base64')
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: [`--ignore-certificate-errors-spki-list=${spki}`] })
const evidence = { scope: 'real authenticated canonical OPS customer-login actions', registration: false, enforcement: false, readback_matches: false }
let page
try {
  const context = await browser.newContext()
  await context.route('**/*', route => ['localhost','127.0.0.1','[::1]'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  page = await context.newPage()
  page.setDefaultTimeout(60000)
  await page.goto('https://localhost:3000/login?next=%2Fadmin%2Fcustomer-login', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('input[name=email]').fill(account.email)
  await page.locator('input[name=password]').fill(account.password)
  await page.getByRole('button', { name: 'Logga in', exact: true }).click()
  await page.waitForURL('https://localhost:3000/admin/customer-login', { timeout: 120000 })
  evidence.stage = 'authenticated_customer_login_page'
  const companySwitch = page.locator('summary').filter({ hasText: 'Byt vy' })
  if (await companySwitch.count()) {
    await companySwitch.click()
    const companyView = page.getByRole('button', { name: 'Bolagsvy', exact: true })
    if (await companyView.getAttribute('aria-pressed') !== 'true') { await companyView.click(); await page.locator('select[name=company_id]').waitFor({ timeout: 15000 }) }
    const companyPicker = page.locator('select[name=company_id]')
    if (await companyPicker.count()) await companyPicker.selectOption(descriptor.companyId)
    await page.goto('https://localhost:3000/admin/customer-login', { waitUntil: 'domcontentloaded' })
  }
  if (await page.getByText('Kontot saknar aktiv bolagskoppling.', { exact: false }).count()) throw new Error('Authenticated administrator has no active company selection through the canonical navigation flow.')
  await page.getByRole('button', { name: 'Egen inloggning', exact: false }).click()
  const form = page.locator('form').filter({ has: page.locator('input[name=public_jwk]') })
  await form.waitFor()
  if (await form.locator('input[name=expected_company_id]').inputValue() !== descriptor.companyId
    || await form.locator('input[name=purpose]').inputValue() !== 'customer') throw new Error('Canonical form does not belong to the approved customer tenant.')
  // Submit the existing authenticated form/action with the prepared PUBLIC key.
  // Native FormData permits an administrator to supply this existing public_jwk field;
  // server validators, company guards, CSRF and audit remain the ordinary action's own.
  await form.evaluate((element, publicJwk) => {
    element.addEventListener('formdata', event => event.formData.set('public_jwk', publicJwk), { once: true })
    element.requestSubmit()
  }, JSON.stringify(descriptor.publicJwk))
  await page.getByRole('status').filter({ hasText: 'Den publika nyckeln är sparad' }).waitFor({ timeout: 120000 })
  evidence.registration = true
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Kräv verifierad kund', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Nu krävs verifierad kund' }).waitFor({ timeout: 120000 })
  evidence.enforcement = true
  evidence.ops_cookie_project_verified = (await context.cookies()).some(cookie => cookie.name.startsWith('sb-localhost-auth-token'))
  if (!evidence.ops_cookie_project_verified) throw new Error('Expected dedicated OPS cookie project was not verified.')
  const query = new URL(`${status.API_URL}/rest/v1/tenant_customer_identity_providers`)
  query.searchParams.set('company_id', `eq.${descriptor.companyId}`)
  query.searchParams.set('purpose', 'eq.customer')
  query.searchParams.set('is_active', 'eq.true')
  query.searchParams.set('select', 'id,kind,issuer,audience,public_jwk,enforcement,subject_claim')
  const response = await fetch(query, { headers: { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY}` } })
  const providers = await response.json()
  if (!response.ok || !Array.isArray(providers) || providers.length !== 1) throw new Error('Canonical provider readback failed.')
  const provider = providers[0]
  const fingerprint = createHash('sha256').update(createPublicKey({ key: provider.public_jwk, format: 'jwk' }).export({ type: 'spki', format: 'der' })).digest('hex')
  if (provider.kind !== 'tenant_key' || provider.enforcement !== 'enforce' || provider.subject_claim !== 'sub'
    || provider.issuer !== descriptor.issuer || provider.audience !== descriptor.audience
    || provider.public_jwk.kid !== descriptor.keyId || fingerprint !== descriptor.publicKeySha256) throw new Error('Canonical provider readback does not match prepared public key and enforcement.')
  evidence.readback_matches = true
  evidence.registered_at = new Date().toISOString()
  const temporary = `${descriptorPath}.new-${randomBytes(8).toString('hex')}`
  const handle = await open(temporary, 'wx', 0o600)
  try { await handle.writeFile(JSON.stringify({ ...descriptor, providerId: provider.id, registrationState: 'registered_and_enforced', registeredAt: evidence.registered_at }, null, 2) + '\n') } finally { await handle.close() }
  await rename(temporary, descriptorPath)
  console.log('Canonical customer public-key registration, enforced verification and matching readback completed.')
} catch (error) {
  evidence.error = error.message
  if (page) {
    const html = await open(`${runtime}/portal/assertion-registration-failed-${attemptId}.html`, 'wx', 0o600)
    try { await html.writeFile(await page.content()) } finally { await html.close() }
  }
  throw error
} finally {
  await browser.close()
  const output = await open(`${runtime}/portal/customer-assertion-registration-evidence-${attemptId}.json`, 'wx', 0o600)
  try { await output.writeFile(JSON.stringify(evidence, null, 2) + '\n') } finally { await output.close() }
}
