import { NextResponse } from 'next/server'
import { fetchOpsWebsiteApplicationStatus, isOpsError } from '@/lib/ops/client'
import { readWebsiteApplicationResult } from '@/lib/website/applicationResultStore'
import { syncWebsiteSubmissionStatus } from '@/lib/website/submissionStore'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const { applicationId } = await context.params
  const normalizedId = applicationId.trim()
  const resultToken = new URL(request.url).searchParams.get('result_token')?.trim() ?? ''
  if (!normalizedId || !/^[A-Za-z0-9_-]{8,200}$/.test(normalizedId)) {
    return NextResponse.json({ error: { code: 'application_id_required' } }, { status: 400 })
  }
  if (!/^[A-Za-z0-9_-]{32,160}$/.test(resultToken)) {
    return NextResponse.json({ error: { code: 'result_token_required' } }, { status: 400 })
  }

  const rate = await checkRateLimit(
    `website-application-status:${clientIpFromHeaders(new Headers(request.headers))}`,
    { limit: 40, windowMs: 10 * 60_000 },
  )
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited' } },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1_000))) } },
    )
  }

  const stored = await readWebsiteApplicationResult(resultToken).catch(() => null)
  if (!stored?.applicationId || stored.applicationId !== normalizedId) {
    return NextResponse.json({ error: { code: 'application_not_found' } }, { status: 404 })
  }

  try {
    const data = await fetchOpsWebsiteApplicationStatus(normalizedId)
    await syncWebsiteSubmissionStatus({
      opsApplicationId: data.application_id,
      opsStatus: data.status,
      opsWorkflowState: data.stage,
      opsCustomerNumber: data.customer_number,
      contractStatus: data.contract_status,
      supplierSwitchStatus: data.supplier_switch_status,
      snapshot: data.raw,
    }).catch((syncError) => {
      console.error('website_application_status_audit_sync_failed', {
        applicationId: normalizedId,
        message: syncError instanceof Error ? syncError.message : 'unknown_error',
      })
    })
    const { raw: _raw, ...publicData } = data
    return NextResponse.json({ data: publicData }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (isOpsError(error) && error.status === 404) {
      return NextResponse.json({ error: { code: 'application_not_found' } }, { status: 404 })
    }
    return NextResponse.json(
      { error: { code: isOpsError(error) ? error.code ?? 'application_status_unavailable' : 'application_status_unavailable' } },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
}
