import {
  fetchOpsPublicContractsFresh,
  fetchOpsWebsiteLegalBundle,
  getOpsClientStatus,
  isOpsError,
} from '@/lib/ops/client'

export const REQUIRED_WEBSITE_SCOPES = [
  'website_contracts.read',
  'website_legal.read',
  'website_applications.write',
  'website_events.write',
  'events.read',
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
  'customer_notifications.read',
  'customer_notifications.write',
  'customer_contact.write',
  'customer_facility_data.write',
] as const

export type OpsReadinessCode =
  | 'ready'
  | 'not_configured'
  | 'invalid_api_key'
  | 'missing_scope'
  | 'invalid_base_url_or_environment'
  | 'ops_unavailable'

export type OpsIntegrationReadiness = {
  ready: boolean
  code: OpsReadinessCode
  message: string
  checkedAt: string
  probes: Array<{ name: string; ok: boolean; status: number | null; code: string | null }>
  scopes: Array<{ scope: string; status: 'declared' | 'missing' | 'unverified' }>
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
    case 'ready': return 'OPS-anslutningen svarar och de deklarerade behörigheterna är kompletta.'
    case 'not_configured': return 'OPS URL eller API-nyckel saknas eller stoppas av produktionsskyddet.'
    case 'invalid_api_key': return 'OPS avvisade API-nyckeln.'
    case 'missing_scope': return 'API-nyckeln saknar behörighet för minst ett verifierat anrop.'
    case 'invalid_base_url_or_environment': return 'OPS URL pekar på fel miljö eller saknar den dokumenterade endpointen.'
    default: return 'OPS kunde inte nås eller svarade med ett tillfälligt serverfel.'
  }
}

export async function checkOpsIntegrationReadiness(): Promise<OpsIntegrationReadiness> {
  const checkedAt = new Date().toISOString()
  const client = getOpsClientStatus()
  const declared = declaredScopes()
  const scopes = REQUIRED_WEBSITE_SCOPES.map((scope) => ({
    scope,
    status: declared ? (declared.has(scope) ? 'declared' as const : 'missing' as const) : 'unverified' as const,
  }))
  if (!client.configured) {
    return { ready: false, code: 'not_configured', message: message('not_configured'), checkedAt, probes: [], scopes }
  }

  const probeDefinitions = [
    { name: 'website_contracts.read', run: () => fetchOpsPublicContractsFresh() },
    { name: 'website_legal.read', run: () => fetchOpsWebsiteLegalBundle() },
  ]
  const probes: OpsIntegrationReadiness['probes'] = []
  let code: OpsReadinessCode = 'ready'
  for (const probe of probeDefinitions) {
    try {
      await probe.run()
      probes.push({ name: probe.name, ok: true, status: 200, code: null })
    } catch (error) {
      const classified = classifyProbeFailure(error)
      if (code === 'ready' || classified !== 'ops_unavailable') code = classified
      probes.push({
        name: probe.name,
        ok: false,
        status: isOpsError(error) ? error.status : null,
        code: errorCode(error),
      })
    }
  }
  if (code === 'ready' && scopes.some((scope) => scope.status === 'missing')) code = 'missing_scope'
  const ready = code === 'ready' && probes.every((probe) => probe.ok)
  return { ready, code, message: message(code), checkedAt, probes, scopes }
}
