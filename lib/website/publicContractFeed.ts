import {
  fetchOpsPublicContractDiagnostics,
  fetchOpsPublicContractsSnapshot,
  isOpsError,
  isTransientOpsError,
  type OpsPublicContract,
  type OpsPublicContractsSnapshot,
} from '@/lib/ops/client'
import { isPublicContractReady, buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'
import type { WebsiteCustomerType } from '@/lib/website/customerType'

export type WebsitePublicContractFeed = {
  contracts: OpsPublicContract[]
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
}): Promise<WebsitePublicContractFeed> {
  const snapshot = await fetchOpsPublicContractsSnapshot(input.customerType)
  const contracts = snapshot.contracts.filter(isPublicContractReady)
  const malformed = snapshot.contracts.filter((contract) => !isPublicContractReady(contract))

  if (snapshot.stale) {
    console.warn(`[${input.context}] serving cached public contracts after transient OPS failure`, {
      publication_revision: snapshot.publication_revision,
      fetched_at: snapshot.fetched_at,
      stale_reason: snapshot.stale_reason,
    })
  }

  if (malformed.length > 0) {
    console.warn(`[${input.context}] blocked malformed public contracts`, {
      offers: malformed.map((contract) => ({
        offer_reference: contract.offer_reference,
        reasons: buildPublicContractDisplay(contract).blockedReasons,
      })),
    })
  }

  if (contracts.length === 0) {
    await diagnoseEmptyFeed(input.context, input.customerType)
  }

  return { contracts, snapshot }
}
