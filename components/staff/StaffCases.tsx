'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { StaffClient } from './client'
import { priorityLabels, staffDate, staffPath, statusLabels } from './client'
import type { StaffAssignee, StaffAttachment, StaffCase, StaffCustomerDetail, StaffEntry, StaffFacility } from './types'
import { useStaffPage } from './useStaffPage'
import { Feedback, field, panel, primary, secondary, PageControls, Value } from './ui'

const actionStatuses = ['open', 'action_required', 'awaiting_external_response', 'manual_follow_up', 'resolved', 'closed']
const entryLabels: Record<string, string> = { customer_message: 'Kundmeddelande', staff_reply: 'Svar till kund', internal_note: 'Intern anteckning', phone_interaction: 'Telefonsamtal', created: 'Ärende skapat', status_changed: 'Status ändrad', assignment_changed: 'Tilldelning ändrad', message: 'Meddelande', phone_summary: 'Samtalssammanfattning' }

export function StaffCaseDetail({ reference, client, canWrite, onChange }: { reference: string; client: StaffClient; canWrite: boolean; onChange?: (ticket: StaffCase) => void }) {
  const base = `/api/staff/support/cases/${staffPath(reference)}`
  const [detail, setDetail] = useState<StaffCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const active = useRef<AbortController | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const entries = useStaffPage<StaffEntry>(client, `${base}/entries`, 'entry_reference')
  const attachments = useStaffPage<StaffAttachment>(client, `${base}/attachments`, 'attachment_reference')
  const assignees = useStaffPage<StaffAssignee>(client, canWrite ? '/api/staff/support/assignees' : null, 'staff_reference')
  async function readDetail(signal?: AbortSignal) {
    const result = await client.read<StaffCase>(base, signal)
    if (!signal?.aborted) { setDetail(result.data); onChange?.(result.data) }
  }
  useEffect(() => {
    const controller = new AbortController(); active.current = controller
    setLoading(true); setDetail(null)
    void readDetail(controller.signal).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Ärendet kunde inte hämtas.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
    // The reference keys this detail view; callbacks do not identify the resource.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, client])
  const waiting = busy || loading || entries.loading || attachments.loading
  const conversationOpen = detail && !['resolved', 'closed', 'cancelled'].includes(detail.status)
  async function refresh() {
    if (lock.current || waiting) return
    lock.current = true; setLoading(true); setError(null)
    try { await readDetail(); entries.refresh(); attachments.refresh(); assignees.refresh() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Ärendet kunde inte uppdateras.') }
    finally { lock.current = false; setLoading(false) }
  }
  async function mutate(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault()
    if (lock.current || waiting || !canWrite || !detail || ['replies', 'internal-notes', 'attachments'].includes(action) && !conversationOpen) return
    const form = event.currentTarget
    const values = new FormData(form)
    const value = (name: string) => String(values.get(name) ?? '').trim()
    let body: Record<string, unknown> | FormData
    let fingerprint: string | undefined
    lock.current = true; setBusy(true); setError(null); setNotice(null)
    try {
      if (action === 'attachments') {
        const file = values.get('file')
        if (!(file instanceof File) || !file.size) throw new Error('Välj en fil först.')
        if (file.size > 4 * 1024 * 1024 || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) throw new Error('Välj PDF, PNG eller JPEG på högst 4 MiB.')
        const visibility = value('visibility') === 'customer' ? 'customer' : 'internal'
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
        const sha = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
        fingerprint = JSON.stringify([reference, file.name, file.type, sha, visibility])
        body = new FormData(); body.set('file', file); body.set('visibility', visibility)
      } else if (action === 'status') body = { status: value('status'), expected_updated_at: detail.updated_at, ...(value('message') ? { message: value('message') } : {}) }
      else if (action === 'assignment') body = { assignee_reference: value('assignee_reference') || null, expected_updated_at: detail.updated_at }
      else body = { message: value('message'), ...(action === 'replies' ? { kind: value('kind') || 'message' } : {}) }
      const result = await client.write<StaffAttachment>(`${base}/${action}`, body, fingerprint)
      form.reset()
      setNotice(action === 'replies' ? 'Svaret är sparat och synligt för kunden.' : action === 'internal-notes' ? 'Den interna anteckningen är sparad.' : action === 'attachments' ? result.data.scan_status === 'released' ? 'Bilagan är kontrollerad och tillgänglig.' : result.data.scan_status === 'rejected' ? 'Bilagan har avvisats vid säkerhetskontrollen.' : 'Bilagan är mottagen och väntar på säkerhetskontroll.' : 'Ändringen är sparad.')
      // An accepted write is complete even if its subsequent read fails.
      try { await readDetail(); entries.refresh(); attachments.refresh() }
      catch { setError('Ändringen är sparad, men vyn kunde inte uppdateras. Uppdatera ärendet för att läsa aktuella uppgifter.') }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Åtgärden kunde inte genomföras.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <article className={`${panel} space-y-5`} aria-label="Ärendedetaljer"><Feedback error={error} notice={notice} />
    {loading && <p role="status">Hämtar ärende…</p>}
    <button type="button" className={secondary} disabled={waiting} onClick={refresh}>Uppdatera ärendet</button>
    {detail && <><div><p className="text-xs text-cyan-300">{detail.customer_display_name || 'Kund'} · {detail.customer_number || ''}</p><h2 className="mt-1 text-xl font-semibold">{detail.title}</h2></div>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"><Value label="Status">{statusLabels[detail.status] || detail.status}</Value><Value label="Prioritet">{priorityLabels[detail.priority] || detail.priority}</Value><Value label="Ansvarig">{detail.assigned_to?.display_name || 'Ej tilldelat'}</Value><Value label="Kategori">{detail.category}</Value><Value label="Kanal">{detail.channel}</Value><Value label="Senast uppdaterad">{staffDate(detail.updated_at)}</Value><Value label="Nästa åtgärd">{detail.next_action}</Value><Value label="Åtgärd senast">{staffDate(detail.next_action_due_at)}</Value></dl>
      {detail.description && <div className="rounded-xl bg-white/5 p-3"><p className="mb-2 text-xs font-medium text-slate-400">{detail.description_visibility === 'customer' ? 'Beskrivning · synlig för kund' : 'Beskrivning · intern'}</p><p className="whitespace-pre-wrap break-words text-sm">{detail.description}</p></div>}
      <section aria-label="Ärendehistorik"><h3 className="font-semibold">Konversation och historik</h3><ol className="mt-3 space-y-3">{entries.rows.map((entry) => <li key={entry.entry_reference} className={`rounded-xl border p-3 ${entry.visibility === 'internal' ? 'border-amber-300/20 bg-amber-300/5' : 'border-white/10'}`}><div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>{entryLabels[entry.kind] || 'Händelse'} · {entry.visibility === 'internal' ? 'Intern' : 'Synlig för kund'} · {entry.author?.display_name || (entry.author_type === 'customer' ? 'Kund' : 'System')}</span><time dateTime={entry.created_at ?? undefined}>{staffDate(entry.created_at)}</time></div>{entry.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{entry.body}</p>}{entry.status && <p className="mt-2 text-sm">Status: {statusLabels[entry.status] || entry.status}</p>}</li>)}</ol>{!entries.loading && !entries.error && !entries.rows.length && <p className="mt-2 text-sm text-slate-400">Inga meddelanden eller händelser.</p>}<PageControls page={entries} label="händelser" /></section>
      {canWrite && conversationOpen && <div className="grid gap-4 lg:grid-cols-2"><form className="space-y-3 rounded-xl border border-cyan-300/20 p-4" onSubmit={(event) => mutate(event, 'replies')}><h3 className="font-semibold">Svara kunden</h3><label className="block text-sm">Typ<select name="kind" className={field}><option value="message">Meddelande</option><option value="phone_summary">Samtalssammanfattning</option></select></label><label className="block text-sm">Svar<textarea name="message" className={field} required minLength={1} maxLength={8000} rows={4} /></label><p className="text-xs text-slate-400">Svaret visas för kunden i ärendet.</p><button className={primary} disabled={waiting}>Spara kundsvar</button></form>
      <form className="space-y-3 rounded-xl border border-amber-300/20 p-4" onSubmit={(event) => mutate(event, 'internal-notes')}><h3 className="font-semibold">Intern anteckning</h3><label className="block text-sm">Anteckning<textarea name="message" className={field} required minLength={1} maxLength={8000} rows={4} /></label><p className="text-xs text-slate-400">Anteckningen är endast synlig för personal.</p><button className={secondary} disabled={waiting}>Spara intern anteckning</button></form></div>}
      {canWrite && !conversationOpen && <p className="text-sm text-slate-400">Ärendet är stängt för svar, anteckningar och uppladdning. Ändra status för att återöppna ärendet.</p>}
      {canWrite && <div className="grid gap-4 lg:grid-cols-2"><form className="space-y-3" onSubmit={(event) => mutate(event, 'status')}><label className="block text-sm">Ändra status<select name="status" className={field} defaultValue={actionStatuses.includes(detail.status) ? detail.status : 'open'} key={detail.updated_at}>{actionStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label><label className="block text-sm">Kommentar (valfri)<textarea name="message" className={field} maxLength={8000} rows={2} /></label><button className={secondary} disabled={waiting}>Spara status</button></form>
      <form className="space-y-3" onSubmit={(event) => mutate(event, 'assignment')}><label className="block text-sm">Ansvarig handläggare<select name="assignee_reference" className={field} defaultValue={detail.assigned_to?.staff_reference || ''} key={detail.updated_at}><option value="">Ej tilldelat</option>{detail.assigned_to && !assignees.rows.some((staff) => staff.staff_reference === detail.assigned_to?.staff_reference) && <option value={detail.assigned_to.staff_reference}>{detail.assigned_to.display_name} (nuvarande)</option>}{assignees.rows.map((staff) => <option key={staff.staff_reference} value={staff.staff_reference}>{staff.display_name}</option>)}</select></label><PageControls page={assignees} label="handläggare" /><button className={secondary} disabled={waiting || assignees.loading}>Spara tilldelning</button></form></div>}
      <section aria-label="Ärendets bilagor"><h3 className="font-semibold">Bilagor</h3><ul className="mt-3 space-y-3">{attachments.rows.map((attachment) => <li key={attachment.attachment_reference} className="rounded-xl border border-white/10 p-3"><p className="break-words text-sm font-medium">{attachment.scan_status === 'released' ? <a href={`${base}/attachments/${staffPath(attachment.attachment_reference)}`} className="text-cyan-200 underline underline-offset-4" download>{attachment.file_name}</a> : attachment.file_name}</p><p className="mt-1 text-xs text-slate-400">{Math.ceil(attachment.byte_size / 1024)} KiB · {attachment.visibility === 'internal' ? 'Intern' : 'Synlig för kund'} · {attachment.scan_status === 'released' ? 'Kontrollerad' : attachment.scan_status === 'rejected' ? 'Avvisad' : 'Väntar på kontroll'}</p>{attachment.scan_reason && <p className="mt-1 text-xs text-slate-400">{attachment.scan_reason}</p>}</li>)}</ul>{!attachments.loading && !attachments.error && !attachments.rows.length && <p className="mt-2 text-sm text-slate-400">Inga bilagor.</p>}<PageControls page={attachments} label="bilagor" />
      {canWrite && conversationOpen && <form className="mt-5 space-y-3" onSubmit={(event) => mutate(event, 'attachments')}><label className="block text-sm">Bifoga fil<input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required className={field} /></label><label className="block text-sm">Synlighet<select name="visibility" className={field}><option value="internal">Endast personal</option><option value="customer">Synlig för kund</option></select></label><p className="text-xs text-slate-400">PDF, PNG eller JPEG, högst 4 MiB. Filen blir tillgänglig efter säkerhetskontroll.</p><button className={secondary} disabled={waiting}>Ladda upp bilaga</button></form>}</section>
    </>}
  </article>
}

export default function StaffCases({ client, canRead, canWrite, customer }: { client: StaffClient; canRead: boolean; canWrite: boolean; customer: StaffCustomerDetail | null }) {
  const [filters, setFilters] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const query = new URLSearchParams(filters)
  if (customer) query.set('customer_reference', customer.customer_reference)
  const cases = useStaffPage<StaffCase>(client, canRead ? `/api/staff/support/cases${query.size ? `?${query}` : ''}` : null, 'case_reference')
  const assignees = useStaffPage<StaffAssignee>(client, canRead ? '/api/staff/support/assignees' : null, 'staff_reference')
  const facilities = useStaffPage<StaffFacility>(client, customer && canWrite ? `/api/staff/customers/${staffPath(customer.customer_reference)}/facilities` : null, 'facility_reference')
  useEffect(() => { setSelected(null); setNotice(null); setError(null) }, [customer?.customer_reference])
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget); const q = String(values.get('q') ?? '').trim()
    if (q.length === 1) { setError('Ange minst två tecken för att söka.'); return }
    const next = new URLSearchParams()
    for (const key of ['q', 'status', 'priority', 'assignee_reference']) { const value = String(values.get(key) ?? '').trim(); if (value) next.set(key, value) }
    setError(null); setSelected(null); setFilters(next.toString())
    if (next.toString() === filters) cases.refresh()
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || !canWrite || !customer) return
    const form = event.currentTarget; const values = new FormData(form); const value = (key: string) => String(values.get(key) ?? '').trim()
    const body = { customer_reference: customer.customer_reference, title: value('title'), ...(value('description') ? { description: value('description') } : {}), ...(value('category') ? { category: value('category') } : {}), priority: value('priority') || 'normal', ...(value('facility_reference') ? { facility_reference: value('facility_reference') } : {}) }
    lock.current = true; setBusy(true); setError(null); setNotice(null)
    try {
      const result = await client.write<{ case_reference: string }>('/api/staff/support/cases', body)
      form.reset(); setNotice('Ärendet är skapat. Beskrivningen är intern.'); setSelected(result.data.case_reference); cases.refresh()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Ärendet kunde inte skapas.') }
    finally { lock.current = false; setBusy(false) }
  }
  if (!canRead) return <p className={panel}>Du saknar behörighet att läsa ärenden.</p>
  return <div className="space-y-5"><section className={panel} aria-labelledby="staff-cases-title"><h2 id="staff-cases-title" className="text-xl font-semibold">{customer ? `Ärenden · ${customer.display_name || 'Kund'}` : 'Ärendekö'}</h2>
    <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={search}><label className="text-sm">Sök ärende<input name="q" maxLength={120} placeholder="Titel eller kategori" className={field} /></label><label className="text-sm">Status<select name="status" className={field}><option value="">Alla statusar</option>{[...actionStatuses, 'cancelled', 'billing_blocked'].map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label><label className="text-sm">Prioritet<select name="priority" className={field}><option value="">Alla prioriteter</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm">Handläggare<select name="assignee_reference" className={field}><option value="">Alla handläggare</option>{assignees.rows.map((staff) => <option key={staff.staff_reference} value={staff.staff_reference}>{staff.display_name}</option>)}</select></label><button className={`${primary} self-end`}>Filtrera ärenden</button></form><PageControls page={assignees} label="handläggare i filtret" />
    <Feedback error={error} notice={notice} /><ul className="mt-4 divide-y divide-white/10">{cases.rows.map((ticket) => <li key={ticket.case_reference}><button type="button" onClick={() => setSelected(ticket.case_reference)} aria-pressed={selected === ticket.case_reference} className="w-full rounded-xl px-2 py-4 text-left hover:bg-white/5 aria-pressed:bg-cyan-300/10"><span className="font-medium">{ticket.title}</span><span className="mt-1 block text-sm text-slate-400">{[ticket.customer_display_name, statusLabels[ticket.status] || ticket.status, priorityLabels[ticket.priority] || ticket.priority, ticket.assigned_to?.display_name || 'Ej tilldelat'].filter(Boolean).join(' · ')}</span></button></li>)}</ul>{!cases.loading && !cases.error && !cases.rows.length && <p className="mt-4 text-sm text-slate-400">Inga ärenden matchar filtret.</p>}<PageControls page={cases} label="ärenden" />
  </section>{canWrite && customer && <section className={panel}><h2 className="font-semibold">Nytt ärende för {customer.display_name || 'Kund'}</h2><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={create}><label className="text-sm sm:col-span-2">Titel<input name="title" className={field} maxLength={180} required /></label><label className="text-sm sm:col-span-2">Intern beskrivning (valfri)<textarea name="description" className={field} maxLength={8000} rows={3} /></label><label className="text-sm">Kategori (valfri)<input name="category" className={field} maxLength={120} /></label><label className="text-sm">Prioritet<select name="priority" className={field} defaultValue="normal">{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm sm:col-span-2">Anläggning (valfri)<select name="facility_reference" className={field}><option value="">Ingen särskild anläggning</option>{facilities.rows.map((facility) => <option key={facility.facility_reference} value={facility.facility_reference}>{facility.site_name || facility.facility_id || 'Anläggning'}</option>)}</select></label><div className="sm:col-span-2"><PageControls page={facilities} label="anläggningar" /></div><button className={`${primary} justify-self-start`} disabled={busy}>Skapa ärende</button></form></section>}{canWrite && !customer && <p className="text-sm text-slate-400">Välj en kund i kundregistret för att skapa ett ärende.</p>}
    {selected && <StaffCaseDetail key={selected} reference={selected} client={client} canWrite={canWrite} />}
  </div>
}
