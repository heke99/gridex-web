import { randomUUID } from 'node:crypto'
import {
  fetchOpsIntegrationContext,
  fetchOpsPublicContractDiagnostics,
  fetchOpsPublicContractsFresh,
  fetchOpsWebsiteLegalBundle,
  getOpsClientStatus,
  isOpsError,
  probeOpsEndpointAuthorization,
} from '@/lib/ops/client'
import {
  GRIDEX_API_CONTRACT_VERSION,
  GRIDEX_WEBSITE_CHECKOUT_SCOPES,
  GRIDEX_WEBSITE_DIAGNOSTICS_SCOPE,
  GRIDEX_WEBSITE_LEGAL_SCOPE,
  GRIDEX_WEBSITE_MARKET_PRICE_SCOPE,
  GRIDEX_WEBSITE_SWITCH_STATUS_SCOPE,
} from '@/lib/ops/contract'
import { gridexOpenApiContractGaps } from '@/lib/ops/validators/openapi'
import openApiVerification from '@/docs/openapi/verification-status.json'

type OpenApiVerificationStatus = {
  liveSyncVerified: boolean
  contractVersion: string | null
  verifiedAt: string | null
}

function normalizeOpenApiVerificationStatus(value: unknown): OpenApiVerificationStatus {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  const contractVersion = typeof row.contract_version === 'string' && row.contract_version.trim()
    ? row.contract_version.trim()
    : null
  const verifiedAt = typeof row.verified_at === 'string' && row.verified_at.trim()
    ? row.verified_at.trim()
    : null

  return {
    liveSyncVerified: row.live_sync_verified === true,
    contractVersion,
    verifiedAt,
  }
}

const openApiVerificationStatus = normalizeOpenApiVerificationStatus(openApiVerification)

export const REQUIRED_WEBSITE_SCOPES = GRIDEX_WEBSITE_CHECKOUT_SCOPES
export const ALTERNATIVE_WEBSITE_SCOPE_GROUPS = [] as const

type ScopeStatus = 'verified' | 'alternative_verified' | 'missing' | 'unverified'
export type OpsReadinessCode =
  | 'ready'
  | 'not_configured'
  | 'invalid_api_key'
  | 'missing_scope'
  | 'invalid_base_url_or_environment'
  | 'webhook_not_configured'
  | 'ops_unavailable'

export type OpsReadinessCheckName =
  | 'configuration_ready'
  | 'authentication_ready'
  | 'tenant_ready'
  | 'contract_version_ready'
  | 'local_schema_ready'
  | 'live_schema_ready'
  | 'runtime_schema_ready'
  | 'openapi_sync_ready'
  | 'public_contracts_ready'
  | 'diagnostics_ready'
  | 'energy_area_ready'
  | 'quote_ready'
  | 'quote_validation_ready'
  | 'customer_application_ready'
  | 'portal_identity_ready'
  | 'legal_bundle_ready'
  | 'market_price_ready'
  | 'portfolio_ready'
  | 'customer_portal_contract_ready'
  | 'customer_portal_runtime_ready'
  | 'switch_status_ready'
  | 'webhook_transport_ready'
  | 'webhook_projection_ready'
  | 'webhook_retry_ready'
  | 'database_migrations_ready'
  | 'staging_flow_ready'
  | 'tenant_isolation_ready'
  | 'full_api_compatibility_ready'

export type OpsReadinessCheck = {
  ready: boolean
  severity: 'ok' | 'warning' | 'blocked'
  code: string
  message: string
  evidence?: Record<string, unknown>
}

export type OpsIntegrationReadiness = {
  ready: boolean
  fullApiCompatibilityReady: boolean
  code: OpsReadinessCode
  message: string
  checkedAt: string
  contractVersion: string
  checks: Record<OpsReadinessCheckName, OpsReadinessCheck>
  upstreamContractGaps: string[]
  probes: Array<{ name: string; ok: boolean; status: number | null; code: string | null }>
  scopes: Array<{ scope: string; status: ScopeStatus }>
  contextReadiness: {
    websiteCheckoutReady: boolean
    customerPortalReady: boolean
    completeTenantWebsiteReady: boolean
    missingWebsiteScopes: string[]
    missingCustomerPortalScopes: string[]
    missingRecommendedScopes: string[]
  } | null
  featureCapabilities: {
    websiteSales: boolean
    websiteMarketPrices: boolean
    websiteDiagnostics: boolean
    customerPortal: boolean
    supplierSwitchStatus: boolean
    productionContracts: boolean
    fullApiCompatibility: boolean
  }
  webhook: {
    ready: boolean
    enabled: boolean
    signingSecretConfigured: boolean
    secretConflict: boolean
    projectionsComplete: boolean
    retryWorkerConfigured: boolean
  }
}

