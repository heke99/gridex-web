import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Acceptance is recorded only through the canonical OPS checkout with server-loaded legal documents. */
export async function POST() {
  return NextResponse.json({ error: { code: 'legacy_legal_acceptance_retired', message: 'Använd det aktuella teckningsflödet.' } }, {
    status: 410, headers: { 'Cache-Control': 'private, no-store' },
  })
}
