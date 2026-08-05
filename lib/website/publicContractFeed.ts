import {
  fetchOpsPublicContractDiagnostics,
  fetchOpsPublicContractsSnapshot,
  isOpsError,
  isTransientOpsError,
  type OpsBlockedPublicContract,
  type OpsPublicContract,
  type OpsPublicContractsSnapshot,
} from '@/lib/ops/client'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'
import type { WebsiteCustomerType } from '@/lib/website/customerType'
import { emitPublicContractMetrics } from '@/lib/website/publicContractObservability'

export type WebsitePublicContractFeedState =
  | 'feed_loaded_with_contracts'
  | 'feed_loaded_empty'
  | 'feed_loaded_with_blocked_contracts'

export function classifyWebsitePublicContractFeedState(
  visibleCount: number,
  blockedCount: number,
): WebsitePublicContractFeedState {
  if (visibleCount > 0) return 'feed_loaded_with_contracts'
  if (blockedCount > 0) return 'feed_loaded_with_blocked_contracts'
  return 'feed_loaded_empty'
}

export type WebsiteBlockedPublicContract = OpsBlockedPublicContract & {
  source: 'upstream_parse' | 'website_readiness'
}

export type WebsitePublicContractFeed = {
  contracts: OpsPublicContract[]
  blockedContracts: WebsiteBlockedPublicContract[]
  state: WebsitePublicContractFeedState
  snapshot: OpsPublicContractsSnapshot
}

function safeOpsError(error: unknown) {
  return {
    status: isOpsError(error) ? error.status : null,
    code: isOpsError(error) ? error.code : null,
    request_id: isOpsError(error) ? error.requestId : null,
    correlation_id: isOpsError(error) ? error.correlationId : null,
    retryable: isTransientOpsError(error),
    details: isOpsError(error) ? error.details : null,
    message: error instanceof Error ? error.message : String(error),
  }
}

export function logWebsitePublicContractFeedError(context: string, error: unknown): void {
  console.error(`[${context}] public contracts load failed`, safeOpsError(error))
}

function readinessReasonCode(reason: string): string {
  const normalized = reason.toLocaleLowerCase('sv-SE')
  if (normalized.includes('offer_reference')) return 'missing_offer_reference'
  if (normalized.includes('namn saknas')) return 'missing_name'
  if (normalized.includes('avtalstyp')) return 'unsupported_contract_type'
  if (normalized.includes('energiriktning')) return 'energy_direction_not_supported'
  if (normalized.includes('produktionsprissättning')) return 'pricing_incomplete'
  if (normalized.includes('juridik') || normalized.includes('dokument')) return 'legal_metadata_incomplete'
  if (normalized.includes('gäller från') || normalized.includes('slutdatum') || normalized.includes('giltighetsperiod')) {
    return 'invalid_validity_window'
  }
  if (normalized.includes('ogiltig') || normalized.includes('pris')) return 'pricing_incomplete'
  return 'invalid_public_contract'
}

async function diagnoseEmptyFeed(context: string, customerType?: WebsiteCustomerType | null): Promise<void> {
  try {
    const diagnostics = await fetchOpsPublicContractDiagnostics(customerType)
    console.warn(`[${context}] public contracts feed is empty`, {
      items: diagnostics.items.map((item) => ({
        offer_reference: item.offer_reference,
        name: item.name,
        visible: item.visible,
        blockers: item.blockers,
      })),
    })
  } catch (error) {
    console.warn(`[${context}] public contracts diagnostics unavailable`, safeOpsError(error))
  }
}

export async function loadWebsitePublicContractFeed(input: {
  context: string
  customerType?: WebsiteCustomerType | null
  forceFresh?: boolean
}): Promise<WebsitePublicContractFeed> {
  const snapshot = await fetchOpsPublicContractsSnapshot(input.customerType, {
    forceFresh: input.forceFresh,
  })
  const contracts: OpsPublicContract[] = []
  const blockedContracts: WebsiteBlockedPublicContract[] = snapshot.blocked_contracts.map((item) => ({
    ...item,
    source: 'upstream_parse',
  }))

  for (const contract of snapshot.contracts) {
    const display = buildPublicContractDisplay(contract)
    if (display.ready) {
      contracts.push(contract)
      continue
    }
    blockedContracts.push({
      offer_reference: contract.offer_reference || null,
      source: 'website_readiness',
      reasons: [...new Set(display.blockedReasons.map(readinessReasonCode))],
    })
  }

  if (snapshot.stale) {
    console.warn(`[${input.context}] serving cached public contracts after transient OPS failure`, {
      publication_revision: snapshot.publication_revision,
      fetched_at: snapshot.fetched_at,
      stale_reason: snapshot.stale_reason,
    })
  }

  if (blockedContracts.length > 0) {
    console.warn(`[${input.context}] blocked public contracts`, {
      offers: blockedContracts,
    })
  }

  if (contracts.length === 0 && snapshot.feed_state !== 'canonical_empty') {
    await diagnoseEmptyFeed(input.context, input.customerType)
  }

  const state = classifyWebsitePublicContractFeedState(contracts.length, blockedContracts.length)

  emitPublicContractMetrics({
    context: input.context,
    upstreamCount: snapshot.contracts.length + snapshot.blocked_contracts.length,
    visibleCount: contracts.length,
    blockedCount: blockedContracts.length,
    warningCount: snapshot.warnings.length,
    compatibilityIssueCount: snapshot.compatibility_issues.length,
    feedEmpty: contracts.length === 0,
    contractVersion: snapshot.contract_version,
    parserVersion: snapshot.parser_version,
    publicationRevision: snapshot.publication_revision,
  })

  console.info(`[${input.context}] public contracts feed classified`, {
    parser_version: snapshot.parser_version,
    schema_sha256: snapshot.schema_sha256,
    contract_version: snapshot.contract_version,
    publication_revision: snapshot.publication_revision,
    feed_state: snapshot.feed_state,
    empty_feed_reason: snapshot.empty_feed_authorization?.reason ?? null,
    upstream_count: snapshot.contracts.length + snapshot.blocked_contracts.length,
    accepted_count: contracts.length,
    blocked_count: blockedContracts.length,
    warning_count: snapshot.warnings.length,
    compatibility_issue_count: snapshot.compatibility_issues.length,
    state,
    upstream_status: snapshot.upstream_status,
    upstream_etag: snapshot.etag,
    upstream_request_id: snapshot.upstream_request_id,
    upstream_correlation_id: snapshot.upstream_correlation_id,
  })

  return { contracts, blockedContracts, state, snapshot }
}
