import type { OpsPublicContractsSnapshot } from '@/lib/ops/client'
import { supabaseService } from '@/lib/supabase/service'

type SnapshotWriteResult = {
  result: string
  stored: boolean
  empty_authorized: boolean
  stored_revision: number | null
}

type StoredSnapshotRow = {
  snapshot: unknown
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function finiteInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : null
  }
  return null
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : value === null ? null : null
}

const EMPTY_FEED_REASONS = new Set([
  'no_canonical_publications',
  'canonical_unpublished_or_archived',
  'publication_validity_ended',
  'canonical_no_visible_contracts',
])
const EMPTY_FEED_AUTHORIZATION_KEYS = new Set([
  'authorized',
  'reason',
  'publication_revision',
  'canonical_source',
  'affected_offer_references',
  'blockers',
])

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null
  return [...value] as string[]
}

function parseEmptyFeedAuthorization(
  value: unknown,
  publicationRevision: number,
): NonNullable<OpsPublicContractsSnapshot['empty_feed_authorization']> | null {
  const authorization = recordValue(value)
  if (!authorization) return null
  const reason = typeof authorization.reason === 'string' ? authorization.reason : null
  const authorizationRevision = finiteInteger(authorization.publication_revision)
  const affected = stringArray(authorization.affected_offer_references)
  const blockers = stringArray(authorization.blockers)
  if (
    authorization.authorized !== true ||
    !reason ||
    !EMPTY_FEED_REASONS.has(reason) ||
    authorizationRevision !== publicationRevision ||
    authorization.canonical_source !== 'canonical_public_contract_delivery_readiness_v' ||
    affected === null ||
    blockers === null ||
    Object.keys(authorization).some((key) => !EMPTY_FEED_AUTHORIZATION_KEYS.has(key))
  ) return null
  return {
    authorized: true,
    reason: reason as NonNullable<OpsPublicContractsSnapshot['empty_feed_authorization']>['reason'],
    publication_revision: authorizationRevision,
    canonical_source: 'canonical_public_contract_delivery_readiness_v',
    affected_offer_references: affected,
    blockers,
  }
}

type SnapshotReadExpectations = {
  tenantReference?: string | null
  contractVersion: string
  parserVersion: string
  schemaSha256: string
  maxAgeMs?: number
}

function maxSnapshotAgeMs(input?: number): number {
  if (typeof input === 'number' && Number.isFinite(input)) return Math.max(1_000, input)
  const configured = Number(process.env.GRIDEX_PUBLIC_CONTRACT_MAX_STALE_SECONDS ?? '900')
  const seconds = Number.isFinite(configured) ? Math.max(30, Math.min(86_400, configured)) : 900
  return seconds * 1_000
}

function parseStoredSnapshot(
  value: unknown,
  expected: SnapshotReadExpectations,
): OpsPublicContractsSnapshot | null {
  const row = recordValue(value)
  if (
    !row ||
    !Array.isArray(row.contracts) ||
    !Array.isArray(row.blocked_contracts) ||
    (row.feed_state !== 'contracts_present' && row.feed_state !== 'canonical_empty') ||
    !Array.isArray(row.warnings) ||
    !Array.isArray(row.compatibility_issues) ||
    typeof row.parser_version !== 'string' ||
    typeof row.schema_sha256 !== 'string' ||
    typeof row.tenant_reference !== 'string' ||
    typeof row.fetched_at !== 'string' ||
    !Number.isFinite(Date.parse(row.fetched_at)) ||
    typeof row.upstream_status !== 'number'
  ) {
    return null
  }

  const publicationRevision = finiteInteger(row.publication_revision)
  if (publicationRevision === null || publicationRevision < 0) return null
  const feedState = row.feed_state as OpsPublicContractsSnapshot['feed_state']
  const emptyAuthorization = feedState === 'canonical_empty'
    ? parseEmptyFeedAuthorization(row.empty_feed_authorization, publicationRevision)
    : null
  if (feedState === 'canonical_empty') {
    if (
      row.contracts.length !== 0 ||
      row.blocked_contracts.length !== 0 ||
      !emptyAuthorization
    ) return null
  } else if (row.contracts.length === 0 || row.empty_feed_authorization !== null) {
    return null
  }
  if (expected.tenantReference && row.tenant_reference !== expected.tenantReference) return null
  if (row.contract_version !== expected.contractVersion) return null
  if (row.parser_version !== expected.parserVersion) return null
  if (row.schema_sha256 !== expected.schemaSha256) return null
  if (Date.now() - Date.parse(row.fetched_at) > maxSnapshotAgeMs(expected.maxAgeMs)) return null

  return {
    contracts: row.contracts as OpsPublicContractsSnapshot['contracts'],
    blocked_contracts: row.blocked_contracts as OpsPublicContractsSnapshot['blocked_contracts'],
    feed_state: feedState,
    empty_feed_authorization: emptyAuthorization,
    warnings: row.warnings as OpsPublicContractsSnapshot['warnings'],
    compatibility_issues: row.compatibility_issues as OpsPublicContractsSnapshot['compatibility_issues'],
    parser_version: row.parser_version,
    schema_sha256: row.schema_sha256,
    etag: nullableString(row.etag),
    publication_revision: publicationRevision,
    tenant_reference: row.tenant_reference,
    contract_version: nullableString(row.contract_version),
    not_modified: true,
    fetched_at: row.fetched_at,
    source: 'cache',
    stale: false,
    stale_reason: null,
    upstream_status: row.upstream_status,
    upstream_request_id: nullableString(row.upstream_request_id),
    upstream_correlation_id: nullableString(row.upstream_correlation_id),
  }
}

