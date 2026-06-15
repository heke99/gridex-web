import { GET as getContracts } from '@/app/api/v1/website/contracts/route'

export const revalidate = 60
export const runtime = 'nodejs'

export async function GET() {
  return getContracts()
}
