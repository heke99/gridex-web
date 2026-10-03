import assert from 'node:assert/strict'
import { constants, generateKeyPairSync, verify } from 'node:crypto'
import { createOpsCustomerAssertion, getOpsCustomerAssertionStatus } from '../lib/ops/customerAssertion.ts'
import { getGridexConfigurationStatus } from '../lib/ops/config.ts'
import { checkOpsCustomerPortalReadiness } from '../lib/ops/portalReadiness.ts'
import { verifiedPortalHeaders } from '../lib/ops/client/portal.ts'

const names = [
  'PRIVATE_KEY', 'ISSUER', 'AUDIENCE', 'KID', 'ALGORITHM', 'REQUIRED',
].map((suffix) => `GRIDEX_CUSTOMER_ASSERTION_${suffix}`)
const previous = names.map((name) => process.env[name])
const userId = '11111111-1111-4111-8111-111111111111'
function parts(assertion) {
  const [header, claims, signature] = assertion.split('.')
  return {
    header: JSON.parse(Buffer.from(header, 'base64url')),
    claims: JSON.parse(Buffer.from(claims, 'base64url')),
    input: Buffer.from(`${header}.${claims}`), signature: Buffer.from(signature, 'base64url'),
  }
}

try {
  for (const name of names) delete process.env[name]
  assert.equal(createOpsCustomerAssertion(userId), null)
  process.env.GRIDEX_CUSTOMER_ASSERTION_REQUIRED = 'true'
  assert.throws(() => createOpsCustomerAssertion(userId), (error) => error.code === 'customer_assertion_configuration_invalid')
  assert.equal(getOpsCustomerAssertionStatus().valid, false)
  assert.equal(getGridexConfigurationStatus().customerAssertionValid, false)
  assert.equal((await checkOpsCustomerPortalReadiness()).portalBundleProbe.code, 'customer_assertion_configuration_invalid')

  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })
  process.env.GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY = rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  process.env.GRIDEX_CUSTOMER_ASSERTION_ISSUER = 'gridex-tenant:verified-organization'
  process.env.GRIDEX_CUSTOMER_ASSERTION_AUDIENCE = 'gridex-customer-api:verified-organization'
  process.env.GRIDEX_CUSTOMER_ASSERTION_KID = 'customer-key-test'
  const first = parts(createOpsCustomerAssertion(userId))
  assert.equal(getOpsCustomerAssertionStatus().valid, true)
  const second = parts(createOpsCustomerAssertion(userId))
  assert.equal(first.header.alg, 'RS256')
  assert.equal(first.header.kid, 'customer-key-test')
  assert.equal(first.claims.sub, userId)
  assert.equal(first.claims.iss, process.env.GRIDEX_CUSTOMER_ASSERTION_ISSUER)
  assert.equal(first.claims.aud, process.env.GRIDEX_CUSTOMER_ASSERTION_AUDIENCE)
  assert.equal(first.claims.exp - first.claims.iat, 300)
  assert.notEqual(first.claims.jti, second.claims.jti, 'assertions must not be reused across requests or retries')
  assert.equal(verify('sha256', first.input, rsa.publicKey, first.signature), true)
  assert.throws(() => createOpsCustomerAssertion('email@example.test'), (error) => error.code === 'customer_assertion_identity_invalid')

  process.env.GRIDEX_CUSTOMER_ASSERTION_ALGORITHM = 'PS256'
  const pss = parts(createOpsCustomerAssertion(userId))
  assert.equal(pss.header.alg, 'PS256')
  assert.equal(verify('sha256', pss.input, {
    key: rsa.publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32,
  }, pss.signature), true)
  process.env.GRIDEX_CUSTOMER_ASSERTION_ALGORITHM = 'HS256'
  assert.throws(() => createOpsCustomerAssertion(userId), (error) => error.code === 'customer_assertion_configuration_invalid')

  const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  process.env.GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY = ec.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().replace(/\n/g, '\\n')
  process.env.GRIDEX_CUSTOMER_ASSERTION_ALGORITHM = 'ES256'
  const headers = await verifiedPortalHeaders({ userId })
  const ecdsa = parts(headers.get('x-gridex-customer-assertion'))
  assert.equal(ecdsa.signature.byteLength, 64)
  assert.equal(verify('sha256', ecdsa.input, { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, ecdsa.signature), true)
  assert.equal(headers.get('x-gridex-auth-user-id'), userId)
  console.log('Customer assertion algorithms, signatures, subject, expiry, replay identities and fail-closed configuration passed')
} finally {
  names.forEach((name, index) => {
    if (previous[index] === undefined) delete process.env[name]
    else process.env[name] = previous[index]
  })
}
