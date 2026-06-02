import { NextResponse } from 'next/server'
import { verifyIntegrationRequest } from '@/lib/integrations/auth'
import { supabaseService } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ApiError = Error & { status?: number }

function mapCisStatus(input: string) {
  switch (input) {
    case 'signature_email_sent':
      return 'signature_email_sent'
    case 'waiting_for_signature':
      return 'waiting_for_signature'
    case 'signed':
      return 'signed'
    case 'activation_pending':
      return 'activation_pending'
    case 'active':
      return 'active'
    case 'rejected':
    case 'rejected_by_cis':
      return 'rejected_by_cis'
    case 'failed':
      return 'failed'
    default:
      return 'waiting_for_cis'
  }
}

export async function POST(req: Request) {
  const auth = verifyIntegrationRequest(req)

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status }
    )
  }

  try {
    const body = await req.json()
    const signupOrderId = String(body.signupOrderId ?? '').trim()
    const cisStatus = String(body.status ?? '').trim()

    if (!signupOrderId || !cisStatus) {
      return NextResponse.json(
        { error: 'Missing signupOrderId or status.' },
        { status: 400 }
      )
    }

    const mappedStatus = mapCisStatus(cisStatus)
    const { error } = await supabaseService.rpc(
      'gridex_apply_signup_order_status',
      {
        p_signup_order_id: signupOrderId,
        p_status: mappedStatus,
        p_cis_status: cisStatus,
        p_cis_customer_ref: body.cisCustomerRef
          ? String(body.cisCustomerRef)
          : null,
        p_cis_contract_ref: body.cisContractRef
          ? String(body.cisContractRef)
          : null,
        p_event_type: `cis_${cisStatus}`,
        p_summary: body.summary ? String(body.summary) : null,
        p_payload: body && typeof body === 'object' ? body : {},
        p_customer_visible: true,
      }
    )

    if (error) {
      throw Object.assign(new Error(error.message), { status: 500 })
    }

    return NextResponse.json({ ok: true, status: mappedStatus })
  } catch (err) {
    const error = err as ApiError
    return NextResponse.json(
      { error: error.message ?? 'CIS status webhook failed.' },
      { status: error.status ?? 500 }
    )
  }
}
