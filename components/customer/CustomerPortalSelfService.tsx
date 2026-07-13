'use client'

import { useMemo, useState } from 'react'

type Props = {
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
  kind: 'idle' | 'working' | 'success' | 'error'
  message: string
}

const idle: ActionState = { kind: 'idle', message: '' }

function operationId(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`
}

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  })
  const payload = await response.json().catch(() => ({})) as {
    queued?: boolean
    error?: string | { message?: string }
  }
  if (!response.ok) {
    const message = typeof payload.error === 'string'
      ? payload.error
      : payload.error?.message || 'Åtgärden kunde inte genomföras.'
    throw new Error(message)
  }
  return payload
}

function Result({ state }: { state: ActionState }) {
  if (state.kind === 'idle' || state.kind === 'working') return null
  return (
    <p className={`mt-3 text-sm ${state.kind === 'success' ? 'text-emerald-200' : 'text-rose-200'}`} role="status">
      {state.message}
    </p>
  )
}

export default function CustomerPortalSelfService({ site, latestUnreadNotificationId }: Props) {
  const [syncState, setSyncState] = useState<ActionState>(idle)
  const [facilityState, setFacilityState] = useState<ActionState>(idle)
  const [moveState, setMoveState] = useState<ActionState>(idle)
  const [notificationState, setNotificationState] = useState<ActionState>(idle)
  const [facilityId, setFacilityId] = useState(site?.facilityId ?? '')
  const [meteringPointId, setMeteringPointId] = useState(site?.meteringPointId ?? '')
  const [gridAreaCode, setGridAreaCode] = useState(site?.gridAreaCode ?? '')
  const [priceAreaCode, setPriceAreaCode] = useState(site?.priceAreaCode ?? '')
  const [moveOutDate, setMoveOutDate] = useState('')

  const minimumMoveOutDate = useMemo(() => new Date().toISOString().slice(0, 10), [])

  async function syncPortal() {
    setSyncState({ kind: 'working', message: '' })
    try {
      const result = await postJson('/api/v1/customer-portal/sync', {
        client_operation_id: operationId('portal-sync'),
      })
      setSyncState({
        kind: 'success',
        message: result.queued
          ? 'Kopplingen är köad och uppdateras automatiskt.'
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
      const result = await postJson('/api/v1/customer/sync', {
        client_operation_id: operationId('facility-data'),
        facility_data: {
          site_id: site?.id ?? undefined,
          facility_id: facilityId.trim() || undefined,
          metering_point_id: meteringPointId.trim() || undefined,
          grid_area_code: gridAreaCode.trim() || undefined,
          price_area_code: priceAreaCode.trim().toUpperCase() || undefined,
          source: 'customer_portal_self_service',
          verified_at: new Date().toISOString(),
        },
      })
      setFacilityState({
        kind: 'success',
        message: result.queued
          ? 'Uppgifterna är mottagna och behandlas automatiskt.'
          : 'Anläggningsuppgifterna är uppdaterade.',
      })
    } catch (error) {
      setFacilityState({ kind: 'error', message: error instanceof Error ? error.message : 'Uppgifterna kunde inte sparas.' })
    }
  }

  async function submitMoveOut(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMoveState({ kind: 'working', message: '' })
    try {
      const result = await postJson('/api/v1/customer/move-out', {
        client_operation_id: operationId('move-out'),
        move_out: {
          site_id: site?.id ?? undefined,
          facility_id: site?.facilityId ?? (facilityId.trim() || undefined),
          move_out_date: moveOutDate,
          reason: 'customer_requested_move_out',
        },
      })
      setMoveState({
        kind: 'success',
        message: result.queued
          ? 'Flyttanmälan är mottagen och behandlas automatiskt.'
          : 'Flyttanmälan är skickad.',
      })
      setMoveOutDate('')
    } catch (error) {
      setMoveState({ kind: 'error', message: error instanceof Error ? error.message : 'Flyttanmälan kunde inte skickas.' })
    }
  }

  async function markLatestRead() {
    if (!latestUnreadNotificationId) return
    setNotificationState({ kind: 'working', message: '' })
    try {
      const result = await postJson('/api/v1/customer/notifications/read', {
        client_operation_id: operationId('notification-read'),
        notification_ids: [latestUnreadNotificationId],
      })
      setNotificationState({
        kind: 'success',
        message: result.queued ? 'Meddelandet markeras som läst.' : 'Meddelandet är markerat som läst.',
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
            <Field label="Nätområde" value={gridAreaCode} onChange={setGridAreaCode} />
            <Field label="Elområde" value={priceAreaCode} onChange={setPriceAreaCode} placeholder="SE1–SE4" />
          </div>
          <button type="submit" disabled={facilityState.kind === 'working'} className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
            {facilityState.kind === 'working' ? 'Sparar…' : 'Spara uppgifter'}
          </button>
          <Result state={facilityState} />
        </form>

        <form onSubmit={submitMoveOut} className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h3 className="font-medium">Flyttanmälan</h3>
          <p className="mt-1 text-xs text-white/50">Ange datumet då du lämnar anläggningen.</p>
          <label className="mt-4 block text-xs text-white/60">
            Utflyttningsdatum
            <input
              type="date"
              required
              min={minimumMoveOutDate}
              value={moveOutDate}
              onChange={(event) => setMoveOutDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <button type="submit" disabled={moveState.kind === 'working' || (!site && !facilityId.trim())} className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
            {moveState.kind === 'working' ? 'Skickar…' : 'Skicka flyttanmälan'}
          </button>
          {!site && !facilityId.trim() ? <p className="mt-3 text-xs text-amber-200">Ange anläggnings-ID först.</p> : null}
          <Result state={moveState} />
        </form>
      </div>

      {latestUnreadNotificationId ? (
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
