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

type LegacyPostalAreaRow = {
  postal_code: string
  price_area?: string | null
  source?: string | null
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
  fields?: Array<{ name?: string; alias?: string; type?: string }>
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


async function readLegacyPostalArea(
  supabase: SupabaseClient | null,
  postalCode: string
): Promise<WebsitePriceAreaResolution | null> {
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('gridex_postal_code_price_area')
      .select('postal_code,price_area,source')
      .eq('postal_code', postalCode)
      .maybeSingle<LegacyPostalAreaRow>()

    if (error || !data || !isPriceArea(data.price_area)) return null

    return toResolution({
      priceArea: data.price_area,
      confidence: 0.78,
      source: data.source ?? 'gridex_postal_code_price_area',
      sourceChain: ['legacy_postal_code_price_area'],
      customerMessage: `Elområde ${data.price_area} används för prisvisningen.`,
      raw: {
        postal_code: data.postal_code,
        used_for: 'pricing_preview_only',
      },
    })
  } catch {
    return null
  }
}

async function readPostalPrefixFallback(
  supabase: SupabaseClient | null,
  postalCode: string
): Promise<WebsitePriceAreaResolution | null> {
  if (!supabase || postalCode.length !== 5) return null

  const prefix = postalCode.slice(0, 3)
  const sources = [
    { table: 'website_postal_code_price_areas', areaColumn: 'price_area_code' },
    { table: 'gridex_postal_code_price_area', areaColumn: 'price_area' },
  ] as const

  for (const source of sources) {
    try {
      const { data, error } = await supabase
        .from(source.table)
        .select(`postal_code,${source.areaColumn}`)
        .gte('postal_code', `${prefix}00`)
        .lte('postal_code', `${prefix}99`)
        .limit(50)

      if (error || !Array.isArray(data) || data.length < 3) continue

      const areas = new Set(
        data
          .map((row: Record<string, unknown>) => row[source.areaColumn])
          .filter(isPriceArea)
      )

      if (areas.size === 1) {
        const [area] = [...areas]
        return toResolution({
          priceArea: area,
          confidence: 0.62,
          source: `${source.table}_prefix`,
          sourceChain: [source.table, 'postal_prefix_fallback'],
          customerMessage: `Elområde ${area} används för prisvisningen.`,
          raw: {
            postal_code: postalCode,
            postal_prefix: prefix,
            matched_rows: data.length,
            used_for: 'pricing_preview_only',
          },
        })
      }
    } catch {
      // Try next source.
    }
  }

  return null
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
  const topLevelResult = data && !Array.isArray(data.results) && ('postal_code' in data || 'latitude' in data)
    ? (data as PapiliteResult)
    : null
  const results = Array.isArray(data?.results) ? (data.results as PapiliteResult[]) : topLevelResult ? [topLevelResult] : []
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

function readAttribute(attributes: Record<string, unknown>, wantedKeys: string[]) {
  const normalizedLookup = new Map(
    Object.entries(attributes).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9åäö]/gi, ''), value])
  )

  for (const key of wantedKeys) {
    const direct = attributes[key]
    if (direct !== undefined && direct !== null) return direct

    const normalized = key.toLowerCase().replace(/[^a-z0-9åäö]/gi, '')
    if (normalizedLookup.has(normalized)) return normalizedLookup.get(normalized)
  }

  return null
}

function extractPriceAreaFromArcgis(features: ArcgisFeature[]): WebsitePriceAreaCode | null {
  const preferredKeys = [
    'Elomrade',
    'Elområde',
    'EL_OMRADE',
    'EL_OMR',
    'SE',
    'price_area_code',
    'PriceArea',
  ]

  for (const feature of features) {
    const attributes = feature.attributes ?? {}
    const direct = readAttribute(attributes, preferredKeys)
    if (isPriceArea(typeof direct === 'string' ? direct.toUpperCase() : direct)) {
      return String(direct).toUpperCase() as WebsitePriceAreaCode
    }

    for (const value of Object.values(attributes)) {
      if (isPriceArea(typeof value === 'string' ? value.toUpperCase() : value)) {
        return String(value).toUpperCase() as WebsitePriceAreaCode
      }
    }
  }

  return null
}

function extractGridAreaCode(features: ArcgisFeature[]): string | null {
  const preferredKeys = [
    'Natomrade',
    'NATOMRADE',
    'Nätområde',
    'Nätområdeskod',
    'NATOMRÅDE',
    'NAT_OMR',
    'NATOMR',
    'OmrKod',
    'OMRKOD',
    'OMR_KOD',
    'omradeskod',
    'Omradeskod',
    'grid_area_code',
  ]

  for (const feature of features) {
    const attributes = feature.attributes ?? {}

    const preferred = readAttribute(attributes, preferredKeys)
    const normalizedPreferred = normalizeGridAreaCode(preferred)
    if (normalizedPreferred) return normalizedPreferred

    for (const value of Object.values(attributes)) {
      const normalized = normalizeGridAreaCode(value)
      if (normalized && getFallbackPriceAreaForGridArea(normalized)) return normalized
    }
  }

  return null
}

