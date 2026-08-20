import { unstable_cache } from 'next/cache'
import { after } from 'next/server'
import {
  fetchOpsPublicContractDiagnostics,
  fetchOpsPublicContractsSnapshot,
  isOpsError,
  isTransientOpsError,
  publicContractsCacheKey,
  WEBSITE_OPENAPI_SCHEMA_SHA256,
  type OpsBlockedPublicContract,
  type OpsPublicContract,
  type OpsPublicContractsSnapshot,
} from '@/lib/ops/client'
import { GRIDEX_WEBSITE_API_CONTRACT_VERSION } from '@/lib/ops/contract'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'
import type { WebsiteCustomerType } from '@/lib/website/customerType'
import { emitPublicContractMetrics } from '@/lib/website/publicContractObservability'
import { CONTRACT_PARSER_VERSION } from '@/lib/website/publicContractPolicy'
import { readWebsitePublicContractSnapshot } from '@/lib/website/publicContractSnapshotStore'

const FAST_PUBLIC_CONTRACT_SNAPSHOT_MAX_AGE_MS = 60_000
const FAST_PUBLIC_CONTRACT_REVALIDATE_AFTER_MS = 10_000
const PUBLIC_CONTRACT_DATA_CACHE_SECONDS = 15
const publicContractRevalidations = new Set<string>()

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

async function readFastPublicContractSnapshot(
  customerType?: WebsiteCustomerType | null,
): Promise<OpsPublicContractsSnapshot | null> {
  try {
    return await readWebsitePublicContractSnapshot(publicContractsCacheKey(customerType), {
      contractVersion: GRIDEX_WEBSITE_API_CONTRACT_VERSION,
      parserVersion: CONTRACT_PARSER_VERSION,
      schemaSha256: WEBSITE_OPENAPI_SCHEMA_SHA256,
      maxAgeMs: FAST_PUBLIC_CONTRACT_SNAPSHOT_MAX_AGE_MS,
    })
  } catch (error) {
    console.warn('[gridex-public-contracts] fast snapshot read unavailable', {
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

const readCachedPublicContractSnapshot = unstable_cache(
  async (
    _cacheIdentity: string,
    customerType: WebsiteCustomerType | null,
  ): Promise<OpsPublicContractsSnapshot> => {
    const stored = await readFastPublicContractSnapshot(customerType)
    if (stored) return stored
    return fetchOpsPublicContractsSnapshot(customerType)
  },
  ['gridex-public-contract-snapshot-v1'],
  { revalidate: PUBLIC_CONTRACT_DATA_CACHE_SECONDS },
)

function schedulePublicContractRevalidation(
  context: string,
  snapshot: OpsPublicContractsSnapshot,
  customerType?: WebsiteCustomerType | null,
): void {
  if (Date.now() - Date.parse(snapshot.fetched_at) < FAST_PUBLIC_CONTRACT_REVALIDATE_AFTER_MS) return

  const cacheKey = publicContractsCacheKey(customerType)
  if (publicContractRevalidations.has(cacheKey)) return
  publicContractRevalidations.add(cacheKey)

  after(async () => {
    try {
      await fetchOpsPublicContractsSnapshot(customerType, { forceFresh: true })
    } catch (error) {
      console.warn(`[${context}] public contracts post-response revalidation failed`, safeOpsError(error))
    } finally {
      publicContractRevalidations.delete(cacheKey)
    }
  })
}

export async function loadWebsitePublicContractFeed(input: {
  context: string
  customerType?: WebsiteCustomerType | null
  forceFresh?: boolean
}): Promise<WebsitePublicContractFeed> {
  const customerType = input.customerType ?? null
  let snapshot: OpsPublicContractsSnapshot

  if (input.forceFresh) {
    snapshot = await fetchOpsPublicContractsSnapshot(customerType, { forceFresh: true })
  } else {
    snapshot = await readCachedPublicContractSnapshot(
      publicContractsCacheKey(customerType),
      customerType,
    )
    schedulePublicContractRevalidation(input.context, snapshot, customerType)
  }

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
    after(() => diagnoseEmptyFeed(input.context, customerType))
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
