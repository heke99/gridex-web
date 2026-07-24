import { randomUUID } from 'node:crypto'
import { probeOpsEndpointAuthorization } from '@/lib/ops/client'

export const DEFAULT_CUSTOMER_PORTAL_SCOPES = [
  'customer_portal.read',
  'customer_sync.write',
  'customer_profile.read',
  'customer_contracts.read',
  'customer_sites.read',
  'customer_invoices.read',
  'customer_metering.read',
  'customer_events.read',
  'customer_documents.read',
  'customer_legal.read',
  'customer_power_of_attorney.read',
  'customer_power_of_attorney.write',
  'customer_notifications.read',
  'customer_notifications.write',
  'customer_contact.write',
  'customer_facility_data.write',
] as const

export type PortalReadiness = {
  ready: boolean
  message: string
  scopes: Array<{ scope: string; status: 'declared' | 'missing' | 'unverified' }>
  portalBundleProbe: { ok: boolean; status: number | null; code: string | null }
}

function scopeSet(name: string): Set<string> | null {
  const raw = process.env[name]?.trim()
  return raw ? new Set(raw.split(/[\s,]+/).map((item: string) => item.trim()).filter(Boolean)) : null
}

function requiredScopes(): string[] {
  const configured = scopeSet('GRIDEX_CUSTOMER_PORTAL_REQUIRED_SCOPES')
  return configured?.size ? [...configured] : [...DEFAULT_CUSTOMER_PORTAL_SCOPES]
}

/** Separate from website checkout readiness so a green checkout cannot hide portal 403s. */
export async function checkOpsCustomerPortalReadiness(): Promise<PortalReadiness> {
  const required = requiredScopes()
  const declared = scopeSet('GRIDEX_CUSTOMER_PORTAL_API_SCOPES') ?? scopeSet('GRIDEX_WEBSITE_API_SCOPES')
  const scopes = required.map((scope) => ({
    scope,
    status: declared ? (declared.has(scope) ? 'declared' as const : 'missing' as const) : 'unverified' as const,
  }))
  let portalBundleProbe: PortalReadiness['portalBundleProbe']
  try {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Idempotency-Key': `portal-readiness-${randomUUID()}`,
      'X-Gridex-External-Customer-Id': 'readiness-no-customer',
      'X-Gridex-Customer-Portal-User-Id': '00000000-0000-4000-8000-000000000000',
      'X-Gridex-Auth-User-Id': '00000000-0000-4000-8000-000000000000',
    })
    const result = await probeOpsEndpointAuthorization('/api/v1/customer/portal-bundle', {
      method: 'POST',
      headers,
      body: JSON.stringify({ external_customer_id: 'readiness-no-customer' }),
    })
    portalBundleProbe = { ok: result.ok, status: result.status, code: result.code }
  } catch (error) {
    portalBundleProbe = {
      ok: false,
      status: typeof error === 'object' && error && 'status' in error ? Number((error as { status: unknown }).status) : null,
      code: 'portal_bundle_probe_failed',
    }
  }
  const declarationsReady = scopes.every((item) => item.status !== 'missing')
  const ready = declarationsReady && portalBundleProbe.ok
  return {
    ready,
    message: ready
      ? 'Mina sidor-scopepaketet och portal-bundle-endpointen är verifierade.'
      : 'Mina sidor har en separat scope- eller endpointblockerare.',
    scopes,
    portalBundleProbe,
  }
}
