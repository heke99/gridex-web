import { randomUUID } from 'node:crypto'
import {
  fetchOpsPublicContractsFresh,
  fetchOpsTenantEvents,
  fetchOpsWebsiteLegalBundle,
  getOpsClientStatus,
  isOpsError,
  probeOpsEndpointAuthorization,
} from '@/lib/ops/client'

export const REQUIRED_WEBSITE_SCOPES = [
  'website_contracts.read',
  'website_legal.read',
  'website_applications.write',
  'website_events.write',
  'events.read',
  'customer_portal.read',
  'customer_portal.write',
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

type RequiredScope = (typeof REQUIRED_WEBSITE_SCOPES)[number]
type ScopeStatus = 'verified' | 'verified_not_declared' | 'declared' | 'missing' | 'unverified'

export type OpsReadinessCode =
  | 'ready'
  | 'not_configured'
  | 'invalid_api_key'
  | 'missing_scope'
  | 'invalid_base_url_or_environment'
  | 'webhook_not_configured'
  | 'ops_unavailable'

export type OpsIntegrationReadiness = {
  ready: boolean
  code: OpsReadinessCode
  message: string
  checkedAt: string
  probes: Array<{ name: string; ok: boolean; status: number | null; code: string | null }>
  scopes: Array<{ scope: RequiredScope; status: ScopeStatus }>
  webhook: {
    ready: boolean
    enabled: boolean
    signingSecretConfigured: boolean
    expectedCompanyConfigured: boolean
    secretConflict: boolean
  }
}

type ProbeDefinition = {
  name: string
  scopes: RequiredScope[]
  run: () => Promise<{ ok: boolean; status: number; code: string | null } | void>
}

function declaredScopes(): Set<string> | null {
  const raw = process.env.GRIDEX_WEBSITE_API_SCOPES?.trim()
  if (!raw) return null
  return new Set(raw.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))
}

function errorCode(error: unknown): string | null {
  if (!isOpsError(error) || !error.details || typeof error.details !== 'object') return null
  const row = error.details as Record<string, unknown>
  const nested = row.error && typeof row.error === 'object' ? row.error as Record<string, unknown> : null
  const value = nested?.code ?? row.code
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function classifyProbeFailure(error: unknown): OpsReadinessCode {
  if (!isOpsError(error)) return 'ops_unavailable'
  if (error.status === 401) return 'invalid_api_key'
  if (error.status === 403) return 'missing_scope'
  if (error.status === 404 || error.status === 405) return 'invalid_base_url_or_environment'
  return 'ops_unavailable'
}

function message(code: OpsReadinessCode): string {
  switch (code) {
    case 'ready': return 'OPS-anslutningen svarar och endpoint-behörigheterna har verifierats.'
    case 'not_configured': return 'OPS URL, API-nyckel eller obligatorisk konfiguration saknas eller stoppas av produktionsskyddet.'
    case 'invalid_api_key': return 'OPS avvisade API-nyckeln.'
    case 'missing_scope': return 'API-nyckeln eller scope-konfigurationen saknar minst en obligatorisk behörighet.'
    case 'invalid_base_url_or_environment': return 'OPS URL pekar på fel miljö eller saknar en dokumenterad endpoint.'
    case 'webhook_not_configured': return 'OPS API svarar, men webhooks är inte komplett konfigurerade. Mina sidor-status får inte betraktas som live.'
    default: return 'OPS kunde inte nås eller svarade med ett tillfälligt serverfel.'
  }
}

function readinessIdentityHeaders(): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'x-gridex-customer-portal-user-id': '00000000-0000-4000-8000-000000000001',
    'x-gridex-auth-user-id': '00000000-0000-4000-8000-000000000001',
    'x-gridex-external-customer-id': 'GRIDEX-READINESS-PROBE-NO-CUSTOMER',
    'x-gridex-customer-email': 'readiness-probe@invalid.example',
  })
  headers.set('Idempotency-Key', `readiness-${randomUUID()}`)
  return headers
}

