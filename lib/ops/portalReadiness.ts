import { randomUUID } from 'node:crypto'
import { getOpsClientStatus, isOpsError, probeOpsEndpointAuthorization } from '@/lib/ops/client'

export const DEFAULT_CUSTOMER_PORTAL_SCOPES = [
  'customer_portal.read',
  'customer_sync.write',
  'customer_notifications.write',
  'customer_contact.write',
  'customer_facility_data.write',
] as const

type PortalScopeStatus = 'verified' | 'alternative_verified' | 'missing' | 'unverified'
type PortalProbe = {
  name: string
  scopes: readonly string[]
  alternative?: boolean
  path: string
  method: 'GET' | 'POST'
  body?: Record<string, unknown>
}

export type PortalReadiness = {
  ready: boolean
  message: string
  scopes: Array<{ scope: string; status: PortalScopeStatus }>
  probes: Array<{ name: string; ok: boolean; status: number | null; code: string | null }>
  portalBundleProbe: { ok: boolean; status: number | null; code: string | null }
}

const READINESS_USER_ID = '00000000-0000-4000-8000-000000000000'
const READINESS_EXTERNAL_ID = 'readiness-no-customer'

function probeDefinitions(): PortalProbe[] {
  return [
    {
      name: 'customer_portal.read',
      scopes: ['customer_portal.read'],
      path: '/api/v1/customer/portal-bundle',
      method: 'POST',
      body: { external_customer_id: READINESS_EXTERNAL_ID },
    },
    {
      name: 'customer_sync.write',
      scopes: ['customer_sync.write'],
      path: '/api/v1/customer-portal/sync',
      method: 'POST',
      body: { external_customer_id: READINESS_EXTERNAL_ID },
    },
    {
      name: 'customer_notifications.write',
      scopes: ['customer_notifications.write'],
      path: '/api/v1/customer/notifications/read',
      method: 'POST',
      body: { notification_ids: [] },
    },
    {
      name: 'customer_profile_update.write_any_of',
      scopes: ['customer_contact.write', 'customer_facility_data.write'],
      alternative: true,
      path: '/api/v1/customer/profile-update',
      method: 'POST',
      body: {},
    },
    {
      name: 'customer_facility_data.write',
      scopes: ['customer_facility_data.write'],
      path: '/api/v1/customer/move-out',
      method: 'POST',
      body: {},
    },
  ]
}

async function runProbe(definition: PortalProbe) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Idempotency-Key': `portal-readiness-${randomUUID()}`,
    'X-Gridex-External-Customer-Id': READINESS_EXTERNAL_ID,
    'X-Gridex-Customer-Portal-User-Id': READINESS_USER_ID,
    'X-Gridex-Auth-User-Id': READINESS_USER_ID,
  })
  return probeOpsEndpointAuthorization(definition.path, {
    method: definition.method,
    headers,
    ...(definition.body ? { body: JSON.stringify(definition.body) } : {}),
  })
}

/** Separate from website checkout readiness so a green checkout cannot hide portal 401/403 responses. */
export async function checkOpsCustomerPortalReadiness(): Promise<PortalReadiness> {
  const definitions = probeDefinitions()
  const allScopes = [...new Set(definitions.flatMap((definition) => [...definition.scopes]))]
  const statuses = new Map<string, PortalScopeStatus>(allScopes.map((scope) => [scope, 'unverified']))
  const probes: PortalReadiness['probes'] = []

  if (!getOpsClientStatus().configured) {
    return {
      ready: false,
      message: 'Mina sidor kan inte verifieras innan GRIDEX_API_KEY är konfigurerad.',
      scopes: allScopes.map((scope) => ({ scope, status: 'unverified' })),
      probes,
      portalBundleProbe: { ok: false, status: null, code: 'ops_not_configured' },
    }
  }

  const results = await Promise.allSettled(definitions.map(runProbe))
  results.forEach((settled, index) => {
    const definition = definitions[index]
    if (settled.status === 'fulfilled') {
      const result = settled.value
      probes.push({ name: definition.name, ok: result.ok, status: result.status, code: result.code })
      for (const scope of definition.scopes) {
        statuses.set(scope, result.ok ? (definition.alternative ? 'alternative_verified' : 'verified') : 'missing')
      }
      return
    }

    const status = isOpsError(settled.reason) ? settled.reason.status : null
    probes.push({ name: definition.name, ok: false, status, code: 'portal_probe_failed' })
    for (const scope of definition.scopes) statuses.set(scope, status === 403 ? 'missing' : 'unverified')
  })

  const portalBundle = probes.find((probe) => probe.name === 'customer_portal.read') ?? {
    ok: false,
    status: null,
    code: 'portal_bundle_probe_missing',
  }
  const ready = probes.length === definitions.length && probes.every((probe) => probe.ok)
  return {
    ready,
    message: ready
      ? 'Mina sidor-endpoints och behörigheter har verifierats direkt mot API:t.'
      : 'Mina sidor har minst en endpoint- eller behörighetsblockerare.',
    scopes: allScopes.map((scope) => ({ scope, status: statuses.get(scope) ?? 'unverified' })),
    probes,
    portalBundleProbe: { ok: portalBundle.ok, status: portalBundle.status, code: portalBundle.code },
  }
}
