/* eslint-disable @typescript-eslint/no-unused-vars */

import { createHash, randomUUID } from "node:crypto";
import {
  calculationPricingComponentAmount,
  normalizePublicContractApiPayload,
  normalizeProductionPricing,
  publicContractValidationIssues,
  type PublicAreaPricing,
  type PublicContractLegal,
  type PublicContractPriceOption,
  type PublicPortfolioMonthlyPrice,
  type PublicLegalRequirement,
  type PublicPricingComponent,
  type PublicProductionPricing,
} from "@/lib/website/publicContractContract";
import {
  GRIDEX_WEBSITE_API_CONTRACT_VERSION,
  GRIDEX_WEBSITE_OPENAPI_SHA256,
} from '@/lib/ops/contract';
import { OpsError, OpsSchemaError, isOpsError } from '@/lib/ops/errors'
import { isCompatibleAdditiveResponseSchemaError } from '@/lib/ops/schemaCompatibility'
import {
  env,
  getOpsApiBaseUrl,
  getOpsApiKey,
  getOpsTransportStatus,
  opsRequest as transportOpsRequest,
  type OpsHttpResponse,
  type OpsRequestOptions,
} from '@/lib/ops/transport'
import {
  assertCustomerPortalOperationRequest,
  assertCustomerPortalOperationResponse,
  assertWebsiteOperationRequest,
  assertWebsiteOperationResponse,
  assertWebsiteRequest,
  assertWebsiteResponse,
  hasCustomerPortalOperation,
  hasWebsiteOperation,
  websiteSchemaHasProperty,
  websiteSchemaRequiresProperty,
  validateOpenApiSchema,
} from '@/lib/ops/validators/openapi'
import { toOpsCustomerType, type WebsiteCustomerType } from "@/lib/website/customerType";
import { annualToMonthlyKwh } from '@/lib/website/consumptionEstimator'
import type { components as WebsiteApiComponents } from '@/lib/ops/generated/website-api';
import { isStrictCalendarDate, stockholmCalendarDate } from '@/lib/website/businessDate'
import { canonicalSha256 } from '@/lib/ops/canonicalJson'
import { logContractVersionDrift } from '@/lib/ops/contractCompatibility'
import {
  CONTRACT_PARSER_VERSION,
  classifyOpenApiIssue,
  contractIssue,
  isBlockingContractIssue,
  type ContractValidationIssue,
} from '@/lib/website/publicContractPolicy'
import { WEBSITE_PUBLIC_CONTRACTS_CACHE_TAG } from '@/lib/website/publicContractCache'
import {
  readWebsitePublicContractSnapshot,
  storeWebsitePublicContractSnapshot,
} from '@/lib/website/publicContractSnapshotStore'

import { normalizeText, recordValue, pickString, extractRows, opsRequest, jsonRequestBody, observeRuntimeSchemaValidation, opsFetch, extractObject } from './core'

export type OpsPortalIdentity = {
  userId: string;
  email?: string | null;
  customerNumber?: string | null;
  externalCustomerId?: string | null;
};

