import { readFile, writeFile, stat } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { API_PERFORMANCE_SCHEMA, API_PERFORMANCE_PREFIX, apiPerformanceRoute } from '../lib/observability/apiPerformance.ts'

const surfaces = new Set(['contracts_feed', 'contracts_endpoint', 'energy_area', 'quote', 'quote_validation', 'market_price'])
const layers = new Set(['integration_context', 'public_contract_data', 'public_contract_snapshot', 'public_contract_refresh'])
const results = new Set(['hit', 'miss', 'join', 'bypass', 'lookup', 'fill', 'scheduled', 'error'])
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 86_400_000 ? value : 0
const count = value => Math.min(1_000_000, Math.trunc(number(value)))
const status = value => Number.isInteger(value) && value >= 100 && value <= 599 ? value : null

function cleanEvent(value) {
  if (value?.schema !== API_PERFORMANCE_SCHEMA || !['operation', 'upstream', 'cache'].includes(value.kind)) return null
  return {
    kind: value.kind,
    surface: surfaces.has(value.surface) ? value.surface : 'other',
    duration_ms: number(value.duration_ms), status: status(value.status),
    outcome: value.outcome === 'success' ? 'success' : 'error',
    upstream_truncated: count(value.upstream_truncated),
    upstream: (Array.isArray(value.upstream) ? value.upstream : []).slice(0, 32).map(item => ({
      route: apiPerformanceRoute(typeof item?.route === 'string' ? item.route : ''),
      method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(item?.method) ? item.method : 'OTHER',
      duration_ms: number(item?.duration_ms), attempts: count(item?.attempts),
      rate_limited_responses: count(item?.rate_limited_responses), status: status(item?.status),
      outcome: item?.outcome === 'success' ? 'success' : 'error',
    })),
    cache: (Array.isArray(value.cache) ? value.cache : []).slice(0, 32)
      .filter(item => layers.has(item?.layer) && results.has(item?.result))
      .map(item => ({ layer: item.layer, result: item.result, count: count(item.count) })),
  }
}

/** Accept JSONL console exports, Vercel log messages or a connector JSON result. Discard unrelated content. */
export function parseApiPerformanceEvents(text) {
  const events = []
  function visit(value, depth = 0) {
    if (depth > 10 || value == null) return
    if (typeof value === 'string') {
      try { visit(JSON.parse(value), depth + 1); return } catch {}
      for (const line of value.split('\n')) {
        try { visit(JSON.parse(line), depth + 1); continue } catch {}
        const marker = line.indexOf(API_PERFORMANCE_PREFIX)
        if (marker >= 0) {
          try { const event = cleanEvent(JSON.parse(line.slice(marker + API_PERFORMANCE_PREFIX.length))); if (event) events.push(event) } catch {}
        }
      }
      return
    }
    if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); return }
    if (typeof value !== 'object') return
    const event = cleanEvent(value)
    if (event) { events.push(event); return }
    for (const key of ['message', 'text', 'logs', 'entries', 'data', 'result', 'content', 'rows']) {
      if (Object.hasOwn(value, key)) visit(value[key], depth + 1)
    }
  }
  try { visit(JSON.parse(text)) } catch { visit(text) }
  return events
}

const round = value => Math.round(value * 10) / 10
const percentile = (values, quantile) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? round(sorted[Math.ceil(quantile * sorted.length) - 1]) : null
}

export function summarizeApiPerformance(events) {
  const operations = new Map(), upstream = new Map(), cache = new Map()
  let truncated = 0, accepted = 0
  for (const raw of events) {
    const event = cleanEvent({ schema: API_PERFORMANCE_SCHEMA, ...raw })
    if (!event) continue
    accepted++
    truncated += event.upstream_truncated
    if (event.kind === 'operation') {
      const item = operations.get(event.surface) ?? { samples: 0, errors: 0, durations: [] }
      item.samples++; item.errors += event.outcome === 'error' ? 1 : 0; item.durations.push(event.duration_ms)
      operations.set(event.surface, item)
    }
    for (const observation of event.upstream) {
      const key = observation.method + ' ' + observation.route
      const item = upstream.get(key) ?? { logical_calls: 0, network_attempts: 0, retries: 0, errors: 0, rate_limited_responses: 0, not_modified: 0, durations: [] }
      item.logical_calls++; item.network_attempts += observation.attempts; item.retries += Math.max(0, observation.attempts - 1)
      item.errors += observation.outcome === 'error' ? 1 : 0
      item.rate_limited_responses += observation.rate_limited_responses
      item.not_modified += observation.status === 304 ? 1 : 0; item.durations.push(observation.duration_ms)
      upstream.set(key, item)
    }
    for (const observation of event.cache) {
      const item = cache.get(observation.layer) ?? {}
      item[observation.result] = (item[observation.result] ?? 0) + observation.count
      cache.set(observation.layer, item)
    }
  }
  function timing(item) {
    const { durations, ...rest } = item
    return { ...rest, p50_ms: percentile(durations, .5), p95_ms: percentile(durations, .95) }
  }
  const cacheResults = Object.fromEntries([...cache].sort().map(([layer, item]) => {
    if (['integration_context', 'public_contract_snapshot'].includes(layer)) {
      const reads = (item.hit ?? 0) + (item.miss ?? 0) + (item.join ?? 0)
      item.reads_excluding_bypass_and_errors = reads
      item.direct_hit_rate = reads ? round((item.hit ?? 0) / reads * 100) : null
      item.network_or_database_reads_avoided_rate = reads ? round(((item.hit ?? 0) + (item.join ?? 0)) / reads * 100) : null
    }
    return [layer, item]
  }))
  return {
    scope: 'supplied log records only; no daily extrapolation or monetary estimate',
    records: accepted, rate_unit: 'percent', upstream_observations_truncated: truncated,
    operations: Object.fromEntries([...operations].sort().map(([key, item]) => [key, timing(item)])),
    upstream: Object.fromEntries([...upstream].sort().map(([key, item]) => [key, timing(item)])),
    cache: cacheResults,
    notes: [
      'Durations cover server operations or complete logical OPS calls, including waits/retries; not browser rendering.',
      'Next data-cache lookup/fill counts are separate: stale background fills and shared work are not inferred to be exact cache hits.',
      'Network attempts count Web→OPS fetches, not OPS→geodata-provider requests or their billing.',
      'Percentiles use nearest rank; assess sample counts and the completeness/retention of the exported log window.',
    ],
  }
}

async function main() {
  const args = process.argv.slice(2), files = []
  let output
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--output') { output = args[++index]; if (!output) throw Error('--output requires a filename') }
    else if (args[index].startsWith('-')) throw Error('Use: npm run perf:api:report -- logs.jsonl [--output report.json]')
    else files.push(args[index])
  }
  if (!files.length || files.length > 16) throw Error('Provide 1–16 explicitly selected log export files')
  const events = []
  for (const file of files) {
    if ((await stat(file)).size > 16 * 1024 * 1024) throw Error('Log export exceeds 16 MiB; use a smaller time window')
    events.push(...parseApiPerformanceEvents(await readFile(file, 'utf8')))
  }
  if (!events.length) throw Error('No Gridex API performance records found in the supplied exports')
  const text = JSON.stringify(summarizeApiPerformance(events), null, 2) + '\n'
  if (output) await writeFile(output, text, { mode: 0o600 })
  process.stdout.write(text)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
