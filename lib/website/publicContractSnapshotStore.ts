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

type SnapshotReadExpectations = {
  tenantReference: string
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

  const publicationRevision = row.publication_revision === null
    ? null
    : finiteInteger(row.publication_revision)
  if (row.publication_revision !== null && publicationRevision === null) return null
  if (row.tenant_reference !== expected.tenantReference) return null
  if (row.contract_version !== expected.contractVersion) return null
  if (row.parser_version !== expected.parserVersion) return null
  if (row.schema_sha256 !== expected.schemaSha256) return null
  if (Date.now() - Date.parse(row.fetched_at) > maxSnapshotAgeMs(expected.maxAgeMs)) return null

  return {
    contracts: row.contracts as OpsPublicContractsSnapshot['contracts'],
    blocked_contracts: row.blocked_contracts as OpsPublicContractsSnapshot['blocked_contracts'],
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
