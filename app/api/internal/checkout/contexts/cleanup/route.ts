import { verifyCronBearer } from '@/lib/integrations/auth'
import { privateJsonResponse } from '@/lib/api/webBoundary'
import { cleanupExpiredWebsiteCheckoutContexts } from '@/lib/website/checkoutContextStore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!verifyCronBearer(request)) {
    return privateJsonResponse({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await cleanupExpiredWebsiteCheckoutContexts()
    return privateJsonResponse({ ok: true })
  } catch {
    console.error('[website checkout context] scheduled cleanup failed')
    return privateJsonResponse({ error: 'Checkout context cleanup failed.' }, { status: 503 })
  }
}
