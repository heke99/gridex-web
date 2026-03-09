import Link from 'next/link'
import { requireAdminPageAccess } from '@/lib/admin/guards'
import {
  assignSupportTicketAction,
  replyToSupportTicketAction,
  updateSupportTicketStatusAction,
} from './actions'

export const dynamic = 'force-dynamic'

type SearchParams = {
  status?: string
  priority?: string
  scope?: string
}

type AdminSupportTicket = {
  id: string
  user_id: string
  subject: string
  category: string
  priority: string
  status: string
  description: string
  assigned_user_id: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
}

type AdminSupportMessage = {
  id: string
  ticket_id: string
  sender_type: string
  body: string
  created_at: string
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

function getPriorityBadgeClass(priority: string) {
  switch (priority) {
    case 'high':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-200'
    case 'medium':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
    case 'low':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    default:
      return 'border-white/10 bg-white/5 text-white/70'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'open':
      return 'Öppet'
    case 'waiting_on_customer':
      return 'Väntar på kund'
    case 'waiting_on_internal':
      return 'Under behandling'
    case 'resolved':
      return 'Löst'
    case 'closed':
      return 'Avslutat'
    default:
      return status
  }
}

function getPriorityLabel(priority: string) {
  switch (priority) {
    case 'high':
      return 'Hög'
    case 'medium':
      return 'Medel'
    case 'low':
      return 'Låg'
    default:
      return priority
  }
}

function getSenderLabel(senderType: string) {
  if (senderType === 'customer') return 'Kund'
  if (senderType === 'agent') return 'Support'
  if (senderType === 'system') return 'System'
  if (senderType === 'integration') return 'Integration'
  return 'Meddelande'
}

function buildScopeLabel(scope: string | undefined) {
  if (scope === 'mine') return 'Mina ärenden'
  if (scope === 'unassigned') return 'Otilldelade'
  return 'Alla ärenden'
}

export default async function AdminSupportTicketsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const ctx = await requireAdminPageAccess({
    anyOf: ['admin.access', 'support_tickets.manage'],
  })

  const params = (await searchParams) ?? {}
  const selectedStatus = typeof params.status === 'string' ? params.status : ''
  const selectedPriority =
    typeof params.priority === 'string' ? params.priority : ''
  const selectedScope = typeof params.scope === 'string' ? params.scope : ''

  const supabase = ctx.supabase

  let query = supabase
    .from('customer_support_tickets')
    .select(
      'id,user_id,subject,category,priority,status,description,assigned_user_id,created_at,updated_at,closed_at'
    )
    .order('updated_at', { ascending: false })
    .limit(30)

  if (selectedStatus) {
    query = query.eq('status', selectedStatus)
  }

  if (selectedPriority) {
    query = query.eq('priority', selectedPriority)
  }

  if (selectedScope === 'mine') {
    query = query.eq('assigned_user_id', ctx.userId)
  }

  if (selectedScope === 'unassigned') {
    query = query.is('assigned_user_id', null)
  }

  const { data: tickets } = await query.returns<AdminSupportTicket[]>()

  const topTickets = tickets ?? []

  const messagesByTicket = await Promise.all(
    topTickets.map(async (ticket) => {
      const { data: messages } = await supabase
        .from('customer_support_messages')
        .select('id,ticket_id,sender_type,body,created_at')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true })
        .returns<AdminSupportMessage[]>()

      return {
        ticketId: ticket.id,
        messages: messages ?? [],
      }
    })
  )

  const messagesMap = new Map(
    messagesByTicket.map((entry) => [entry.ticketId, entry.messages])
  )

  const openCount = topTickets.filter((ticket) =>
    ['open', 'waiting_on_customer', 'waiting_on_internal'].includes(ticket.status)
  ).length

  const unassignedCount = topTickets.filter(
    (ticket) =>
      !ticket.assigned_user_id &&
      ['open', 'waiting_on_customer', 'waiting_on_internal'].includes(ticket.status)
  ).length

  const mineCount = topTickets.filter(
    (ticket) => ticket.assigned_user_id === ctx.userId
  ).length

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">
              Supportmodul
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Supportärenden
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-white/60">
              Hantera inkommande kundärenden, tilldelning, statusförändringar och
              svar till kund. Sidan är kopplad till befintliga support-actions och
              tabeller för tickets och messages.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70">
            Aktiv vy: <span className="text-white/90">{buildScopeLabel(selectedScope)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs text-white/60">Visade öppna / väntande</div>
          <div className="mt-2 text-2xl font-semibold">{openCount}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs text-white/60">Visade otilldelade</div>
          <div className="mt-2 text-2xl font-semibold">{unassignedCount}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs text-white/60">Visade tilldelade mig</div>
          <div className="mt-2 text-2xl font-semibold">{mineCount}</div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <form className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-xs text-white/60">Status</label>
            <select
              name="status"
              defaultValue={selectedStatus}
              className="h-11 w-full rounded-2xl border border-white/10 bg-black/40 px-3 text-sm"
            >
              <option value="">Alla</option>
              <option value="open">Öppet</option>
              <option value="waiting_on_internal">Under behandling</option>
              <option value="waiting_on_customer">Väntar på kund</option>
              <option value="resolved">Löst</option>
              <option value="closed">Avslutat</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs text-white/60">Prioritet</label>
            <select
              name="priority"
              defaultValue={selectedPriority}
              className="h-11 w-full rounded-2xl border border-white/10 bg-black/40 px-3 text-sm"
            >
              <option value="">Alla</option>
              <option value="high">Hög</option>
              <option value="medium">Medel</option>
              <option value="low">Låg</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs text-white/60">Scope</label>
            <select
              name="scope"
              defaultValue={selectedScope}
              className="h-11 w-full rounded-2xl border border-white/10 bg-black/40 px-3 text-sm"
            >
              <option value="">Alla ärenden</option>
              <option value="mine">Mina ärenden</option>
              <option value="unassigned">Otilldelade</option>
            </select>
          </div>

          <div className="flex items-end gap-3">
            <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90">
              Filtrera
            </button>
            <Link
              href="/admin/support-tickets"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white/80 transition hover:bg-white/5"
            >
              Rensa
            </Link>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {topTickets.map((ticket) => {
          const messages = messagesMap.get(ticket.id) ?? []
          const isMine = ticket.assigned_user_id === ctx.userId
          const isUnassigned = !ticket.assigned_user_id

          return (
            <section
              key={ticket.id}
              className="rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
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

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] ${getPriorityBadgeClass(
                        ticket.priority
                      )}`}
                    >
                      {getPriorityLabel(ticket.priority)}
                    </span>

                    {isMine ? (
                      <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200">
                        Tilldelad mig
                      </span>
                    ) : null}

                    {isUnassigned ? (
                      <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-200">
                        Ej tilldelad
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/55">
                    <span>{ticket.category}</span>
                    <span>•</span>
                    <span>Kund: {ticket.user_id}</span>
                    <span>•</span>
                    <span>{messages.length} meddelanden</span>
                  </div>
                </div>

                <div className="text-xs text-white/45">
                  Uppdaterad {formatDate(ticket.updated_at)}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/45">Beskrivning</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-white/85">
                  {ticket.description}
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                <form
                  action={assignSupportTicketAction}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <input type="hidden" name="ticket_id" value={ticket.id} />
                  <div className="text-sm font-medium">Tilldela till mig</div>
                  <div className="mt-1 text-xs text-white/55">
                    Nuvarande handläggare: {ticket.assigned_user_id || 'Ingen'}
                  </div>
                  <button className="mt-3 h-10 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90">
                    Tilldela
                  </button>
                </form>

                <form
                  action={updateSupportTicketStatusAction}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <input type="hidden" name="ticket_id" value={ticket.id} />
                  <div className="text-sm font-medium">Uppdatera status</div>
                  <select
                    name="status"
                    defaultValue={ticket.status}
                    className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm"
                  >
                    <option value="open">Öppet</option>
                    <option value="waiting_on_internal">Under behandling</option>
                    <option value="waiting_on_customer">Väntar på kund</option>
                    <option value="resolved">Löst</option>
                    <option value="closed">Avslutat</option>
                  </select>
                  <button className="mt-3 h-10 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90">
                    Spara status
                  </button>
                </form>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-medium">Ärendeinformation</div>
                  <div className="mt-3 space-y-1 text-xs text-white/60">
                    <div>Skapat: {formatDate(ticket.created_at)}</div>
                    <div>Senast uppdaterat: {formatDate(ticket.updated_at)}</div>
                    <div>Avslutat: {formatDate(ticket.closed_at)}</div>
                    <div>Ansvarig: {ticket.assigned_user_id || 'Ingen'}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {messages.length > 0 ? (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="text-xs text-white/45">
                        {getSenderLabel(message.sender_type)} •{' '}
                        {formatDate(message.created_at)}
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-sm text-white/85">
                        {message.body}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
                    Inga meddelanden finns ännu i ärendet.
                  </div>
                )}
              </div>

              <form action={replyToSupportTicketAction} className="mt-5 space-y-3">
                <input type="hidden" name="ticket_id" value={ticket.id} />
                <div>
                  <label className="mb-2 block text-xs text-white/60">
                    Svara kunden
                  </label>
                  <textarea
                    name="body"
                    placeholder="Skriv ditt svar"
                    className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm"
                  />
                </div>
                <button className="h-11 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90 sm:w-auto">
                  Skicka svar
                </button>
              </form>
            </section>
          )
        })}

        {topTickets.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/60">
            Inga supportärenden matchar nuvarande filter.
          </div>
        )}
      </div>
    </div>
  )
}