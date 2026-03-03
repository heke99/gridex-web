import type { SupabaseClient } from '@supabase/supabase-js'
import type { PublishedPricingVersion } from './types'
import { tryQuery } from './db'
import { looksLikeMissingColumn } from './schema'

export type PricingVersionSelection =
  | { mode?: 'published_now'; nowIso?: string }
  | { mode: 'published_any' }
  | { mode: 'by_id'; id: string }
  | { mode: 'by_version_number'; versionNumber: number }
  | { mode: 'draft_latest' }

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

  // -------- PROBES (NULL SAFE) --------

  const statusProbe = await tryQuery<{ status: string | null } | null>(
    opts.supabase
      .from('contract_pricing_versions')
      .select('status')
      .eq('contract_id', opts.contractId)
      .limit(1)
      .maybeSingle()
  )

  const versionsHasStatus = !looksLikeMissingColumn(
    statusProbe.error,
    'status'
  )

  const isPubProbe = await tryQuery<{ is_published: boolean | null } | null>(
    opts.supabase
      .from('contract_pricing_versions')
      .select('is_published')
      .eq('contract_id', opts.contractId)
      .limit(1)
      .maybeSingle()
  )

  const versionsHasIsPublished = !looksLikeMissingColumn(
    isPubProbe.error,
    'is_published'
  )

  const selectCommon =
    'id,contract_id,version_number,valid_from,status,is_published'

  // -------- MODE: by_id --------

  if (mode === 'by_id') {
    const id = (opts.selection as { mode: 'by_id'; id: string }).id

    const { data } = await tryQuery<PublishedPricingVersion | null>(
      opts.supabase
        .from('contract_pricing_versions')
        .select(selectCommon)
        .eq('id', id)
        .eq('contract_id', opts.contractId)
        .maybeSingle()
    )

    return {
      version: data ?? null,
      selectionMode: mode,
      probes: { versionsHasStatus, versionsHasIsPublished },
    }
  }

  // -------- MODE: by_version_number --------

  if (mode === 'by_version_number') {
    const versionNumber = (
      opts.selection as { mode: 'by_version_number'; versionNumber: number }
    ).versionNumber

    const { data } = await tryQuery<PublishedPricingVersion | null>(
      opts.supabase
        .from('contract_pricing_versions')
        .select(selectCommon)
        .eq('contract_id', opts.contractId)
        .eq('version_number', versionNumber)
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle()
    )

    return {
      version: data ?? null,
      selectionMode: mode,
      probes: { versionsHasStatus, versionsHasIsPublished },
    }
  }

  // -------- MODE: draft_latest --------

  if (mode === 'draft_latest') {
    if (versionsHasStatus) {
      const { data } = await tryQuery<PublishedPricingVersion | null>(
        opts.supabase
          .from('contract_pricing_versions')
          .select(selectCommon)
          .eq('contract_id', opts.contractId)
          .eq('status', 'draft')
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle()
      )

      return {
        version: data ?? null,
        selectionMode: mode,
        probes: { versionsHasStatus, versionsHasIsPublished },
      }
    }

    if (versionsHasIsPublished) {
      const { data } = await tryQuery<PublishedPricingVersion | null>(
        opts.supabase
          .from('contract_pricing_versions')
          .select(selectCommon)
          .eq('contract_id', opts.contractId)
          .eq('is_published', false)
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle()
      )

      return {
        version: data ?? null,
        selectionMode: mode,
        probes: { versionsHasStatus, versionsHasIsPublished },
      }
    }

    return {
      version: null,
      selectionMode: mode,
      probes: { versionsHasStatus, versionsHasIsPublished },
    }
  }

  // -------- MODE: published_any --------

  if (mode === 'published_any') {
    if (versionsHasStatus) {
      const { data } = await tryQuery<PublishedPricingVersion | null>(
        opts.supabase
          .from('contract_pricing_versions')
          .select(selectCommon)
          .eq('contract_id', opts.contractId)
          .eq('status', 'published')
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle()
      )

      return {
        version: data ?? null,
        selectionMode: mode,
        probes: { versionsHasStatus, versionsHasIsPublished },
      }
    }

    const { data } = await tryQuery<PublishedPricingVersion | null>(
      opts.supabase
        .from('contract_pricing_versions')
        .select(selectCommon)
        .eq('contract_id', opts.contractId)
        .eq('is_published', true)
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle()
    )

    return {
      version: data ?? null,
      selectionMode: mode,
      probes: { versionsHasStatus, versionsHasIsPublished },
    }
  }

  // -------- MODE: published_now --------

  const nowIso =
    (opts.selection as { mode?: 'published_now'; nowIso?: string } | undefined)
      ?.nowIso ?? new Date().toISOString()

  if (versionsHasStatus) {
    const { data } = await tryQuery<PublishedPricingVersion | null>(
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

    return {
      version: data ?? null,
      selectionMode: 'published_now',
      probes: { versionsHasStatus, versionsHasIsPublished },
    }
  }

  const { data } = await tryQuery<PublishedPricingVersion | null>(
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

  return {
    version: data ?? null,
    selectionMode: 'published_now',
    probes: { versionsHasStatus, versionsHasIsPublished },
  }
}