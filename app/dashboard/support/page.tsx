import { randomUUID } from 'crypto'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import type { OpsPortalIdentity } from '@/lib/ops/client/portal'
import {
  getOpsPortalIdentityForUser,
  getPortalSession,
} from '@/lib/customerPortal/service'
import { addSupportMessageAction, createSupportTicketAction } from './actions'
import AttachmentUpload from '@/components/support/AttachmentUpload'
import {
  listOpsCustomerSupportAttachments,
  listOpsCustomerSupportCases,
  listOpsCustomerSupportMessages,
} from '@/lib/ops/client/customerSupport'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatSenderLabel(senderType: string) {
  if (senderType === 'customer') return 'Du'
  if (senderType === 'staff') return 'Kundservice'
  if (senderType === 'system') return 'System'
  if (senderType === 'integration') return 'Meddelande'
  return 'Meddelande'
}

function isTicketClosed(status: string) {
  return status === 'resolved' || status === 'closed'
}

function getClosedTicketMessage(status: string) {
  if (status === 'resolved') {
    return 'Detta ärende är markerat som löst. Du kan läsa svaret nedan. Om du fortfarande behöver hjälp kan du skapa ett nytt ärende.'
  }

  if (status === 'closed') {
    return 'Detta ärende är avslutat. Tidigare meddelanden finns kvar här för din överblick.'
  }

  return ''
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'received':
      return 'Öppet'
    case 'in_progress':
      return 'Under behandling'
    case 'resolved':
      return 'Löst'
    case 'closed':
      return 'Avslutat'
    default:
      return 'Status uppdateras'
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'received':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
    case 'in_progress':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-200'
    case 'resolved':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    case 'closed':
      return 'border-white/10 bg-white/5 text-white/70'
    default:
      return 'border-white/10 bg-white/5 text-white/70'
  }
}

function statusMessage(status?: string) {
  switch (status) {
    case 'created':
      return 'Ditt ärende har skapats.'
    case 'message-sent':
      return 'Ditt meddelande har skickats.'
    default:
      return null
  }
}

type SupportSectionProps = {
  identity: OpsPortalIdentity
  reference: string
  retryHref: string
  cursor?: string
}

function supportPageHref(href: string, key: 'message_cursor' | 'attachment_cursor', cursor: string) {
  const [path, queryAndHash] = href.split('?')
  const [search, hash] = queryAndHash.split('#')
  const query = new URLSearchParams(search)
  query.set(key, cursor)
  return `${path}?${query}#${hash}`
}

async function SupportMessages({ identity, reference, retryHref, cursor }: SupportSectionProps) {
  const result = await listOpsCustomerSupportMessages(identity, reference, cursor).catch(() => null)
  if (!result) return <p role="status">
    Meddelandena kunde inte hämtas just nu. <a href={retryHref} className="underline">Försök igen</a>.
  </p>
  return <>
    {!result.data.length && <p className="text-sm text-white/60">Inga meddelanden på den här sidan.</p>}
    {result.data.map(message => (
      <div key={message.message_reference} className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs text-white/45">
          {formatSenderLabel(message.author_type)} • {formatDate(message.created_at)}
        </div>
        <div className="mt-2 whitespace-pre-wrap text-sm text-white/85">{message.body}</div>
      </div>
    ))}
    {result.nextCursor && <Link href={supportPageHref(retryHref, 'message_cursor', result.nextCursor)} prefetch={false} className="underline">Nästa sida med meddelanden</Link>}
  </>
}

async function SupportAttachments({ identity, reference, retryHref, cursor }: SupportSectionProps) {
  const result = await listOpsCustomerSupportAttachments(identity, reference, cursor).catch(() => null)
  if (!result) return <p role="status">
    Bilagorna kunde inte hämtas just nu. <a href={retryHref} className="underline">Försök igen</a>.
  </p>
  return <>
    {result.data.length ? <ul>{result.data.map(file => (
      <li key={file.attachment_reference}>
        <a className="underline" href={`/api/customer-support/cases/${reference}/attachments/${file.attachment_reference}`}>{file.file_name}</a>
        {' · '}{Math.ceil(file.byte_size / 1024)} kB
      </li>
    ))}</ul> : <p className="text-sm text-white/60">Inga godkända bilagor på den här sidan.</p>}
    {result.nextCursor && <Link href={supportPageHref(retryHref, 'attachment_cursor', result.nextCursor)} prefetch={false} className="underline">Nästa sida med bilagor</Link>}
  </>
}

