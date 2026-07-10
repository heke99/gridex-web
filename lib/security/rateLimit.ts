import { createClient } from '@supabase/supabase-js'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
  source: 'shared' | 'local_fallback'
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
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
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
 * Falls back to an in-process bucket only when shared infrastructure is not
 * configured or temporarily unavailable, so public flows remain usable while
 * still receiving best-effort protection.
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

  if (!normalizedKey || !url || !serviceKey) {
    return localRateLimit(normalizedKey || 'unknown', { limit, windowMs })
  }

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
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
  } catch (error) {
    console.error('[rate-limit] shared limiter unavailable; using local fallback', error)
    return localRateLimit(normalizedKey, { limit, windowMs })
  }
}

export function clientIpFromHeaders(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
