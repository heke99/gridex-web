import { constants, createPrivateKey, randomUUID, sign, type KeyObject } from 'node:crypto'
import { OpsError } from '@/lib/ops/errors'

type AssertionAlgorithm = 'RS256' | 'PS256' | 'ES256'
let signingKey: { pem: string; key: KeyObject } | null = null

function getGridexRuntimeSetting(name: string): string | undefined {
  return process.env[name]?.trim() || undefined
}

export function getOpsCustomerAssertionStatus(): {
  required: boolean
  configured: boolean
  valid: boolean
  missingVariables: string[]
} {
  const required = getGridexRuntimeSetting('GRIDEX_CUSTOMER_ASSERTION_REQUIRED') === 'true'
  const variables = ['PRIVATE_KEY', 'ISSUER', 'AUDIENCE', 'KID'].map((name) => `GRIDEX_CUSTOMER_ASSERTION_${name}`)
  const configured = variables.every((name) => Boolean(getGridexRuntimeSetting(name)))
  const enabled = required || variables.some((name) => Boolean(getGridexRuntimeSetting(name))) ||
    Boolean(getGridexRuntimeSetting('GRIDEX_CUSTOMER_ASSERTION_ALGORITHM'))
  if (!enabled) return { required, configured: false, valid: true, missingVariables: [] }
  const missingVariables = variables.filter((name) => !getGridexRuntimeSetting(name))
  try {
    createOpsCustomerAssertion('00000000-0000-4000-8000-000000000000')
    return { required, configured, valid: true, missingVariables }
  } catch {
    return { required, configured, valid: false, missingVariables }
  }
}

function configurationError(): OpsError {
  return new OpsError('Verifiering av kundinloggningen är inte korrekt konfigurerad.', 503, {
    code: 'customer_assertion_configuration_invalid',
    retryable: false,
  })
}

/** Sign only identities verified by the server session; browser assertions are never forwarded. */
export function createOpsCustomerAssertion(userId: string): string | null {
  const privateKey = getGridexRuntimeSetting('GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY')
  const issuer = getGridexRuntimeSetting('GRIDEX_CUSTOMER_ASSERTION_ISSUER')
  const audience = getGridexRuntimeSetting('GRIDEX_CUSTOMER_ASSERTION_AUDIENCE')
  const kid = getGridexRuntimeSetting('GRIDEX_CUSTOMER_ASSERTION_KID')
  const required = getGridexRuntimeSetting('GRIDEX_CUSTOMER_ASSERTION_REQUIRED') === 'true'
  const configuredAlgorithm = getGridexRuntimeSetting('GRIDEX_CUSTOMER_ASSERTION_ALGORITHM')
  if (!privateKey && !issuer && !audience && !kid && !required && !configuredAlgorithm) return null
  if (!privateKey || !issuer || !audience || !kid) throw configurationError()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new OpsError('Kundinloggningen saknar en verifierad användaridentitet.', 401, {
      code: 'customer_assertion_identity_invalid', retryable: false,
    })
  }

  const pem = privateKey.replace(/\\n/g, '\n')
  let key: KeyObject
  try {
    if (signingKey?.pem !== pem) signingKey = { pem, key: createPrivateKey(pem) }
    key = signingKey.key
  } catch {
    throw configurationError()
  }
  const algorithm = configuredAlgorithm ??
    (key.asymmetricKeyType === 'ec' ? 'ES256' : 'RS256')
  if (!['RS256', 'PS256', 'ES256'].includes(algorithm)) throw configurationError()
  const alg = algorithm as AssertionAlgorithm
  if (alg === 'ES256') {
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
      throw configurationError()
    }
  } else if (
    !['rsa', 'rsa-pss'].includes(key.asymmetricKeyType ?? '') ||
    (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048 ||
    (alg === 'RS256' && key.asymmetricKeyType === 'rsa-pss')
  ) {
    throw configurationError()
  }

  const iat = Math.floor(Date.now() / 1000)
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const input = `${encode({ alg, typ: 'JWT', kid })}.${encode({
    iss: issuer, aud: audience, sub: userId, iat, exp: iat + 300, jti: randomUUID(),
  })}`
  try {
    const signature = sign('sha256', Buffer.from(input), {
      key,
      ...(alg === 'ES256' ? { dsaEncoding: 'ieee-p1363' as const } : {}),
      ...(alg === 'PS256' ? { padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 } : {}),
    }).toString('base64url')
    const assertion = `${input}.${signature}`
    if (assertion.length > 8192) throw configurationError()
    return assertion
  } catch {
    throw configurationError()
  }
}
