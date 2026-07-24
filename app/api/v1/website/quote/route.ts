import { POST as handlePost } from '@/app/api/v1/website/pricing/preview/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  return handlePost(request)
}
