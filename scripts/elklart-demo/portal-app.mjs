import { open, readFile, lstat, unlink, rename } from 'node:fs/promises'
import { randomBytes, createPrivateKey, createPublicKey, createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const runtime = '/workspace/elklart-runtime/portal'
const tls = '/workspace/elklart-runtime/tls'
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const envPath = `${runtime}/app.env`
async function privateFile(path) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error('Runtime files must be private regular files.')
}
async function prepare() {
  await privateFile(`${runtime}/status.json`)
  const status = JSON.parse(await readFile(`${runtime}/status.json`, 'utf8'))
  if (status.API_URL !== 'http://127.0.0.1:55321' || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error('Unexpected dedicated portal Supabase status.')
  const env = {
    NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: '--max-old-space-size=4096',
    NODE_EXTRA_CA_CERTS: `${tls}/ca.pem`,
    ELKLART_DEMO_ENABLED: 'true', ELKLART_DEMO_LOCAL_RUNTIME: 'true',
    NEXT_PUBLIC_SITE_URL: 'https://localhost:3001', GRIDEX_OPS_API_URL: 'https://localhost:3000/api/v1',
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    GRIDEX_WEBSITE_STATE_SIGNING_SECRET: randomBytes(48).toString('base64url'),
    PII_HASH_PEPPER: randomBytes(32).toString('base64url'), PII_ENCRYPTION_KEY: randomBytes(32).toString('base64url'),
  }
  const handle = await open(envPath, 'wx', 0o600)
  try { await handle.writeFile(Object.entries(env).map(([key,value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n') } finally { await handle.close() }
  console.log('Prepared private portal environment. OPS API credentials remain unconfigured until canonical client provisioning.')
}
export function validatePortalAppEnvironment(env) {
  if (env.NODE_ENV !== 'development' || env.ELKLART_DEMO_ENABLED !== 'true' || env.ELKLART_DEMO_LOCAL_RUNTIME !== 'true'
    || env.NEXT_PUBLIC_SITE_URL !== 'https://localhost:3001' || env.GRIDEX_OPS_API_URL !== 'https://localhost:3000/api/v1'
    || env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:55321' || env.VERCEL_ENV
    || env.NODE_EXTRA_CA_CERTS !== `${tls}/ca.pem` || env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('Portal launcher refuses nonlocal or insecure configuration.')
}
export function integrationEnvironmentFields(integration) {
  if (integration.apiBaseUrl !== 'https://localhost:3000/api/v1'
    || typeof integration.apiKey !== 'string' || Buffer.byteLength(integration.apiKey) < 32
    || typeof integration.webhookSigningSecret !== 'string' || Buffer.byteLength(integration.webhookSigningSecret) < 32
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(integration.companyId ?? '')) {
    throw new Error('Expected a real provisioned local website client and webhook signing secret.')
  }
  return { GRIDEX_API_KEY: integration.apiKey, GRIDEX_WEBHOOK_SIGNING_SECRET: integration.webhookSigningSecret }
}
export function customerAssertionEnvironmentFields(metadata, privatePem) {
  const expectedIssuer = `gridex-tenant:${metadata.companyId}`
  const expectedAudience = `gridex-customer-api:${metadata.companyId}`
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(metadata.companyId ?? '')
    || metadata.registrationState !== 'registered_and_enforced' || metadata.purpose !== 'customer'
    || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(metadata.providerId ?? '')
    || metadata.issuer !== expectedIssuer || metadata.audience !== expectedAudience
    || !metadata.keyId || metadata.publicJwk?.kid !== metadata.keyId || metadata.publicJwk?.kty !== 'RSA'
    || ['d', 'p', 'q', 'dp', 'dq', 'qi'].some(key => key in metadata.publicJwk)) throw new Error('A registered and enforced canonical customer assertion provider is required.')
  const key = createPrivateKey(privatePem)
  if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error('Customer assertion key must be RSA2048 or stronger.')
  const publicKey = createPublicKey(key)
  const jwk = publicKey.export({ format: 'jwk' })
  const fingerprint = createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex')
  if (jwk.n !== metadata.publicJwk.n || jwk.e !== metadata.publicJwk.e || fingerprint !== metadata.publicKeySha256) throw new Error('Registered assertion public key does not match the private local key.')
  return { GRIDEX_CUSTOMER_ASSERTION_REQUIRED: 'true', GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY: privatePem, GRIDEX_CUSTOMER_ASSERTION_KEY_ID: metadata.keyId, GRIDEX_CUSTOMER_ASSERTION_ISSUER: metadata.issuer, GRIDEX_CUSTOMER_ASSERTION_AUDIENCE: metadata.audience }
}
async function replaceEnvironmentFields(fields) {
  await privateFile(envPath)
  const lines = (await readFile(envPath, 'utf8')).split('\n').filter(Boolean).filter(line => !Object.keys(fields).includes(line.slice(0, line.indexOf('='))))
  const updated = lines.concat(Object.entries(fields).map(([key,value]) => `${key}=${JSON.stringify(value)}`)).join('\n') + '\n'
  const temporary = `${envPath}.new-${randomBytes(8).toString('hex')}`
  const handle = await open(temporary, 'wx', 0o600)
  try { await handle.writeFile(updated) } finally { await handle.close() }
  await rename(temporary, envPath)
}
async function configureCustomerAssertion() {
  const metadataPath = `${runtime}/customer-assertion-registration.json`
  await privateFile(metadataPath)
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
  if (metadata.privateKeyPath !== `${runtime}/customer-assertion-private.pem`) throw new Error('Unexpected private assertion key path.')
  await privateFile(metadata.privateKeyPath)
  const integration = JSON.parse(await readFile('/workspace/elklart-runtime/ops/integration.json', 'utf8'))
  integrationEnvironmentFields(integration)
  if (metadata.companyId !== integration.companyId) throw new Error('Assertion provider belongs to a different demo company.')
  const fields = customerAssertionEnvironmentFields(metadata, await readFile(metadata.privateKeyPath, 'utf8'))
  await replaceEnvironmentFields(fields)
  console.log('Configured registered customer assertion signer privately. Restart the portal to load it.')
}
async function configureIntegration() {
  const source = '/workspace/elklart-runtime/ops/integration.json'
  await privateFile(source)
  await privateFile(envPath)
  const fields = integrationEnvironmentFields(JSON.parse(await readFile(source, 'utf8')))
  await replaceEnvironmentFields(fields)
  console.log('Configured canonical local OPS client and webhook secret privately. Restart the portal to load them.')
}
async function start() {
  if (Number(process.versions.node.split('.')[0]) !== 22) throw new Error('Use Node 22 for the portal runtime.')
  await privateFile(envPath)
  // Node parses the file; values are never passed to a shell or emitted.
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (/^(GRIDEX_|SUPABASE_|NEXT_PUBLIC_SUPABASE_|ELKLART_|PII_)/.test(key) || key === 'VERCEL_ENV') delete env[key]
  }
  const text = await readFile(envPath, 'utf8')
  for (const line of text.split('\n').filter(Boolean)) {
    const separator = line.indexOf('=')
    const key = line.slice(0, separator)
    if (separator < 1 || !/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error('Invalid private portal environment format.')
    env[key] = JSON.parse(line.slice(separator + 1))
  }
  validatePortalAppEnvironment(env)
  const pidHandle = await open(`${runtime}/app.pid`, 'wx', 0o600)
  const logHandle = await open(`${runtime}/app.log`, constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | constants.O_NOFOLLOW, 0o600)
  if (!(await logHandle.stat()).isFile()) { await logHandle.close(); await pidHandle.close(); throw new Error('Portal log must be a regular file.') }
  await logHandle.chmod(0o600)
  try {
    const child = spawn(process.execPath, [resolve(repository, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3001', '--experimental-https', '--experimental-https-key', `${tls}/server-key.pem`, '--experimental-https-cert', `${tls}/server.pem`, '--experimental-https-ca', `${tls}/ca.pem`], { cwd: repository, env, detached: true, stdio: ['ignore', logHandle.fd, logHandle.fd] })
    await new Promise((accept,reject) => { child.once('spawn',accept); child.once('error',reject) })
    await pidHandle.writeFile(String(child.pid) + '\n')
    child.unref()
  } finally { await Promise.all([pidHandle.close(),logHandle.close()]) }
  console.log('Portal process started; PID and logs saved privately. Verify HTTPS readiness separately.')
}
export function isPortalProcessCommand(command) {
  const args = command.split('\0').filter(Boolean)
  return args[1] === resolve(repository, 'node_modules/next/dist/bin/next')
    && args[2] === 'dev' && args[args.indexOf('--port') + 1] === '3001'
    && args[args.indexOf('--hostname') + 1] === '127.0.0.1'
    && args[args.indexOf('--experimental-https-key') + 1] === `${tls}/server-key.pem`
}
async function stop() {
  await privateFile(`${runtime}/app.pid`)
  const pid = Number((await readFile(`${runtime}/app.pid`, 'utf8')).trim())
  if (!Number.isSafeInteger(pid) || pid < 2) throw new Error('Invalid portal PID.')
  const command = await readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => '')
  if (command && !isPortalProcessCommand(command)) throw new Error('PID does not identify the dedicated portal app.')
  if (command) process.kill(-pid, 'SIGTERM')
  await unlink(`${runtime}/app.pid`)
  console.log('Dedicated portal process stopped.')
}
const action = process.argv[2]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) Promise.resolve().then(() => {
  if (action === 'prepare') return prepare()
  if (action === 'configure-integration') return configureIntegration()
  if (action === 'configure-customer-assertion') return configureCustomerAssertion()
  if (action === 'start') return start()
  if (action === 'stop') return stop()
  throw new Error('Usage: node scripts/elklart-demo/portal-app.mjs prepare|configure-integration|configure-customer-assertion|start|stop')
}).catch(error => { console.error(error.message); process.exitCode = 1 })
