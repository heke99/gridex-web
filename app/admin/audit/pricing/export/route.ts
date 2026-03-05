// app/admin/audit/pricing/export/route.ts
import { NextResponse } from 'next/server'
import { requireAdminActionAccess } from '@/lib/admin/guards'

type AuditRow = {
  id: string
  contract_id: string
  version_id: string
  action: 'publish' | 'unpublish'
  performed_by: string
  performed_at: string
}

export async function GET(req: Request) {
  const ctx = await requireAdminActionAccess({ anyOf: ['admin.access'] })
  const supabase = ctx.supabase

  const { data, error } = await supabase
    .from('pricing_version_audit')
    .select('id, contract_id, version_id, action, performed_by, performed_at')
    .order('performed_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows: AuditRow[] = data ?? []

  const header = [
    'performed_at',
    'action',
    'contract_id',
    'version_id',
    'performed_by',
    'id',
  ]

  const csvRows = rows.map((r) =>
    [
      r.performed_at,
      r.action,
      r.contract_id,
      r.version_id,
      r.performed_by,
      r.id,
    ].join(',')
  )

  const csv = [header.join(','), ...csvRows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="pricing_audit.csv"`,
    },
  })
}