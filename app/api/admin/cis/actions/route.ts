import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin/getAdminContext'
import { canAccessByRule, cisOperationRule } from '@/lib/admin/access'
import { requireGlobalAdminActionAccess } from '@/lib/admin/guards'
import {
  runCisActionOperation,
  type CisActionOperation,
} from '@/lib/integrations/cisActions'
import { supabaseService } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ApiError = Error & { status?: number }

function isOperation(value: unknown): value is CisActionOperation {
  return value === 'retry' || value === 'cancel' || value === 'resend_signature'
}

export async function POST(req: Request) {
  try {
    const ctx = await getAdminContext()
    if (!ctx.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const actionId = String(body.actionId ?? '').trim()

    if (!actionId || !isOperation(body.operation)) {
      return NextResponse.json(
        { error: 'Missing actionId or invalid operation.' },
        { status: 400 }
      )
    }
    if (!canAccessByRule(ctx, cisOperationRule(body.operation))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await requireGlobalAdminActionAccess(cisOperationRule(body.operation))

    const result = await runCisActionOperation(supabaseService, {
      actionId,
      operation: body.operation,
      actorId: ctx.userId,
    })

    return NextResponse.json(result)
  } catch (err) {
    const error = err as ApiError
    return NextResponse.json(
      { error: error.message ?? 'CIS operation failed.' },
      { status: error.status ?? 500 }
    )
  }
}