export default async function DashboardSupportPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; cursor?: string | string[]; case?: string | string[]; message_cursor?: string | string[]; attachment_cursor?: string | string[] }>
}) {
  const { supabase, user } = await getPortalSession()
  const params = (await searchParams) ?? {}
  const banner = statusMessage(params.status)
  const cursor = typeof params.cursor === 'string' ? params.cursor : null
  const identity = await getOpsPortalIdentityForUser(supabase, user)
  const result = await listOpsCustomerSupportCases(identity, {
    limit: 5,
    ...(cursor ? { cursor } : {}),
  })
  const tickets = result.data

  const createTicketRequestId = randomUUID()

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <h1 className="text-2xl font-semibold">Support</h1>
        <p className="mt-2 text-sm text-white/60">
          Här kan du skapa nya ärenden, följa tidigare kontakt och läsa svar från kundservice.
        </p>
      </div>

      {banner ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100" aria-live="polite">
          {banner}
        </div>
      ) : null}

      <form
        action={createSupportTicketAction}
        className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6"
      >
        <input type="hidden" name="client_request_id" value={createTicketRequestId} />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Skapa nytt ärende</h2>
            <p className="mt-1 text-sm text-white/60">
              Beskriv ditt ärende så tydligt som möjligt för snabbare hjälp.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs text-white/60">Ämne</label>
            <input
              name="subject"
              maxLength={180}
              required
              placeholder="Till exempel: Fråga om faktura eller flytt"
              className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs text-white/60">Kategori</label>
            <select
              name="category"
              className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3"
            >
              <option value="general">Allmänt</option>
              <option value="invoice">Faktura</option>
              <option value="move">Flytt</option>
              <option value="contract">Avtal</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs text-white/60">Beskrivning</label>
          <textarea
            name="description"
            maxLength={8000}
            required
            placeholder="Beskriv ditt ärende här"
            className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3"
          />
        </div>

        <button className="h-11 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black sm:w-auto">
          Skapa ärende
        </button>
      </form>

      <div className="space-y-4">
        {tickets.map(ticket => {
          const closed = isTicketClosed(ticket.status)
          const expanded = params.case === ticket.case_reference
          const detailQuery = new URLSearchParams()
          if (cursor) detailQuery.set('cursor', cursor)
          if (!expanded) detailQuery.set('case', ticket.case_reference)
          const retryQuery = new URLSearchParams(detailQuery)
          retryQuery.set('case', ticket.case_reference)
          const messageCursor = expanded && typeof params.message_cursor === 'string' ? params.message_cursor : undefined
          const attachmentCursor = expanded && typeof params.attachment_cursor === 'string' ? params.attachment_cursor : undefined
          if (messageCursor) retryQuery.set('message_cursor', messageCursor)
          if (attachmentCursor) retryQuery.set('attachment_cursor', attachmentCursor)
          const retryHref = `/dashboard/support?${retryQuery}#${ticket.case_reference}`
          const detailHref = `/dashboard/support${detailQuery.size ? `?${detailQuery}` : ''}#${ticket.case_reference}`

          return (
            <section
              key={ticket.case_reference}
              id={ticket.case_reference}
              className="scroll-mt-24 rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{ticket.title}</h2>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] ${getStatusBadgeClass(
                        ticket.status
                      )}`}
                    >
                      {getStatusLabel(ticket.status)}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-white/45">
                  Skapad {formatDate(ticket.created_at)}
                </div>
              </div>

              {ticket.description ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/45">Beskrivning</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-white/85">
                    {ticket.description}
                  </div>
                </div>
              ) : null}

              <Link href={detailHref} prefetch={false}
                aria-expanded={expanded}
                className="mt-4 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm">
                {expanded ? 'Dölj ärende' : 'Öppna ärende'}
              </Link>

              {expanded && (
                <>
                  {closed && <p className="mt-4 text-sm text-white/70">{getClosedTicketMessage(ticket.status)}</p>}
                  <section className="mt-5 space-y-3">
                    <h3 className="font-semibold">Meddelanden</h3>
                    <Suspense fallback={<p role="status">Hämtar meddelanden…</p>}>
                      <SupportMessages identity={identity} reference={ticket.case_reference} retryHref={retryHref} cursor={messageCursor} />
                    </Suspense>
                  </section>
                  {!closed && (
                    <form action={addSupportMessageAction} className="mt-5 space-y-3">
                      <input type="hidden" name="ticket_id" value={ticket.case_reference} />
                      <input type="hidden" name="client_request_id" value={randomUUID()} />
                      {cursor && <input type="hidden" name="cursor" value={cursor} />}
                      <div>
                        <label className="mb-2 block text-xs text-white/60" htmlFor="support-message">
                          Skriv ett meddelande
                        </label>
                        <textarea
                          id="support-message"
                          name="body"
                          maxLength={8000}
                          required
                          placeholder="Skriv ditt meddelande"
                          className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3"
                        />
                      </div>
                      <button className="h-11 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black sm:w-auto">
                        Skicka meddelande
                      </button>
                    </form>
                  )}
                  <section className="mt-5 space-y-3">
                    <h3 className="font-semibold">Bilagor</h3>
                    <Suspense fallback={<p role="status">Hämtar bilagor…</p>}>
                      <SupportAttachments identity={identity} reference={ticket.case_reference} retryHref={retryHref} cursor={attachmentCursor} />
                    </Suspense>
                    {!closed && <AttachmentUpload endpoint={`/api/customer-support/cases/${ticket.case_reference}/attachments`} />}
                  </section>
                </>
              )}
            </section>
          )
        })}

        {tickets.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/60 sm:p-6">
            Inga supportärenden ännu. Skapa ett ärende ovan om du behöver hjälp med avtal, faktura, flytt eller anläggningsuppgifter.
          </div>
        )}
      </div>
      {cursor || result.page.has_more ? (
        <nav aria-label="Ärendesidor" className="flex flex-wrap gap-4 text-sm text-cyan-200">
          {cursor ? <Link href="/dashboard/support">Senaste ärendena</Link> : null}
          {result.page.has_more && result.page.next_cursor ? (
            <Link href={`/dashboard/support?cursor=${encodeURIComponent(result.page.next_cursor)}`}>
              Fler ärenden
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  )
}
