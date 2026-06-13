import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  getFallbackPriceAreaForGridArea,
  normalizeGridAreaCode,
  type WebsiteGridPriceArea,
} from '@/lib/website/gridAreaPriceAreas.generated'

const PRICE_AREAS = ['SE1', 'SE2', 'SE3', 'SE4'] as const
const DEFAULT_PAPILITE_BASE_URL = 'https://api.papapi.se/lite/'
const DEFAULT_ARCGIS_GRID_AREAS_QUERY_URL =
  'https://services2.arcgis.com/L8WLzcxhwLqd80Jx/arcgis/rest/services/N%C3%A4tomr%C3%A5den_240524_2_WFL1/FeatureServer/4/query'

export type WebsitePriceAreaCode = (typeof PRICE_AREAS)[number]

export type WebsitePriceAreaResolveInput = {
  postal_code: string
  city?: string | null
  address?: string | null
  street?: string | null
}

export type WebsitePriceAreaResolution = {
  status: 'resolved' | 'not_found' | 'needs_configuration' | 'error'
  price_area_code: WebsitePriceAreaCode | null
  grid_area_code?: string | null
  confidence?: number | null
  source?: string | null
  source_chain: string[]
  customer_message?: string | null
  used_for: 'pricing_preview_only'
  raw?: Record<string, unknown>
}

type PostalCacheRow = {
  postal_code: string
  city?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  grid_area_code?: string | null
  price_area_code?: string | null
  confidence?: number | string | null
  source?: string | null
  source_chain?: unknown
  expires_at?: string | null
}

type GridAreaRow = {
  grid_area_code: string
  grid_area_label?: string | null
  price_area_code?: string | null
}

type PapiliteResult = {
  postal_code?: unknown
  city?: unknown
  latitude?: unknown
  longitude?: unknown
  county?: unknown
  state?: unknown
}

type ArcgisFeature = {
  attributes?: Record<string, unknown>
}