export type OpsCustomerSyncInput = {
  identity: OpsPortalIdentity;
  idempotencyKey?: string | null;
  powerOfAttorney?: Record<string, unknown> | null;
  legalAcceptances?: Record<string, unknown>[] | null;
  documents?: Record<string, unknown>[] | null;
  facilityData?: Record<string, unknown>[] | null;
  profile?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type OpsCustomerSyncResult = {
  ok: boolean;
  status?: string | null;
  synced?: Record<string, unknown> | null;
  warnings: string[];
  requestId?: string | null;
  correlationId?: string | null;
  contractSchemaVersion?: string | null;
  raw?: Record<string, unknown>;
};

export type OpsCustomerProfileUpdateInput = {
  identity: OpsPortalIdentity;
  idempotencyKey?: string | null;
  profile: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
};

export type OpsCustomerMoveOutInput = {
  identity: OpsPortalIdentity;
  idempotencyKey?: string | null;
  moveOut: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
};

export type OpsCustomerWriteResult = {
  ok: boolean;
  status?: string | null;
  data?: Record<string, unknown> | null;
  warnings: string[];
  requestId?: string | null;
  correlationId?: string | null;
  contractSchemaVersion?: string | null;
  raw?: Record<string, unknown>;
};

export type OpsCustomerEventType =
  | "customer.opened_document"
  | "customer.downloaded_document";

export type OpsCustomerEventResult = {
  eventId: string | null;
  customerEventId: string | null;
  eventReference: string;
  eventType: string;
  customerReference: string | null;
  status: 'accepted';
  requestId: string;
  correlationId: string | null;
  contractSchemaVersion: string;
};

export const OPS_CUSTOMER_EVENT_TYPES = new Set<string>([
  "customer.opened_document",
  "customer.downloaded_document",
]);

export function isOpsCustomerEventType(value: string): value is OpsCustomerEventType {
  return OPS_CUSTOMER_EVENT_TYPES.has(value);
}

export type OpsPortalBundle = {
  profile: Record<string, unknown> | null;
  customerStatus: Record<string, unknown> | null;
  dataQuality: Record<string, unknown> | null;
  contracts: Record<string, unknown>[];
  sites: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  legalAcceptances: Record<string, unknown>[];
  powersOfAttorney: Record<string, unknown>[];
  switchStatus: Record<string, unknown> | null;
  events: Record<string, unknown>[];
  meteringValues: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
};

export function normalizeStableExternalCustomerId(
  value: string | null | undefined,
  customerNumber?: string | null,
): string | null {
  const normalized = normalizeText(value)
  const normalizedCustomerNumber = normalizeText(customerNumber)
  if (
    !normalized ||
    normalized === normalizedCustomerNumber ||
    /^DX-\d+$/i.test(normalized)
  ) return null
  return normalized
}

export function stableExternalCustomerId(identity: OpsPortalIdentity): string | null {
  return normalizeStableExternalCustomerId(
    identity.externalCustomerId,
    identity.customerNumber,
  )
}

export function portalHeaders(identity: OpsPortalIdentity): Headers {
  const headers = new Headers();
  const externalCustomerId = stableExternalCustomerId(identity);

  headers.set("x-gridex-customer-portal-user-id", identity.userId);
  headers.set("x-gridex-auth-user-id", identity.userId);

  if (externalCustomerId) headers.set("x-gridex-external-customer-id", externalCustomerId);
  if (identity.customerNumber) headers.set("x-gridex-customer-number", identity.customerNumber);
  if (identity.email) headers.set("x-gridex-customer-email", identity.email);

  return headers;
}

export function portalIdentityPayload(identity: OpsPortalIdentity): Record<string, string> {
  const email = normalizeText(identity.email)?.toLowerCase() ?? null;
  const customerNumber = normalizeText(identity.customerNumber);
  const externalCustomerId = stableExternalCustomerId(identity);
  return {
    ...(email ? { email } : {}),
    ...(customerNumber ? { customer_number: customerNumber } : {}),
    ...(externalCustomerId ? { external_customer_id: externalCustomerId } : {}),
  };
}

export function customerSyncIdentityPayload(identity: OpsPortalIdentity): Record<string, string> {
  return {
    ...portalIdentityPayload(identity),
    authenticated_user_reference: identity.userId,
  }
}

export async function opsCustomerFetch(
  path: string,
  identity: OpsPortalIdentity,
  init?: RequestInit,
): Promise<unknown> {
  const headers = new Headers(init?.headers)
  portalHeaders(identity).forEach((value, key) => headers.set(key, value))
  const requestInit = { ...init, headers }
  const method = (requestInit.method ?? 'GET').toLowerCase() as
    | 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'
  if (!hasCustomerPortalOperation(path, method)) {
    throw new OpsError('Customer Portal-anropet saknar ett incheckat OpenAPI-kontrakt.', 500, {
      code: 'openapi_operation_missing',
      endpoint: path.split('?', 1)[0],
      method: method.toUpperCase(),
      retryable: false,
    })
  }
  assertCustomerPortalOperationRequest(path, method, jsonRequestBody(requestInit), headers)
  const response = await opsRequest(path, requestInit)
  observeRuntimeSchemaValidation({
    endpoint: path.split('?', 1)[0],
    schema: 'customer-portal-operation-response',
    validate: () => assertCustomerPortalOperationResponse(path, method, response.status, response.payload),
  })
  return response.payload
}

export type OpsCustomerReadResource =
  | "me"
  | "contracts"
  | "sites"
  | "invoices"
  | "documents"
  | "legal-acceptances"
  | "powers-of-attorney"
  | "events"
  | "metering-values"
  | "notifications";

export const OPS_CUSTOMER_READ_PATHS: Readonly<Record<OpsCustomerReadResource, string>> = {
  me: "/api/v1/customer/me",
  contracts: "/api/v1/customer/contracts",
  sites: "/api/v1/customer/sites",
  invoices: "/api/v1/customer/invoices",
  documents: "/api/v1/customer/documents",
  "legal-acceptances": "/api/v1/customer/legal-acceptances",
  "powers-of-attorney": "/api/v1/customer/powers-of-attorney",
  events: "/api/v1/customer/events",
  "metering-values": "/api/v1/customer/metering-values",
  notifications: "/api/v1/customer/notifications",
};

/**
 * Executes one canonical customer read. This intentionally never calls portal-bundle:
 * granular BFF routes must preserve upstream authorization, status and entity identity.
 */
export async function fetchOpsCustomerResource(
  identity: OpsPortalIdentity,
  resource: OpsCustomerReadResource,
  opaqueId?: string | null,
): Promise<unknown> {
  const basePath = OPS_CUSTOMER_READ_PATHS[resource];
  if (opaqueId !== undefined && opaqueId !== null) {
    const id = opaqueId.trim();
    if (resource !== "invoices" || !id || id.length > 240 || /[/\\?#]/.test(id)) {
      throw new OpsError("Ogiltigt canonicalt OPS-resurs-id.", 400, {
        code: "invalid_ops_resource_id",
        resource,
      });
    }
    return opsCustomerFetch(`${basePath}/${encodeURIComponent(id)}`, identity);
  }
  return opsCustomerFetch(basePath, identity);
}

export function rowsAsObjects(payload: unknown): Record<string, unknown>[] {
  return extractRows(payload).filter((item): item is Record<string, unknown> =>
    Boolean(item && typeof item === "object" && !Array.isArray(item)),
  );
}

export function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object" && !Array.isArray(item)),
      )
    : [];
}

