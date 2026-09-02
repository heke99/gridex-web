import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { OpsWebsiteEnergyResolution } from '@/lib/ops/client'

const OPS_REFERENCE_UNIQUE_CONSTRAINT = 'website_price_area_resolutions_ops_reference_uidx'
const AUDIT_MATCH_FIELDS = [
  'address_fingerprint',
  'postal_code',
  'price_area_code',
  'grid_area_code',
  'resolver_version',
  'ops_resolution_id',
  'ops_resolution_reference',
  'ops_resolution_payload_sha256',
  'ops_valid_until',
] as const

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('Website energy-area audit storage is not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function fingerprint(input: { postalCode: string; city: string; address: string }): string {
  const pepper = process.env.GRIDEX_WEBSITE_HASH_PEPPER?.trim() || process.env.PII_HASH_PEPPER?.trim()
  if (!pepper) throw new Error('Website address hash secret is not configured.')
  return createHash('sha256')
    .update(`${pepper}:${input.postalCode.replace(/\s+/g, '')}|${input.city.trim().toLowerCase()}|${input.address.trim().toLowerCase()}`)
    .digest('hex')
}

export function isOpsReferenceUniqueViolation(error: {
  code?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
} | null | undefined): boolean {
  if (!error || error.code !== '23505') return false
  const diagnostic = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()
  return diagnostic.includes(OPS_REFERENCE_UNIQUE_CONSTRAINT) || diagnostic.includes('ops_resolution_reference')
}

export function energyAreaAuditRetryMatches(
  existing: Record<string, unknown> | null | undefined,
  expected: Record<string, unknown>,
): boolean {
  if (!existing) return false
  return AUDIT_MATCH_FIELDS.every((field) => existing[field] === expected[field])
}

export async function persistOpsEnergyAreaResolution(input: {
  resolution: OpsWebsiteEnergyResolution
  location: { postalCode: string; city: string; address: string }
}): Promise<void> {
  const validUntil = input.resolution.valid_until
  if (!validUntil || !Number.isFinite(Date.parse(validUntil))) throw new Error('OPS energy-area resolution has no valid_until.')
  const assurance = input.resolution.price_area_assurance
  const payloadHash = createHash('sha256').update(JSON.stringify(input.resolution.raw ?? input.resolution)).digest('hex')
  const record = {
    address_fingerprint: fingerprint(input.location),
    postal_code: input.location.postalCode.replace(/\s+/g, ''),
    price_area_code: input.resolution.price_area_code,
    grid_area_code: input.resolution.grid_area_code ?? null,
    // The public resolver contract exposes a canonical grid-area code and owner name,
    // not an internal grid-owner UUID. Never infer or persist an identifier here.
    grid_owner_id: null,
    grid_owner_name: input.resolution.grid_owner_name ?? null,
    confidence: assurance.confidence,
    assurance_level: assurance.status,
    assurance_source: assurance.source,
    assurance_candidate_count: assurance.candidate_count,
    assurance_unique_price_area_count: assurance.unique_price_area_count,
    assurance_source_version: assurance.source_version,
    assurance_evidence: assurance.evidence,
    source: assurance.source ?? input.resolution.source?.provider ?? input.resolution.source?.resolved_by ?? 'ops',
    source_chain: input.resolution.source_chain ?? [],
    resolver_version: input.resolution.resolver_version ?? `ops-${input.resolution.contract_version}`,
    resolved_at: input.resolution.resolved_at ?? new Date().toISOString(),
    valid_until: validUntil,
    ops_resolution_id: input.resolution.resolution_id ?? null,
    ops_resolution_reference: input.resolution.resolution_reference ?? input.resolution.resolution_id ?? null,
    ops_resolution_status: input.resolution.resolution_status ?? input.resolution.status,
    ops_resolution_payload_sha256: payloadHash,
    ops_valid_until: validUntil,
  }

  const client = serviceClient()
  const { error } = await client.from('website_price_area_resolutions').insert(record)
  if (!error) return

  if (!record.ops_resolution_reference || !isOpsReferenceUniqueViolation(error)) {
    throw new Error(`Website energy-area audit storage failed: ${error.message}`)
  }

  // OPS resolution references are immutable audit identities. A repeated website request may
  // legitimately receive the same canonical resolution, including under concurrent retries.
  // Verify the existing row instead of weakening the unique constraint or silently upserting.
  const { data: existing, error: lookupError } = await client
    .from('website_price_area_resolutions')
    .select('address_fingerprint,postal_code,price_area_code,grid_area_code,resolver_version,ops_resolution_id,ops_resolution_reference,ops_resolution_payload_sha256,ops_valid_until')
    .eq('ops_resolution_reference', record.ops_resolution_reference)
    .maybeSingle()

  if (lookupError) {
    throw new Error(`Website energy-area audit retry verification failed: ${lookupError.message}`)
  }
  if (!energyAreaAuditRetryMatches(existing, record)) {
    throw new Error('Website energy-area audit reference collision detected; existing audit row does not match the OPS resolution.')
  }
}
