import { NextResponse } from 'next/server'
import { processPortalOnboardingJobs } from '@/lib/customerPortal/onboarding'
import { processAuthProfileSyncJobs } from '@/lib/customerPortal/authProfileSync'
import { processWebsiteSubmissionReconciliationJobs } from '@/lib/website/submissionStore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function authorized(request: Request): boolean {
  const secret =
    process.env.CUSTOMER_PORTAL_ONBOARDING_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim()
  if (!secret) return false
  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.headers.get('x-cron-secret') === secret
  )
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [onboarding, profiles, submissions] = await Promise.all([
      processPortalOnboardingJobs(),
      processAuthProfileSyncJobs(),
      processWebsiteSubmissionReconciliationJobs(),
    ])
    return NextResponse.json({ ok: true, onboarding, profiles, submissions })
  } catch (error) {
    console.error('[customer portal onboarding] cron failed', error)
    return NextResponse.json({ error: 'Portal onboarding processing failed.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
