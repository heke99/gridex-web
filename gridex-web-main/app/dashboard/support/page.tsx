import { randomUUID } from 'crypto'
import type { Metadata } from 'next'
import {
  getCustomerTickets,
  getPortalSession,
  getTicketMessages,
} from '@/lib/customerPortal/service'
import { addSupportMessageAction, createSupportTicketAction } from './actions'

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
  if (senderType === 'agent') return 'Kundservice'
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
    case 'open':
      return 'Öppet'
    case 'waiting_on_customer':
      return 'Väntar på dig'
    case 'waiting_on_internal':
      return 'Under behandling'
    case 'resolved':
      return 'Löst'
    case 'closed':
      return 'Avslutat'
    default:
      return 'Status uppdateras'
  }
}

function getPriorityLabel(priority: string) {
  switch (priority) {
    case 'low':
      return 'Låg'
    case 'normal':
      return 'Normal'
    case 'high':
      return 'Hög'
    case 'urgent':
      return 'Akut'
    default:
      return 'Normal'
  }
}

function getCategoryLabel(category: string) {
  switch (category) {
    case 'general':
      return 'Allmänt'
    case 'invoice':
      return 'Faktura'
    case 'move':
      return 'Flytt'
    case 'contract':
      return 'Avtal'
    default:
      return 'Övrigt'
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'open':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
    case 'waiting_on_customer':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
    case 'waiting_on_internal':
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

export default async function DashboardSupportPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>
}) {
  const { supabase, user } = await getPortalSession()
  const params = (await searchParams) ?? {}
  const banner = statusMessage(params.status)
  const tickets = await getCustomerTickets(supabase, user.id)

  const expanded = await Promise.all(
    tickets.slice(0, 5).map(async (ticket) => ({
      ticket,
      messages: await getTicketMessages(supabase, ticket.id),
      replyRequestId: randomUUID(),
    }))
  )

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
          <label className="mb-2 block text-xs text-white/60">Prioritet</label>
          <select
            name="priority"
            className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3"
          >
            <option value="normal">Normal</option>
            <option value="high">Hög</option>
            <option value="urgent">Akut</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs text-white/60">Beskrivning</label>
          <textarea
            name="description"
            placeholder="Beskriv ditt ärende här"
            className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3"
          />
        </div>

        <button className="h-11 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black sm:w-auto">
          Skapa ärende
        </button>
      </form>

      <div className="space-y-4">
        {expanded.map(({ ticket, messages, replyRequestId }) => {
          const closed = isTicketClosed(ticket.status)

          return (
            <section
              key={ticket.id}
              className="rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{ticket.subject}</h2>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] ${getStatusBadgeClass(
                        ticket.status
                      )}`}
                    >
                      {getStatusLabel(ticket.status)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/55">
                    <span>{getCategoryLabel(ticket.category)}</span>
                    <span>•</span>
                    <span>{getPriorityLabel(ticket.priority)}</span>
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

              {closed ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  {getClosedTicketMessage(ticket.status)}
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                {messages.length > 0 ? (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="text-xs text-white/45">
                        {formatSenderLabel(message.sender_type)} •{' '}
                        {formatDate(message.created_at)}
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-sm text-white/85">
                        {message.body}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
                    Inga meddelanden finns ännu i detta ärende.
                  </div>
                )}
              </div>

              {closed ? (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  Ärendet är avslutat och tar inte emot nya meddelanden.
                </div>
              ) : (
                <form action={addSupportMessageAction} className="mt-5 space-y-3">
                  <input type="hidden" name="ticket_id" value={ticket.id} />
                  <input type="hidden" name="client_request_id" value={replyRequestId} />

                  <div>
                    <label className="mb-2 block text-xs text-white/60">
                      Skriv ett meddelande
                    </label>
                    <textarea
                      name="body"
                      placeholder="Skriv ditt meddelande"
                      className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3"
                    />
                  </div>
                  <button className="h-11 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black sm:w-auto">
                    Skicka meddelande
                  </button>
                </form>
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
    </div>
  )
}