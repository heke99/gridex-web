import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { OpsWebsiteEnergyResolution } from '@/lib/ops/client'

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

export async function persistOpsEnergyAreaResolution(input: {
  resolution: OpsWebsiteEnergyResolution
  location: { postalCode: string; city: string; address: string }
}): Promise<void> {
  const validUntil = input.resolution.valid_until
  if (!validUntil || !Number.isFinite(Date.parse(validUntil))) throw new Error('OPS energy-area resolution has no valid_until.')
  const confidence = input.resolution.confidence
  const assuranceLevel = confidence == null
    ? 'verified'
    : confidence >= 0.95
      ? 'sufficient_for_application'
      : confidence >= 0.75
        ? 'verified'
        : 'unresolved'
  const payloadHash = createHash('sha256').update(JSON.stringify(input.resolution.raw ?? input.resolution)).digest('hex')
  const { error } = await serviceClient().from('website_price_area_resolutions').insert({
    address_fingerprint: fingerprint(input.location),
    postal_code: input.location.postalCode.replace(/\s+/g, ''),
    price_area_code: input.resolution.price_area_code,
    grid_area_code: input.resolution.grid_area_code ?? null,
    grid_owner_id: input.resolution.grid_owner_id ?? null,
    grid_owner_name: input.resolution.grid_owner_name ?? null,
    confidence: input.resolution.confidence ?? null,
    assurance_level: assuranceLevel,
    source: input.resolution.source ?? 'ops',
    source_chain: input.resolution.source_chain ?? [],
    resolver_version: 'ops-2026-07-23.1',
    resolved_at: input.resolution.resolved_at ?? new Date().toISOString(),
    valid_until: validUntil,
    ops_resolution_reference: input.resolution.resolution_reference ?? null,
    ops_resolution_status: input.resolution.resolution_status ?? input.resolution.status,
    ops_resolution_payload_sha256: payloadHash,
    ops_valid_until: validUntil,
  })
  if (error) throw new Error(`Website energy-area audit storage failed: ${error.message}`)
}
