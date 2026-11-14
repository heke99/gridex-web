import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateKeyPairSync, createHash } from 'node:crypto'
import { validatePortalAppEnvironment, integrationEnvironmentFields, isPortalProcessCommand, customerAssertionEnvironmentFields } from '../scripts/elklart-demo/portal-app.mjs'

test('portal launcher requires dedicated Auth URL, paired HTTPS, CA and development gates', () => {
  const env = { NODE_ENV: 'development', ELKLART_DEMO_ENABLED: 'true', ELKLART_DEMO_LOCAL_RUNTIME: 'true', NEXT_PUBLIC_SITE_URL: 'https://localhost:3001', GRIDEX_OPS_API_URL: 'https://localhost:3000/api/v1', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321', NODE_EXTRA_CA_CERTS: '/workspace/elklart-runtime/tls/ca.pem' }
  validatePortalAppEnvironment(env)
  for (const [key,value] of Object.entries({ NODE_ENV: 'production', ELKLART_DEMO_ENABLED: 'false', ELKLART_DEMO_LOCAL_RUNTIME: 'false', NEXT_PUBLIC_SITE_URL: 'https://gridex.se', GRIDEX_OPS_API_URL: 'https://app.gridex.se/api/v1', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321', VERCEL_ENV: 'preview', NODE_EXTRA_CA_CERTS: '/tmp/other-ca.pem', NODE_TLS_REJECT_UNAUTHORIZED: '0' })) {
    assert.throws(() => validatePortalAppEnvironment({ ...env, [key]: value }), /refuses/)
  }
})


test('integration merge allows only real local client credentials and drops unrelated fields', () => {
  const integration = { apiBaseUrl: 'https://localhost:3000/api/v1', companyId: '11111111-1111-4111-8111-111111111111', apiKey: 'synthetic-test-key-'.repeat(3), webhookSigningSecret: 'synthetic-test-secret-'.repeat(3), NEXT_PUBLIC_LEAK: 'must not copy' }
  assert.deepEqual(Object.keys(integrationEnvironmentFields(integration)).sort(), ['GRIDEX_API_KEY', 'GRIDEX_WEBHOOK_SIGNING_SECRET'])
  for (const fields of [{ apiBaseUrl: 'https://app.gridex.se/api/v1' }, { apiKey: 'prefix' }, { webhookSigningSecret: '' }, { companyId: 'not-a-tenant' }]) assert.throws(() => integrationEnvironmentFields({ ...integration, ...fields }), /provisioned local/)
})


test('stopping requires the exact portal dev process and loopback port', () => {
  const args = ['/node', '/workspace/gridex-web/node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3001', '--experimental-https-key', '/workspace/elklart-runtime/tls/server-key.pem']
  assert.equal(isPortalProcessCommand(args.join('\0')), true)
  assert.equal(isPortalProcessCommand(args.map(a => a === '3001' ? '3000' : a).join('\0')), false)
  assert.equal(isPortalProcessCommand(args.map(a => a === '127.0.0.1' ? '0.0.0.0' : a).join('\0')), false)
  assert.equal(isPortalProcessCommand('/node\0other-app\0'), false)
})


test('customer assertion activation requires real registration and matching RSA public key', () => {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const companyId = '11111111-1111-4111-8111-111111111111'
  const metadata = { companyId, purpose: 'customer', providerId: '22222222-2222-4222-8222-222222222222', registrationState: 'registered_and_enforced', keyId: 'synthetic-kid', issuer: `gridex-tenant:${companyId}`, audience: `gridex-customer-api:${companyId}`, publicJwk: { ...pair.publicKey.export({ format: 'jwk' }), kid: 'synthetic-kid' }, publicKeySha256: createHash('sha256').update(pair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex') }
  const pem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' })
  assert.equal(customerAssertionEnvironmentFields(metadata, pem).GRIDEX_CUSTOMER_ASSERTION_REQUIRED, 'true')
  assert.throws(() => customerAssertionEnvironmentFields({ ...metadata, registrationState: 'prepared_only_not_registered' }, pem), /registered/)
  assert.throws(() => customerAssertionEnvironmentFields({ ...metadata, audience: 'different-tenant' }, pem), /registered/)
  assert.throws(() => customerAssertionEnvironmentFields({ ...metadata, publicKeySha256: 'wrong-key' }, pem), /does not match/)
})