type ArcgisResponse = {
  features?: ArcgisFeature[]
  error?: { message?: string; details?: string[] }
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function websiteSupabase(): SupabaseClient | null {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function normalizePricingPostalCode(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const normalized = String(value).replace(/\s+/g, '').trim()
  return /^\d{5}$/.test(normalized) ? normalized : null
}

function isPriceArea(value: unknown): value is WebsitePriceAreaCode {
  return typeof value === 'string' && PRICE_AREAS.includes(value as WebsitePriceAreaCode)
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function textOrNull(value: unknown, max = 180): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const trimmed = String(value).trim().slice(0, max)
  return trimmed || null
}

function sourceChain(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function toResolution(params: {
  status?: WebsitePriceAreaResolution['status']
  priceArea: WebsitePriceAreaCode | null
  gridAreaCode?: string | null
  confidence?: number | null
  source?: string | null
  sourceChain?: string[]
  customerMessage?: string | null
  raw?: Record<string, unknown>
}): WebsitePriceAreaResolution {
  return {
    status: params.status ?? (params.priceArea ? 'resolved' : 'not_found'),
    price_area_code: params.priceArea,
    grid_area_code: params.gridAreaCode ?? null,
    confidence: params.confidence ?? null,
    source: params.source ?? null,
    source_chain: params.sourceChain ?? [],
    customer_message: params.customerMessage ?? null,
    used_for: 'pricing_preview_only',
    raw: params.raw,
  }
}

async function readPostalCache(
  supabase: SupabaseClient | null,
  postalCode: string
): Promise<WebsitePriceAreaResolution | null> {
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('website_postal_code_price_areas')
      .select('postal_code,city,latitude,longitude,grid_area_code,price_area_code,confidence,source,source_chain,expires_at')
      .eq('postal_code', postalCode)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle<PostalCacheRow>()

    if (error || !data || !isPriceArea(data.price_area_code)) return null

    return toResolution({
      priceArea: data.price_area_code,
      gridAreaCode: normalizeGridAreaCode(data.grid_area_code),
      confidence: numberOrNull(data.confidence) ?? 0.9,
      source: data.source ?? 'website_postal_code_price_areas',
      sourceChain: ['website_postal_code_price_areas', ...sourceChain(data.source_chain)],
      customerMessage: `Elområde ${data.price_area_code} används för prisvisningen.`,
      raw: {
        postal_code: data.postal_code,
        city: data.city ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        expires_at: data.expires_at ?? null,
      },
    })
  } catch {
    return null
  }
}

async function fetchPapilitePostalCode(postalCode: string): Promise<{
  city: string | null
  latitude: number
  longitude: number
  raw: Record<string, unknown>
}> {
  const apiKey = env('PAPILITE_API_KEY') ?? env('PAP_API_LITE_KEY') ?? env('PAP_API_KEY')
  if (!apiKey) {
    throw Object.assign(new Error('Papilite är inte konfigurerat för prisområdesuppslag.'), {
      code: 'missing_papilite_key',
    })
  }

  const url = new URL(env('PAPILITE_BASE_URL') ?? env('PAP_API_LITE_BASE_URL') ?? DEFAULT_PAPILITE_BASE_URL)
  url.searchParams.set('query', postalCode)
  url.searchParams.set('country', 'se')
  url.searchParams.set('format', 'json')
  url.searchParams.set('apikey', apiKey)

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw Object.assign(new Error('Postnumret kunde inte slås upp just nu.'), {
      status: res.status,
    })
  }

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  const results = Array.isArray(data?.results) ? (data.results as PapiliteResult[]) : []
  const exact =
    results.find((item) => textOrNull(item.postal_code)?.replace(/\s+/g, '') === postalCode) ??
    results[0]

  const latitude = numberOrNull(exact?.latitude)
  const longitude = numberOrNull(exact?.longitude)

  if (latitude == null || longitude == null) {
    throw new Error('Postnumret saknar koordinater för prisområdesuppslag.')
  }

  return {
    city: textOrNull(exact.city, 120),
    latitude,
    longitude,
    raw: data ?? {},
  }
}

function extractGridAreaCode(features: ArcgisFeature[]): string | null {
  const preferredKeys = [
    'Natomrade',
    'NATOMRADE',
    'Nätområde',
    'NAT_OMR',
    'NATOMR',
    'OmrKod',
    'OMRKOD',
    'grid_area_code',
  ]

  for (const feature of features) {
    const attributes = feature.attributes ?? {}

    for (const key of preferredKeys) {
      const normalized = normalizeGridAreaCode(attributes[key])
      if (normalized) return normalized
    }

    for (const value of Object.values(attributes)) {
      const normalized = normalizeGridAreaCode(value)
      if (normalized && getFallbackPriceAreaForGridArea(normalized)) return normalized
    }
  }

  return null
}

async function fetchArcgisGridArea(latitude: number, longitude: number): Promise<{
  gridAreaCode: string
  raw: Record<string, unknown>
}> {
  const url = new URL(
    env('WEBSITE_ARCGIS_GRID_AREAS_QUERY_URL') ?? DEFAULT_ARCGIS_GRID_AREAS_QUERY_URL
  )

  url.searchParams.set('f', 'json')
  url.searchParams.set('geometry', `${longitude},${latitude}`)
  url.searchParams.set('geometryType', 'esriGeometryPoint')
  url.searchParams.set('inSR', '4326')
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  url.searchParams.set('outFields', 'Natomrade,OBJECTID,NATOMRADE,NAT_OMR,OmrKod')
  url.searchParams.set('returnGeometry', 'false')

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw Object.assign(new Error('Elområde kunde inte hämtas från karttjänsten.'), {
      status: res.status,
    })
  }

  const data = (await res.json().catch(() => null)) as ArcgisResponse | null
  const features = Array.isArray(data?.features) ? data.features : []
  const gridAreaCode = extractGridAreaCode(features)

  if (!gridAreaCode) {
    throw new Error('Postnumret kunde inte matchas mot ett nätområde.')
  }

  return {
    gridAreaCode,
    raw: data ? (data as Record<string, unknown>) : {},
  }
}

async function readPriceAreaForGridArea(
  supabase: SupabaseClient | null,
  gridAreaCode: string
): Promise<{
  priceArea: WebsiteGridPriceArea
  label: string | null
  source: string
} | null> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('website_grid_area_price_areas')
        .select('grid_area_code,grid_area_label,price_area_code')
        .eq('grid_area_code', gridAreaCode)
        .eq('is_active', true)
        .maybeSingle<GridAreaRow>()

      if (!error && data && isPriceArea(data.price_area_code)) {
        return {
          priceArea: data.price_area_code,
          label: data.grid_area_label ?? null,
          source: 'website_grid_area_price_areas',
        }
      }
    } catch {
      // Static fallback below keeps price preview working if DB seed has not run yet.
    }
  }

  const fallback = getFallbackPriceAreaForGridArea(gridAreaCode)
  return fallback
    ? {
        priceArea: fallback.priceArea,
        label: fallback.label,
        source: 'static_esett_mapping',
      }
    : null
}

