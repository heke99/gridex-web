import { readFile, open, lstat } from 'node:fs/promises'
import { createHash, X509Certificate } from 'node:crypto'
import { chromium } from 'playwright'

const runtime = '/workspace/elklart-runtime'
const action = process.argv[2]
if (!['activate-company','verify-website','add-diagnostics'].includes(action)) throw new Error('Usage: node scripts/elklart-demo/activate-website-runtime.mjs activate-company|verify-website|add-diagnostics [development|production]')
async function readPrivate(path) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error('Private runtime JSON required.')
  return JSON.parse(await readFile(path,'utf8'))
}
const { platform: account } = await readPrivate(`${runtime}/ops/accounts.json`)
const integration = await readPrivate(`${runtime}/ops/integration.json`)
const descriptor = await readPrivate(`${runtime}/portal/customer-assertion-registration.json`)
const status = await readPrivate(`${runtime}/ops/status.json`)
if (integration.apiBaseUrl !== 'https://localhost:3000/api/v1' || status.API_URL !== 'http://127.0.0.1:54321'
  || descriptor.companyId !== integration.companyId || descriptor.registrationState !== 'registered_and_enforced') throw new Error('Registered local customer signer and dedicated OPS runtime required.')
const certificate = new X509Certificate(await readFile(`${runtime}/tls/server.pem`))
const spki = createHash('sha256').update(certificate.publicKey.export({ type: 'spki', format: 'der' })).digest('base64')
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: [`--ignore-certificate-errors-spki-list=${spki}`] })
const evidence = { action, checked_at: new Date().toISOString(), scope: 'ordinary authenticated local OPS admin UI; no Ediel certification or production-send transition', submitted: false, success: false }
const target = action === 'activate-company' ? '/admin/companies' : action === 'add-diagnostics' ? `/admin/platform/api-clients?companyId=${integration.companyId}` : `/admin/platform/go-live/${integration.companyId}`
try {
  const context = await browser.newContext()
  await context.route('**/*', route => ['localhost','127.0.0.1','[::1]'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  const page = await context.newPage()
  page.setDefaultTimeout(60000)
  await page.goto(`https://localhost:3000/login?next=${encodeURIComponent(target)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('input[name=email]').fill(account.email)
  await page.locator('input[name=password]').fill(account.password)
  await page.getByRole('button', { name: 'Logga in', exact: true }).click()
  await page.waitForURL(`https://localhost:3000${target}`, { timeout: 120000 })
  if (action === 'activate-company') {
    const form = page.locator(`form:has(input[name=company_id][value="${integration.companyId}"]):has(input[name=next_status][value=active])`)
    await form.locator('xpath=ancestor::details[1]').locator('summary').click()
    await form.locator('input[name=reason]').fill('Isolerat Elklart-demo: ordinarie tenantaktivering för lokala simulerade systemflöden.')
    await form.getByRole('button', { name: 'Återaktivera', exact: true }).click()
    evidence.submitted = true
    await page.waitForURL(url => url.pathname === '/admin/companies' && (url.searchParams.has('success') || url.searchParams.has('error')), { timeout: 120000 })
    const url = new URL(page.url())
    evidence.success = url.searchParams.has('success')
    evidence.result_message = url.searchParams.get('success') ?? url.searchParams.get('error')
  } else if (action === 'add-diagnostics') {
    const environment = process.argv[3]
    if (!['development','production'].includes(environment)) throw new Error('Explicit client environment required.')
    const endpoint = new URL(`${status.API_URL}/rest/v1/integration_api_clients`)
    endpoint.searchParams.set('company_id', `eq.${integration.companyId}`)
    endpoint.searchParams.set('profile_key', 'eq.tenant_website')
    endpoint.searchParams.set('select', 'id,scopes,metadata,status')
    const headers = { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY}` }
    const clientResponse = await fetch(endpoint,{ headers })
    const clients = await clientResponse.json()
    const candidates = Array.isArray(clients) ? clients.filter(c => c.metadata?.environment === environment && c.metadata?.primary === true && c.status === 'active') : []
    if (candidates.length !== 1) throw new Error('Expected exactly one active canonical client for this local environment.')
    const client = candidates[0]
    const form = page.locator(`form:has(input[name=clientId][value="${client.id}"]):has(input[name=permissionGroups])`)
    await form.locator('xpath=ancestor::details[1]').locator('summary').click()
    await form.locator('input[name=permissionGroups][value=website_contract_diagnostics]').check()
    // Initial client scopes are authoritative fixture API_CLIENT_PROFILES defaults.
    // The normal group UI marks groups on any matching scope, which can otherwise
    // expand partner groups and drop supported standalone profile scopes.
    const { API_CLIENT_PROFILES } = await import('../../../gridex-ops-platform/lib/integrations/apiClientProfiles.ts')
    const expectedScopes = [...new Set([...API_CLIENT_PROFILES.tenant_website.defaultScopes, 'website_contracts.diagnostics'])]
    await form.evaluate((element, scopes) => {
      element.addEventListener('formdata', event => {
        event.formData.delete('permissionGroups')
        event.formData.append('permissionGroups', 'website_contract_diagnostics')
        event.formData.delete('scopes')
        for (const scope of scopes) event.formData.append('scopes',scope)
      }, { once: true })
    }, expectedScopes)
    await form.getByRole('button', { name: 'Spara avancerat', exact: true }).click()
    evidence.submitted = true
    await page.waitForTimeout(1500)
    const readback = await fetch(endpoint,{ headers })
    const after = (await readback.json()).find(c => c.id === client.id)
    evidence.added_scopes = after.scopes.filter(scope => !client.scopes.includes(scope))
    evidence.removed_scope_count = client.scopes.filter(scope => !after.scopes.includes(scope)).length
    evidence.unexpected_scope_count = after.scopes.filter(scope => !expectedScopes.includes(scope)).length
    evidence.missing_expected_scope_count = expectedScopes.filter(scope => !after.scopes.includes(scope)).length
    evidence.success = evidence.unexpected_scope_count === 0 && evidence.missing_expected_scope_count === 0
    evidence.client_environment = environment
  } else {
    const form = page.locator('form:has(textarea[name=allowed_origins]):has(input[name=customer_portal_url])')
    if (await form.locator('input[name=company_id]').inputValue() !== integration.companyId) throw new Error('Website verification form tenant mismatch.')
    await form.locator('textarea[name=allowed_origins]').fill('https://localhost:3001')
    await form.locator('input[name=customer_portal_url]').fill('https://localhost:3001/mina-sidor')
    await form.getByRole('button', { name: 'Verifiera webb & Mina sidor', exact: true }).click()
    evidence.submitted = true
    await page.waitForURL(url => url.pathname === target && url.searchParams.has('status'), { timeout: 120000 })
    const url = new URL(page.url())
    evidence.success = url.searchParams.get('status') === 'prepared'
    evidence.result_status = url.searchParams.get('status')
    evidence.result_message = url.searchParams.get('message')
  }
  const query = new URL(`${status.API_URL}/rest/v1/companies`)
  query.searchParams.set('id', `eq.${integration.companyId}`)
  query.searchParams.set('select', 'status,lifecycle_state_version')
  const response = await fetch(query, { headers: { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY}` } })
  const rows = await response.json()
  if (!response.ok || !Array.isArray(rows) || rows.length !== 1) throw new Error('Company state readback failed.')
  evidence.company_active = rows[0].status === 'active'
  evidence.lifecycle_version = rows[0].lifecycle_state_version
  if (!evidence.success) throw new Error('Canonical action returned blockers; inspect private evidence.')
  console.log('Ordinary local OPS admin action completed; private evidence records canonical outcome.')
} catch (error) {
  evidence.error = error.message
  throw error
} finally {
  await browser.close()
  const id = new Date().toISOString().replace(/[:.]/g,'-')
  const output = await open(`${runtime}/portal/${action}-evidence-${id}.json`, 'wx', 0o600)
  try { await output.writeFile(JSON.stringify(evidence,null,2)+'\n') } finally { await output.close() }
}
