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

export type WebsitePublicContractFeedState =
  | 'feed_loaded_with_contracts'
  | 'feed_loaded_empty'
  | 'feed_partially_loaded'

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

  if (contracts.length === 0) {
    await diagnoseEmptyFeed(input.context, input.customerType)
  }

  const state: WebsitePublicContractFeedState = contracts.length === 0
    ? 'feed_loaded_empty'
    : blockedContracts.length > 0
      ? 'feed_partially_loaded'
      : 'feed_loaded_with_contracts'

  return { contracts, blockedContracts, state, snapshot }
}
