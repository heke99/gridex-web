import { readFile, open } from 'node:fs/promises'
import { verify, createPublicKey } from 'node:crypto'
import { signCustomerAssertion } from '../../lib/ops/customerAssertion.ts'
import { customerAssertionEnvironmentFields } from './portal-app.mjs'

const runtime = '/workspace/elklart-runtime'
const metadata = JSON.parse(await readFile(`${runtime}/portal/customer-assertion-registration.json`, 'utf8'))
const pem = await readFile(`${runtime}/portal/customer-assertion-private.pem`, 'utf8')
const fields = customerAssertionEnvironmentFields(metadata, pem)
const env = {}
for (const line of (await readFile(`${runtime}/portal/app.env`, 'utf8')).split('\n').filter(Boolean)) {
  const separator = line.indexOf('=');env[line.slice(0,separator)] = JSON.parse(line.slice(separator + 1))
}
for (const [key,value] of Object.entries(fields)) {
  if (env[key] !== value) throw new Error('Active portal environment does not match the registered assertion signer.')
  process.env[key] = value
}
if (env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:55321') throw new Error('Unexpected local portal Auth URL.')
const credentials = JSON.parse(await readFile(`${runtime}/portal/auth-smoke.json`, 'utf8'))
const headers = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }
const login = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers, body: JSON.stringify(credentials) })
const session = await login.json()
if (!login.ok || !session.access_token) throw new Error('Real local customer Auth verification failed.')
try {
  const userResponse = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, { headers: { ...headers, Authorization: `Bearer ${session.access_token}` } })
  const user = await userResponse.json()
  if (!userResponse.ok || !user.id || user.id !== session.user?.id) throw new Error('Authenticated subject could not be independently verified.')
  const tokens = [signCustomerAssertion(user.id), signCustomerAssertion(user.id)]
  const jwk = metadata.publicJwk
  const publicKey = createPublicKey({ key: jwk, format: 'jwk' })
  const claims = tokens.map(token => {
    if (!token) throw new Error('Existing portal signer did not produce an assertion.')
    const [header,payload,signature] = token.split('.')
    if (!verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url'))) throw new Error('Customer assertion signature did not verify against registered public key.')
    const h = JSON.parse(Buffer.from(header,'base64url').toString('utf8'))
    const p = JSON.parse(Buffer.from(payload,'base64url').toString('utf8'))
    if (h.alg !== 'RS256' || h.kid !== metadata.keyId || p.iss !== metadata.issuer || p.aud !== metadata.audience || p.sub !== user.id || p.exp - p.iat !== 60 || !p.jti) throw new Error('Assertion does not carry canonical authenticated customer claims.')
    return p
  })
  if (claims[0].jti === claims[1].jti) throw new Error('Customer assertion JTI must be fresh on every attempt.')
  const evidence = { checked_at: new Date().toISOString(), scope: 'existing portal signer with real Auth-verified subject and registered RSA public key; not customer-resource or replay-gate verification', signature_valid: true, real_authenticated_subject: true, canonical_issuer_audience_and_kid: true, expiry_seconds: 60, fresh_jti_per_attempt: true, assertion_required: true }
  const output = await open(`${runtime}/portal/customer-assertion-signer-evidence.json`, 'wx', 0o600)
  try { await output.writeFile(JSON.stringify(evidence,null,2)+'\n') } finally { await output.close() }
  console.log('Existing portal signer verified with real Auth subject, registered public key, 60-second expiry and unique JTI.')
} finally {
  await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${session.access_token}` } }).catch(() => undefined)
}
