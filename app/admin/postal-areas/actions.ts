'use server'

import { revalidatePath } from 'next/cache'
import { requireGlobalAdminActionAccess } from '@/lib/admin/guards'
import { supabaseService } from '@/lib/supabase/service'

type PriceArea = 'SE1' | 'SE2' | 'SE3' | 'SE4'
type PostalMapping = { postal_code: string; price_area: PriceArea; source: 'admin' }
const AREAS: readonly string[] = ['SE1', 'SE2', 'SE3', 'SE4']

function normalizePostal(input: string): string {
  return input.replace(/\s/g, '').trim()
}

export async function upsertSingleAction(formData: FormData) {
  // Postal mappings are shared by the entire Web tenant, not a local company.
  await requireGlobalAdminActionAccess({ allOf: ['pricing.write'] })
  const postal = normalizePostal(String(formData.get('postal_code') ?? ''))
  const area = String(formData.get('price_area') ?? '')
  if (!/^\d{5}$/.test(postal)) throw new Error('Postnummer måste vara 5 siffror.')
  if (!AREAS.includes(area)) throw new Error('Ogiltigt elområde.')

  const { error } = await supabaseService.from('gridex_postal_code_price_area').upsert(
    { postal_code: postal, price_area: area, source: 'admin' },
    { onConflict: 'postal_code' },
  )
  if (error) throw new Error(error.message)
  revalidatePath('/admin/postal-areas')
}

export async function bulkPasteAction(formData: FormData) {
  await requireGlobalAdminActionAccess({ allOf: ['pricing.write'] })
  const raw = String(formData.get('bulk') ?? '').trim()
  if (!raw) throw new Error('Klistra in rader först.')
  const mappings = new Map<string, PostalMapping>()
  for (const line of raw.split('\n')) {
    const [postalInput, area] = line.trim().split(',').map((item) => item.trim())
    const postal = normalizePostal(postalInput ?? '')
    if (!/^\d{5}$/.test(postal) || !AREAS.includes(area)) continue
    // PostgreSQL cannot upsert the same conflict key twice in one statement.
    // The last valid mapping for a repeated postal code is the intended value.
    mappings.set(postal, { postal_code: postal, price_area: area as PriceArea, source: 'admin' })
  }
  if (!mappings.size) throw new Error('Inga giltiga rader. Format: 11122,SE3')

  const { error } = await supabaseService.from('gridex_postal_code_price_area').upsert(
    Array.from(mappings.values()), { onConflict: 'postal_code' },
  )
  if (error) throw new Error(error.message)
  revalidatePath('/admin/postal-areas')
}
