import { OpsError, isOpsError } from '@/lib/ops/errors'
import {
  fetchOpsCustomerPortalBundle as fetchRawOpsCustomerPortalBundle,
  fetchOpsCustomerResource as fetchRawOpsCustomerResource,
  opsErrorCodeValue,
  stableExternalCustomerId,
  type OpsCustomerReadResource,
  type OpsPortalBundle,
  type OpsPortalIdentity,
} from './portal'

function hasStableCustomerReference(identity: OpsPortalIdentity): boolean {
  return Boolean(
    identity.customerNumber?.trim() ||
    stableExternalCustomerId(identity),
  )
}

function isCustomerNotFound(error: unknown): boolean {
  return Boolean(
    isOpsError(error) &&
    error.status === 404 &&
    opsErrorCodeValue(error) === 'customer_not_found',
  )
}

function outOfSyncError(identity: OpsPortalIdentity): OpsError {
  return new OpsError(
    'Kundkontot är känt lokalt men saknas i Gridex OPS. Kundkopplingen måste synkroniseras innan Mina sidor kan användas.',
    409,
    {
      code: 'customer_portal_link_out_of_sync',
      stage: 'customer_resolution',
      action: 'reconcile_customer_portal_link',
      retryable: false,
      has_customer_number: Boolean(identity.customerNumber?.trim()),
      has_external_customer_id: Boolean(stableExternalCustomerId(identity)),
    },
  )
}

function notLinkedProfile(identity: OpsPortalIdentity): Record<string, unknown> {
  return {
    email: identity.email?.trim().toLowerCase() || null,
    onboarding_state: 'not_linked',
    customer_link_state: 'not_linked',
  }
}

function notLinkedCustomerStatus(): Record<string, unknown> {
  return {
    code: 'not_linked',
    status: 'not_linked',
    label: 'Inget kundavtal kopplat ännu',
    message:
      'Ditt konto är verifierat, men inget Gridex-kundavtal är kopplat ännu. När en teckning har slutförts visas kunduppgifterna här automatiskt.',
    can_start_switch: false,
  }
}

function notLinkedBundle(identity: OpsPortalIdentity): OpsPortalBundle {
  return {
    profile: notLinkedProfile(identity),
    customerStatus: notLinkedCustomerStatus(),
    dataQuality: null,
    contracts: [],
    sites: [],
    invoices: [],
    documents: [],
    legalAcceptances: [],
    powersOfAttorney: [],
    switchStatus: null,
    events: [],
    meteringValues: [],
    notifications: [],
  }
}

function notLinkedResource(
  identity: OpsPortalIdentity,
  resource: OpsCustomerReadResource,
  opaqueId?: string | null,
): unknown {
  if (resource === 'me') {
    return { data: { profile: notLinkedProfile(identity) } }
  }
  return { data: opaqueId ? null : [] }
}

function handleCustomerNotFound<T>(
  error: unknown,
  identity: OpsPortalIdentity,
  notLinked: () => T,
): T {
  if (!isCustomerNotFound(error)) throw error
  if (hasStableCustomerReference(identity)) throw outOfSyncError(identity)
  return notLinked()
}

/**
 * Canonical BFF read semantics:
 * - OPS is always queried first with the verified auth user id.
 * - An auth-only account with no stable customer reference is a valid not-linked state.
 * - Once Web holds a stable OPS customer reference, customer_not_found is an integrity
 *   failure and must never be hidden as an empty portal.
 * - No email-only or cross-tenant customer fallback is introduced here.
 */
export async function fetchOpsCustomerPortalBundle(
  identity: OpsPortalIdentity,
): Promise<OpsPortalBundle> {
  try {
    return await fetchRawOpsCustomerPortalBundle(identity)
  } catch (error) {
    return handleCustomerNotFound(error, identity, () => notLinkedBundle(identity))
  }
}

export async function fetchOpsCustomerResource(
  identity: OpsPortalIdentity,
  resource: OpsCustomerReadResource,
  opaqueId?: string | null,
): Promise<unknown> {
  try {
    return await fetchRawOpsCustomerResource(identity, resource, opaqueId)
  } catch (error) {
    return handleCustomerNotFound(
      error,
      identity,
      () => notLinkedResource(identity, resource, opaqueId),
    )
  }
}
