import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto'
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { createClient } from '@supabase/supabase-js'

export type WebsiteCommunicationItem = {
  event_type?: string
  code?: string
  status?: string
  message?: string
  occurred_at?: string
}

export type WebsiteApplicationPublicResult = {
  workflowId: string | null
  workflowState: string | null
  continuationJobId?: string | null
  signatureSnapshotSha256: string
  status: string
  energyDirection: 'consumption' | 'production'
  portalStatus: string
  portalMessage: string | null
  customerNumber: string | null
  contractNumber: string | null
  applicationNumber: string | null
  nextStep: string | null
  nextActionMessage: string | null
  caseReference: string | null
  powerOfAttorneySigned: boolean
  missingFields: string[]
  contractStatus: string | null
  signedAt: string | null
  withdrawalDeadlineAt: string | null
  canSendAgreementConfirmation: boolean | null
  canStartSwitch: boolean | null
  canCreateSupplierSwitchRequest: boolean | null
  canDispatchSupplierSwitch: boolean | null
  supplierSwitchStatus: string | null
  blockingReasons: string[]
  warnings: string[]
  communicationQueued: WebsiteCommunicationItem[]
  communicationSent: WebsiteCommunicationItem[]
  communicationFailed: WebsiteCommunicationItem[]
}

type StoredResultRow = {
  public_result: WebsiteApplicationPublicResult
  expires_at: string
}

type StatelessResultPayload = {
  version: 1
  issuedAt: string
  expiresAt: string
  submissionAttemptId: string
  userId: string | null
  result: WebsiteApplicationPublicResult
}

export type WebsiteApplicationResultReadState =
  | {
      status: 'verified'
      result: WebsiteApplicationPublicResult
      source: 'database' | 'stateless'
      expiresAt: string
      submissionAttemptId?: string
      userId?: string | null
    }
  | { status: 'missing' | 'invalid' | 'expired' | 'storage_error'; result: null; source: null; expiresAt: string | null }

const TOKEN_VERSION = 'wr1'
const TOKEN_AAD = Buffer.from('gridex.website-application-result.v1', 'utf8')
const RESULT_TTL_MS = 24 * 60 * 60_000
const MAX_TOKEN_LENGTH = 12_000

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value || null
}

function serviceClient() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Website result storage is not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function configuredResultTokenSecret(): string | null {
  const secret = env('WEBSITE_RESULT_TOKEN_SECRET')
  return secret && secret.length >= 32 ? secret : null
}

function resultTokenSecret(): string {
  const secret = configuredResultTokenSecret()
  if (!secret) {
    throw new Error('WEBSITE_RESULT_TOKEN_SECRET must be configured with at least 32 characters.')
  }
  return secret
}

function encryptionKey(): Buffer {
  return createHash('sha256').update(resultTokenSecret(), 'utf8').digest()
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function createOpaqueResultToken(): string {
  return randomBytes(32).toString('base64url')
}

function validPublicResult(value: unknown): value is WebsiteApplicationPublicResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Partial<WebsiteApplicationPublicResult>
  return (
    row.status === 'accepted' &&
    typeof row.applicationNumber === 'string' &&
    row.applicationNumber.trim().length > 0 &&
    typeof row.customerNumber === 'string' &&
    row.customerNumber.trim().length > 0 &&
    row.contractStatus === 'signed' &&
    row.workflowState === 'canonical_data_committed' &&
    typeof row.signatureSnapshotSha256 === 'string' &&
    /^[a-f0-9]{64}$/i.test(row.signatureSnapshotSha256) &&
    typeof row.signedAt === 'string' &&
    !Number.isNaN(Date.parse(row.signedAt)) &&
    (row.energyDirection === 'consumption' || row.energyDirection === 'production')
  )
}

function encodeStatelessResult(payload: StatelessResultPayload): string {
  const serialized = Buffer.from(JSON.stringify(payload), 'utf8')
  // Deterministic per immutable checkout result: retries for the same attempt
  // return the same token instead of creating multiple active result links.
  // The IV is HMAC-derived from the full payload, so different plaintexts do
  // not reuse an IV under the same key.
  const iv = createHmac('sha256', encryptionKey())
    .update('gridex.website-result.iv.v1\0')
    .update(serialized)
    .digest()
    .subarray(0, 12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(TOKEN_AAD)
  const compressed = deflateRawSync(serialized)
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    TOKEN_VERSION,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.')
}

function decodeStatelessResult(token: string): WebsiteApplicationResultReadState {
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) {
    return { status: 'invalid', result: null, source: null, expiresAt: null }
  }

  try {
    const iv = Buffer.from(parts[1], 'base64url')
    const ciphertext = Buffer.from(parts[2], 'base64url')
    const tag = Buffer.from(parts[3], 'base64url')
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      return { status: 'invalid', result: null, source: null, expiresAt: null }
    }

    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
    decipher.setAAD(TOKEN_AAD)
    decipher.setAuthTag(tag)
    const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    const parsed = JSON.parse(inflateRawSync(compressed).toString('utf8')) as Partial<StatelessResultPayload>
    const expiresAt = typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null

    if (
      parsed.version !== 1 ||
      typeof parsed.issuedAt !== 'string' ||
      !expiresAt ||
      Number.isNaN(Date.parse(expiresAt)) ||
      typeof parsed.submissionAttemptId !== 'string' ||
      !(parsed.userId === null || typeof parsed.userId === 'string') ||
      !validPublicResult(parsed.result)
    ) {
      return { status: 'invalid', result: null, source: null, expiresAt }
    }

    if (Date.parse(expiresAt) <= Date.now()) {
      return { status: 'expired', result: null, source: null, expiresAt }
    }

    return {
      status: 'verified',
      result: parsed.result,
      source: 'stateless',
      expiresAt,
      submissionAttemptId: parsed.submissionAttemptId,
      userId: parsed.userId ?? null,
    }
  } catch {
    return { status: 'invalid', result: null, source: null, expiresAt: null }
  }
}

