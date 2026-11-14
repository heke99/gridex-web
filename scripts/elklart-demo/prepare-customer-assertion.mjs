import { generateKeyPairSync, createHash } from 'node:crypto'
import { readFile, open, lstat, unlink } from 'node:fs/promises'
import { integrationEnvironmentFields } from './portal-app.mjs'

const runtime = '/workspace/elklart-runtime/portal'
const source = '/workspace/elklart-runtime/ops/integration.json'
const sourceStat = await lstat(source)
if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || (sourceStat.mode & 0o077)) throw new Error('Private local integration metadata required.')
const integration = JSON.parse(await readFile(source, 'utf8'))
integrationEnvironmentFields(integration)
const pair = generateKeyPairSync('rsa', { modulusLength: 3072 })
const fingerprint = createHash('sha256').update(pair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex')
const kid = `elklart-portal-${fingerprint.slice(0, 20)}`
const publicJwk = { ...pair.publicKey.export({ format: 'jwk' }), kid }
if (['d','p','q','dp','dq','qi'].some(key => key in publicJwk)) throw new Error('Public key unexpectedly contains private material.')
const metadata = {
  companyId: integration.companyId, purpose: 'customer',
  keyId: kid, issuer: `gridex-tenant:${integration.companyId}`, audience: `gridex-customer-api:${integration.companyId}`,
  publicJwk, publicKeySha256: fingerprint, privateKeyPath: `${runtime}/customer-assertion-private.pem`,
  canonicalRegistration: { page: 'https://localhost:3000/admin/customer-login', action: 'saveTenantKeyProviderAction', form: { expected_company_id: integration.companyId, purpose: 'customer', public_jwk: JSON.stringify(publicJwk) } },
  canonicalEnforcement: { action: 'setEnforcementAction', form: { expected_company_id: integration.companyId, purpose: 'customer', enforcement: 'enforce' } },
  registrationState: 'prepared_only_not_registered',
}
const privateHandle = await open(metadata.privateKeyPath, 'wx', 0o600)
const metadataHandle = await open(`${runtime}/customer-assertion-registration.json`, 'wx', 0o600).catch(async error => { await privateHandle.close(); await unlink(metadata.privateKeyPath); throw error })
try {
  await privateHandle.writeFile(pair.privateKey.export({ type: 'pkcs8', format: 'pem' }))
  await metadataHandle.writeFile(JSON.stringify(metadata, null, 2) + '\n')
} finally { await Promise.all([privateHandle.close(), metadataHandle.close()]) }
console.log('Prepared private RS256 key and public registration form metadata. OPS registration and enforcement remain required.')
