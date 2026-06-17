import { NextResponse } from 'next/server'
import { sendOpsCustomerEvent } from '@/lib/ops/client'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const overview = await getCustomerPortalOverview()
    const profile = overview.profile

    if (!profile?.user_id) {
      return NextResponse.json({ error: 'Kunden är inte inloggad.' }, { status: 401 })
    }

    await sendOpsCustomerEvent(
      {
        userId: profile.user_id,
        email: profile.email,
        customerNumber: profile.customer_number ?? profile.contract_customer_ref ?? null,
        externalCustomerId:
          profile.external_customer_id && profile.external_customer_id !== profile.customer_number
            ? profile.external_customer_id
            : null,
      },
      {
        event_type: String(body.event_type ?? body.type ?? 'customer.portal_event'),
        source: 'gridex_website',
        entity_type: typeof body.entity_type === 'string' ? body.entity_type : null,
        entity_id: typeof body.entity_id === 'string' ? body.entity_id : null,
        metadata:
          body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
            ? body.metadata
            : {},
      },
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[customer portal] event route failed', error)
    return NextResponse.json(
      { error: 'Händelsen kunde inte skickas just nu.' },
      { status: 500 },
    )
  }
}
