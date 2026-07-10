import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

type SubmissionRequestContext = {
  ipAddress: string | null
  ipHash: string | null
  userAgent: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}

type SubmissionRow = {
  submission_attempt_id: string
  idempotency_key: string
  external_application_id: string
  external_customer_id: string
  offer_reference: string
  payload_hash: string
  ops_payload_hash: string | null
  accepted_at: string
  request_context: SubmissionRequestContext | null
  status: string
}

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value || null
}

function serviceClient() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Website submission storage is not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function submissionPayloadHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function normalizeContext(value: SubmissionRequestContext | null | undefined): SubmissionRequestContext {
  return {
    ipAddress: value?.ipAddress ?? null,
    ipHash: value?.ipHash ?? null,
    userAgent: value?.userAgent ?? null,
    utmSource: value?.utmSource ?? null,
    utmMedium: value?.utmMedium ?? null,
    utmCampaign: value?.utmCampaign ?? null,
  }
}

async function readSubmission(submissionAttemptId: string): Promise<SubmissionRow | null> {
  const supabase = serviceClient()
  const { data, error } = await supabase
    .from('website_application_submissions')
    .select('submission_attempt_id,idempotency_key,external_application_id,external_customer_id,offer_reference,payload_hash,ops_payload_hash,accepted_at,request_context,status')
    .eq('submission_attempt_id', submissionAttemptId)
    .maybeSingle<SubmissionRow>()
  if (error) throw new Error(`Submission storage read failed: ${error.message}`)
  return data
}

function verifyImmutableSubmission(existing: SubmissionRow, input: {
  idempotencyKey: string
  externalApplicationId: string
  externalCustomerId: string
  offerReference: string
  payloadHash: string
}) {
  const mismatch =
    existing.idempotency_key !== input.idempotencyKey ||
    existing.external_application_id !== input.externalApplicationId ||
    existing.external_customer_id !== input.externalCustomerId ||
    existing.offer_reference !== input.offerReference ||
    existing.payload_hash !== input.payloadHash
  if (mismatch) throw new Error('Submission attempt payload changed after signing.')
}

export async function prepareWebsiteSubmission(input: {
  submissionAttemptId: string
  userId: string | null
  idempotencyKey: string
  externalApplicationId: string
  externalCustomerId: string
  offerReference: string
  payloadHash: string
  requestContext: SubmissionRequestContext
}): Promise<{ acceptedAt: string; requestContext: SubmissionRequestContext }> {
  const existing = await readSubmission(input.submissionAttemptId)
  if (existing) {
    verifyImmutableSubmission(existing, input)
    return {
      acceptedAt: existing.accepted_at,
      requestContext: normalizeContext(existing.request_context),
    }
  }

  const supabase = serviceClient()
  const acceptedAt = new Date().toISOString()
  const requestContext = normalizeContext(input.requestContext)
  const { error } = await supabase.from('website_application_submissions').insert({
    submission_attempt_id: input.submissionAttemptId,
    user_id: input.userId,
    idempotency_key: input.idempotencyKey,
    external_application_id: input.externalApplicationId,
    external_customer_id: input.externalCustomerId,
    accepted_at: acceptedAt,
    offer_reference: input.offerReference,
    payload_hash: input.payloadHash,
    request_context: requestContext,
    status: 'prepared',
  })

  if (error) {
    // Two concurrent requests may race on the same attempt. Re-read and accept
    // only when the persisted immutable values are identical.
    const raced = await readSubmission(input.submissionAttemptId)
    if (!raced) throw new Error(`Submission storage insert failed: ${error.message}`)
    verifyImmutableSubmission(raced, input)
    return {
      acceptedAt: raced.accepted_at,
      requestContext: normalizeContext(raced.request_context),
    }
  }
  return { acceptedAt, requestContext }
}

export async function lockWebsiteSubmissionOpsPayload(input: {
  submissionAttemptId: string
  opsPayloadHash: string
}): Promise<void> {
  const supabase = serviceClient()
  const existing = await readSubmission(input.submissionAttemptId)
  if (!existing) throw new Error('Submission attempt was not prepared.')
  if (existing.ops_payload_hash && existing.ops_payload_hash !== input.opsPayloadHash) {
    throw new Error('OPS payload changed for an existing idempotency key.')
  }
  if (existing.ops_payload_hash === input.opsPayloadHash) return

  const { data, error } = await supabase
    .from('website_application_submissions')
    .update({ ops_payload_hash: input.opsPayloadHash, updated_at: new Date().toISOString() })
    .eq('submission_attempt_id', input.submissionAttemptId)
    .is('ops_payload_hash', null)
    .select('ops_payload_hash')
    .maybeSingle<{ ops_payload_hash: string | null }>()
  if (error) throw new Error(`Submission payload lock failed: ${error.message}`)
  if (data?.ops_payload_hash === input.opsPayloadHash) return

  const raced = await readSubmission(input.submissionAttemptId)
  if (!raced || raced.ops_payload_hash !== input.opsPayloadHash) {
    throw new Error('OPS payload changed for an existing idempotency key.')
  }
}

export async function updateWebsiteSubmission(input: {
  submissionAttemptId: string
  status: 'submitting' | 'accepted' | 'failed'
  opsApplicationId?: string | null
  opsCustomerId?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}): Promise<void> {
  const supabase = serviceClient()
  const { error } = await supabase
    .from('website_application_submissions')
    .update({
      status: input.status,
      ops_application_id: input.opsApplicationId ?? null,
      ops_customer_id: input.opsCustomerId ?? null,
      last_error_code: input.errorCode ?? null,
      last_error_message: input.errorMessage?.slice(0, 1000) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('submission_attempt_id', input.submissionAttemptId)
  if (error) throw new Error(`Submission storage update failed: ${error.message}`)
}
