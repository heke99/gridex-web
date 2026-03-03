import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase/service'
import { ContractAgreement } from '@/lib/types/contracts'

export async function GET() {
  const { data, error } = await supabaseService
    .from('contract_agreements')
    .select('*')

  if (error) throw error
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'No data' }, { status: 404 })
  }

  const agreements = data as ContractAgreement[]

  const headers = Object.keys(agreements[0]).join(',')

  const rows = agreements.map((row) =>
    Object.values(row)
      .map((v) => `"${v ?? ''}"`)
      .join(',')
  )

  const csv = [headers, ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="agreements.csv"',
    },
  })
}