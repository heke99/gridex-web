import { handlePublicationChangedWebhook } from '@/lib/webhooks/publicationChanged'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  return handlePublicationChangedWebhook(request)
}
