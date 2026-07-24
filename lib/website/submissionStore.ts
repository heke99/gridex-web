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
  normalized_ops_payload_sha256: string | null
  ops_quote_reference: string | null
  accepted_at: string
  request_context: SubmissionRequestContext | null
  pricing_quote_snapshot: Record<string, unknown> | null
  contract_display_snapshot: Record<string, unknown> | null
  ops_result_snapshot: Record<string, unknown> | null
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
    .select('submission_attempt_id,idempotency_key,external_application_id,external_customer_id,offer_reference,payload_hash,ops_payload_hash,normalized_ops_payload_sha256,ops_quote_reference,accepted_at,request_context,pricing_quote_snapshot,contract_display_snapshot,ops_result_snapshot,status')
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
  pricingQuoteSnapshot: Record<string, unknown>
  contractDisplaySnapshot: Record<string, unknown>
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
    submission_idempotency_key: input.idempotencyKey,
    external_application_id: input.externalApplicationId,
    external_customer_id: input.externalCustomerId,
    accepted_at: acceptedAt,
    offer_reference: input.offerReference,
    payload_hash: input.payloadHash,
    request_context: requestContext,
    pricing_quote_snapshot: input.pricingQuoteSnapshot,
    contract_display_snapshot: input.contractDisplaySnapshot,
    ops_quote_reference: typeof input.pricingQuoteSnapshot.ops_quote_reference === 'string'
      ? input.pricingQuoteSnapshot.ops_quote_reference
      : null,
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
    .update({
      ops_payload_hash: input.opsPayloadHash,
      normalized_ops_payload_sha256: input.opsPayloadHash,
      submission_payload_hash: input.opsPayloadHash,
      attempt_count: existing.ops_payload_hash ? undefined : 1,
      updated_at: new Date().toISOString(),
    })
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
  opsApplicationNumber?: string | null
  opsContractId?: string | null
  opsCustomerNumber?: string | null
  opsSiteId?: string | null
  opsMeteringPointId?: string | null
  opsWorkflowId?: string | null
  opsContinuationJobId?: string | null
  opsWorkflowState?: string | null
  opsStatus?: string | null
  opsSupplierSwitchStatus?: string | null
  opsCorrelationId?: string | null
  lastStatusSyncedAt?: string | null
  opsResultSnapshot?: Record<string, unknown> | null
  contractStatus?: string | null
  signedAt?: string | null
  withdrawalDeadlineAt?: string | null
  signatureSnapshotSha256?: string | null
  canSendAgreementConfirmation?: boolean | null
  canStartSwitch?: boolean | null
  communication?: Record<string, unknown> | null
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
      ops_application_number: input.opsApplicationNumber ?? null,
      ops_contract_id: input.opsContractId ?? null,
      ops_customer_number: input.opsCustomerNumber ?? null,
      ops_site_id: input.opsSiteId ?? null,
      ops_metering_point_id: input.opsMeteringPointId ?? null,
      ops_workflow_id: input.opsWorkflowId ?? null,
      ops_continuation_job_id: input.opsContinuationJobId ?? null,
      ops_workflow_state: input.opsWorkflowState ?? null,
      ops_status: input.opsStatus ?? null,
      ops_supplier_switch_status: input.opsSupplierSwitchStatus ?? null,
      ops_correlation_id: input.opsCorrelationId ?? null,
      last_status_synced_at: input.lastStatusSyncedAt ?? null,
      ops_result_snapshot: input.opsResultSnapshot ?? null,
      contract_status: input.contractStatus ?? null,
      signed_at: input.signedAt ?? null,
      withdrawal_deadline_at: input.withdrawalDeadlineAt ?? null,
      signature_snapshot_sha256: input.signatureSnapshotSha256 ?? null,
      can_send_agreement_confirmation: input.canSendAgreementConfirmation ?? null,
      can_start_switch: input.canStartSwitch ?? null,
      communication_snapshot: input.communication ?? null,
      last_error_code: input.errorCode ?? null,
      last_error_message: input.errorMessage?.slice(0, 1000) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('submission_attempt_id', input.submissionAttemptId)
  if (error) throw new Error(`Submission storage update failed: ${error.message}`)
}

export async function syncWebsiteSubmissionStatus(input: {
  opsApplicationId: string
  opsStatus: string
  opsWorkflowState?: string | null
  opsCustomerNumber?: string | null
  contractStatus?: string | null
  supplierSwitchStatus?: string | null
  snapshot: Record<string, unknown>
}): Promise<void> {
  const applicationId = input.opsApplicationId.trim()
  if (!applicationId) throw new Error('OPS application ID is required for status sync.')
  const now = new Date().toISOString()
  const supabase = serviceClient()
  const { error } = await supabase
    .from('website_application_submissions')
    .update({
      ops_status: input.opsStatus,
      ops_workflow_state: input.opsWorkflowState ?? input.opsStatus,
      ops_customer_number: input.opsCustomerNumber ?? undefined,
      contract_status: input.contractStatus ?? undefined,
      ops_supplier_switch_status: input.supplierSwitchStatus ?? undefined,
      last_status_synced_at: now,
      ops_result_snapshot: input.snapshot,
      updated_at: now,
    })
    .eq('ops_application_id', applicationId)
  if (error) throw new Error(`Submission status sync failed: ${error.message}`)
}
