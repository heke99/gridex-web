'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readCustomerWriteResponse, readMoveOutReceipt, pendingCustomerWrite as pendingResult } from '@/lib/customerPortal/writeResponse'
import { withAbort } from '@/lib/ops/httpSafety'
import { moveOutDateBounds } from '@/lib/website/businessDate'

type MoveOutSite = { reference: string; address: string | null; facilityId: string | null }

type Props = {
  moveOutSites: readonly MoveOutSite[]
  userId?: string
  site: {
    id: string
    facilityId: string | null
    meteringPointId: string | null
    gridAreaCode: string | null
    priceAreaCode: string | null
  } | null
  latestUnreadNotificationId?: string | null
}

type ActionState = {
  kind: 'idle' | 'working' | 'success' | 'pending' | 'error'
  message: string
}

const MOVE_OUT_TIMEOUT_MS = 20_000

const idle: ActionState = { kind: 'idle', message: '' }

function operationId(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`
}

async function postJson(path: string, body: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
    signal,
  })
  return readCustomerWriteResponse(response)
}

function Result({ state }: { state: ActionState }) {
  if (state.kind === 'idle' || state.kind === 'working') return null
  return (
    <p className={`mt-3 text-sm ${state.kind === 'success' ? 'text-emerald-200' : state.kind === 'pending' ? 'text-amber-200' : 'text-rose-200'}`} role="status">
      {state.message}
    </p>
  )
}

export default function CustomerPortalSelfService({ site, moveOutSites, latestUnreadNotificationId, userId }: Props) {
  const router = useRouter()
  const [readNotificationId, setReadNotificationId] = useState<string | null>(null)
  const intents = useRef(new Map<string, string>())
  async function submitIntent(path: string, prefix: string, body: Record<string, unknown>, signal?: AbortSignal) {
    const bytes = new TextEncoder().encode(JSON.stringify(body))
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
    const key = `gridex:portal-intent:${userId ?? 'session'}:${prefix}:${hash}`
    let id = intents.current.get(key)
    if (!id && userId) { try { id = sessionStorage.getItem(key) ?? undefined } catch {} }
    if (!id) id = operationId(prefix)
    intents.current.set(key, id)
    if (userId) { try { sessionStorage.setItem(key, id) } catch {} }
    signal?.throwIfAborted()
    const request = postJson(path, { ...body, client_operation_id: id }, signal)
    const result = await (signal ? withAbort(request, signal) : request)
    if (prefix === 'move-out') return { ...result, releaseIntent: () => {
      intents.current.delete(key)
      if (userId) { try { sessionStorage.removeItem(key) } catch {} }
    } }
    if (!pendingResult(result) && !(prefix === 'facility-data' && (!result.facilityOutcome || result.facilityOutcome === 'unconfirmed'))) {
      intents.current.delete(key)
      if (userId) { try { sessionStorage.removeItem(key) } catch {} }
      router.refresh()
    }
    return result
  }
  const [syncState, setSyncState] = useState<ActionState>(idle)
  const [facilityState, setFacilityState] = useState<ActionState>(idle)
  const [moveState, setMoveState] = useState<ActionState>(idle)
  const [notificationState, setNotificationState] = useState<ActionState>(idle)
  const [facilityId, setFacilityId] = useState(site?.facilityId ?? '')
  const [meteringPointId, setMeteringPointId] = useState(site?.meteringPointId ?? '')
  const [moveOutDate, setMoveOutDate] = useState('')
  const [moveOutSiteReference, setMoveOutSiteReference] = useState('')
  const moveOutSite = moveOutSites.length === 1
    ? moveOutSites[0]
    : moveOutSites.find(candidate => candidate.reference === moveOutSiteReference)
  const moveOutFacilityReference = moveOutSite?.reference ?? (moveOutSites.length === 0 ? facilityId.trim() : '')

  const moveOutDates = moveOutDateBounds()

  async function syncPortal() {
    setSyncState({ kind: 'working', message: '' })
    try {
      const result = await submitIntent('/api/web/customer-portal/sync', 'portal-sync', {})
      setSyncState({
        kind: pendingResult(result) ? 'pending' : 'success',
        message: pendingResult(result)
          ? 'Kopplingen inväntar behandling. Tillgången till Mina sidor är ännu inte bekräftad.'
          : 'Kopplingen till Mina sidor är uppdaterad.',
      })
    } catch (error) {
      setSyncState({ kind: 'error', message: error instanceof Error ? error.message : 'Kopplingen kunde inte uppdateras.' })
    }
  }

  async function submitFacility(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFacilityState({ kind: 'working', message: '' })
    try {
      const result = await submitIntent('/api/web/customer/sync', 'facility-data', {
        facility_data: {
          site_id: site?.id ?? undefined,
          facility_id: facilityId.trim() || undefined,
          metering_point_id: meteringPointId.trim() || undefined,
          source: 'customer_portal_self_service',
        },
      })
      if (pendingResult(result)) {
        setFacilityState({ kind: 'pending', message: 'Uppgifterna är mottagna och behandlas automatiskt.' })
      } else if (result.facilityOutcome === 'updated') {
        setFacilityState({ kind: 'success', message: 'Anläggningsuppgifterna är uppdaterade.' })
      } else if (result.facilityOutcome === 'unchanged') {
        setFacilityState({ kind: 'success', message: 'Uppgifterna behandlades utan att någon ändring registrerades.' })
      } else if (result.facilityOutcome === 'skipped') {
        setFacilityState({ kind: 'error', message: 'Anläggningsändringen hoppades över. Kontrollera uppgifterna och försök igen.' })
      } else {
        setFacilityState({ kind: 'pending', message: 'Kunde inte bekräfta att anläggningsuppgifterna uppdaterades.' })
      }
    } catch (error) {
      setFacilityState({ kind: 'error', message: error instanceof Error ? error.message : 'Uppgifterna kunde inte sparas.' })
    }
  }

  async function submitMoveOut(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!moveOutFacilityReference) {
      setMoveState({ kind: 'error', message: 'Ange vilken anläggning du flyttar från.' })
      return
    }
    const { min, max } = moveOutDateBounds()
    if (!moveOutDate || moveOutDate < min || moveOutDate > max) {
      setMoveState({ kind: 'error', message: 'Välj ett utflyttningsdatum från idag och högst 730 dagar framåt.' })
      return
    }
    const signal = AbortSignal.timeout(MOVE_OUT_TIMEOUT_MS)
    setMoveState({ kind: 'working', message: '' })
    try {
      const result = await submitIntent('/api/web/customer/move-out', 'move-out', {
        move_out: {
          facility_reference: moveOutFacilityReference,
          move_out_date: moveOutDate,
          reason: 'customer_requested_move_out',
        },
      }, signal)
      const receipt = readMoveOutReceipt(result.moveOutReceipt, moveOutFacilityReference, moveOutDate)
      if (!receipt) {
        setMoveState({ kind: 'pending', message: 'Kvittot kunde inte bekräftas. Försök igen med samma uppgifter.' })
        return
      }
      if ('releaseIntent' in result) result.releaseIntent()
      setMoveState({
        kind: 'success',
        message: `Flyttanmälan är skickad. Kvitto ${receipt.completion_reference} för anläggning ${receipt.facility_reference}. Utflyttningsdatum ${receipt.requested_move_out_date}.`,
      })
      setMoveOutDate('')
    } catch (error) {
      setMoveState(signal.aborted ? {
        kind: 'pending',
        message: 'Vi kunde inte bekräfta om flyttanmälan togs emot. Försök igen med samma uppgifter.',
      } : { kind: 'error', message: error instanceof Error ? error.message : 'Flyttanmälan kunde inte skickas.' })
    }
  }

  async function markLatestRead() {
    if (!latestUnreadNotificationId) return
    setNotificationState({ kind: 'working', message: '' })
    try {
      const result = await submitIntent('/api/web/customer/notifications/read', 'notification-read', {
        notification_ids: [latestUnreadNotificationId],
      })
      const pending = pendingResult(result)
      if (!pending) setReadNotificationId(latestUnreadNotificationId)
      setNotificationState({
        kind: pending ? 'pending' : 'success',
        message: pending ? 'Meddelandet markeras som läst.' : 'Meddelandet är markerat som läst.',
      })
    } catch (error) {
      setNotificationState({ kind: 'error', message: error instanceof Error ? error.message : 'Meddelandet kunde inte uppdateras.' })
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Hantera dina uppgifter</h2>
          <p className="mt-1 text-sm text-white/60">Komplettera anläggningen, anmäl flytt eller uppdatera kopplingen till Mina sidor.</p>
        </div>
        <button
          type="button"
          onClick={syncPortal}
          disabled={syncState.kind === 'working'}
          className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 disabled:opacity-50"
        >
          {syncState.kind === 'working' ? 'Uppdaterar…' : 'Uppdatera Mina sidor'}
        </button>
      </div>
      <Result state={syncState} />

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <form onSubmit={submitFacility} className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h3 className="font-medium">Anläggningsuppgifter</h3>
          <p className="mt-1 text-xs text-white/50">Fyll i det du känner till. Tomma fält lämnas oförändrade.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Anläggnings-ID" value={facilityId} onChange={setFacilityId} />
            <Field label="Mätpunkts-ID" value={meteringPointId} onChange={setMeteringPointId} />
            <p className="text-xs text-white/60">Nätområde: {site?.gridAreaCode ?? 'Inväntas'}<br />Elområde: {site?.priceAreaCode ?? 'Inväntas'}<br />Områdena fastställs från anläggningsuppgifterna.</p>
          </div>
          <button type="submit" disabled={facilityState.kind === 'working'} className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
            {facilityState.kind === 'working' ? 'Sparar…' : 'Spara uppgifter'}
          </button>
          <Result state={facilityState} />
        </form>

        <form onSubmit={submitMoveOut} className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h3 className="font-medium">Flyttanmälan</h3>
          <p className="mt-1 text-xs text-white/50">Ange datumet då du lämnar anläggningen.</p>
          {moveOutSites.length > 1 && (
            <label className="mt-4 block text-xs text-white/60">
              Anläggning
              <select required value={moveOutSite?.reference ?? ''} disabled={moveState.kind === 'working'}
                onChange={(event) => { setMoveOutSiteReference(event.target.value); setMoveState(idle) }}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
                <option value="">Välj anläggning</option>
                {moveOutSites.map(candidate => (
                  <option key={candidate.reference} value={candidate.reference}>
                    {candidate.address ?? 'Adress saknas'} · {candidate.facilityId ?? candidate.reference}
                  </option>
                ))}
              </select>
            </label>
          )}
          {moveOutSite && <p className="mt-3 text-sm text-white/80">
            {moveOutSite.address ?? 'Adress saknas'} · Anläggningsreferens {moveOutSite.reference}
          </p>}
          <label className="mt-4 block text-xs text-white/60">
            Utflyttningsdatum
            <input
              type="date"
              required
              min={moveOutDates.min}
              max={moveOutDates.max}
              value={moveOutDate}
              onChange={(event) => setMoveOutDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <button type="submit" disabled={moveState.kind === 'working' || !moveOutFacilityReference} className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
            {moveState.kind === 'working' ? 'Skickar…' : 'Skicka flyttanmälan'}
          </button>
          {moveOutSites.length === 0 && !moveOutFacilityReference ? <p className="mt-3 text-xs text-amber-200">Ange anläggnings-ID först.</p> : null}
          <Result state={moveState} />
        </form>
      </div>

      {latestUnreadNotificationId && latestUnreadNotificationId !== readNotificationId ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <span className="text-sm text-white/70">Senaste meddelandet är oläst.</span>
          <button type="button" onClick={markLatestRead} disabled={notificationState.kind === 'working'} className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50">
            {notificationState.kind === 'working' ? 'Uppdaterar…' : 'Markera som läst'}
          </button>
          <Result state={notificationState} />
        </div>
      ) : null}
    </section>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="text-xs text-white/60">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={120}
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25"
      />
    </label>
  )
}
