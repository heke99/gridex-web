import { NextRequest, NextResponse } from 'next/server'
import { requireAdminActionAccess } from '@/lib/admin/guards'
import { AccessDeniedError } from '@/lib/admin/access'
import { supabaseService } from '@/lib/supabase/service'

type Context = {
  params: Promise<{ id: string }>
}

export async function GET(
  _request: NextRequest,
  context: Context
) {
  try {
    await requireAdminActionAccess({ allOf: ['agreements.read'] })
  } catch (error) {
    return NextResponse.json({ error: 'Behörighet saknas.' }, {
      status: error instanceof AccessDeniedError ? error.status : 503,
    })
  }

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
      'Cache-Control': 'private, no-store',
    },
  })
}
