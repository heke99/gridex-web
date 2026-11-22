import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { fetchOpsWebsiteSwitchStatus, isOpsError } from '@/lib/ops/client'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rateLimit'
import { isWebsiteApplicationResultTokenShape, readWebsiteApplicationResultState } from '@/lib/website/applicationResultStore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type PublicSwitchStatus = {
  status: string
  label: string
  message: string
  updated_at: string | null
  terminal: boolean
}

function publicSwitchStatus(value: Awaited<ReturnType<typeof fetchOpsWebsiteSwitchStatus>>): PublicSwitchStatus {
  if (!value.switch) {
    return { status: 'unknown', label: 'Leverantörsbytets status är obekräftad', message: 'Vi kan ännu inte bekräfta statusen för bytet som hör till ditt avtal.', updated_at: null, terminal: false }
  }
  const raw = value.switch?.status?.trim().toLowerCase() ?? 'pending'
  const updatedAt = value.switch?.updated_at ?? null
  if (['complete', 'completed', 'accepted', 'active', 'switched', 'done'].includes(raw)) {
    return { status: 'completed', label: 'Leverantörsbytet är klart', message: 'Bytet är genomfört eller slutligt godkänt.', updated_at: updatedAt, terminal: true }
  }
  if (['rejected', 'declined', 'failed', 'error', 'cancelled', 'canceled'].includes(raw)) {
    return { status: 'needs_attention', label: 'Leverantörsbytet behöver hanteras', message: 'Vi behöver kontrollera ärendet innan bytet kan fortsätta. Du får mer information via e-post eller Mina sidor.', updated_at: updatedAt, terminal: true }
  }
  if (value.switch?.lifecycle_blocked || ['blocked', 'missing', 'missing_data', 'awaiting_data', 'incomplete'].includes(raw)) {
    return { status: 'awaiting_information', label: 'Vi inväntar komplettering', message: 'Leverantörsbytet fortsätter när nödvändiga anläggningsuppgifter är verifierade.', updated_at: updatedAt, terminal: false }
  }
  if (['submitted', 'sent', 'requested', 'processing', 'in_progress', 'queued'].includes(raw)) {
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
    { limit: 1200, windowMs: 10 * 60_000 },
  )
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited' } },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1_000))) } },
    )
  }
  try {
    const receipt = await readWebsiteApplicationResultState(resultToken)
    if (receipt.status === 'storage_error') {
      return NextResponse.json({ error: { code: 'switch_status_unavailable' } }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
    }
    if (receipt.status === 'expired') {
      return NextResponse.json({ error: { code: 'result_token_expired' } }, { status: 410 })
    }
    const applicationNumber = receipt.result?.applicationNumber?.trim() ?? ''
    if (!applicationNumber) {
      return NextResponse.json({ error: { code: 'application_not_found' } }, { status: 404 })
    }
    // Use the verified receipt's application, so unrelated customers sharing an IP do not share this quota.
    const applicationRate = await checkRateLimit(
      `website-switch-status:application:${createHash('sha256').update(applicationNumber).digest('hex')}`,
      { limit: 120, windowMs: 10 * 60_000 },
    )
    if (!applicationRate.allowed) return NextResponse.json({ error: { code: 'rate_limited' } }, { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((applicationRate.resetAt - Date.now()) / 1_000))) } })
    const status = await fetchOpsWebsiteSwitchStatus(applicationNumber, { includeEvents: false })
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