export function nestedArray(row: Record<string, unknown>, keys: string[]): Record<string, unknown>[] {
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value)) return objectArray(value);
  }
  return [];
}

export function normalizePortalBundle(payload: unknown): OpsPortalBundle {
  const root = extractObject(payload);
  const data = recordValue(root.data) ?? root;
  const profile = recordValue(data.profile);

  return {
    profile,
    customerStatus:
      recordValue(data.customer_status),
    dataQuality:
      recordValue(data.data_quality),
    contracts: nestedArray(data, ["contracts"]),
    sites: nestedArray(data, ["sites"]),
    invoices: nestedArray(data, ["invoices"]),
    documents: nestedArray(data, ["documents"]),
    legalAcceptances: nestedArray(data, ["legal_acceptances"]),
    powersOfAttorney: nestedArray(data, ["powers_of_attorney"]),
    switchStatus: recordValue(data.switch_status),
    events: nestedArray(data, ["events"]),
    meteringValues: nestedArray(data, ["metering_values"]),
    notifications: nestedArray(data, ["notifications"]),
  };
}

export function opsErrorCodeValue(error: OpsError): string | null {
  const details = recordValue(error.details);
  const nested = recordValue(details?.error);
  return normalizeText(nested?.code ?? details?.code);
}

export async function fetchOpsCustomerPortalBundle(
  identity: OpsPortalIdentity,
): Promise<OpsPortalBundle> {
  return normalizePortalBundle(
    await opsCustomerFetch("/api/v1/customer/portal-bundle", identity, {
      method: "POST",
      body: JSON.stringify(portalIdentityPayload(identity)),
    }),
  );
}

