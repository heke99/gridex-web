'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { date } from '@/support/lib/presentation'
import { casePageHref, type CaseSection } from '@/support/lib/case-pages'
import type { StaffAttachment, StaffCaseEvent, StaffCasePage } from '@/staff-api/types'

type Page<T> = { data: T[]; page: StaffCasePage }

function useCasePage<T>(reference: string, section: CaseSection, firstPage: Page<T>, firstCursor: string | null) {
  const [override, setOverride] = useState<{ base: Page<T>; value: Page<T>; cursor: string | null }>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [firstPage])
  const current = override?.base === firstPage ? override : { value: firstPage, cursor: firstCursor }

  async function navigate(event: MouseEvent<HTMLAnchorElement>, cursor: string | null) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (request.current && !request.current.signal.aborted) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError(false)
    try {
      const query = new URLSearchParams(cursor ? { cursor } : {})
      const endpoint = `/cases/${encodeURIComponent(reference)}/pages/${section}`
      const response = await fetch(`${endpoint}${query.size ? `?${query}` : ''}`, {
        cache: 'no-store', redirect: 'error', signal: controller.signal,
      })
      if (!response.ok) throw new Error('Case page unavailable')
      const value = await response.json() as Page<T>
      if (controller.signal.aborted) return
      window.history.replaceState(null, '', casePageHref(reference, section, cursor, window.location.search))
      setOverride({ base: firstPage, value, cursor })
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (request.current === controller) {
        request.current = null
        setPending(false)
      }
    }
  }

  return { ...current, navigate, pending, error }
}

function CasePager({ reference, section, page, cursor, navigate, pending, error, nextLabel, resetLabel }: {
  reference: string; section: CaseSection; page: StaffCasePage; cursor: string | null
  navigate: (event: MouseEvent<HTMLAnchorElement>, cursor: string | null) => Promise<void>
  pending: boolean; error: boolean; nextLabel: string; resetLabel: string
}) {
  const search = useSearchParams().toString()
  const next = page.has_more ? page.next_cursor : null
  return (
    <div className="pager">
      {error && <p role="alert">Sidan kunde inte hämtas. Försök igen.</p>}
      {pending && <p role="status">Hämtar sidan…</p>}
      {cursor && <a href={casePageHref(reference, section, null, search)} aria-disabled={pending}
        onClick={event => void navigate(event, null)}>{resetLabel}</a>}
      {next && <a className="button" href={casePageHref(reference, section, next, search)} aria-disabled={pending}
        onClick={event => void navigate(event, next)}>{nextLabel}</a>}
    </div>
  )
}

export default function CasePages({ reference, firstEvents, firstAttachments, eventsCursor, attachmentsCursor, upload }: {
  reference: string
  firstEvents: Page<StaffCaseEvent>
  firstAttachments: Page<StaffAttachment>
  eventsCursor: string | null
  attachmentsCursor: string | null
  upload: ReactNode
}) {
  const history = useCasePage(reference, 'events', firstEvents, eventsCursor)
  const files = useCasePage(reference, 'attachments', firstAttachments, attachmentsCursor)
  const events = history.value
  const attachments = files.value
  return (
    <>
      <section className="panel">
        <h2>Historik</h2>
        <ol className="timeline">
          {events.data.map((event) => (
            <li
              key={event.event_reference}
              className={`event ${event.visibility === "internal" ? "internal" : ""}`}
            >
              <div className="row small">
                <strong>
                  {event.author_type === "customer"
                    ? "Kunden"
                    : event.event_type.includes("phone")
                      ? "Telefonsamtal"
                      : event.visibility === "internal"
                        ? "Intern anteckning"
                        : "Svar till kund"}
                </strong>
                <span className="muted">{date(event.created_at)}</span>
              </div>
              <p className="pre">{event.message}</p>
              <span
                className={`badge ${event.visibility === "internal" ? "internal" : ""}`}
              >
                {event.visibility === "internal"
                  ? "Endast personal"
                  : "Synligt för kunden"}
              </span>
            </li>
          ))}
        </ol>
        {events.data.length === 0 ? (
          <p className="muted">Ingen historik ännu.</p>
        ) : null}
        <CasePager reference={reference} section="events" page={events.page} cursor={history.cursor}
          navigate={history.navigate} pending={history.pending} error={history.error}
          nextLabel="Äldre händelser →" resetLabel="Senaste händelserna" />
      </section>
      <section className="panel">
        <h2>Bilagor</h2>
        {upload}
        <ul className="attachments">
          {attachments.data.map((file) => (
            <li className="row" key={file.attachment_reference}>
              <div>
                <strong>{file.file_name}</strong>
                <p className="small muted">
                  {Math.ceil(file.byte_size / 1024)} kB ·{" "}
                  {file.visibility === "internal"
                    ? "Endast personal"
                    : "Synlig för kunden"}
                </p>
              </div>
              {file.scan_status === "released" ? (
                <a
                  className="button"
                  href={`/cases/${reference}/attachments/${file.attachment_reference}`}
                >
                  Ladda ner
                </a>
              ) : (
                <span className="badge">
                  {file.scan_status === "rejected"
                    ? "Stoppad i kontrollen"
                    : "Kontrolleras"}
                </span>
              )}
            </li>
          ))}
        </ul>
        {attachments.data.length === 0 ? (
          <p className="muted">Inga bilagor.</p>
        ) : null}
        <CasePager reference={reference} section="attachments" page={attachments.page} cursor={files.cursor}
          navigate={files.navigate} pending={files.pending} error={files.error}
          nextLabel="Fler bilagor →" resetLabel="Första bilagesidan" />
      </section>
    </>
  )
}
