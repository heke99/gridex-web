import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type MatchResult = { status: 'none' | 'unique' | 'ambiguous'; userId: string | null }

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value || null
}

function authorized(request: Request): boolean {
  const secret = env('CUSTOMER_PORTAL_OUTBOX_CRON_SECRET') ?? env('CRON_SECRET')
  return Boolean(
    secret &&
      (request.headers.get('authorization') === `Bearer ${secret}` ||
        request.headers.get('x-cron-secret') === secret),
  )
}

function client() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase service role is not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function matchBy(
  supabase: ReturnType<typeof client>,
  column: 'external_customer_id' | 'customer_number' | 'contract_customer_ref' | 'email',
  value: string | null,
): Promise<MatchResult> {
  if (!value) return { status: 'none', userId: null }
  const queryValue = column === 'email' ? value.toLowerCase() : value
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('user_id')
    .eq(column, queryValue)
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
  values: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('customer_notifications')
    .update(values)
    .eq('id', id)
    .is('user_id', null)
    .select('id')
    .maybeSingle<{ id: string }>()
  if (error) throw new Error(error.message)
  return Boolean(data?.id)
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  let resolved = 0
  let pending = 0
  let ambiguous = 0
  for (const row of data ?? []) {
    const matches = await Promise.all([
      matchBy(supabase, 'external_customer_id', row.external_customer_id),
      matchBy(supabase, 'customer_number', row.customer_number),
      matchBy(supabase, 'contract_customer_ref', row.customer_number),
      matchBy(supabase, 'email', row.customer_email),
    ])
    const candidates = new Set(
      matches.filter((match) => match.status === 'unique' && match.userId).map((match) => match.userId as string),
    )
    const hasAmbiguousIdentifier = matches.some((match) => match.status === 'ambiguous')
    const attempt = Number(row.identity_resolution_attempt_count ?? 0) + 1

    if (!hasAmbiguousIdentifier && candidates.size === 1) {
      const updated = await updateUnresolvedNotification(supabase, String(row.id), {
        user_id: [...candidates][0],
        identity_resolution_status: 'resolved',
        identity_resolution_error: null,
        identity_resolution_attempt_count: attempt,
        identity_resolution_last_attempt_at: now,
        identity_resolution_next_attempt_at: null,
      })
      if (updated) resolved += 1
      continue
    }

    if (hasAmbiguousIdentifier || candidates.size > 1) {
      const updated = await updateUnresolvedNotification(supabase, String(row.id), {
        identity_resolution_status: 'ambiguous',
        identity_resolution_error: 'Customer identifiers are ambiguous or point to different portal profiles.',
        identity_resolution_attempt_count: attempt,
        identity_resolution_last_attempt_at: now,
        identity_resolution_next_attempt_at: null,
      })
      if (updated) ambiguous += 1
      continue
    }

    const updated = await updateUnresolvedNotification(supabase, String(row.id), {
      identity_resolution_status: 'pending',
      identity_resolution_error: 'No local portal profile matched yet; retry is scheduled.',
      identity_resolution_attempt_count: attempt,
      identity_resolution_last_attempt_at: now,
      identity_resolution_next_attempt_at: new Date(Date.now() + backoffMinutes(attempt) * 60_000).toISOString(),
    })
    if (updated) pending += 1
  }
  return NextResponse.json({ ok: true, checked: (data ?? []).length, resolved, pending, ambiguous })
}

export async function GET(request: Request) {
  return POST(request)
}