function authorizationProbe(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>) {
  const headers = readinessIdentityHeaders()
  return probeOpsEndpointAuthorization(path, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

function probeDefinitions(): ProbeDefinition[] {
  return [
    {
      name: 'website_contracts.read',
      scopes: ['website_contracts.read'],
      run: async () => { await fetchOpsPublicContractsFresh() },
    },
    {
      name: 'website_legal.read',
      scopes: ['website_legal.read'],
      run: async () => { await fetchOpsWebsiteLegalBundle() },
    },
    {
      name: 'website_applications.write',
      scopes: ['website_applications.write'],
      run: () => authorizationProbe('/api/v1/website/customer-applications', 'POST', {}),
    },
    {
      name: 'website_events.write',
      scopes: ['website_events.write'],
      run: () => authorizationProbe('/api/v1/website/customer-events', 'POST', {}),
    },
    {
      name: 'events.read',
      scopes: ['events.read'],
      run: async () => { await fetchOpsTenantEvents({ limit: '1' }) },
    },
    {
      name: 'customer_portal.read',
      scopes: ['customer_portal.read'],
      run: () => authorizationProbe('/api/v1/customer/portal-bundle', 'POST', {}),
    },
    {
      name: 'customer_portal.write',
      scopes: ['customer_portal.write'],
      run: () => authorizationProbe('/api/v1/customer-portal/sync', 'POST', {}),
    },
    {
      name: 'customer_sync.write',
      scopes: ['customer_sync.write'],
      run: () => authorizationProbe('/api/v1/customer/sync', 'POST', {}),
    },
    {
      name: 'customer_profile.read',
      scopes: ['customer_profile.read'],
      run: () => authorizationProbe('/api/v1/customer/me', 'GET'),
    },
    {
      name: 'customer_contracts.read',
      scopes: ['customer_contracts.read'],
      run: () => authorizationProbe('/api/v1/customer/contracts', 'GET'),
    },
    {
      name: 'customer_sites.read',
      scopes: ['customer_sites.read'],
      run: () => authorizationProbe('/api/v1/customer/sites', 'GET'),
    },
    {
      name: 'customer_invoices.read',
      scopes: ['customer_invoices.read'],
      run: () => authorizationProbe('/api/v1/customer/invoices', 'GET'),
    },
    {
      name: 'customer_metering.read',
      scopes: ['customer_metering.read'],
      run: () => authorizationProbe('/api/v1/customer/metering-values', 'GET'),
    },
    {
      name: 'customer_events.read',
      scopes: ['customer_events.read'],
      run: () => authorizationProbe('/api/v1/customer/events', 'GET'),
    },
    {
      name: 'customer_documents.read',
      scopes: ['customer_documents.read'],
      run: () => authorizationProbe('/api/v1/customer/documents', 'GET'),
    },
    {
      name: 'customer_legal.read',
      scopes: ['customer_legal.read'],
      run: () => authorizationProbe('/api/v1/customer/legal-acceptances', 'GET'),
    },
    {
      name: 'customer_power_of_attorney.read',
      scopes: ['customer_power_of_attorney.read'],
      run: () => authorizationProbe('/api/v1/customer/powers-of-attorney', 'GET'),
    },
    {
      name: 'customer_power_of_attorney.write',
      scopes: ['customer_power_of_attorney.write'],
      run: () => authorizationProbe('/api/v1/customer/sync', 'POST', {
        power_of_attorney: { status: '__readiness_probe_invalid__' },
      }),
    },
    {
      name: 'customer_notifications.read',
      scopes: ['customer_notifications.read'],
      run: () => authorizationProbe('/api/v1/customer/notifications', 'GET'),
    },
    {
      name: 'customer_notifications.write',
      scopes: ['customer_notifications.write'],
      run: () => authorizationProbe('/api/v1/customer/notifications/read', 'POST', {}),
    },
    {
      name: 'customer_contact.write',
      scopes: ['customer_contact.write'],
      run: () => authorizationProbe('/api/v1/customer/profile-update', 'POST', {}),
    },
    {
      name: 'customer_facility_data.write',
      scopes: ['customer_facility_data.write'],
      run: () => authorizationProbe('/api/v1/customer/move-out', 'POST', {}),
    },
  ]
}

export async function checkOpsIntegrationReadiness(): Promise<OpsIntegrationReadiness> {
  const checkedAt = new Date().toISOString()
  const client = getOpsClientStatus()
  const declared = declaredScopes()
  const canonicalWebhookSecret = process.env.GRIDEX_WEBHOOK_SIGNING_SECRET?.trim() ?? ''
  const legacyWebhookSecret = process.env.GRIDEX_OPS_WEBHOOK_SECRET?.trim() ?? ''
  const webhook = {
    enabled: process.env.GRIDEX_ENABLE_OPS_WEBHOOKS === 'true',
    signingSecretConfigured: Boolean(canonicalWebhookSecret || legacyWebhookSecret),
    expectedCompanyConfigured: Boolean(process.env.GRIDEX_EXPECTED_COMPANY_ID?.trim()),
    secretConflict: Boolean(
      canonicalWebhookSecret &&
        legacyWebhookSecret &&
        canonicalWebhookSecret !== legacyWebhookSecret,
    ),
    ready: false,
  }
  webhook.ready =
    webhook.enabled &&
    webhook.signingSecretConfigured &&
    webhook.expectedCompanyConfigured &&
    !webhook.secretConflict
  const declarationComplete = Boolean(
    declared && REQUIRED_WEBSITE_SCOPES.every((scope) => declared.has(scope)),
  )
  const scopeStatuses = new Map<RequiredScope, ScopeStatus>()
  for (const scope of REQUIRED_WEBSITE_SCOPES) {
    scopeStatuses.set(scope, declared ? (declared.has(scope) ? 'declared' : 'missing') : 'unverified')
  }

  const initialScopes = () => REQUIRED_WEBSITE_SCOPES.map((scope) => ({
    scope,
    status: scopeStatuses.get(scope) ?? 'unverified',
  }))

  if (!client.configured) {
    return { ready: false, code: 'not_configured', message: message('not_configured'), checkedAt, probes: [], scopes: initialScopes(), webhook }
  }

  const definitions = probeDefinitions()
  const probes: OpsIntegrationReadiness['probes'] = []
  let code: OpsReadinessCode = 'ready'
  const results = await Promise.allSettled(definitions.map(async (probe) => ({ probe, result: await probe.run() })))

  for (let index = 0; index < results.length; index += 1) {
    const definition = definitions[index]
    const settled = results[index]
    if (settled.status === 'fulfilled') {
      const result = settled.value.result
      const ok = result?.ok ?? true
      const status = result?.status ?? 200
      const resultCode = result?.code ?? null
      probes.push({ name: definition.name, ok, status, code: resultCode })
      for (const scope of definition.scopes) {
        scopeStatuses.set(
          scope,
          ok ? (declared?.has(scope) ? 'verified' : 'verified_not_declared') : 'missing',
        )
      }
      if (!ok) {
        code = status === 401 ? 'invalid_api_key' : 'missing_scope'
      }
      continue
    }

    const error = settled.reason
    const classified = classifyProbeFailure(error)
    if (code === 'ready' || classified !== 'ops_unavailable') code = classified
    probes.push({
      name: definition.name,
      ok: false,
      status: isOpsError(error) ? error.status : null,
      code: errorCode(error),
    })
  }

  const scopes = initialScopes()
  if (code === 'ready' && (!declarationComplete || scopes.some((scope) => scope.status === 'missing' || scope.status === 'unverified'))) {
    code = 'missing_scope'
  }
  if (code === 'ready' && !webhook.ready) code = 'webhook_not_configured'
  const ready = code === 'ready' && probes.every((probe) => probe.ok) && webhook.ready
  return { ready, code, message: message(code), checkedAt, probes, scopes, webhook }
}
