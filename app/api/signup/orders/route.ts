//api/signup/orders/route.ts
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createSignupOrder } from '@/lib/customerSignup/service'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isPriceArea } from '@/lib/gridex/postalAreas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ApiError = Error & { status?: number }

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const result = await createSignupOrder({
      userId: user.id,
      agreementId: body.agreementId ? String(body.agreementId) : null,
      email: String(body.email ?? user.email ?? '').trim().toLowerCase(),
      phone: String(body.phone ?? '').trim(),
      firstName: String(body.firstName ?? '').trim(),
      lastName: String(body.lastName ?? '').trim(),
      personalNumber: String(body.personalNumber ?? '').trim(),
      address: String(body.address ?? '').trim(),
      postalCode: String(body.postalCode ?? '').trim(),
      city: String(body.city ?? '').trim(),
      apartment: body.apartment ? String(body.apartment).trim() : null,
      facilityId: String(body.facilityId ?? '').trim(),
      moveInDate: body.moveInDate ? String(body.moveInDate).trim() : null,
      contractSlug: String(body.contractSlug ?? '').trim(),
      monthlyConsumptionKwh: Number(body.monthlyConsumptionKwh ?? 2000),
      manualPriceArea: isPriceArea(body.manualPriceArea)
        ? body.manualPriceArea
        : null,
      legalSnapshot:
        body.legalSnapshot && typeof body.legalSnapshot === 'object'
          ? body.legalSnapshot
          : {},
      idempotencyKey: String(body.idempotencyKey ?? randomUUID()),
      signingProvider:
        body.signingProvider === 'email' ? 'email' : 'cis',
    })

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    const error = err as ApiError
    return NextResponse.json(
      { error: error.message ?? 'Kunde inte skapa beställning.' },
      { status: error.status ?? 500 }
    )
  }
}
