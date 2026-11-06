import { AsyncLocalStorage } from 'node:async_hooks'

export const API_PERFORMANCE_SCHEMA = 'gridex.api-performance.v1'
export const API_PERFORMANCE_PREFIX = '[gridex-api-performance] '

const surfaces = new Set(['contracts_feed', 'contracts_endpoint', 'energy_area', 'quote', 'quote_validation', 'market_price'])
type Surface = 'contracts_feed' | 'contracts_endpoint' | 'energy_area' | 'quote' | 'quote_validation' | 'market_price'
type CacheLayer = 'integration_context' | 'public_contract_data' | 'public_contract_snapshot' | 'public_contract_refresh'
type CacheResult = 'hit' | 'miss' | 'join' | 'bypass' | 'lookup' | 'fill' | 'scheduled' | 'error'
const cacheLayers = new Set<CacheLayer>(['integration_context', 'public_contract_data', 'public_contract_snapshot', 'public_contract_refresh'])
const cacheResults = new Set<CacheResult>(['hit', 'miss', 'join', 'bypass', 'lookup', 'fill', 'scheduled', 'error'])
const publicRoutes = new Set([
  '/integration/context', '/contracts', '/public-contracts', '/public-contracts/diagnostics',
  '/website/public-contracts', '/website/public-contracts/diagnostics',
  '/website/energy-area/resolve', '/website/quote', '/website/quote/validate',
  '/website/market-price/current', '/website/portfolio-prices', '/website/legal-bundle',
  '/website/customer-applications', '/website/customer-events', '/website/switch-status',
])

/** Bounded route labels only: never include a URL, query, customer ID or document reference. */
export function apiPerformanceRoute(path: string): string {
  const route = path.split('?', 1)[0].replace(/^\/api\/v1(?=\/|$)/, '').replace(/\/+$/, '')
  if (publicRoutes.has(route)) return route
  if (/^\/website\/customer-applications\//.test(route)) return '/website/customer-applications/:reference'
  if (/^\/(customer|customer-portal)(\/|$)/.test(route)) return '/customer/*'
  if (/^\/staff(\/|$)/.test(route)) return '/staff/*'
  if (/^\/openapi\//.test(route)) return '/openapi/*'
  return '/other'
}

type UpstreamObservation = {
  route: string
  method: string
  duration_ms: number
  attempts: number
  rate_limited_responses: number
  status: number | null
  outcome: 'success' | 'error'
}
type CacheObservation = { layer: CacheLayer; result: CacheResult; count: number }
type Measurement = {
  upstream: UpstreamObservation[]
  cache: Map<string, CacheObservation>
  truncated: number
  closed: boolean
}
const measurements = new AsyncLocalStorage<Measurement>()
const milliseconds = (value: number) => Math.round(Math.max(0, Math.min(86_400_000, Number.isFinite(value) ? value : 0)) * 10) / 10
const counter = (value: number) => Math.min(1_000_000, Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)))

function emit(event: Record<string, unknown>) {
  // Observability must never change the business result or cause a retry.
  try { console.info(API_PERFORMANCE_PREFIX + JSON.stringify({ schema: API_PERFORMANCE_SCHEMA, ...event })) } catch {}
}

export function recordApiCache(layer: CacheLayer, result: CacheResult): void {
  if (!cacheLayers.has(layer) || !cacheResults.has(result)) return
  const current = measurements.getStore()
  if (!current || current.closed) {
    emit({ kind: 'cache', cache: [{ layer, result, count: 1 }] })
    return
  }
  const key = `${layer}:${result}`
  const existing = current.cache.get(key)
  if (existing) existing.count = counter(existing.count + 1)
  else current.cache.set(key, { layer, result, count: 1 })
}

export function recordOpsPerformance(input: {
  path: string
  method: string
  durationMs: number
  attempts: number
  rateLimitedResponses: number
  status: number | null
  success: boolean
}): void {
  const observation: UpstreamObservation = {
    route: apiPerformanceRoute(input.path),
    method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(input.method) ? input.method : 'OTHER',
    duration_ms: milliseconds(input.durationMs),
    attempts: counter(input.attempts),
    rate_limited_responses: counter(input.rateLimitedResponses),
    status: input.status !== null && Number.isInteger(input.status) && input.status >= 100 && input.status <= 599 ? input.status : null,
    outcome: input.success ? 'success' : 'error',
  }
  const current = measurements.getStore()
  if (!current || current.closed) {
    emit({ kind: 'upstream', upstream: [observation] })
    return
  }
  if (current.upstream.length < 32) current.upstream.push(observation)
  else current.truncated = counter(current.truncated + 1)
}

/** One compact server-log record per measured operation; no exporter, database write or timer. */
export async function observeApiOperation<T>(surface: Surface, operation: () => Promise<T>): Promise<T> {
  const parent = measurements.getStore()
  if (parent && !parent.closed) return operation()
  const current: Measurement = { upstream: [], cache: new Map(), truncated: 0, closed: false }
  const started = performance.now()
  let success = false
  let status: number | null = null
  return measurements.run(current, async () => {
    try {
      const value = await operation()
      status = value instanceof Response ? value.status : null
      success = status === null || status < 400
      return value
    } finally {
      current.closed = true
      emit({
        kind: 'operation', surface: surfaces.has(surface) ? surface : 'other',
        duration_ms: milliseconds(performance.now() - started), status,
        outcome: success ? 'success' : 'error', upstream: current.upstream,
        cache: [...current.cache.values()], upstream_truncated: current.truncated,
      })
    }
  })
}
