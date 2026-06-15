import { NextResponse } from 'next/server'
import { requireAdminActionAccess } from '@/lib/admin/guards'
import { logPermissionAudit } from '@/lib/auth/audit'
import type { ContractAgreement } from '@/lib/types/contracts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function csvResponse(rows: ContractAgreement[]): NextResponse {
  if (rows.length === 0) {
    return new NextResponse('created_at,status,customer_number,agreement_reference,email\n', {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="agreements.csv"',
        'Cache-Control': 'no-store',
      },
    })
  }

  const headers = Object.keys(rows[0])
  const csvRows = rows.map((row) =>
    headers.map((key) => csvEscape((row as unknown as Record<string, unknown>)[key])).join(','),
  )
  const csv = [headers.join(','), ...csvRows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="agreements.csv"',
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET() {
  try {
    const ctx = await requireAdminActionAccess({
      anyOf: ['agreements.export', 'agreements.read', 'admin.access'],
    })

    const { data, error } = await ctx.supabase
      .from('contract_agreements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) {
      console.error('[admin.agreements.export] query failed', error)
      return NextResponse.json({ error: 'Kunde inte exportera avtal.' }, { status: 500 })
    }

    await logPermissionAudit({
      actorId: ctx.userId,
      action: 'agreements.export_csv',
      metadata: {
        rows: data?.length ?? 0,
        source: 'gridex_web_admin',
      },
    }).catch((error) => {
      console.error('[admin.agreements.export] audit failed', error)
    })

    return csvResponse((data ?? []) as ContractAgreement[])
  } catch (error) {
    console.error('[admin.agreements.export] denied', error)
    return NextResponse.json({ error: 'Behörighet saknas.' }, { status: 403 })
  }
}
