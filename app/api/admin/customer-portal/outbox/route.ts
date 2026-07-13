import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin/getAdminContext'
import { replayPortalWriteOutbox } from '@/lib/customerPortal/outbox'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const ctx = await getAdminContext()
    const canReplay =
      ctx.isAdmin ||
      ctx.permissions.includes('integrations.write') ||
      ctx.permissions.includes('admin.access')
    if (!ctx.userId || !canReplay) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => null) as { id?: unknown } | null
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    if (!id) return NextResponse.json({ error: 'Outbox-ID saknas.' }, { status: 400 })
    await replayPortalWriteOutbox(id)
    return NextResponse.json({ ok: true, status: 'pending' })
  } catch (error) {
    console.error('[admin.portal-outbox.replay] failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Operationen kunde inte köas om.' },
      { status: 500 },
    )
  }
}