export function isWebsiteApplicationResultTokenShape(token: string | null | undefined): boolean {
  const normalized = token?.trim() ?? ''
  if (!normalized || normalized.length > MAX_TOKEN_LENGTH) return false
  if (normalized.startsWith(`${TOKEN_VERSION}.`)) {
    return /^wr1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/.test(normalized)
  }
  return /^[A-Za-z0-9_-]{32,160}$/.test(normalized)
}

export async function createWebsiteApplicationResult(input: {
  submissionAttemptId: string
  userId: string | null
  result: WebsiteApplicationPublicResult
}): Promise<string> {
  if (!validPublicResult(input.result)) {
    throw new Error('Website result cannot be created from an unverified OPS application result.')
  }

  const issuedAt = new Date(input.result.signedAt!)
  const expiresAt = new Date(issuedAt.getTime() + RESULT_TTL_MS).toISOString()
  const useStatelessToken = Boolean(configuredResultTokenSecret())
  const token = useStatelessToken
    ? encodeStatelessResult({
        version: 1,
        issuedAt: issuedAt.toISOString(),
        expiresAt,
        submissionAttemptId: input.submissionAttemptId,
        userId: input.userId,
        result: input.result,
      })
    : createOpaqueResultToken()

  try {
    const { error } = await serviceClient().from('website_application_results').upsert(
      [{
        token_hash: tokenHash(token),
        submission_attempt_id: input.submissionAttemptId,
        user_id: input.userId,
        public_result: input.result,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }],
      { onConflict: 'submission_attempt_id', defaultToNull: false },
    )
    if (error) throw new Error(error.message)
  } catch (error) {
    if (useStatelessToken) {
      // OPS has already committed the business transaction. A configured
      // encrypted token remains independently verifiable, while reconciliation
      // can restore the database projection later.
      console.error('[website signup] durable result row upsert failed; using verified stateless result token', error)
      return token
    }

    // Without the dedicated stateless secret, never redirect with an
    // unverifiable token. The caller will keep the accepted submission in its
    // reconciliation path instead of claiming the result page is verified.
    console.error('[website signup] durable result row upsert failed and no stateless result token secret is configured', error)
    throw new Error('Website result storage is unavailable.')
  }

  return token
}

export async function readWebsiteApplicationResultState(
  token: string | null | undefined,
): Promise<WebsiteApplicationResultReadState> {
  const normalized = token?.trim() ?? ''
  if (!normalized) return { status: 'missing', result: null, source: null, expiresAt: null }
  if (!isWebsiteApplicationResultTokenShape(normalized)) {
    return { status: 'invalid', result: null, source: null, expiresAt: null }
  }

  if (normalized.startsWith(`${TOKEN_VERSION}.`)) {
    const decoded = decodeStatelessResult(normalized)
    if (decoded.status !== 'verified') return decoded

    // The signed token is the customer-facing source of truth after OPS success.
    // Opportunistically repair a missing/failed database projection whenever the
    // customer opens the result or a status endpoint validates the token.
    try {
      const { error } = await serviceClient().from('website_application_results').upsert(
        [{
          token_hash: tokenHash(normalized),
          submission_attempt_id: decoded.submissionAttemptId,
          user_id: decoded.userId ?? null,
          public_result: decoded.result,
          expires_at: decoded.expiresAt,
          updated_at: new Date().toISOString(),
        }],
        { onConflict: 'submission_attempt_id', defaultToNull: false },
      )
      if (error) throw new Error(error.message)
    } catch (error) {
      console.error('[website signup] stateless result projection repair failed', error)
    }

    return decoded
  }

  try {
    const { data, error } = await serviceClient()
      .from('website_application_results')
      .select('public_result,expires_at')
      .eq('token_hash', tokenHash(normalized))
      .maybeSingle<StoredResultRow>()
    if (error) throw new Error(error.message)
    if (!data) return { status: 'invalid', result: null, source: null, expiresAt: null }
    if (Date.parse(data.expires_at) <= Date.now()) {
      return { status: 'expired', result: null, source: null, expiresAt: data.expires_at }
    }
    if (!validPublicResult(data.public_result)) {
      return { status: 'invalid', result: null, source: null, expiresAt: data.expires_at }
    }
    return {
      status: 'verified',
      result: data.public_result,
      source: 'database',
      expiresAt: data.expires_at,
    }
  } catch (error) {
    console.error('[website signup] result token database read failed', error)
    return { status: 'storage_error', result: null, source: null, expiresAt: null }
  }
}

export async function readWebsiteApplicationResult(
  token: string | null | undefined,
): Promise<WebsiteApplicationPublicResult | null> {
  const state = await readWebsiteApplicationResultState(token)
  return state.status === 'verified' ? state.result : null
}
