import { customerPoaArchiveListResponse } from '@/lib/customerPortal/poaArchiveRoute'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: Request) { return customerPoaArchiveListResponse(request) }
