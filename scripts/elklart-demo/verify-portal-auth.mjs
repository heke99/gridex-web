import { readFile, open, chmod } from 'node:fs/promises'
import { createHash, randomBytes, X509Certificate } from 'node:crypto'
import { chromium } from 'playwright'

const runtime = '/workspace/elklart-runtime/portal'
const origin = 'https://localhost:3001'
const certificate = new X509Certificate(await readFile('/workspace/elklart-runtime/tls/server.pem'))
const spki = createHash('sha256').update(certificate.publicKey.export({ type: 'spki', format: 'der' })).digest('base64')
const credentials = { email: 'portal-auth-smoke@elklart.example', password: `Demo!${randomBytes(24).toString('base64url')}7aA` }
const credentialsFile = await open(`${runtime}/auth-smoke.json`, 'wx', 0o600)
await credentialsFile.writeFile(JSON.stringify(credentials, null, 2) + '\n')
await credentialsFile.close()
const evidence = { scope: 'real local browser forms and Supabase Auth; no OPS integration', origin, certificate_validation: 'exact leaf public key SPKI; no blanket TLS disable', local_email_confirmation: 'disabled by local Auth configuration', registration: false, login: false, portal_authenticated: false, errors: [] }
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: [`--ignore-certificate-errors-spki-list=${spki}`] })
try {
  const context = await browser.newContext()
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? route.continue() : route.abort()
  })
  const page = await context.newPage()
  page.setDefaultTimeout(45000)
  await page.goto(`${origin}/register`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.locator('input[type=email]').fill(credentials.email)
  await page.locator('input[type=password]').nth(0).fill(credentials.password)
  await page.locator('input[type=password]').nth(1).fill(credentials.password)
  await page.locator('input[type=checkbox]').check()
  const signupResponse = page.waitForResponse(response => response.url().startsWith('http://127.0.0.1:55321/auth/v1/signup'))
  await page.getByRole('button', { name: 'Skapa konto', exact: true }).click()
  const response = await signupResponse
  evidence.registration_http_status = response.status()
  const signup = await response.json()
  if (!response.ok() || !signup.user?.id) throw new Error('Normal registration did not create a real Auth user.')
  evidence.registration = true
  await page.getByText('Kontot är nästan klart').waitFor()
  // Start a fresh browser session to prove password login independently of signup's auto-confirm session.
  await context.close()
  const loginContext = await browser.newContext()
  await loginContext.route('**/*', route => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  const login = await loginContext.newPage()
  await login.goto(`${origin}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await login.locator('input[name=email]').fill(credentials.email)
  await login.locator('input[name=password]').fill(credentials.password)
  await login.getByRole('button', { name: 'Logga in', exact: true }).click()
  await login.waitForURL(`${origin}/mina-sidor`, { timeout: 90000 })
  evidence.login = true
  const session = await loginContext.request.get(`${origin}/api/auth/public-session`)
  const payload = await session.json()
  evidence.session_http_status = session.status()
  evidence.session_present = payload.authenticatedEmail === credentials.email
  evidence.portal_authenticated = (await loginContext.cookies()).some(cookie => cookie.name.startsWith('sb-127-auth-token'))
  if (!evidence.session_present || !evidence.portal_authenticated) throw new Error('Authenticated portal session was not independently verified.')
  await login.screenshot({ path: `${runtime}/auth-smoke-portal.png`, fullPage: true })
  await chmod(`${runtime}/auth-smoke-portal.png`, 0o600)
  await loginContext.close()
  console.log('Portal ordinary registration and fresh-session password login completed against real local Supabase Auth.')
} catch (error) {
  evidence.errors.push(error.message.replace(/https?:\/\/[^\s]+/g, '[runtime URL]'))
  throw error
} finally {
  await browser.close()
  const handle = await open(`${runtime}/auth-smoke-evidence.json`, 'wx', 0o600)
  try { await handle.writeFile(JSON.stringify(evidence, null, 2) + '\n') } finally { await handle.close() }
}