async function writeSuccessCache(
  supabase: SupabaseClient | null,
  params: {
    postalCode: string
    city: string | null
    latitude: number
    longitude: number
    gridAreaCode: string
    priceArea: WebsitePriceAreaCode
    confidence: number
    source: string
    sourceChain: string[]
    raw: Record<string, unknown>
  }
) {
  if (!supabase) return

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  const now = new Date().toISOString()

  try {
    await supabase.from('website_postal_code_price_areas').upsert({
      postal_code: params.postalCode,
      city: params.city,
      latitude: params.latitude,
      longitude: params.longitude,
      grid_area_code: params.gridAreaCode,
      price_area_code: params.priceArea,
      confidence: params.confidence,
      source: params.source,
      source_chain: params.sourceChain,
      raw_response: params.raw,
      used_for: 'pricing_preview_only',
      is_active: true,
      looked_up_at: now,
      expires_at: expiresAt,
      updated_at: now,
    })

    await supabase.from('website_price_area_lookup_cache').insert({
      postal_code: params.postalCode,
      city: params.city,
      grid_area_code: params.gridAreaCode,
      price_area_code: params.priceArea,
      lookup_status: 'resolved',
      confidence: params.confidence,
      source: params.source,
      source_chain: params.sourceChain,
      raw_response: params.raw,
      used_for: 'pricing_preview_only',
      expires_at: expiresAt,
    })
  } catch {
    // Non-critical cache write failure. The customer can still see the price.
  }
}

async function writeFailureCache(
  supabase: SupabaseClient | null,
  postalCode: string,
  message: string,
  raw?: Record<string, unknown>
) {
  if (!supabase) return
  try {
    await supabase.from('website_price_area_lookup_cache').insert({
      postal_code: postalCode,
      lookup_status: 'error',
      error_message: message,
      source: 'papilite_arcgis',
      source_chain: ['papilite', 'arcgis_feature_server', 'esett_grid_area_mapping'],
      raw_response: raw ?? {},
      used_for: 'pricing_preview_only',
    })
  } catch {
    // Non-critical cache write failure.
  }
}

export async function resolveWebsitePriceAreaForPricing(
  input: WebsitePriceAreaResolveInput
): Promise<WebsitePriceAreaResolution> {
  const postalCode = normalizePricingPostalCode(input.postal_code)

  if (!postalCode) {
    return toResolution({
      status: 'error',
      priceArea: null,
      customerMessage: 'Ange ett svenskt postnummer med 5 siffror.',
      sourceChain: [],
    })
  }

  const supabase = websiteSupabase()
  const cached = await readPostalCache(supabase, postalCode)
  if (cached) return cached

  let raw: Record<string, unknown> = {}

  try {
    const papilite = await fetchPapilitePostalCode(postalCode)
    const arcgis = await fetchArcgisGridArea(papilite.latitude, papilite.longitude)
    const mapping = await readPriceAreaForGridArea(supabase, arcgis.gridAreaCode)

    raw = {
      papilite: papilite.raw,
      arcgis: arcgis.raw,
      mapping_source: mapping?.source ?? null,
    }

    if (!mapping) {
      throw new Error('Nätområdet saknar koppling till elområde för prisvisning.')
    }

    const sourceChain = ['papilite', 'arcgis_feature_server_layer_4', mapping.source]
    const confidence = 0.88

    await writeSuccessCache(supabase, {
      postalCode,
      city: textOrNull(input.city, 120) ?? papilite.city,
      latitude: papilite.latitude,
      longitude: papilite.longitude,
      gridAreaCode: arcgis.gridAreaCode,
      priceArea: mapping.priceArea,
      confidence,
      source: 'papilite_arcgis_esett',
      sourceChain,
      raw,
    })

    return toResolution({
      priceArea: mapping.priceArea,
      gridAreaCode: arcgis.gridAreaCode,
      confidence,
      source: 'papilite_arcgis_esett',
      sourceChain,
      customerMessage: `Elområde ${mapping.priceArea} används för prisvisningen.`,
      raw: {
        postal_code: postalCode,
        city: papilite.city,
        grid_area_code: arcgis.gridAreaCode,
        grid_area_label: mapping.label,
        used_for: 'pricing_preview_only',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Elområde kunde inte kontrolleras automatiskt just nu.'

    await writeFailureCache(supabase, postalCode, message, raw)

    const missingConfig =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'missing_papilite_key'

    return toResolution({
      status: missingConfig ? 'needs_configuration' : 'not_found',
      priceArea: null,
      source: 'papilite_arcgis_esett',
      sourceChain: ['papilite', 'arcgis_feature_server_layer_4', 'esett_grid_area_mapping'],
      customerMessage: missingConfig
        ? 'Prisområde kan inte hämtas automatiskt innan postnummeruppslaget är konfigurerat.'
        : 'Vi kunde inte hitta elområdet automatiskt. Kontrollera postnumret och försök igen.',
      raw: {
        postal_code: postalCode,
        error: message,
      },
    })
  }
}
