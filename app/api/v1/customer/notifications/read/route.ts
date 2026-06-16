import { NextResponse } from 'next/server'
import { createSupabaseServerActionClient } from '@/lib/supabase/server'
import { getCustomerProfile } from '@/lib/customerPortal/service'
import { markOpsCustomerNotificationsRead } from '@/lib/ops/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function notificationIds(body: unknown): string[] {
  if (!body || typeof body !== 'object') return []
  const raw = (body as Record<string, unknown>).notification_ids ?? (body as Record<string, unknown>).ids
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .slice(0, 100)
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerActionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ids = notificationIds(await req.json().catch(() => null))
  if (ids.length === 0) {
    return NextResponse.json({ error: 'notification_ids saknas.' }, { status: 400 })
  }

  const profile = await getCustomerProfile(supabase, user.id, user).catch(() => null)

  await supabase
    .from('customer_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .in('id', ids)

  await markOpsCustomerNotificationsRead(
    {
      userId: user.id,
      email: user.email ?? profile?.email ?? null,
      customerNumber: profile?.customer_number ?? profile?.contract_customer_ref ?? null,
      externalCustomerId: profile?.external_customer_id ?? null,
    },
    ids
  ).catch(() => null)

  return NextResponse.json({ ok: true })
}
