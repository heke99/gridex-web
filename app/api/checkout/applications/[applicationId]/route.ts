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
  const applicationNumber = applicationId.trim()
  const resultToken = new URL(request.url).searchParams.get('result_token')?.trim() ?? ''
  if (!applicationNumber || !/^[A-Za-z0-9_-]{3,200}$/.test(applicationNumber)) {
    return NextResponse.json({ error: { code: 'application_number_required' } }, { status: 400 })
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
  if (!stored?.applicationNumber || stored.applicationNumber !== applicationNumber) {
    return NextResponse.json({ error: { code: 'application_not_found' } }, { status: 404 })
  }

  try {
    const data = await fetchOpsWebsiteApplicationStatus(applicationNumber)
    await syncWebsiteSubmissionStatus({
      opsApplicationNumber: data.application_number,
      opsStatus: data.status,
      opsWorkflowState: data.stage,
      opsCustomerNumber: data.customer_number,
      contractStatus: data.contract_status,
      supplierSwitchStatus: data.supplier_switch_status,
      snapshot: data.raw,
    }).catch((syncError) => {
      console.error('website_application_status_audit_sync_failed', {
        applicationNumber,
        message: syncError instanceof Error ? syncError.message : 'unknown_error',
      })
    })
    const { raw, ...publicData } = data
    void raw
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
