import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export type WebsiteCommunicationItem = {
  event_type?: string
  code?: string
  status?: string
  message?: string
  occurred_at?: string
}

export type WebsiteApplicationPublicResult = {
  applicationId: string | null
  workflowId: string | null
  workflowState: string | null
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

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createWebsiteApplicationResult(input: {
  submissionAttemptId: string
  userId: string | null
  result: WebsiteApplicationPublicResult
}): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60_000).toISOString()
  const { error } = await serviceClient().from('website_application_results').insert({
    token_hash: tokenHash(token),
    submission_attempt_id: input.submissionAttemptId,
    user_id: input.userId,
    public_result: input.result,
    expires_at: expiresAt,
  })
  if (error) throw new Error(`Website result storage failed: ${error.message}`)
  return token
}

export async function readWebsiteApplicationResult(token: string | null | undefined): Promise<WebsiteApplicationPublicResult | null> {
  const normalized = token?.trim() ?? ''
  if (!/^[A-Za-z0-9_-]{32,160}$/.test(normalized)) return null
  const { data, error } = await serviceClient()
    .from('website_application_results')
    .select('public_result,expires_at')
    .eq('token_hash', tokenHash(normalized))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle<StoredResultRow>()
  if (error) throw new Error(`Website result read failed: ${error.message}`)
  return data?.public_result ?? null
}