type ProbeDefinition = {
  name: string
  scopes: readonly string[]
  alternative?: boolean
  requiredForWebsiteSales?: boolean
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

function readinessMessage(code: OpsReadinessCode, fullReady: boolean): string {
  if (code === 'ready' && fullReady) return 'Gridex API-flödet är fullt verifierat mot det godkända kontraktet.'
  if (code === 'ready') return 'Webbteckningens grundflöde är verifierat, men full API-kompatibilitet är fortfarande blockerad.'
  switch (code) {
    case 'not_configured': return 'GRIDEX_API_KEY saknas eller är ogiltig.'
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
    { name: 'integration_context', scopes: ['integration_context.read'], run: async () => {
      const context = await fetchOpsIntegrationContext(true)
      if (!context.capabilities.website_checkout_ready || context.capabilities.missing_website_checkout_scopes.length > 0) {
        return {
          ok: false,
          status: 403,
          code: `missing_scope:${context.capabilities.missing_website_checkout_scopes.join(',')}`,
        }
      }
      if (context.configuration.application_reference_location !== 'top_level') {
        throw new Error('application_reference_location_mismatch')
      }
    } },
    { name: 'website_contracts.read', scopes: ['website_contracts.read'], run: async () => { await fetchOpsPublicContractsFresh() } },
    {
      name: 'website_contracts.diagnostics',
      scopes: [GRIDEX_WEBSITE_DIAGNOSTICS_SCOPE],
      requiredForWebsiteSales: false,
      run: async () => { await fetchOpsPublicContractDiagnostics() },
    },
    { name: 'website_energy_area.resolve', scopes: ['website_energy_area.resolve'], run: () => authorizationProbe('/api/v1/website/energy-area/resolve', 'POST', {}) },
    { name: 'website_quotes.write', scopes: ['website_quotes.write'], run: () => authorizationProbe('/api/v1/website/quote', 'POST', {}) },
    { name: 'website_quotes.validate', scopes: ['website_quotes.validate'], run: () => authorizationProbe('/api/v1/website/quote/validate', 'POST', {}) },
    { name: 'website_applications.write', scopes: ['website_applications.write'], run: () => authorizationProbe('/api/v1/website/customer-applications', 'POST', {}) },
    {
      name: 'website_legal.read',
      scopes: [GRIDEX_WEBSITE_LEGAL_SCOPE],
      run: async () => {
        const [offer] = await fetchOpsPublicContractsFresh()
        if (!offer?.offer_reference) throw new Error('legal_readiness_offer_unavailable')
        await fetchOpsWebsiteLegalBundle(offer.offer_reference)
      },
    },
    {
      name: 'website_market_prices.read',
      scopes: [GRIDEX_WEBSITE_MARKET_PRICE_SCOPE],
      requiredForWebsiteSales: false,
      run: () => authorizationProbe('/api/v1/website/market-price/current', 'POST', {}),
    },
    {
      name: 'website_switch_status.read',
      scopes: [GRIDEX_WEBSITE_SWITCH_STATUS_SCOPE],
      requiredForWebsiteSales: false,
      run: () => authorizationProbe('/api/v1/website/switch-status', 'GET'),
    },
  ]
}

function check(
  ready: boolean,
  code: string,
  message: string,
  evidence?: Record<string, unknown>,
  severityWhenFalse: 'warning' | 'blocked' = 'blocked',
): OpsReadinessCheck {
  return {
    ready,
    severity: ready ? 'ok' : severityWhenFalse,
    code,
    message,
    ...(evidence ? { evidence } : {}),
  }
}

export async function checkOpsIntegrationReadiness(): Promise<OpsIntegrationReadiness> {
  const checkedAt = new Date().toISOString()
  const client = getOpsClientStatus()
  const upstreamContractGaps = gridexOpenApiContractGaps()
  const allScopes = [...new Set([
    ...REQUIRED_WEBSITE_SCOPES,
    GRIDEX_WEBSITE_LEGAL_SCOPE,
    GRIDEX_WEBSITE_DIAGNOSTICS_SCOPE,
    GRIDEX_WEBSITE_MARKET_PRICE_SCOPE,
    GRIDEX_WEBSITE_SWITCH_STATUS_SCOPE,
  ])]
  const scopeStatuses = new Map<string, ScopeStatus>(allScopes.map((scope) => [scope, 'unverified']))

  const canonicalWebhookSecret = process.env.GRIDEX_WEBHOOK_SIGNING_SECRET?.trim() ?? ''
  const webhookEnabled = Boolean(canonicalWebhookSecret)
  const webhookSecretConfigured = Buffer.byteLength(canonicalWebhookSecret, 'utf8') >= 32
  const webhookSecretConflict = false
  const migrationsVerified = process.env.GRIDEX_DATABASE_MIGRATIONS_READY === 'true'
  const webhookRetryWorkerConfigured = Boolean(
    process.env.WEBHOOK_RETRY_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim(),
  )
  const webhookProjectionsComplete =
    process.env.GRIDEX_WEBHOOK_PROJECTIONS_READY === 'true' &&
    migrationsVerified &&
    webhookRetryWorkerConfigured
  const stagingFlowVerified =
    process.env.GRIDEX_STAGING_FLOW_VERIFIED === 'true'
  const tenantIsolationVerified =
    process.env.GRIDEX_TWO_TENANT_ISOLATION_VERIFIED === 'true'
  const webhook = {
    enabled: webhookEnabled,
    signingSecretConfigured: webhookSecretConfigured,
    secretConflict: webhookSecretConflict,
    projectionsComplete: webhookProjectionsComplete,
    retryWorkerConfigured: webhookRetryWorkerConfigured,
    ready: webhookEnabled && webhookSecretConfigured && !webhookSecretConflict,
  }

  const scopes = () => allScopes.map((scope) => ({ scope, status: scopeStatuses.get(scope) ?? 'unverified' }))
  const probes: OpsIntegrationReadiness['probes'] = []
  let code: OpsReadinessCode = client.configured ? 'ready' : 'not_configured'
  let contextReadiness: OpsIntegrationReadiness['contextReadiness'] = null
  let resolvedContractVersion: string | null = null

  if (client.configured) {
    try {
      const context = await fetchOpsIntegrationContext(true)
      resolvedContractVersion = context.contract_version
      contextReadiness = {
        websiteCheckoutReady: context.capabilities.website_checkout_ready,
        customerPortalReady: context.capabilities.customer_portal_ready,
        completeTenantWebsiteReady: context.capabilities.complete_tenant_website_ready,
        missingWebsiteScopes: context.capabilities.missing_website_checkout_scopes,
        missingCustomerPortalScopes: context.capabilities.missing_customer_portal_scopes,
        missingRecommendedScopes: context.capabilities.recommended_missing_scopes,
      }
    } catch (error) {
      code = classifyProbeFailure(error)
    }

    const definitions = probeDefinitions()
    const results = await Promise.allSettled(definitions.map(async (probe) => ({ probe, result: await probe.run() })))
    for (let index = 0; index < results.length; index += 1) {
      const definition = definitions[index]
      const settled = results[index]
      if (settled.status === 'fulfilled') {
        const result = settled.value.result ?? null
        const ok = result ? result.ok : true
        const status = result ? result.status : 200
        probes.push({ name: definition.name, ok, status, code: result ? result.code : null })
        for (const scope of definition.scopes) {
          scopeStatuses.set(scope, ok ? (definition.alternative ? 'alternative_verified' : 'verified') : 'missing')
        }
        if (!ok && definition.requiredForWebsiteSales !== false) code = status === 401 ? 'invalid_api_key' : 'missing_scope'
      } else {
        const classified = classifyProbeFailure(settled.reason)
        if (definition.requiredForWebsiteSales !== false && (code === 'ready' || classified !== 'ops_unavailable')) code = classified
        for (const scope of definition.scopes) scopeStatuses.set(scope, classified === 'missing_scope' ? 'missing' : 'unverified')
        probes.push({
          name: definition.name,
          ok: false,
          status: isOpsError(settled.reason) ? settled.reason.status : null,
          code: errorCode(settled.reason),
        })
      }
    }
  }

  const probeReady = (name: string) => probes.find((probe) => probe.name === name)?.ok === true
  const checkoutProbeNames = new Set(probeDefinitions()
    .filter((definition) => definition.requiredForWebsiteSales !== false)
    .map((definition) => definition.name))
  const checkoutProbesReady = probes
    .filter((probe) => checkoutProbeNames.has(probe.name))
    .every((probe) => probe.ok)
  const portalIdentityGap = upstreamContractGaps.includes('customer_application_portal_identity_missing')
  const legalAcceptanceGap = upstreamContractGaps.includes('legal_acceptances_not_dynamic')
  const priceOptionsGap = upstreamContractGaps.includes('public_contract_price_options_not_published')
  const portfolioGap = upstreamContractGaps.includes('portfolio_response_schema_not_strict')
  const quoteValidationSchemaGap = upstreamContractGaps.includes('website_quote_validation_response_not_strict')
  const webhookSchemaGap = upstreamContractGaps.includes('ops_domain_webhook_schema_not_published')
  const portalContractGaps = upstreamContractGaps.filter((gap) => gap.startsWith('customer_portal_'))
  const checkoutReady =
    client.configured &&
    code === 'ready' &&
    checkoutProbesReady &&
    contextReadiness?.websiteCheckoutReady === true &&
    !portalIdentityGap &&
    !legalAcceptanceGap &&
    !priceOptionsGap
  const liveOpenApiVerified =
    openApiVerificationStatus.liveSyncVerified &&
    openApiVerificationStatus.contractVersion === GRIDEX_API_CONTRACT_VERSION

  const checks: Record<OpsReadinessCheckName, OpsReadinessCheck> = {
    configuration_ready: check(client.configured, client.configured ? 'configured' : 'not_configured', client.configured ? 'Gridex API är serverkonfigurerat.' : 'GRIDEX_API_KEY eller canonical API-bas saknas.'),
    authentication_ready: check(probeReady('integration_context'), probeReady('integration_context') ? 'authenticated' : 'authentication_unverified', 'API-nyckeln har verifierats mot integration/context.'),
    tenant_ready: check(Boolean(contextReadiness), contextReadiness ? 'tenant_verified' : 'tenant_unverified', 'Tenantidentiteten härleds och verifieras från API-nyckeln.'),
    contract_version_ready: check(
      resolvedContractVersion === GRIDEX_API_CONTRACT_VERSION,
      resolvedContractVersion === GRIDEX_API_CONTRACT_VERSION ? 'contract_version_verified' : 'contract_version_mismatch',
      resolvedContractVersion === GRIDEX_API_CONTRACT_VERSION
        ? `OPS svarar med godkänd kontraktsversion ${GRIDEX_API_CONTRACT_VERSION}.`
        : 'OPS-kontraktsversionen är inte runtimeverifierad eller matchar inte klienten.',
      { expected: GRIDEX_API_CONTRACT_VERSION, received: resolvedContractVersion },
    ),
    local_schema_ready: check(
      upstreamContractGaps.length === 0,
      upstreamContractGaps.length === 0
        ? 'local_schema_verified'
        : 'local_schema_gaps',
      upstreamContractGaps.length === 0
        ? 'Incheckade OpenAPI-kontrakt är slutna och kompatibilitetsverifierade.'
        : 'Incheckade OpenAPI-kontrakt har blockerande schemagap.',
      { gaps: upstreamContractGaps },
    ),
    live_schema_ready: check(
      liveOpenApiVerified,
      liveOpenApiVerified
        ? 'live_schema_verified'
        : openApiVerificationStatus.liveSyncVerified
          ? 'live_schema_version_mismatch'
          : 'live_schema_unverified',
      'Live-manifestets version och SHA-256 ska vara verifierade mot lokala snapshots.',
      {
        verified_at: openApiVerificationStatus.verifiedAt,
        expected: GRIDEX_API_CONTRACT_VERSION,
        received: openApiVerificationStatus.contractVersion,
      },
    ),
    runtime_schema_ready: check(
      resolvedContractVersion === GRIDEX_API_CONTRACT_VERSION &&
        upstreamContractGaps.length === 0,
      resolvedContractVersion === GRIDEX_API_CONTRACT_VERSION
        ? 'runtime_schema_verified'
        : 'runtime_schema_unverified',
      'Runtimeversion och maskinkontrakt ska vara samma release.',
      {
        expected: GRIDEX_API_CONTRACT_VERSION,
        received: resolvedContractVersion,
      },
    ),
    openapi_sync_ready: check(
      liveOpenApiVerified,
      liveOpenApiVerified
        ? 'openapi_live_sync_verified'
        : openApiVerificationStatus.liveSyncVerified
          ? 'openapi_live_sync_version_mismatch'
          : 'openapi_live_sync_unverified',
      liveOpenApiVerified
        ? 'Incheckade OpenAPI-snapshots är hämtade från live-API och genererad kod är synkroniserad.'
        : 'OpenAPI-snapshots måste hämtas och godkännas med npm run api:sync i en nätverksansluten miljö.',
      {
        verified_at: openApiVerificationStatus.verifiedAt,
        expected: GRIDEX_API_CONTRACT_VERSION,
        received: openApiVerificationStatus.contractVersion,
      },
    ),
    public_contracts_ready: check(probeReady('website_contracts.read'), 'public_contracts_probe', 'Publicerade avtal kan hämtas och valideras.'),
    diagnostics_ready: check(
      probeReady('website_contracts.diagnostics'),
      'diagnostics_probe',
      'Tenantens publiceringsgraf kan verifieras via diagnostics.',
      undefined,
      'warning',
    ),
    energy_area_ready: check(probeReady('website_energy_area.resolve'), 'energy_area_probe', 'Elområdesresolverns behörighet är verifierad.'),
    quote_ready: check(probeReady('website_quotes.write'), 'quote_probe', 'Quote-endpointens behörighet är verifierad.'),
    quote_validation_ready: check(
      probeReady('website_quotes.validate') && !quoteValidationSchemaGap,
      quoteValidationSchemaGap ? 'quote_validation_schema_gap' : 'quote_validation_probe',
      quoteValidationSchemaGap
        ? 'Quote validation-responsen är uttryckligen öppen i OPS OpenAPI och kan därför inte verifieras strikt.'
        : 'Quote validation-endpointens behörighet och maskinschema är verifierade.',
    ),
    customer_application_ready: check(probeReady('website_applications.write') && !portalIdentityGap, portalIdentityGap ? 'portal_identity_contract_missing' : 'customer_application_probe', portalIdentityGap ? 'Kundansökans OpenAPI saknar atomisk portalidentitet.' : 'Kundansökan kan skickas enligt kontraktet.'),
    portal_identity_ready: check(
      probeReady('website_applications.write') &&
        !portalIdentityGap &&
        contextReadiness?.customerPortalReady === true,
      portalIdentityGap
        ? 'portal_identity_contract_missing'
        : 'portal_identity_runtime_unverified',
      'Portalidentitet ska skrivas atomiskt av OPS och Customer Portal-capability ska vara aktiv.',
    ),
    legal_bundle_ready: check(
      probeReady('website_legal.read') && !legalAcceptanceGap,
      legalAcceptanceGap ? 'legal_acceptance_contract_not_dynamic' : 'legal_bundle_probe',
      legalAcceptanceGap
        ? 'Juridikpaketet kan hämtas, men OPS OpenAPI tillåter ännu inte dynamiska dokumentbundna acceptanser.'
        : 'Canonical juridikpaket kan hämtas och acceptanser kan skickas enligt kontraktet.',
    ),
    market_price_ready: check(probeReady('website_market_prices.read'), 'market_price_probe', 'Aktuellt marknadspris är behörighetsverifierat.'),
    portfolio_ready: check(probeReady('website_contracts.read') && !portfolioGap, portfolioGap ? 'portfolio_schema_gap' : 'portfolio_ready', portfolioGap ? 'Portfolioresponsen saknar strikt maskinschema i OPS OpenAPI.' : 'Portfoliohistoriken följer ett strikt kontrakt.'),
    customer_portal_contract_ready: check(portalContractGaps.length === 0, portalContractGaps.length === 0 ? 'portal_contract_ready' : 'portal_contract_gaps', portalContractGaps.length === 0 ? 'Customer Portal-kontraktet är maskinellt komplett.' : 'Customer Portal OpenAPI har blockerande kontraktsfel.', { gaps: portalContractGaps }),
    customer_portal_runtime_ready: check(contextReadiness?.customerPortalReady === true, 'portal_runtime_context', 'Tenantens Customer Portal-capability är aktiv.', undefined, 'warning'),
    switch_status_ready: check(probeReady('website_switch_status.read'), 'switch_status_probe', 'Bytesstatusens behörighet är verifierad.', undefined, 'warning'),
    webhook_transport_ready: check(webhook.ready, webhook.ready ? 'webhook_transport_ready' : 'webhook_transport_not_ready', 'Webhookmottagningen kräver aktiv och giltig signing secret.'),
    webhook_projection_ready: check(
      webhookProjectionsComplete && !webhookSchemaGap,
      webhookSchemaGap
        ? 'webhook_domain_schema_missing'
        : webhookProjectionsComplete ? 'webhook_projections_ready' : 'webhook_projections_unverified',
      webhookSchemaGap
        ? 'OPS har inte publicerat maskinscheman för de dokumenterade domänwebhookarna; projektionerna kan därför inte märkas fullt kontraktsverifierade.'
        : webhookProjectionsComplete
          ? 'Dokumenterade webhooktyper, retryarbetare och dead-letter-kedja är miljöverifierade.'
          : 'Webhookprojektionerna kräver applicerad migration, cron-secret, retryarbetare och explicit stagingverifiering.',
      {
        retry_worker_configured: webhookRetryWorkerConfigured,
        migrations_verified: migrationsVerified,
        webhook_schema_gap: webhookSchemaGap,
      },
      'warning',
    ),
    webhook_retry_ready: check(
      webhookRetryWorkerConfigured,
      webhookRetryWorkerConfigured
        ? 'webhook_retry_ready'
        : 'webhook_retry_unverified',
      'Webhook retry/dead-letter worker kräver en verifierad cron-konfiguration.',
      undefined,
      'warning',
    ),
    database_migrations_ready: check(migrationsVerified, migrationsVerified ? 'database_migrations_verified' : 'database_migrations_unverified', 'Nödvändiga databasmigrationer måste vara applicerade och verifierade.', undefined, 'warning'),
    staging_flow_ready: check(
      stagingFlowVerified,
      stagingFlowVerified
        ? 'staging_flow_verified'
        : 'staging_flow_unverified',
      'Canonical checkout, portal och webhookflöde ska verifieras i staging.',
      undefined,
      'warning',
    ),
    tenant_isolation_ready: check(
      tenantIsolationVerified,
      tenantIsolationVerified
        ? 'tenant_isolation_verified'
        : 'tenant_isolation_unverified',
      'Två separata tenantnycklar ska bevisa läs-, skriv- och webhookisolering.',
      undefined,
      'warning',
    ),
    full_api_compatibility_ready: check(false, 'pending_full_evaluation', 'Full kompatibilitet beräknas från samtliga obligatoriska kontroller.'),
  }

  const fullPrerequisites: OpsReadinessCheckName[] = [
    'configuration_ready',
    'authentication_ready',
    'tenant_ready',
    'contract_version_ready',
    'local_schema_ready',
    'live_schema_ready',
    'runtime_schema_ready',
    'openapi_sync_ready',
    'public_contracts_ready',
    'diagnostics_ready',
    'energy_area_ready',
    'quote_ready',
    'quote_validation_ready',
    'customer_application_ready',
    'portal_identity_ready',
    'legal_bundle_ready',
    'market_price_ready',
    'portfolio_ready',
    'customer_portal_contract_ready',
    'customer_portal_runtime_ready',
    'switch_status_ready',
    'webhook_transport_ready',
    'webhook_projection_ready',
    'webhook_retry_ready',
    'database_migrations_ready',
    'staging_flow_ready',
    'tenant_isolation_ready',
  ]
  const fullApiCompatibilityReady =
    upstreamContractGaps.length === 0 &&
    fullPrerequisites.every((name) => checks[name].ready)
  checks.full_api_compatibility_ready = check(
    fullApiCompatibilityReady,
    fullApiCompatibilityReady ? 'full_api_compatibility_ready' : 'full_api_compatibility_blocked',
    fullApiCompatibilityReady
      ? 'Alla obligatoriska kontrakts-, runtime-, webhook- och migrationskontroller är verifierade.'
      : 'Minst en obligatorisk kontroll blockerar full API-kompatibilitet.',
    {
      blocked_checks: fullPrerequisites.filter((name) => !checks[name].ready),
      upstream_contract_gaps: upstreamContractGaps,
    },
  )

  const featureCapabilities = {
    websiteSales: checkoutReady,
    websiteMarketPrices: checks.market_price_ready.ready,
    websiteDiagnostics: probeReady('website_contracts.diagnostics'),
    customerPortal: checks.customer_portal_contract_ready.ready && checks.customer_portal_runtime_ready.ready,
    supplierSwitchStatus: checks.switch_status_ready.ready,
    productionContracts: checkoutReady,
    fullApiCompatibility: fullApiCompatibilityReady,
  }

  return {
    ready: checkoutReady,
    fullApiCompatibilityReady,
    code,
    message: readinessMessage(code, fullApiCompatibilityReady),
    checkedAt,
    contractVersion: GRIDEX_API_CONTRACT_VERSION,
    checks,
    upstreamContractGaps,
    probes,
    scopes: scopes(),
    contextReadiness,
    featureCapabilities,
    webhook,
  }
}
