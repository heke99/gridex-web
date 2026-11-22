import { NextResponse } from 'next/server'
import { requireAdminActionAccess } from '@/lib/admin/guards'
import { logPermissionAudit } from '@/lib/auth/audit'
import { AGREEMENT_EXPORT_LIMIT } from '@/lib/admin/agreementExport'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CSV_COLUMNS = ['created_at', 'status', 'customer_number', 'agreement_reference', 'email'] as const
const PAGE_SIZE = 500

type ExportRow = Record<(typeof CSV_COLUMNS)[number], string | null> & {
  id: string
}

function csvEscape(value: string | null): string {
  return `"${(value ?? '').replace(/"/g, '""')}"`
}

function csvResponse(rows: ExportRow[], truncated: boolean): NextResponse {
  const lines = [CSV_COLUMNS.join(','), ...rows.map(row => CSV_COLUMNS.map(key => csvEscape(row[key])).join(','))]
  return new NextResponse(`${lines.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="agreements.csv"',
      'Cache-Control': 'no-store',
      'X-Export-Row-Limit': String(AGREEMENT_EXPORT_LIMIT),
      'X-Export-Truncated': String(truncated),
    },
  })
}

async function readExportRows(supabase: Awaited<ReturnType<typeof requireAdminActionAccess>>['supabase']) {
  const rows: ExportRow[] = []
  let cursor: ExportRow | undefined
  while (rows.length <= AGREEMENT_EXPORT_LIMIT) {
    const limit = Math.min(PAGE_SIZE, AGREEMENT_EXPORT_LIMIT + 1 - rows.length)
    let query = supabase
      .from('contract_agreements')
      .select(`id,${CSV_COLUMNS.join(',')}`)
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(limit)
    if (cursor) {
      query = cursor.created_at === null
        ? query.is('created_at', null).lt('id', cursor.id)
        : query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id}),created_at.is.null`)
    }
    const { data, error } = await query.returns<ExportRow[]>()
    if (error) throw error
    const page = data ?? []
    rows.push(...page)
    if (page.length === 0) break
    cursor = page.at(-1)
  }
  return { rows: rows.slice(0, AGREEMENT_EXPORT_LIMIT), truncated: rows.length > AGREEMENT_EXPORT_LIMIT }
}

export async function GET() {
  let ctx: Awaited<ReturnType<typeof requireAdminActionAccess>>
  try {
    ctx = await requireAdminActionAccess({
      anyOf: ['agreements.export', 'agreements.read', 'admin.access'],
    })
  } catch (error) {
    console.error('[admin.agreements.export] denied', error)
    return NextResponse.json({ error: 'Behörighet saknas.' }, { status: 403 })
  }

  try {
    const { rows, truncated } = await readExportRows(ctx.supabase)
    await logPermissionAudit({
      actorId: ctx.userId,
      action: 'agreements.export_csv',
      metadata: { rows: rows.length, truncated, source: 'gridex_web_admin' },
    }).catch((error) => {
      console.error('[admin.agreements.export] audit failed', error)
    })

    return csvResponse(rows, truncated)
  } catch (error) {
    console.error('[admin.agreements.export] query failed', error)
    return NextResponse.json(
      { error: 'Kunde inte exportera avtal.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
