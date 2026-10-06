import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
let lastPrunedAt = 0
let sharedClient: SupabaseClient | null = null
let sharedConfiguration = ''

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
  source: 'shared' | 'local_fallback' | 'unavailable'
}

type SharedRateLimitRow = {
  allowed: boolean
  remaining: number
  reset_at: string
}

function localRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now()
  if (now - lastPrunedAt >= 30_000 || buckets.size >= 10_000) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key)
    lastPrunedAt = now
  }
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= 10_000) return { allowed: false, remaining: 0, resetAt: now + options.windowMs, source: 'unavailable' }
    const resetAt = now + options.windowMs
    buckets.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: Math.max(0, options.limit - 1),
      resetAt,
      source: 'local_fallback',
    }
  }

  if (existing.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      source: 'local_fallback',
    }
  }

  existing.count += 1
  buckets.set(key, existing)
  return {
    allowed: true,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
    source: 'local_fallback',
  }
}

/**
 * Distributed rate limiter backed by an atomic Supabase/Postgres function.
 * Production fails closed when the shared limiter is unavailable. Development
 * uses bounded process-local buckets without weakening deployed write protection.
 */
export async function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const normalizedKey = key.trim().slice(0, 500)
  const limit = Math.max(1, Math.floor(options.limit))
  const windowMs = Math.max(1_000, Math.floor(options.windowMs))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const unavailable = (): RateLimitResult => process.env.NODE_ENV === 'production'
    ? { allowed: false, remaining: 0, resetAt: Date.now() + 30_000, source: 'unavailable' }
    : localRateLimit(normalizedKey || 'unknown', { limit, windowMs })

  if (!normalizedKey || !url || !serviceKey) {
    return unavailable()
  }

  try {
    const configuration = `${url}:${serviceKey}`
    if (!sharedClient || sharedConfiguration !== configuration) {
      sharedClient = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => fetch(input, {
          ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(3_000)]) : AbortSignal.timeout(3_000),
        }) },
      })
      sharedConfiguration = configuration
    }
    const supabase = sharedClient
    const { data, error } = await supabase.rpc('consume_distributed_rate_limit', {
      p_key: normalizedKey,
      p_limit: limit,
      p_window_seconds: Math.ceil(windowMs / 1_000),
    })

    if (error) throw new Error(error.message)
    const row = Array.isArray(data) ? (data[0] as SharedRateLimitRow | undefined) : undefined
    const resetAt = row?.reset_at ? Date.parse(row.reset_at) : Number.NaN
    if (!row || typeof row.allowed !== 'boolean' || !Number.isFinite(resetAt)) {
      throw new Error('Invalid distributed rate-limit response.')
    }

    return {
      allowed: row.allowed,
      remaining: Math.max(0, Number(row.remaining) || 0),
      resetAt,
      source: 'shared',
    }
  } catch {
    console.error('[rate-limit] shared limiter unavailable')
    return unavailable()
  }
}

export function clientIpFromHeaders(headers: Headers): string {
  // Vercel overwrites this header at its ingress, unlike forwarded application headers.
  const xff = headers.get(process.env.VERCEL ? 'x-vercel-forwarded-for' : 'x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return process.env.VERCEL ? 'unknown' : headers.get('x-real-ip')?.trim() || 'unknown'
}
