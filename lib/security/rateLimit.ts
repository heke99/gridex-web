type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Lightweight in-process rate limiter.
 *
 * Production note:
 * This limiter protects a single running server process only. In a distributed
 * deployment such as Vercel serverless/functions, multiple instances do not share
 * this Map, and cold starts reset the counters. Keep this guard as a safe local
 * fallback, but use a shared store such as Redis/Upstash or an edge/network rate
 * limiter before public forms for full production protection.
 */
export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs
    buckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: Math.max(0, options.limit - 1), resetAt }
  }

  if (existing.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count += 1
  buckets.set(key, existing)
  return {
    allowed: true,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
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
