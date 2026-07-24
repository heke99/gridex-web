import { randomUUID } from 'node:crypto'
import {
  fetchOpsIntegrationContext,
  fetchOpsPublicContractDiagnostics,
  fetchOpsPublicContractsFresh,
  getOpsClientStatus,
  isOpsError,
  probeOpsEndpointAuthorization,
} from '@/lib/ops/client'
import {
  GRIDEX_WEBSITE_CHECKOUT_SCOPES,
  GRIDEX_WEBSITE_LEGAL_SCOPE_ALTERNATIVES,
} from '@/lib/ops/contract'

export const REQUIRED_WEBSITE_SCOPES = GRIDEX_WEBSITE_CHECKOUT_SCOPES
export const ALTERNATIVE_WEBSITE_SCOPE_GROUPS = [GRIDEX_WEBSITE_LEGAL_SCOPE_ALTERNATIVES] as const

type ScopeStatus = 'verified' | 'alternative_verified' | 'missing' | 'unverified'
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
  scopes: Array<{ scope: string; status: ScopeStatus }>
  webhook: {
    ready: boolean
    enabled: boolean
    signingSecretConfigured: boolean
    secretConflict: boolean
  }
}

type ProbeDefinition = {
  name: string
  scopes: readonly string[]
  alternative?: boolean
  run: () => Promise<{ ok: boolean; status: number; code: string | null } | void>
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

function readinessMessage(code: OpsReadinessCode): string {
  switch (code) {
    case 'ready': return 'OPS checkout-flöde, juridik och endpoint-behörigheter har verifierats direkt mot API:t.'
    case 'not_configured': return 'OPS API-nyckel eller en lokal serverhemlighet saknas, eller så stoppas anslutningen av produktionsskyddet.'
    case 'invalid_api_key': return 'OPS avvisade API-nyckeln.'
    case 'missing_scope': return 'API-nyckeln saknar minst en behörighet som det aktiva checkoutflödet använder.'
    case 'invalid_base_url_or_environment': return 'OPS URL pekar på fel miljö eller saknar en dokumenterad endpoint.'
    case 'webhook_not_configured': return 'OPS API svarar, men aktiverade webhooks saknar en giltig signing secret.'
    default: return 'OPS kunde inte nås eller svarade med ett tillfälligt serverfel.'
  }
}

function authorizationProbe(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  headers.set('Idempotency-Key', `readiness-${randomUUID()}`)
  return probeOpsEndpointAuthorization(path, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

function probeDefinitions(): ProbeDefinition[] {
  return [
    { name: 'integration_context', scopes: ['integration_context.read'], run: async () => { await fetchOpsIntegrationContext(true) } },
    { name: 'website_contracts.read', scopes: ['website_contracts.read'], run: async () => { await fetchOpsPublicContractsFresh() } },
    { name: 'website_contracts.diagnostics', scopes: ['website_contracts.diagnostics'], run: async () => { await fetchOpsPublicContractDiagnostics() } },
    { name: 'website_energy_area.resolve', scopes: ['website_energy_area.resolve'], run: () => authorizationProbe('/api/v1/website/energy-area/resolve', 'POST', {}) },
    { name: 'website_quotes.write', scopes: ['website_quotes.write'], run: () => authorizationProbe('/api/v1/website/quote', 'POST', {}) },
    { name: 'website_quotes.validate', scopes: ['website_quotes.validate'], run: () => authorizationProbe('/api/v1/website/quote/validate', 'POST', {}) },
    { name: 'website_applications.write', scopes: ['website_applications.write'], run: () => authorizationProbe('/api/v1/website/customer-applications', 'POST', {}) },
    { name: 'website_switch_status.read', scopes: ['website_switch_status.read'], run: () => authorizationProbe('/api/v1/website/switch-status?application_number=READINESS-NO-APPLICATION', 'GET') },
    {
      name: 'website_legal.read_any_of',
      scopes: GRIDEX_WEBSITE_LEGAL_SCOPE_ALTERNATIVES,
      alternative: true,
      run: () => authorizationProbe('/api/v1/website/legal-bundle', 'GET'),
    },
  ]
}

export async function checkOpsIntegrationReadiness(): Promise<OpsIntegrationReadiness> {
  const checkedAt = new Date().toISOString()
  const client = getOpsClientStatus()
  const allScopes = [...new Set([...REQUIRED_WEBSITE_SCOPES, ...GRIDEX_WEBSITE_LEGAL_SCOPE_ALTERNATIVES])]
  const scopeStatuses = new Map<string, ScopeStatus>(allScopes.map((scope) => [scope, 'unverified']))

  const canonicalWebhookSecret = process.env.GRIDEX_WEBHOOK_SIGNING_SECRET?.trim() ?? ''
  const legacyWebhookSecret = process.env.GRIDEX_OPS_WEBHOOK_SECRET?.trim() ?? ''
  const webhookEnabled = process.env.GRIDEX_ENABLE_OPS_WEBHOOKS === 'true'
  const webhookSecretConfigured = Boolean(canonicalWebhookSecret || legacyWebhookSecret)
  const webhookSecretConflict = Boolean(
    canonicalWebhookSecret && legacyWebhookSecret && canonicalWebhookSecret !== legacyWebhookSecret,
  )
  const webhook = {
    enabled: webhookEnabled,
    signingSecretConfigured: webhookSecretConfigured,
    secretConflict: webhookSecretConflict,
    ready: !webhookEnabled || (webhookSecretConfigured && !webhookSecretConflict),
  }

  const scopes = () => allScopes.map((scope) => ({ scope, status: scopeStatuses.get(scope) ?? 'unverified' }))
  if (!client.configured) {
    return {
      ready: false,
      code: 'not_configured',
      message: readinessMessage('not_configured'),
      checkedAt,
      probes: [],
      scopes: scopes(),
      webhook,
    }
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
      probes.push({ name: definition.name, ok, status, code: result?.code ?? null })
      for (const scope of definition.scopes) {
        scopeStatuses.set(scope, ok ? (definition.alternative ? 'alternative_verified' : 'verified') : 'missing')
      }
      if (!ok) code = status === 401 ? 'invalid_api_key' : 'missing_scope'
      continue
    }

    const classified = classifyProbeFailure(settled.reason)
    if (code === 'ready' || classified !== 'ops_unavailable') code = classified
    for (const scope of definition.scopes) scopeStatuses.set(scope, classified === 'missing_scope' ? 'missing' : 'unverified')
    probes.push({
      name: definition.name,
      ok: false,
      status: isOpsError(settled.reason) ? settled.reason.status : null,
      code: errorCode(settled.reason),
    })
  }

  const ready = code === 'ready' && probes.every((probe) => probe.ok)
  return { ready, code, message: readinessMessage(code), checkedAt, probes, scopes: scopes(), webhook }
}
