import { verifyScheduledJobRequest } from '@/lib/integrations/auth'
import { NextResponse } from 'next/server'
import { processPortalOnboardingJobs } from '@/lib/customerPortal/onboarding'
import { processAuthProfileSyncJobs } from '@/lib/customerPortal/authProfileSync'
import { processWebsiteSubmissionReconciliationJobs } from '@/lib/website/submissionStore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BRANCH_BUDGET_MS = 45_000

export async function POST(request: Request) {
  if (!verifyScheduledJobRequest(request, process.env.CUSTOMER_PORTAL_ONBOARDING_CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobs = {
    onboarding: processPortalOnboardingJobs,
    profiles: processAuthProfileSyncJobs,
    submissions: processWebsiteSubmissionReconciliationJobs,
  }
  const entries = Object.entries(jobs).map(([name, processJobs]) => ({
    name, processJobs, signal: AbortSignal.timeout(BRANCH_BUDGET_MS),
  }))
  const results = await Promise.allSettled(
    entries.map(async ({ processJobs, signal }) => processJobs(undefined, signal)),
  )
  const outcomes = Object.fromEntries(results.map((result, index) => {
    const { name, signal } = entries[index]
    if (result.status === 'fulfilled') return [name, result.value]
    const timedOut = signal.aborted && result.reason === signal.reason
    console.error('[customer portal onboarding] cron branch failed', { branch: name, timedOut })
    return [name, { error: timedOut ? 'branch_timeout' : 'branch_failed' }]
  }))
  const ok = results.every(result => result.status === 'fulfilled')
  return NextResponse.json({ ok, ...outcomes }, {
    status: ok ? 200 : 500,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function GET(request: Request) {
  return POST(request)
}
