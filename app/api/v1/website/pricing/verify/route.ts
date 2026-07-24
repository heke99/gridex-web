import { POST as handlePost } from '@/app/api/v1/website/pricing/quote/validate/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  return handlePost(request)
}
