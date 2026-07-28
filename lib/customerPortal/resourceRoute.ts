import { NextResponse } from 'next/server'
import { getCanonicalCustomerResource } from '@/lib/customerPortal/service'
import { customerApiErrorResponse } from '@/lib/customerPortal/apiErrors'
import type { OpsCustomerReadResource } from '@/lib/ops/client'

const FALLBACK_MESSAGES: Readonly<Record<OpsCustomerReadResource, string>> = {
  me: 'Kundprofilen kunde inte hämtas just nu.',
  contracts: 'Avtalen kunde inte hämtas just nu.',
  sites: 'Anläggningarna kunde inte hämtas just nu.',
  invoices: 'Fakturorna kunde inte hämtas just nu.',
  documents: 'Dokumenten kunde inte hämtas just nu.',
  'legal-acceptances': 'Godkännandena kunde inte hämtas just nu.',
  'powers-of-attorney': 'Fullmakterna kunde inte hämtas just nu.',
  'switch-status': 'Bytesstatusen kunde inte hämtas just nu.',
  events: 'Händelserna kunde inte hämtas just nu.',
  'metering-values': 'Mätvärdena kunde inte hämtas just nu.',
  notifications: 'Notiserna kunde inte hämtas just nu.',
}

export async function customerResourceResponse(
  resource: OpsCustomerReadResource,
  opaqueId?: string | null,
) {
  try {
    const response = await getCanonicalCustomerResource(resource, opaqueId)
    return NextResponse.json(response)
  } catch (error) {
    return customerApiErrorResponse(error, {
      logLabel: opaqueId ? `${resource} detail` : resource,
      fallbackMessage: FALLBACK_MESSAGES[resource],
    })
  }
}
