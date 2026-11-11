import { readFile, open, lstat, rename, copyFile, chmod } from 'node:fs/promises'
import { constants } from 'node:fs'
import { createHash, randomBytes, X509Certificate } from 'node:crypto'
import { chromium } from 'playwright'

const runtime = '/workspace/elklart-runtime'
async function readPrivate(path) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error('Private runtime JSON required.')
  return JSON.parse(await readFile(path,'utf8'))
}
async function writePrivateNew(path, value) {
  const handle = await open(path,'wx',0o600)
  try { await handle.writeFile(JSON.stringify(value,null,2)+'\n') } finally { await handle.close() }
}
const integrationPath = `${runtime}/ops/integration.json`
const previous = await readPrivate(integrationPath)
const { platform: account } = await readPrivate(`${runtime}/ops/accounts.json`)
const status = await readPrivate(`${runtime}/ops/status.json`)
if (previous.apiBaseUrl !== 'https://localhost:3000/api/v1' || status.API_URL !== 'http://127.0.0.1:54321') throw new Error('Dedicated local tenant configuration required.')
const headers = { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY}` }
const companyQuery = new URL(`${status.API_URL}/rest/v1/companies`)
companyQuery.searchParams.set('id',`eq.${previous.companyId}`);companyQuery.searchParams.set('select','status,slug')
const companyResponse = await fetch(companyQuery,{headers})
const company = (await companyResponse.json())[0]
if (!companyResponse.ok || company?.status !== 'active' || company.slug !== 'elklart-demo') throw new Error('Activate the dedicated local demo tenant normally before one-time credential creation; no credential was created.')
const clientQuery = new URL(`${status.API_URL}/rest/v1/integration_api_clients`)
clientQuery.searchParams.set('company_id',`eq.${previous.companyId}`);clientQuery.searchParams.set('profile_key','eq.tenant_website');clientQuery.searchParams.set('select','id,status,metadata,key_prefix,secret_hash')
const beforeResponse = await fetch(clientQuery,{headers})
const before = await beforeResponse.json()
if (!beforeResponse.ok || !Array.isArray(before) || before.some(c => c.metadata?.environment === 'production' && ['active','paused'].includes(c.status))) throw new Error('Production-labelled client already exists; refusing implicit replacement or rotation.')
const originalPath = `${runtime}/ops/integration-development-original.json`
try { await copyFile(integrationPath,originalPath,constants.COPYFILE_EXCL);await chmod(originalPath,0o600) } catch (error) { if (error.code !== 'EEXIST') throw error;await readPrivate(originalPath) }
const certificate = new X509Certificate(await readFile(`${runtime}/tls/server.pem`))
const spki = createHash('sha256').update(certificate.publicKey.export({type:'spki',format:'der'})).digest('base64')
const browser = await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:[`--ignore-certificate-errors-spki-list=${spki}`]})
const evidence = {scope:'ordinary isolated local OPS creation UI; production is a client label, not external production authority',credential_captured:false,credential_readback_verified:false,integration_updated:false}
try {
  const context = await browser.newContext()
  await context.route('**/*',route => ['localhost','127.0.0.1','[::1]'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  const page = await context.newPage();page.setDefaultTimeout(90000)
  const target = `/admin/platform/api-clients?companyId=${previous.companyId}`
  await page.goto(`https://localhost:3000/login?next=${encodeURIComponent(target)}`,{waitUntil:'domcontentloaded',timeout:120000})
  await page.locator('input[name=email]').fill(account.email);await page.locator('input[name=password]').fill(account.password)
  await page.getByRole('button',{name:'Logga in',exact:true}).click();await page.waitForURL(`https://localhost:3000${target}`,{timeout:120000})
  const form = page.locator('#tenant-go-live form')
  await form.locator('select[name=companyId]').selectOption(previous.companyId)
  await form.locator('input[name=customerPortalUrl]').fill('https://localhost:3001/mina-sidor')
  await form.locator('textarea[name=allowedOrigins]').fill('https://localhost:3001')
  await form.locator('summary').click()
  await form.locator('input[name=name]').fill('Elklart lokalt demo · Webb och Mina sidor')
  await form.getByRole('button',{name:'Sätt bolaget live',exact:true}).click()
  const tokenView = page.locator('#tenant-go-live code')
  await tokenView.waitFor({timeout:120000})
  const apiKey = (await tokenView.innerText()).trim()
  if (!/^gdxp_[a-f0-9]{7}\.[A-Za-z0-9_-]{30,}$/.test(apiKey)) throw new Error('One-time client credential was not returned in the expected canonical format.')
  // Persist immediately, before readback, navigation, permission changes or another action.
  const captured = {...previous,apiKey,credentialSource:'ordinary_local_OPS_createIntegrationApiClientAction',environment:'production',capturedAt:new Date().toISOString()}
  await writePrivateNew(`${runtime}/ops/integration-production-created.json`,captured)
  evidence.credential_captured = true
  const response = await fetch(clientQuery,{headers});const clients = await response.json()
  const matches = Array.isArray(clients) ? clients.filter(c => c.metadata?.environment === 'production' && c.key_prefix === apiKey.slice(0,12) && c.secret_hash === createHash('sha256').update(apiKey).digest('hex')) : []
  if (!response.ok || matches.length !== 1) throw new Error('Captured credential does not match exactly one canonical production-labelled local client; preserved privately for operator recovery.')
  evidence.credential_readback_verified = true
  evidence.launch_ready_claim = false
  const temporary = `${integrationPath}.new-${randomBytes(8).toString('hex')}`
  await writePrivateNew(temporary,{...captured,apiClientId:matches[0].id})
  await rename(temporary,integrationPath)
  evidence.integration_updated = true
  console.log('Real production-labelled local client created through normal UI; one-time credential captured privately and verified before integration update.')
} finally {
  await browser.close()
  const id = new Date().toISOString().replace(/[:.]/g,'-')
  await writePrivateNew(`${runtime}/portal/production-client-creation-evidence-${id}.json`,evidence)
}
