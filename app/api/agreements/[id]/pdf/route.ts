import { NextRequest, NextResponse } from 'next/server'
import { requireGlobalAdminActionAccess } from '@/lib/admin/guards'
import { AccessDeniedError } from '@/lib/admin/access'
import { supabaseService } from '@/lib/supabase/service'
import { privateJsonResponse } from '@/lib/api/webBoundary'

type Context = {
  params: Promise<{ id: string }>
}

export async function GET(
  _request: NextRequest,
  context: Context
) {
  try {
    await requireGlobalAdminActionAccess({ allOf: ['agreements.read'] })
  } catch (error) {
    return privateJsonResponse({ error: 'Behörighet saknas.' }, {
      status: error instanceof AccessDeniedError ? error.status : 503,
    })
  }

  const { id } = await context.params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return privateJsonResponse({ error: 'Ogiltig avtalsreferens.' }, { status: 400 })
  }

  let path: string
  try {
    const { data: agreement, error: lookupError } = await supabaseService
      .from('contract_agreements').select('contract_pdf_path').eq('id', id).maybeSingle<{ contract_pdf_path: string | null }>()
    if (lookupError) return privateJsonResponse({ error: 'Dokumentreferensen kunde inte hämtas.' }, { status: 503 })
    if (!agreement?.contract_pdf_path) return privateJsonResponse({ error: 'Dokumentet är inte tillgängligt ännu.' }, { status: 404 })
    path = agreement.contract_pdf_path
    if (path.length > 1024 || /[\\\x00-\x1f\x7f?#]/.test(path) || /^[a-z]+:/i.test(path) ||
      path.split('/').some((part) => !part || part === '.' || part === '..')) {
      return privateJsonResponse({ error: 'Dokumentreferensen är ogiltig.' }, { status: 503 })
    }
  } catch {
    return privateJsonResponse({ error: 'Dokumentreferensen kunde inte hämtas.' }, { status: 503 })
  }

  const bucket = process.env.CONTRACTS_BUCKET || 'contract-docs'

  let data: Blob | null
  try {
    const result = await supabaseService.storage.from(bucket).download(path)
    if (result.error || !result.data) return privateJsonResponse({ error: 'Dokumentet kunde inte hittas.' }, { status: 404 })
    data = result.data
  } catch {
    return privateJsonResponse({ error: 'Dokumentet kunde inte hämtas.' }, { status: 503 })
  }

  return new NextResponse(data, {
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="${id}.pdf"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    },
  })
}
