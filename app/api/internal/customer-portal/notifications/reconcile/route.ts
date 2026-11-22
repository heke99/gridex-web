import { verifyScheduledJobRequest } from '@/lib/integrations/auth'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ProfileColumn = 'external_customer_id' | 'customer_number' | 'contract_customer_ref' | 'email'

type MatchResult = { status: 'none' | 'unique' | 'ambiguous'; userId: string | null }

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value || null
}

function client() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase service role is not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function matchBy(
  supabase: ReturnType<typeof client>,
  column: ProfileColumn,
  value: string,
): Promise<MatchResult> {
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('user_id')
    .eq(column, value)
    .limit(3)
  if (error) throw new Error(error.message)
  if (!data?.length) return { status: 'none', userId: null }
  if (data.length > 1) return { status: 'ambiguous', userId: null }
  return { status: 'unique', userId: String(data[0].user_id) }
}

function backoffMinutes(attempt: number): number {
  return Math.min(24 * 60, Math.max(5, 2 ** Math.min(attempt + 2, 10)))
}

async function updateUnresolvedNotification(
  supabase: ReturnType<typeof client>,
  id: string,
  previousAttempts: number,
  values: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('customer_notifications')
    .update(values)
    .eq('id', id)
    .eq('identity_resolution_status', 'pending')
    .eq('identity_resolution_attempt_count', previousAttempts)
    .is('user_id', null)
    .select('id')
    .maybeSingle<{ id: string }>()
  if (error) throw new Error(error.message)
  return Boolean(data?.id)
}

export async function POST(request: Request) {
  if (!verifyScheduledJobRequest(request, process.env.CUSTOMER_PORTAL_OUTBOX_CRON_SECRET)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = client()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('customer_notifications')
    .select('id,external_customer_id,customer_number,customer_email,identity_resolution_attempt_count')
    .is('user_id', null)
    .eq('identity_resolution_status', 'pending')
    .or(`identity_resolution_next_attempt_at.is.null,identity_resolution_next_attempt_at.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const matches = new Map<string, Promise<MatchResult>>()
  function lookup(column: ProfileColumn, value: string | null): Promise<MatchResult> {
    if (!value) return Promise.resolve({ status: 'none', userId: null })
    const queryValue = column === 'email' ? value.toLowerCase() : value
    const key = JSON.stringify([column, queryValue])
    const cached = matches.get(key)
    if (cached) return cached
    const match = matchBy(supabase, column, queryValue).catch((error: unknown) => {
      matches.delete(key)
      throw error
    })
    matches.set(key, match)
    return match
  }

  let resolved = 0
  let pending = 0
  let ambiguous = 0
  let failed = 0
  let retriesScheduled = 0
  let retryWriteFailures = 0
  for (const row of data ?? []) {
    const previousAttempts = Number(row.identity_resolution_attempt_count ?? 0)
    const attempt = previousAttempts + 1
    const nextAttemptAt = new Date(Date.now() + backoffMinutes(attempt) * 60_000).toISOString()
    const update = (values: Record<string, unknown>) => updateUnresolvedNotification(
      supabase,
      String(row.id),
      previousAttempts,
      {
        ...values,
        identity_resolution_attempt_count: attempt,
        identity_resolution_last_attempt_at: now,
      },
    )

    try {
      const results = await Promise.allSettled([
        lookup('external_customer_id', row.external_customer_id),
        lookup('customer_number', row.customer_number),
        lookup('contract_customer_ref', row.customer_number),
        lookup('email', row.customer_email),
      ])
      const [externalMatch, customerNumberMatch, contractRefMatch, emailMatch] = results.map((result) => {
        if (result.status === 'rejected') throw result.reason
        return result.value
      })
      const customerUsers = new Set(
        [customerNumberMatch, contractRefMatch]
          .filter((match) => match.status === 'unique' && match.userId)
          .map((match) => match.userId as string),
      )
      const hasAmbiguousIdentifier = [externalMatch, customerNumberMatch, contractRefMatch, emailMatch]
        .some((match) => match.status === 'ambiguous') || customerUsers.size > 1
      const externalUser = externalMatch.status === 'unique' ? externalMatch.userId : null
      const customerUser = [...customerUsers][0] ?? null
      const emailUser = emailMatch.status === 'unique' ? emailMatch.userId : null
      const candidates = new Set([externalUser, customerUser, emailUser].filter((value): value is string => Boolean(value)))

      if (hasAmbiguousIdentifier || candidates.size > 1) {
        const updated = await update({
          identity_resolution_status: 'ambiguous',
          identity_resolution_error: 'Customer identifiers are ambiguous or point to different portal profiles.',
          identity_resolution_next_attempt_at: null,
        })
        if (updated) ambiguous += 1
        continue
      }

      const candidate = [...candidates][0] ?? null
      const matchingAttributes = candidate
        ? Number(customerUser === candidate) + Number(emailUser === candidate)
        : 0
      if (candidate && (externalUser === candidate || matchingAttributes >= 2)) {
        const updated = await update({
          user_id: candidate,
          identity_resolution_status: 'resolved',
          identity_resolution_error: null,
          identity_resolution_next_attempt_at: null,
        })
        if (updated) resolved += 1
        continue
      }

      const updated = await update({
        identity_resolution_status: 'pending',
        identity_resolution_error: 'No exact external customer match or two matching customer attributes were found; retry is scheduled.',
        identity_resolution_next_attempt_at: nextAttemptAt,
      })
      if (updated) pending += 1
    } catch {
      failed += 1
      try {
        const updated = await update({
          identity_resolution_status: 'pending',
          identity_resolution_error: 'Identity resolution failed during a database operation; retry is scheduled.',
          identity_resolution_next_attempt_at: nextAttemptAt,
        })
        if (updated) retriesScheduled += 1
      } catch {
        retryWriteFailures += 1
      }
    }
  }

  const checked = data?.length ?? 0
  const batchFailed = checked > 0 && failed === checked
  return NextResponse.json({
    ok: failed === 0,
    checked,
    resolved,
    pending,
    ambiguous,
    failed,
    retriesScheduled,
    retryWriteFailures,
    status: batchFailed ? 'failed' : failed > 0 ? 'partial' : 'completed',
  }, { status: batchFailed ? 503 : 200 })
}

export async function GET(request: Request) {
  return POST(request)
}
