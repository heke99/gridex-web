import { NextRequest, NextResponse } from 'next/server'
import { requireAdminServer } from '@/lib/auth/requireAdminServer'
import { supabaseService } from '@/lib/supabase/service'

type Context = {
  params: Promise<{ id: string }>
}

export async function GET(
  _request: NextRequest,
  context: Context
) {
  await requireAdminServer()

  const { id } = await context.params

  const bucket = process.env.CONTRACTS_BUCKET || 'contract-docs'

  const { data, error } = await supabaseService.storage
    .from(bucket)
    .download(`${id}.pdf`)

  if (error || !data) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    )
  }

  return new NextResponse(data, {
    headers: {
      'Content-Type': 'application/pdf',
    },
  })
}