export async function markOpsCustomerNotificationsRead(
  identity: OpsPortalIdentity,
  input: { notificationIds: string[]; operationId: string },
): Promise<void> {
  const ids = [...new Set(input.notificationIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    throw new OpsError("Minst en notis måste anges.", 400, {
      code: "validation_error",
      field: "notification_ids",
    });
  }
  const headers = portalHeaders(identity);
  headers.set(
    "Idempotency-Key",
    `notification-read:${identity.userId}:${input.operationId}`,
  );

  await opsCustomerFetch("/api/v1/customer/notifications/read", identity, {
    method: "POST",
    headers,
    body: JSON.stringify({ notification_ids: ids }),
  });
}

export function normalizeWarnings(row: Record<string, unknown>): string[] {
  const warnings = row.warnings;
  return Array.isArray(warnings) ? warnings.map(String).filter(Boolean) : [];
}

export function responseObject(payload: unknown): Record<string, unknown> {
  const row = extractObject(payload);
  return row && typeof row === "object" ? row : {};
}

export async function submitOpsCustomerSync(
  input: OpsCustomerSyncInput,
): Promise<OpsCustomerSyncResult> {
  const headers = portalHeaders(input.identity);
  const body = {
    ...customerSyncIdentityPayload(input.identity),
    ...(input.facilityData?.length ? { facility_data: input.facilityData } : {}),
    ...(input.profile ? { profile: input.profile } : {}),
    ...(input.powerOfAttorney ? { power_of_attorney: input.powerOfAttorney } : {}),
    ...(input.legalAcceptances?.length ? { legal_acceptances: input.legalAcceptances } : {}),
    ...(input.documents?.length ? { documents: input.documents } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  const operationId =
    normalizeText(input.idempotencyKey) ??
    canonicalSha256({ scope: 'customer_sync', user: input.identity.userId, body });
  headers.set(
    "Idempotency-Key",
    `customer-sync:${input.identity.userId}:${operationId}`,
  );

  const payload = await opsCustomerFetch("/api/v1/customer/sync", input.identity, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const row = responseObject(payload);
  const data = recordValue(row.data);
  return {
    ok: data?.status === 'synced',
    status: data ? pickString(data, ['status']) : null,
    synced: data,
    warnings: data ? normalizeWarnings(data) : [],
    requestId: pickString(row, ['request_id']),
    correlationId: pickString(row, ['correlation_id']),
    contractSchemaVersion: pickString(row, ['contract_schema_version']),
    raw: row,
  };
}

export async function submitOpsCustomerPortalSync(
  input: {
    identity: OpsPortalIdentity;
    idempotencyKey: string;
    customerNumber?: string | null;
    externalCustomerId?: string | null;
    email?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<OpsCustomerSyncResult> {
  const headers = portalHeaders(input.identity);
  const customerNumber = normalizeText(input.customerNumber) ?? normalizeText(input.identity.customerNumber)
  const externalCustomerId = normalizeStableExternalCustomerId(
    input.externalCustomerId ?? input.identity.externalCustomerId,
    customerNumber,
  )
  if (!externalCustomerId) {
    throw new OpsError('Portal recovery kräver external_customer_id.', 400, {
      code: 'external_customer_id_required',
      field: 'external_customer_id',
      retryable: false,
    })
  }
  const body = {
    ...portalIdentityPayload(input.identity),
    external_customer_id: externalCustomerId,
    customer_portal_user_id: input.identity.userId,
    auth_user_id: input.identity.userId,
    ...(input.customerNumber ? { customer_number: input.customerNumber } : {}),
    ...(input.email ? { email: input.email } : {}),
    metadata: input.metadata ?? { source: "tenant_website_customer_portal_sync" },
  };
  headers.set(
    "Idempotency-Key",
    `customer-portal-sync:${input.identity.userId}:${input.idempotencyKey}`,
  );
  const payload = await opsCustomerFetch("/api/v1/customer-portal/sync", input.identity, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const row = responseObject(payload);
  const data = recordValue(row.data);
  const status = data ? pickString(data, ['status']) : null;
  return {
    ok: status === 'linked' || (status === 'pending_review' && data?.access_granted === true),
    status,
    synced: data,
    warnings: data ? normalizeWarnings(data) : [],
    requestId: pickString(row, ['request_id']),
    correlationId: pickString(row, ['correlation_id']),
    contractSchemaVersion: pickString(row, ['contract_schema_version']),
    raw: row,
  };
}

export function customerWriteIdempotencyKey(
  scope: string,
  input: { identity: OpsPortalIdentity; idempotencyKey?: string | null },
  body: Record<string, unknown>,
): string {
  const value =
    normalizeText(input.idempotencyKey) ??
    canonicalSha256({ scope, user: input.identity.userId, body });
  return `${scope}:${input.identity.userId}:${value}`;
}

export function mapCustomerWriteResult(payload: unknown): OpsCustomerWriteResult {
  const row = responseObject(payload);
  const data = recordValue(row.data);
  const status = data ? pickString(data, ['status']) : null;
  return {
    ok: Boolean(data),
    status,
    data,
    warnings: data ? normalizeWarnings(data) : [],
    requestId: pickString(row, ['request_id']),
    correlationId: pickString(row, ['correlation_id']),
    contractSchemaVersion: pickString(row, ['contract_schema_version']),
    raw: row,
  };
}

export async function submitOpsCustomerProfileUpdate(
  input: OpsCustomerProfileUpdateInput,
): Promise<OpsCustomerWriteResult> {
  const headers = portalHeaders(input.identity);
  const body = {
    ...portalIdentityPayload(input.identity),
    profile: input.profile,
    metadata: input.metadata ?? {},
  };

  headers.set("Idempotency-Key", customerWriteIdempotencyKey("profile-update", input, body));

  const payload = await opsCustomerFetch("/api/v1/customer/profile-update", input.identity, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return mapCustomerWriteResult(payload);
}

export async function submitOpsCustomerMoveOut(
  input: OpsCustomerMoveOutInput,
): Promise<OpsCustomerWriteResult> {
  const headers = portalHeaders(input.identity);
  const requestedMoveOutDate = normalizeText(
    input.moveOut.requested_move_out_date ?? input.moveOut.move_out_date,
  );
  if (!requestedMoveOutDate || !isStrictCalendarDate(requestedMoveOutDate)) {
    throw new OpsError('Utflyttningsdatum är inte ett verkligt kalenderdatum.', 400, {
      code: 'requested_move_out_date_invalid',
      field: 'requested_move_out_date',
      retryable: false,
    });
  }
  const reason = normalizeText(input.moveOut.reason);
  const allowedMoveOutFields = new Set([
    'customer_contract_reference',
    'facility_reference',
    'new_address',
    'contact_details',
  ]);
  const moveOutData = Object.fromEntries(
    Object.entries(input.moveOut).filter(
      ([key, value]) => allowedMoveOutFields.has(key) && value !== undefined && value !== null,
    ),
  );
  const facilityReference = normalizeText(moveOutData.facility_reference);
  if (!facilityReference) {
    throw new OpsError('Anläggningsreferens saknas för utflyttningen.', 400, {
      code: 'facility_reference_required',
      field: 'facility_reference',
      retryable: false,
    });
  }
  const body = {
    ...customerSyncIdentityPayload(input.identity),
    ...moveOutData,
    facility_reference: facilityReference,
    requested_move_out_date: requestedMoveOutDate,
    ...(reason ? { reason } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  headers.set("Idempotency-Key", customerWriteIdempotencyKey("move-out", input, body));

  const payload = await opsCustomerFetch("/api/v1/customer/move-out", input.identity, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return mapCustomerWriteResult(payload);
}

export function createCustomerEventIdempotencyKey(
  identity: OpsPortalIdentity,
  event: {
    event_type: string;
    entity_type?: string | null;
    entity_id?: string | null;
    metadata?: Record<string, unknown>;
  },
): string {
  const bucket = Math.floor(Date.now() / 60_000);
  return canonicalSha256({
    scope: 'customer_event',
    user: identity.userId,
    customer_number: identity.customerNumber ?? null,
    external_customer_id: stableExternalCustomerId(identity),
    event_type: event.event_type,
    entity_type: event.entity_type ?? null,
    entity_id: event.entity_id ?? null,
    metadata: event.metadata ?? {},
    bucket,
  });
}

export async function sendOpsCustomerEvent(
  identity: OpsPortalIdentity,
  event: {
    event_type: string;
    source: "gridex_website";
    entity_type?: string | null;
    entity_id?: string | null;
    idempotency_key?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<OpsCustomerEventResult> {
  if (!isOpsCustomerEventType(event.event_type)) {
    throw new OpsError("Kundhändelsen stöds inte av OPS-kontraktet.", 400, {
      event_type: event.event_type,
    });
  }

  const headers = portalHeaders(identity);
  const operationId =
    normalizeText(event.idempotency_key) ??
    createCustomerEventIdempotencyKey(identity, event);
  headers.set(
    "Idempotency-Key",
    `customer-event:${identity.userId}:${operationId}`,
  );

  const payload = await opsFetch("/api/v1/website/customer-events", {
    method: "POST",
    headers,
    body: JSON.stringify({
      event_type: event.event_type,
      event_reference: operationId,
      occurred_at: new Date().toISOString(),
      customer: {
        ...portalIdentityPayload(identity),
        customer_portal_user_id: identity.userId,
        auth_user_id: identity.userId,
      },
      subject: {
        type: normalizeText(event.entity_type) ?? 'customer',
        ...(normalizeText(event.entity_id)
          ? { reference: normalizeText(event.entity_id)! }
          : {}),
      },
      data: event.metadata ?? {},
    }),
  });
  const root = responseObject(payload)
  const data = recordValue(root.data)
  const status = normalizeText(data?.status)
  const eventReference = normalizeText(data?.event_reference)
  const eventType = normalizeText(data?.event_type)
  const requestId = normalizeText(root.request_id)
  const contractSchemaVersion = normalizeText(root.contract_schema_version)
  if (
    !data ||
    status !== 'accepted' ||
    !eventReference ||
    eventReference !== operationId ||
    !eventType ||
    eventType !== event.event_type ||
    !requestId ||
    contractSchemaVersion !== GRIDEX_WEBSITE_API_CONTRACT_VERSION
  ) {
    throw new OpsError('OPS returnerade ett ogiltigt kundhändelsesvar.', 502, {
      code: 'ops_customer_event_response_invalid',
      endpoint: '/api/v1/website/customer-events',
      request_id: requestId,
      expected_event_reference: operationId,
      received_event_reference: eventReference,
      expected_event_type: event.event_type,
      received_event_type: eventType,
      retryable: false,
    })
  }
  return {
    eventId: normalizeText(data.event_id),
    customerEventId: normalizeText(data.customer_event_id),
    eventReference,
    eventType,
    customerReference: normalizeText(data.customer_reference),
    status: 'accepted',
    requestId,
    correlationId: normalizeText(root.correlation_id),
    contractSchemaVersion,
  }
}

export async function fetchOpsTenantEvents(): Promise<Record<string, unknown>[]> {
  // The current Customer Portal OpenAPI does not define query filters for this endpoint.
  // Do not silently send legacy parameters that the machine contract cannot validate.
  const payload = await opsFetch('/api/v1/events')
  return rowsAsObjects(payload)
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const pepper =
    env("GRIDEX_WEBSITE_HASH_PEPPER") ?? env("PII_HASH_PEPPER") ?? "";
  return createHash("sha256").update(`${pepper}:${ip}`).digest("hex");
}

export function createApplicationIdempotencyKey(parts: string[]): string {
  return createHash("sha256")
    .update(parts.map((p) => p.trim().toLowerCase()).join("|"))
    .digest("hex");
}

export function createExternalCustomerId(parts: string[]): string {
  const prefix = env("GRIDEX_WEBSITE_CUSTOMER_PREFIX") ?? "GRIDEX-WEB-CUSTOMER";
  const stable = parts
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join("|");
  if (!stable) throw new OpsError("Stable customer identity input is missing.", 422);
  const pepper = env("GRIDEX_WEBSITE_HASH_PEPPER") ?? env("PII_HASH_PEPPER");
  if (!pepper) {
    throw new OpsError("Website customer identity hash secret is not configured.", 503);
  }
  const digest = createHash("sha256")
    .update(`${pepper}:${stable}`)
    .digest("hex")
    .slice(0, 24);
  return `${prefix}-${digest}`;
}

export function createExternalApplicationId(submissionAttemptId?: string | null): string {
  const prefix = env("GRIDEX_WEBSITE_APPLICATION_PREFIX") ?? "GRIDEX-WEB";
  const stableAttempt = normalizeText(submissionAttemptId);
  if (stableAttempt) return `${prefix}-${stableAttempt}`;
  return `${prefix}-${stockholmCalendarDate().replace(/-/g, "")}-${randomUUID()}`;
}

export function isTransientOpsError(error: unknown): boolean {
  if (isOpsError(error)) {
    // Contract, tenant and response-schema failures are explicitly non-retryable
    // even when represented as a 5xx. Never hide them behind a local portal fallback.
    return error.retryable && (
      error.status === 408 ||
      error.status === 425 ||
      error.status === 429 ||
      error.status >= 500
    );
  }
  // Native fetch reports transport/DNS/TLS failures as TypeError. Abort and
  // timeout errors are also retryable. Unknown application/programming errors
  // must not be hidden behind stale local fallback or an outbox success.
  if (error instanceof TypeError) return true;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return true;
  }
  return false;
}