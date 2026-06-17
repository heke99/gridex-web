import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { submitOpsCustomerSync } from '@/lib/ops/client'
import { getOpsPortalIdentityForUser } from '@/lib/customerPortal/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(object(item)))
    : []
}

function text(value: unknown, max = 240): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = object(await req.json().catch(() => null)) ?? {}

  try {
    const identity = await getOpsPortalIdentityForUser(supabase, user)
    const result = await submitOpsCustomerSync({
      identity,
      idempotencyKey: text(body.idempotency_key ?? body.idempotencyKey),
      powerOfAttorney: object(body.power_of_attorney ?? body.powerOfAttorney),
      legalAcceptances: objectArray(body.legal_acceptances ?? body.legalAcceptances),
      documents: objectArray(body.documents),
      facilityData: object(body.facility_data ?? body.facilityData),
      profile: object(body.profile),
      metadata: object(body.metadata),
    })

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[customer portal] OPS customer sync failed', error)
    return NextResponse.json(
      { error: 'Kunduppgifterna kunde inte synkas just nu.' },
      { status: 502 },
    )
  }
}
