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
  legal_evidence_snapshot: Record<string, unknown> | null
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
    .select('submission_attempt_id,idempotency_key,external_application_id,external_customer_id,offer_reference,payload_hash,ops_payload_hash,normalized_ops_payload_sha256,ops_quote_reference,accepted_at,request_context,pricing_quote_snapshot,contract_display_snapshot,legal_evidence_snapshot,ops_result_snapshot,status')
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
  legalEvidenceSnapshot: Record<string, unknown>
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
    legal_evidence_snapshot: input.legalEvidenceSnapshot,
    legal_evidence_sha256: submissionPayloadHash(input.legalEvidenceSnapshot),
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

export type WebsiteSubmissionUpdateInput = {
  submissionAttemptId: string
  status: 'submitting' | 'accepted' | 'failed'
  opsCustomerId?: string | null
  opsCustomerReference?: string | null
  opsApplicationNumber?: string | null
  opsApplicationReference?: string | null
  opsContractId?: string | null
  opsContractReference?: string | null
  opsFacilityReference?: string | null
  opsMeteringPointReference?: string | null
  opsCustomerNumber?: string | null
  opsSiteId?: string | null
  opsMeteringPointId?: string | null
  opsWorkflowId?: string | null
  opsContinuationJobId?: string | null
  opsWorkflowState?: string | null
  opsStatus?: string | null
  opsSupplierSwitchStatus?: string | null
  opsRequestId?: string | null
  opsCorrelationId?: string | null
  opsTraceId?: string | null
  opsContractSchemaVersion?: string | null
  apiContractVersionUsed?: string | null
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
}

