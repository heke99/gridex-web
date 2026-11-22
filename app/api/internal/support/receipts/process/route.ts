import { privateJsonResponse } from '@/lib/api/webBoundary'
import { oldestWaitingSupportReceiptAge, processPublicSupportReceipts } from '@/lib/customerPortal/publicSupportReceipts'
import { verifyCronBearer } from '@/lib/integrations/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  if (!verifyCronBearer(request)) {
    return privateJsonResponse({ error: 'Unauthorized' }, { status: 401 })
  }
  // Four sequential provider calls leave room for database I/O. Unclaimed
  // receipts stay queued for the next scheduled run.
  try {
    const results = await processPublicSupportReceipts(4)
    const oldestWaitingAgeMs = await oldestWaitingSupportReceiptAge().catch(() => {
      console.error('[public support receipts] queue age unavailable')
      return null
    })
    console.info('[public support receipts] processed batch', { ...results, oldestWaitingAgeMs })
    return privateJsonResponse({ ok: true, ...results, oldestWaitingAgeMs })
  } catch {
    return privateJsonResponse({ error: 'Bekräftelsekön kunde inte behandlas.' }, { status: 503 })
  }
}

export async function GET(request: Request) { return POST(request) }
