'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupportAttachment, SupportCase, SupportCaseDetail, SupportListResponse, SupportResponse } from '@/lib/support/types'

const API = '/api/web/customer/support/cases'
const statusLabels: Record<SupportCase['status'], string> = {
  received: 'Mottaget', in_progress: 'Under behandling', resolved: 'Löst', closed: 'Avslutat',
}
const fieldClass = 'mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20'
const buttonClass = 'rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(25_000)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  const response = await fetch(url, { ...options, signal, cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof payload.error?.message === 'string' ? payload.error.message : 'Kundservice kunde inte nås. Försök igen.'
    const trace = typeof payload.error?.request_id === 'string' ? ` Referens: ${payload.error.request_id}` : ''
    throw new Error(`${message}${trace}`)
  }
  return payload as T
}

type Operation = { body: string; key: string }

function operationKey(previous: Operation | null, body: string): Operation {
  return previous?.body === body ? previous : { body, key: crypto.randomUUID() }
}

export default function SupportWorkspace({ initial, initialError }: { initial: SupportListResponse | null; initialError?: string | null }) {
  const [tickets, setTickets] = useState(initial?.data ?? [])
  const [listAvailable, setListAvailable] = useState(Boolean(initial))
  const [nextCursor, setNextCursor] = useState(initial?.page.next_cursor ?? null)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<SupportCaseDetail | null>(null)
  const [attachments, setAttachments] = useState<SupportAttachment[]>([])
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingAttachments, setLoadingAttachments] = useState(false)
  const [busy, setBusy] = useState<'create' | 'reply' | 'upload' | 'list' | null>(null)
  const createOperation = useRef<Operation | null>(null)
  const replyOperation = useRef<Operation | null>(null)
  const uploadOperation = useRef<{ fingerprint: string; reference: string; key: string } | null>(null)

  useEffect(() => {
    if (!selected) { setDetail(null); setAttachments([]); setLoadingAttachments(false); return }
    const controller = new AbortController()
    setLoadingDetail(true)
    setLoadingAttachments(true)
    setDetail(null)
    setAttachments([])
    setError(null)
    setAttachmentError(null)
    const caseUrl = `${API}/${encodeURIComponent(selected)}`
    // The conversation can render immediately even if the attachment service is slow.
    void request<SupportResponse<SupportCaseDetail>>(caseUrl, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setDetail(result.data) })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Ärendet kunde inte hämtas.') })
      .finally(() => { if (!controller.signal.aborted) setLoadingDetail(false) })
    void request<SupportResponse<SupportAttachment[]>>(`${caseUrl}/attachments`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setAttachments(result.data) })
      .catch(() => { if (!controller.signal.aborted) setAttachmentError('Bilagorna kunde inte hämtas. Uppdatera ärendet för att försöka igen.') })
      .finally(() => { if (!controller.signal.aborted) setLoadingAttachments(false) })
    return () => controller.abort()
  }, [selected])

  async function refreshList(append = false) {
    setBusy('list'); setError(null)
    try {
      const query = new URLSearchParams({ limit: '20' })
      if (append && nextCursor) query.set('cursor', nextCursor)
      const result = await request<SupportListResponse>(`${API}?${query}`)
      setTickets((previous) => append ? [...previous, ...result.data.filter((item) => !previous.some((old) => old.case_reference === item.case_reference))] : result.data)
      setNextCursor(result.page.next_cursor)
      setListAvailable(true)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Ärendena kunde inte hämtas.') }
    finally { setBusy(null) }
  }

  async function refreshDetail(reference: string) {
    const result = await request<SupportResponse<SupportCaseDetail>>(`${API}/${encodeURIComponent(reference)}`)
    setDetail(result.data)
    setTickets((previous) => previous.map((ticket) => ticket.case_reference === reference ? result.data : ticket))
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const values = new FormData(form)
    const body = JSON.stringify({ title: String(values.get('title') ?? '').trim(), message: String(values.get('message') ?? '').trim(), category: String(values.get('category') ?? 'general') })
    createOperation.current = operationKey(createOperation.current, body)
    setBusy('create'); setError(null); setNotice(null)
    try {
      const result = await request<SupportResponse<SupportCase>>(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': createOperation.current.key }, body })
      createOperation.current = null
      form.reset()
      setTickets((previous) => [result.data, ...previous.filter((ticket) => ticket.case_reference !== result.data.case_reference)])
      setSelected(result.data.case_reference)
      setNotice('Ditt ärende är mottaget. Du kan följa svaren här.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Ärendet kunde inte skapas.') }
    finally { setBusy(null) }
  }

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !detail) return
    const form = event.currentTarget
    const reference = detail.case_reference
    const body = JSON.stringify({ message: String(new FormData(form).get('message') ?? '').trim() })
    replyOperation.current = operationKey(replyOperation.current, `${reference}:${body}`)
    setBusy('reply'); setError(null); setNotice(null)
    try {
      await request(`${API}/${encodeURIComponent(reference)}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': replyOperation.current.key }, body })
      replyOperation.current = null
      form.reset()
      setNotice('Ditt meddelande är skickat.')
      try { await refreshDetail(reference) }
      catch { setError('Meddelandet är skickat, men ärendet kunde inte uppdateras. Uppdatera ärendet för att läsa den senaste konversationen.') }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Meddelandet kunde inte skickas.') }
    finally { setBusy(null) }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !detail) return
    const form = event.currentTarget
    const file = new FormData(form).get('file')
    if (!(file instanceof File) || file.size === 0) { setError('Välj en fil först.'); return }
    if (file.size > 4 * 1024 * 1024 || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) { setError('Välj en PDF-, PNG- eller JPEG-fil på högst 4 MB.'); return }
    const reference = detail.case_reference
    setBusy('upload'); setError(null); setNotice(null)
    try {
      const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      const fingerprint = `${file.type}:${file.name}:${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
      const old = uploadOperation.current
      if (!old || old.reference !== reference || old.fingerprint !== fingerprint) {
        uploadOperation.current = { fingerprint, reference, key: crypto.randomUUID() }
      }
      const result = await request<SupportResponse<SupportAttachment>>(`${API}/${encodeURIComponent(reference)}/attachments`, {
        method: 'POST', headers: { 'Content-Type': file.type, 'Idempotency-Key': uploadOperation.current!.key, 'X-File-Name': encodeURIComponent(file.name) }, body: file,
      })
      uploadOperation.current = null
      setAttachments((previous) => [...previous.filter((item) => item.attachment_reference !== result.data.attachment_reference), result.data])
      setAttachmentError(null)
      setNotice('Bilagan har tagits emot och kontrollerats.')
      form.reset()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Bilagan kunde inte skickas.') }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">Kundservice</h1><p className="mt-2 max-w-2xl text-sm text-white/60">Få hjälp med avtal, fakturor och flytt. Följ dina ärenden och skicka meddelanden eller bilagor.</p></div>
        <button type="button" className={buttonClass} disabled={Boolean(busy)} onClick={() => { setSelected(null); setError(null); setNotice(null) }}>Nytt ärende</button>
      </div>
      {error ? <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">{error}</div> : null}
      {notice ? <div role="status" className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">{notice}</div> : null}
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <div className="mb-4 flex items-center justify-between gap-2"><h2 className="font-semibold">Mina ärenden</h2><button type="button" onClick={() => void refreshList()} disabled={Boolean(busy)} className="text-xs text-cyan-200 hover:underline disabled:opacity-50">{busy === 'list' ? 'Hämtar…' : 'Uppdatera'}</button></div>
          <div className="space-y-2">
            {tickets.map((ticket) => <button key={ticket.case_reference} type="button" disabled={Boolean(busy)} onClick={() => { setSelected(ticket.case_reference); setNotice(null) }} aria-pressed={selected === ticket.case_reference} className={`w-full rounded-xl border p-3 text-left transition disabled:opacity-60 ${selected === ticket.case_reference ? 'border-cyan-300/50 bg-cyan-300/10' : 'border-white/10 hover:border-white/30'}`}><span className="block break-words text-sm font-medium">{ticket.title}</span><span className="mt-2 flex justify-between gap-2 text-xs text-white/55"><span>{statusLabels[ticket.status]}</span><span>{formatDate(ticket.updated_at)}</span></span></button>)}
            {tickets.length === 0 ? <p className="py-4 text-sm text-white/55">{!listAvailable ? 'Hämta ärendena igen när anslutningen är tillbaka.' : 'Du har inga ärenden ännu.'}</p> : null}
          </div>
          {nextCursor ? <button type="button" className="mt-4 w-full rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50" disabled={Boolean(busy)} onClick={() => void refreshList(true)}>Visa fler ärenden</button> : null}
          <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-white/50">Vid strömavbrott eller elnätsfel: kontakta din nätägare.</p>
        </aside>
        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[.03] p-5 sm:p-6">
          {selected ? loadingDetail ? <p role="status" className="py-12 text-center text-sm text-white/60">Hämtar ditt ärende…</p> : detail ? <div className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="break-words text-xl font-semibold">{detail.title}</h2><p className="mt-2 text-xs text-white/50">{statusLabels[detail.status]} · Skapat {formatDate(detail.created_at)}</p></div><button type="button" disabled={Boolean(busy)} className="text-sm text-cyan-200 hover:underline disabled:opacity-50" onClick={() => { setBusy('list'); setError(null); void Promise.all([refreshDetail(detail.case_reference), request<SupportResponse<SupportAttachment[]>>(`${API}/${encodeURIComponent(detail.case_reference)}/attachments`).then((result) => { setAttachments(result.data); setAttachmentError(null) })]).catch((failure) => setError(failure instanceof Error ? failure.message : 'Ärendet kunde inte uppdateras.')).finally(() => setBusy(null)) }}>Uppdatera ärendet</button></header>
            <div className="space-y-3" aria-label="Meddelanden">
              {detail.messages.length ? detail.messages.map((message) => <article key={message.message_reference} className={`rounded-2xl border p-4 ${message.author_type === 'staff' ? 'border-cyan-300/20 bg-cyan-300/5' : 'border-white/10 bg-black/20'}`}><div className="flex flex-wrap justify-between gap-2 text-xs text-white/55"><span>{message.author_type === 'customer' ? 'Du' : 'Kundservice'}{message.kind === 'phone_summary' ? ' · Samtalssammanfattning' : ''}</span><time dateTime={message.created_at}>{formatDate(message.created_at)}</time></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p></article>) : <p className="whitespace-pre-wrap text-sm leading-6 text-white/70">{detail.description ?? 'Ärendet har ännu inga meddelanden.'}</p>}
            </div>
            <div><h3 className="text-sm font-semibold">Bilagor</h3>{loadingAttachments ? <p role="status" className="mt-2 text-sm text-white/50">Hämtar bilagor…</p> : null}{attachmentError ? <p role="alert" className="mt-2 text-sm text-amber-200">{attachmentError}</p> : null}<ul className="mt-3 space-y-2">{attachments.map((file) => <li key={file.attachment_reference}><a href={`${API}/${encodeURIComponent(detail.case_reference)}/attachments/${encodeURIComponent(file.attachment_reference)}`} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-cyan-200 hover:bg-white/5"><span className="truncate">{file.file_name}</span><span className="shrink-0 text-xs text-white/45">{Math.ceil(file.byte_size / 1024)} kB</span></a></li>)}</ul>{!attachments.length && !attachmentError && !loadingAttachments ? <p className="mt-2 text-sm text-white/50">Inga bilagor.</p> : null}</div>
            {detail.status === 'closed' || detail.status === 'resolved' ? <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/65">Ärendet är {detail.status === 'resolved' ? 'löst' : 'avslutat'}. Skapa ett nytt ärende om du behöver mer hjälp.</p> : <>
              <form onSubmit={reply}><label htmlFor="support-reply" className="text-sm font-medium">Skriv ett meddelande</label><textarea id="support-reply" name="message" required maxLength={8000} rows={5} className={fieldClass} /><button disabled={Boolean(busy)} className={`${buttonClass} mt-3`}>{busy === 'reply' ? 'Skickar…' : 'Skicka meddelande'}</button></form>
              <form onSubmit={upload} className="rounded-xl border border-dashed border-white/15 p-4"><label htmlFor="support-file" className="block text-sm font-medium">Bifoga en fil</label><input id="support-file" name="file" type="file" required accept="application/pdf,image/png,image/jpeg" className="mt-3 block w-full text-sm text-white/65 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white" /><p className="mt-2 text-xs text-white/50">PDF, PNG eller JPEG. Högst 4 MB.</p><button disabled={Boolean(busy)} className="mt-3 rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50">{busy === 'upload' ? 'Skickar bilaga…' : 'Skicka bilaga'}</button></form>
            </>}
          </div> : <p className="py-8 text-sm text-white/60">Ärendet kunde inte hämtas. Välj ett annat ärende eller uppdatera sidan.</p> : <form onSubmit={createCase} className="space-y-5">
            <h2 className="text-lg font-semibold">Skapa ett ärende</h2>
            <div><label htmlFor="support-title" className="text-sm font-medium">Ämne</label><input id="support-title" name="title" required maxLength={180} className={fieldClass} placeholder="Vad behöver du hjälp med?" /></div>
            <div><label htmlFor="support-category" className="text-sm font-medium">Kategori</label><select id="support-category" name="category" className={fieldClass}><option value="general">Allmänt</option><option value="invoice">Faktura</option><option value="contract">Avtal</option><option value="move">Flytt</option><option value="price">Pris och avgifter</option></select></div>
            <div><label htmlFor="support-message" className="text-sm font-medium">Beskriv ditt ärende</label><textarea id="support-message" name="message" required maxLength={8000} rows={7} className={fieldClass} placeholder="Beskriv vad som har hänt och vad du behöver hjälp med." /></div>
            <button disabled={Boolean(busy)} className={buttonClass}>{busy === 'create' ? 'Skickar…' : 'Skicka ärende'}</button>
          </form>}
        </section>
      </div>
    </div>
  )
}
