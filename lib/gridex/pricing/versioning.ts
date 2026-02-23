// lib/gridex/pricing/versioning.ts
// Enterprise version selection policy for pricing engine (Admin Preview + API).
// Supports: published now, any published, explicit version id, version_number, and draft/latest.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PublishedPricingVersion } from './types'
import { tryQuery } from './db'
import { looksLikeMissingColumn } from './schema'

export type PricingVersionSelection =
  | { mode?: 'published_now'; nowIso?: string }
  | { mode: 'published_any' }
  | { mode: 'by_id'; id: string }
  | { mode: 'by_version_number'; versionNumber: number }
  | { mode: 'draft_latest' } // latest where status='draft' (or is_published=false) when available

export type PricingVersionSelectionMode =
  | 'published_now'
  | 'published_any'
  | 'by_id'
  | 'by_version_number'
  | 'draft_latest'

function coerceMode(sel?: PricingVersionSelection): PricingVersionSelectionMode {
  if (!sel?.mode) return 'published_now'
  return sel.mode
}

export async function resolvePricingVersionForContract(opts: {
  supabase: SupabaseClient
  contractId: string
  selection?: PricingVersionSelection
}): Promise<{
  version: PublishedPricingVersion | null
  selectionMode: PricingVersionSelectionMode
  probes: { versionsHasStatus: boolean; versionsHasIsPublished: boolean }
}> {
  const mode = coerceMode(opts.selection)

  // Probe availability (used in diagnostics)
  const statusProbe = await tryQuery<{ status: string | null }>(
    opts.supabase
      .from('contract_pricing_versions')
      .select('status')
      .eq('contract_id', opts.contractId)
      .limit(1)
      .maybeSingle()
  )

  const versionsHasStatus = !looksLikeMissingColumn(statusProbe.error, 'status')

  const isPubProbe = await tryQuery<{ is_published: boolean | null }>(
    opts.supabase
      .from('contract_pricing_versions')
      .select('is_published')
      .eq('contract_id', opts.contractId)
      .limit(1)
      .maybeSingle()
  )

  const versionsHasIsPublished = !looksLikeMissingColumn(isPubProbe.error, 'is_published')

  // Helpers
  const selectCommon = 'id,contract_id,version_number,valid_from,status,is_published'

  if (mode === 'by_id') {
    const id = (opts.selection as { mode: 'by_id'; id: string }).id
    const { data } = await tryQuery<PublishedPricingVersion>(
      opts.supabase
        .from('contract_pricing_versions')
        .select(selectCommon)
        .eq('id', id)
        .eq('contract_id', opts.contractId)
        .maybeSingle()
    )
    return { version: data, selectionMode: mode, probes: { versionsHasStatus, versionsHasIsPublished } }
  }

  if (mode === 'by_version_number') {
    const versionNumber = (opts.selection as { mode: 'by_version_number'; versionNumber: number }).versionNumber
    const { data } = await tryQuery<PublishedPricingVersion>(
      opts.supabase
        .from('contract_pricing_versions')
        .select(selectCommon)
        .eq('contract_id', opts.contractId)
        .eq('version_number', versionNumber)
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle()
    )
    return { version: data, selectionMode: mode, probes: { versionsHasStatus, versionsHasIsPublished } }
  }

  if (mode === 'draft_latest') {
    // Prefer status='draft' if present; otherwise is_published=false if present.
    if (versionsHasStatus) {
      const { data } = await tryQuery<PublishedPricingVersion>(
        opts.supabase
          .from('contract_pricing_versions')
          .select(selectCommon)
          .eq('contract_id', opts.contractId)
          .eq('status', 'draft')
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle()
      )
      return { version: data, selectionMode: mode, probes: { versionsHasStatus, versionsHasIsPublished } }
    }

    if (versionsHasIsPublished) {
      const { data } = await tryQuery<PublishedPricingVersion>(
        opts.supabase
          .from('contract_pricing_versions')
          .select(selectCommon)
          .eq('contract_id', opts.contractId)
          .eq('is_published', false)
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle()
      )
      return { version: data, selectionMode: mode, probes: { versionsHasStatus, versionsHasIsPublished } }
    }

    // No known draft semantics.
    return { version: null, selectionMode: mode, probes: { versionsHasStatus, versionsHasIsPublished } }
  }

  if (mode === 'published_any') {
    // Prefer status='published', otherwise is_published=true.
    if (versionsHasStatus) {
      const { data } = await tryQuery<PublishedPricingVersion>(
        opts.supabase
          .from('contract_pricing_versions')
          .select(selectCommon)
          .eq('contract_id', opts.contractId)
          .eq('status', 'published')
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle()
      )
      return { version: data, selectionMode: mode, probes: { versionsHasStatus, versionsHasIsPublished } }
    }

    const { data } = await tryQuery<PublishedPricingVersion>(
      opts.supabase
        .from('contract_pricing_versions')
        .select(selectCommon)
        .eq('contract_id', opts.contractId)
        .eq('is_published', true)
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle()
    )
    return { version: data, selectionMode: mode, probes: { versionsHasStatus, versionsHasIsPublished } }
  }

  // published_now (default)
  const nowIso =
    (opts.selection as { mode?: 'published_now'; nowIso?: string } | undefined)?.nowIso ?? new Date().toISOString()

  if (versionsHasStatus) {
    const { data } = await tryQuery<PublishedPricingVersion>(
      opts.supabase
        .from('contract_pricing_versions')
        .select(selectCommon)
        .eq('contract_id', opts.contractId)
        .eq('status', 'published')
        .lte('valid_from', nowIso)
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle()
    )
    return { version: data, selectionMode: 'published_now', probes: { versionsHasStatus, versionsHasIsPublished } }
  }

  const { data } = await tryQuery<PublishedPricingVersion>(
    opts.supabase
      .from('contract_pricing_versions')
      .select(selectCommon)
      .eq('contract_id', opts.contractId)
      .eq('is_published', true)
      .lte('valid_from', nowIso)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()
  )

  return { version: data, selectionMode: 'published_now', probes: { versionsHasStatus, versionsHasIsPublished } }
}