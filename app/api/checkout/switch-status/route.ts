import { NextResponse } from 'next/server'
import { fetchOpsWebsiteSwitchStatus, isOpsError } from '@/lib/ops/client'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'
import { isWebsiteApplicationResultTokenShape, readWebsiteApplicationResult } from '@/lib/website/applicationResultStore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type PublicSwitchStatus = {
  status: string
  label: string
  message: string
  updated_at: string | null
  terminal: boolean
}

function text(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function publicSwitchStatus(value: Record<string, unknown> | null): PublicSwitchStatus {
  const raw = text(value ?? {}, ['status', 'switch_status', 'supplier_switch_status', 'state'])?.toLowerCase() ?? 'pending'
  const updatedAt = text(value ?? {}, ['updated_at', 'changed_at', 'status_at', 'processed_at'])
  if (/complete|completed|accepted|active|switched|done/.test(raw)) {
    return { status: 'completed', label: 'Leverantörsbytet är klart', message: 'Bytet är genomfört eller slutligt godkänt.', updated_at: updatedAt, terminal: true }
  }
  if (/reject|declin|failed|error|cancel/.test(raw)) {
    return { status: 'needs_attention', label: 'Leverantörsbytet behöver hanteras', message: 'Vi behöver kontrollera ärendet innan bytet kan fortsätta. Du får mer information via e-post eller Mina sidor.', updated_at: updatedAt, terminal: true }
  }
  if (/block|missing|awaiting_data|incomplete/.test(raw)) {
    return { status: 'awaiting_information', label: 'Vi inväntar komplettering', message: 'Leverantörsbytet fortsätter när nödvändiga anläggningsuppgifter är verifierade.', updated_at: updatedAt, terminal: false }
  }
  if (/submit|sent|requested|processing|progress|queue/.test(raw)) {
    return { status: 'in_progress', label: 'Leverantörsbytet behandlas', message: 'Underlaget är skickat eller behandlas nu.', updated_at: updatedAt, terminal: false }
  }
  return { status: 'pending', label: 'Leverantörsbytet förbereds', message: 'Vi kontrollerar uppgifterna innan bytet kan starta.', updated_at: updatedAt, terminal: false }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const resultToken = url.searchParams.get('result_token')?.trim() ?? ''
  if (!isWebsiteApplicationResultTokenShape(resultToken)) {
    return NextResponse.json({ error: { code: 'result_token_required' } }, { status: 400 })
  }
  const rate = await checkRateLimit(
    `website-switch-status:${clientIpFromHeaders(new Headers(req.headers))}`,
    { limit: 30, windowMs: 10 * 60_000 },
  )
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited' } },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1_000))) } },
    )
  }
  try {
    const result = await readWebsiteApplicationResult(resultToken)
    const applicationNumber = result?.applicationNumber?.trim() ?? ''
    if (!applicationNumber) {
      return NextResponse.json({ error: { code: 'application_not_found' } }, { status: 404 })
    }
    const status = await fetchOpsWebsiteSwitchStatus(applicationNumber)
    return NextResponse.json(
      { data: publicSwitchStatus(status) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    if (isOpsError(error) && error.status === 404) {
      return NextResponse.json({ error: { code: 'application_not_found' } }, { status: 404 })
    }
    return NextResponse.json({ error: { code: 'switch_status_unavailable' } }, { status: 503 })
  }
}