export async function updateWebsiteSubmission(input: WebsiteSubmissionUpdateInput): Promise<void> {
  const supabase = serviceClient()
  const { data, error } = await supabase
    .from('website_application_submissions')
    .update({
      status: input.status,
      ops_customer_id: input.opsCustomerId ?? null,
      ops_customer_reference: input.opsCustomerReference ?? null,
      ops_application_number: input.opsApplicationNumber ?? null,
      ops_application_reference: input.opsApplicationReference ?? null,
      ops_contract_id: input.opsContractId ?? null,
      ops_contract_reference: input.opsContractReference ?? null,
      ops_facility_reference: input.opsFacilityReference ?? null,
      ops_metering_point_reference: input.opsMeteringPointReference ?? null,
      ops_customer_number: input.opsCustomerNumber ?? null,
      ops_site_id: input.opsSiteId ?? null,
      ops_metering_point_id: input.opsMeteringPointId ?? null,
      ops_workflow_id: input.opsWorkflowId ?? null,
      ops_continuation_job_id: input.opsContinuationJobId ?? null,
      ops_workflow_state: input.opsWorkflowState ?? null,
      ops_status: input.opsStatus ?? null,
      ops_supplier_switch_status: input.opsSupplierSwitchStatus ?? null,
      ops_request_id: input.opsRequestId ?? null,
      ops_correlation_id: input.opsCorrelationId ?? null,
      ops_trace_id: input.opsTraceId ?? null,
      ops_contract_schema_version: input.opsContractSchemaVersion ?? null,
      api_contract_version_used: input.apiContractVersionUsed ?? null,
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
    .select('submission_attempt_id')
    .maybeSingle<{ submission_attempt_id: string }>()
  if (error) throw new Error(`Submission storage update failed: ${error.message}`)
  if (!data) throw new Error('Submission storage update failed: submission row not found.')
}

export async function syncWebsiteSubmissionStatus(input: {
  opsApplicationNumber: string
  opsStatus: string
  opsWorkflowState?: string | null
  opsCustomerNumber?: string | null
  contractStatus?: string | null
  supplierSwitchStatus?: string | null
  snapshot: Record<string, unknown>
}): Promise<void> {
  const applicationNumber = input.opsApplicationNumber.trim()
  if (!applicationNumber) throw new Error('OPS application number is required for status sync.')
  const now = new Date().toISOString()
  const supabase = serviceClient()
  const { data, error } = await supabase
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
    .eq('ops_application_number', applicationNumber)
    .select('submission_attempt_id')
    .maybeSingle<{ submission_attempt_id: string }>()
  if (error) throw new Error(`Submission status sync failed: ${error.message}`)
  if (!data) throw new Error('Submission status sync failed: submission row not found.')
}

export async function recordWebsiteSubmissionFailure(input: {
  flow: string
  reason: string
  submissionAttemptId?: string | null
  email?: string | null
  metadata?: Record<string, unknown> | null
}): Promise<void> {
  const normalizedEmail = input.email?.trim().toLowerCase() || null
  const { error } = await serviceClient().from('website_submission_failures').insert({
    flow: input.flow,
    email_hash: normalizedEmail
      ? createHash('sha256').update(normalizedEmail).digest('hex')
      : null,
    reason: input.reason.slice(0, 1000),
    metadata: {
      submission_attempt_id: input.submissionAttemptId ?? null,
      ...(input.metadata ?? {}),
    },
  })
  if (error) throw new Error(`Submission failure audit insert failed: ${error.message}`)
}


type WebsiteSubmissionReconciliationJob = {
  id: string
  submission_attempt_id: string
  status: 'pending' | 'processing' | 'completed' | 'retryable_failure' | 'manual_review'
  payload: WebsiteSubmissionUpdateInput
  attempt_count: number
  max_attempts: number
}

async function recoverStaleWebsiteSubmissionReconciliationJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString()
  const { error } = await serviceClient()
    .from('website_submission_reconciliation_jobs')
    .update({
      status: 'retryable_failure',
      next_attempt_at: new Date().toISOString(),
      last_error: 'Recovered stale processing lock after worker interruption.',
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'processing')
    .lt('locked_at', cutoff)
  if (error) throw new Error(`Submission reconciliation stale-lock recovery failed: ${error.message}`)
}

export async function queueWebsiteSubmissionReconciliation(
  input: WebsiteSubmissionUpdateInput,
  reason: string,
): Promise<void> {
  const supabase = serviceClient()
  const { data: existing, error: readError } = await supabase
    .from('website_submission_reconciliation_jobs')
    .select('id,status,attempt_count,max_attempts')
    .eq('submission_attempt_id', input.submissionAttemptId)
    .maybeSingle<Pick<WebsiteSubmissionReconciliationJob, 'id' | 'status' | 'attempt_count' | 'max_attempts'>>()
  if (readError) throw new Error(`Submission reconciliation queue read failed: ${readError.message}`)
  if (existing?.status === 'processing' || existing?.status === 'completed') return

  const { error } = await supabase.from('website_submission_reconciliation_jobs').upsert(
    [{
      submission_attempt_id: input.submissionAttemptId,
      status: 'pending',
      payload: input,
      attempt_count: existing?.attempt_count ?? 0,
      max_attempts: existing?.max_attempts ?? 10,
      last_error: reason.slice(0, 2000),
      next_attempt_at: new Date().toISOString(),
      locked_at: null,
      updated_at: new Date().toISOString(),
    }],
    { onConflict: 'submission_attempt_id', defaultToNull: false },
  )
  if (error) throw new Error(`Submission reconciliation queue failed: ${error.message}`)
}

async function claimWebsiteSubmissionReconciliationJob(
  job: WebsiteSubmissionReconciliationJob,
): Promise<number | null> {
  const attempt = job.attempt_count + 1
  const { data, error } = await serviceClient()
    .from('website_submission_reconciliation_jobs')
    .update({
      status: 'processing',
      attempt_count: attempt,
      locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('attempt_count', job.attempt_count)
    .in('status', ['pending', 'retryable_failure'])
    .select('id')
    .maybeSingle<{ id: string }>()
  if (error) throw new Error(`Submission reconciliation claim failed: ${error.message}`)
  return data ? attempt : null
}

export async function processWebsiteSubmissionReconciliationJobs(limit = 25): Promise<{
  processed: number
  completed: number
  failed: number
}> {
  const supabase = serviceClient()
  await recoverStaleWebsiteSubmissionReconciliationJobs()
  const { data, error } = await supabase
    .from('website_submission_reconciliation_jobs')
    .select('id,submission_attempt_id,status,payload,attempt_count,max_attempts')
    .in('status', ['pending', 'retryable_failure'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)))
    .returns<WebsiteSubmissionReconciliationJob[]>()
  if (error) throw new Error(`Submission reconciliation load failed: ${error.message}`)

  let completed = 0
  let failed = 0
  for (const job of data ?? []) {
    const attempt = await claimWebsiteSubmissionReconciliationJob(job)
    if (attempt === null) continue
    try {
      await updateWebsiteSubmission(job.payload)
      const { data: completedJob, error: completeError } = await supabase
        .from('website_submission_reconciliation_jobs')
        .update({
          status: 'completed',
          last_error: null,
          next_attempt_at: null,
          locked_at: null,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('status', 'processing')
        .eq('attempt_count', attempt)
        .select('id')
        .maybeSingle<{ id: string }>()
      if (completeError) throw new Error(completeError.message)
      if (!completedJob) throw new Error('Submission reconciliation completion lost its processing claim.')
      completed += 1
    } catch (jobError) {
      const message = jobError instanceof Error ? jobError.message : String(jobError)
      const exhausted = attempt >= job.max_attempts
      const delayMinutes = Math.min(12 * 60, Math.max(5, 2 ** Math.min(attempt, 8)))
      const { error: retryError } = await supabase
        .from('website_submission_reconciliation_jobs')
        .update({
          status: exhausted ? 'manual_review' : 'retryable_failure',
          last_error: message.slice(0, 2000),
          next_attempt_at: exhausted
            ? null
            : new Date(Date.now() + delayMinutes * 60_000).toISOString(),
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('status', 'processing')
        .eq('attempt_count', attempt)
      if (retryError) console.error('[submission reconciliation] failed to persist retry state', retryError)
      failed += 1
    }
  }
  return { processed: (data ?? []).length, completed, failed }
}
