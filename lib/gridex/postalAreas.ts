import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriceArea } from '@/lib/gridex/pricing/types'

const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

type PostalAreaRow = {
  postal_code: string
  price_area: string
  source?: string | null
  updated_at?: string | null
}

export function normalizePostalCode(input: string): string {
  return input.replace(/\s+/g, '').trim()
}

export function isPriceArea(value: unknown): value is PriceArea {
  return typeof value === 'string' && AREAS.includes(value as PriceArea)
}

export function assertPostalCode(input: string): string {
  const postalCode = normalizePostalCode(input)

  if (!/^\d{5}$/.test(postalCode)) {
    throw Object.assign(new Error('Postnummer måste bestå av 5 siffror.'), {
      status: 400,
    })
  }

  return postalCode
}

export async function resolvePriceAreaForPostalCode(
  supabase: SupabaseClient,
  postalCodeInput: string,
  manualArea?: PriceArea | null
): Promise<{
  postalCode: string
  priceArea: PriceArea
  source: string | null
}> {
  if (manualArea && isPriceArea(manualArea)) {
    return {
      postalCode: normalizePostalCode(postalCodeInput),
      priceArea: manualArea,
      source: 'manual',
    }
  }

  const postalCode = assertPostalCode(postalCodeInput)

  const { data, error } = await supabase
    .from('gridex_postal_code_price_area')
    .select('postal_code,price_area,source,updated_at')
    .eq('postal_code', postalCode)
    .maybeSingle<PostalAreaRow>()

  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 })
  }

  if (!data?.price_area || !isPriceArea(data.price_area)) {
    throw Object.assign(
      new Error(
        'Postnumret saknar elområdesmappning. Välj elområde manuellt eller komplettera postnummerregistret i admin.'
      ),
      { status: 422 }
    )
  }

  return {
    postalCode,
    priceArea: data.price_area,
    source: data.source ?? null,
  }
}