async function fetchArcgisGridArea(latitude: number, longitude: number): Promise<{
  gridAreaCode: string | null
  priceAreaCode: WebsitePriceAreaCode | null
  raw: Record<string, unknown>
}> {
  const baseUrl = env('WEBSITE_ARCGIS_GRID_AREAS_QUERY_URL') ?? DEFAULT_ARCGIS_GRID_AREAS_QUERY_URL
  const attempts = [
    {
      name: 'point_intersects_4326',
      geometry: `${longitude},${latitude}`,
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
    },
    {
      name: 'point_contains_4326',
      geometry: `${longitude},${latitude}`,
      inSR: '4326',
      spatialRel: 'esriSpatialRelContains',
    },
    {
      name: 'nearest_5000m_4326',
      geometry: `${longitude},${latitude}`,
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      distance: '5000',
    },
    {
      name: 'nearest_15000m_4326',
      geometry: `${longitude},${latitude}`,
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      distance: '15000',
    },
  ]

  const rawAttempts: Record<string, unknown>[] = []

  for (const attempt of attempts) {
    const url = new URL(baseUrl)
    url.searchParams.set('f', 'json')
    url.searchParams.set('geometry', attempt.geometry)
    url.searchParams.set('geometryType', 'esriGeometryPoint')
    url.searchParams.set('inSR', attempt.inSR)
    url.searchParams.set('spatialRel', attempt.spatialRel)
    url.searchParams.set('outFields', '*')
    url.searchParams.set('returnGeometry', 'false')
    url.searchParams.set('resultRecordCount', '5')
    url.searchParams.set('cacheHint', 'true')

    if (attempt.distance) {
      url.searchParams.set('distance', attempt.distance)
      url.searchParams.set('units', 'esriSRUnit_Meter')
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!res.ok) {
      rawAttempts.push({ attempt: attempt.name, status: res.status })
      continue
    }

    const data = (await res.json().catch(() => null)) as ArcgisResponse | null
    const features = Array.isArray(data?.features) ? data.features : []
    const gridAreaCode = extractGridAreaCode(features)
    const priceAreaCode = extractPriceAreaFromArcgis(features)

    rawAttempts.push({
      attempt: attempt.name,
      feature_count: features.length,
      grid_area_code: gridAreaCode,
      price_area_code: priceAreaCode,
      field_names: Array.isArray(data?.fields) ? data.fields.map((field) => field.name).filter(Boolean) : undefined,
      first_attributes: features[0]?.attributes ?? null,
      error: data?.error ?? null,
    })

    if (gridAreaCode || priceAreaCode) {
      return {
        gridAreaCode,
        priceAreaCode,
        raw: { attempts: rawAttempts, selected_attempt: attempt.name, response: data ?? {} },
      }
    }
  }

  throw Object.assign(new Error('Postnumret kunde inte matchas mot ett nätområde.'), {
    rawAttempts,
  })
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

  const legacy = await readLegacyPostalArea(supabase, postalCode)
  if (legacy) return legacy

  let raw: Record<string, unknown> = {}

  try {
    const papilite = await fetchPapilitePostalCode(postalCode)
    const arcgis = await fetchArcgisGridArea(papilite.latitude, papilite.longitude)
    const mapping = arcgis.gridAreaCode
      ? await readPriceAreaForGridArea(supabase, arcgis.gridAreaCode)
      : null

    const priceArea = mapping?.priceArea ?? arcgis.priceAreaCode ?? null
    const mappingSource = mapping?.source ?? (arcgis.priceAreaCode ? 'arcgis_price_area_direct' : null)

    raw = {
      papilite: papilite.raw,
      arcgis: arcgis.raw,
      mapping_source: mappingSource,
    }

    if (!priceArea) {
      throw new Error('Nätområdet saknar koppling till elområde för prisvisning.')
    }

    const sourceChain = ['papilite', 'arcgis_feature_server_layer_4', mappingSource ?? 'price_area_direct']
    const confidence = arcgis.gridAreaCode && mapping ? 0.88 : 0.82
    const gridAreaCode = arcgis.gridAreaCode ?? 'UNKNOWN'

    await writeSuccessCache(supabase, {
      postalCode,
      city: textOrNull(input.city, 120) ?? papilite.city,
      latitude: papilite.latitude,
      longitude: papilite.longitude,
      gridAreaCode,
      priceArea,
      confidence,
      source: 'papilite_arcgis_esett',
      sourceChain,
      raw,
    })

    return toResolution({
      priceArea,
      gridAreaCode: arcgis.gridAreaCode,
      confidence,
      source: 'papilite_arcgis_esett',
      sourceChain,
      customerMessage: `Elområde ${priceArea} används för prisvisningen.`,
      raw: {
        postal_code: postalCode,
        city: papilite.city,
        grid_area_code: arcgis.gridAreaCode,
        grid_area_label: mapping?.label ?? null,
        used_for: 'pricing_preview_only',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Elområde kunde inte kontrolleras automatiskt just nu.'

    await writeFailureCache(supabase, postalCode, message, raw)

    const prefixFallback = await readPostalPrefixFallback(supabase, postalCode)
    if (prefixFallback) return prefixFallback

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
