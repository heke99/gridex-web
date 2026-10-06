import { createPrivateKey, randomUUID, sign } from 'node:crypto'
import { OpsError } from './errors'

/** Server-only customer login assertion. Each transport attempt gets a fresh jti. */
export function signCustomerAssertion(subject: string, now = new Date()): string | null {
  const privatePem = process.env.GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY?.trim()
  const kid = process.env.GRIDEX_CUSTOMER_ASSERTION_KEY_ID?.trim()
  const issuer = process.env.GRIDEX_CUSTOMER_ASSERTION_ISSUER?.trim()
  const audience = process.env.GRIDEX_CUSTOMER_ASSERTION_AUDIENCE?.trim()
  if (![privatePem, kid, issuer, audience].some(Boolean) && process.env.GRIDEX_CUSTOMER_ASSERTION_REQUIRED !== 'true') return null
  const fail = (): never => { throw new OpsError('Kundinloggningens verifiering är inte konfigurerad.', 503, { code: 'customer_assertion_not_configured', retryable: false }) }
  if (!privatePem || !kid || !issuer || !audience || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(subject)) fail()
  try {
    const key = createPrivateKey(privatePem!.replaceAll('\\n', '\n'))
    if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) fail()
    const iat = Math.floor(now.getTime() / 1000)
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT', kid })}.${encode({ iss: issuer, aud: audience, sub: subject, iat, exp: iat + 60, jti: randomUUID() })}`
    return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`
  } catch { return fail() }
}