export async function readWebsitePublicContractSnapshot(
  cacheKey: string,
  expected: SnapshotReadExpectations,
): Promise<OpsPublicContractsSnapshot | null> {
  const { data, error } = await supabaseService
    .from('website_public_contract_snapshots')
    .select('snapshot')
    .eq('cache_key', cacheKey)
    .maybeSingle<StoredSnapshotRow>()

  if (error) {
    throw new Error(`Website public-contract snapshot read failed: ${error.message}`)
  }
  if (!data) return null
  return parseStoredSnapshot(data.snapshot, expected)
}

export async function storeWebsitePublicContractSnapshot(input: {
  cacheKey: string
  customerType: string
  snapshot: OpsPublicContractsSnapshot
}): Promise<SnapshotWriteResult> {
  const acceptedCount = input.snapshot.contracts.length
  const blockedCount = input.snapshot.blocked_contracts.length
  const upstreamCount = acceptedCount + blockedCount
  const { data, error } = await supabaseService.rpc('store_website_public_contract_snapshot', {
    p_cache_key: input.cacheKey,
    p_tenant_reference: input.snapshot.tenant_reference,
    p_customer_type: input.customerType,
    p_publication_revision: input.snapshot.publication_revision,
    p_contract_version: input.snapshot.contract_version,
    p_parser_version: input.snapshot.parser_version,
    p_schema_sha256: input.snapshot.schema_sha256,
    p_etag: input.snapshot.etag,
    p_snapshot: input.snapshot,
    p_accepted_count: acceptedCount,
    p_blocked_count: blockedCount,
    p_upstream_count: upstreamCount,
    p_feed_state: input.snapshot.feed_state,
    p_empty_feed_authorization: input.snapshot.empty_feed_authorization,
    p_fetched_at: input.snapshot.fetched_at,
  })

  if (error) {
    throw new Error(`Website public-contract snapshot write failed: ${error.message}`)
  }

  const result = (Array.isArray(data) ? data[0] : data) as SnapshotWriteResult | null
  if (!result || typeof result.result !== 'string' || typeof result.stored !== 'boolean') {
    throw new Error('Website public-contract snapshot write returned an invalid result.')
  }
  return {
    result: result.result,
    stored: result.stored,
    empty_authorized: result.empty_authorized === true,
    stored_revision: finiteInteger(result.stored_revision),
  }
}


export async function inspectWebsitePublicContractSnapshotStore(
  tenantReference: string,
): Promise<{
  available: true
  snapshotCount: number
  latestPublicationRevision: number | null
  latestAcceptedCount: number | null
  latestUpdatedAt: string | null
}> {
  const query = supabaseService
    .from('website_public_contract_snapshots')
    .select('publication_revision,accepted_count,updated_at', { count: 'exact' })
    .eq('tenant_reference', tenantReference)
    .eq('channel', 'website')
    .order('publication_revision', { ascending: false, nullsFirst: false })
    .limit(1)
  const { data, error, count } = await query
  if (error) {
    throw new Error(`Website public-contract snapshot health check failed: ${error.message}`)
  }
  const latest = Array.isArray(data) && data.length > 0
    ? data[0] as Record<string, unknown>
    : null
  return {
    available: true,
    snapshotCount: typeof count === 'number' ? count : 0,
    latestPublicationRevision: finiteInteger(latest?.publication_revision),
    latestAcceptedCount: finiteInteger(latest?.accepted_count),
    latestUpdatedAt: nullableString(latest?.updated_at),
  }
}
