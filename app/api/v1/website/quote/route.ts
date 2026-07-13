import { POST as pricingPreviewPost } from '@/app/api/v1/website/pricing/preview/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Public website facade. The shared handler resolves the selected public
// contract and obtains the authoritative price from OPS /website/quote.
export async function POST(request: Request) {
  return pricingPreviewPost(request)
}
