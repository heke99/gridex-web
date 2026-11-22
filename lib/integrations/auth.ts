import { timingSafeEqual } from 'node:crypto'

export type IntegrationAuthResult =
  | { ok: true; mode: 'integration_key' | 'cron_secret' }
  | { ok: false; status: number; message: string }

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)

  if (left.length !== right.length) {
    return false
  }

  return timingSafeEqual(left, right)
}

export function verifyCronBearer(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const authorization = request.headers.get('authorization')
  return Boolean(secret && authorization && safeEqual(authorization, `Bearer ${secret}`))
}

export function verifyScheduledJobRequest(request: Request, jobSecret?: string): boolean {
  if (verifyCronBearer(request)) return true
  const secret = jobSecret?.trim() || process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const bearer = bearerToken(request)
  const header = request.headers.get('x-cron-secret')?.trim()
  return Boolean((bearer && safeEqual(bearer, secret)) || (header && safeEqual(header, secret)))
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null

  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function headerToken(req: Request): string | null {
  return req.headers.get('x-gridex-integration-key')?.trim() || null
}

export function verifyIntegrationRequest(
  req: Request,
  options?: { allowCronSecret?: boolean }
): IntegrationAuthResult {
  const integrationKey = process.env.GRIDEX_INTEGRATION_API_KEY
  const cronSecret = process.env.CRON_SECRET
  const provided = bearerToken(req) ?? headerToken(req)

  if (!provided) {
    return { ok: false, status: 401, message: 'Missing integration credentials' }
  }

  if (integrationKey && safeEqual(provided, integrationKey)) {
    return { ok: true, mode: 'integration_key' }
  }

  if (
    options?.allowCronSecret &&
    cronSecret &&
    safeEqual(provided, cronSecret)
  ) {
    return { ok: true, mode: 'cron_secret' }
  }

  return { ok: false, status: 403, message: 'Invalid integration credentials' }
}
