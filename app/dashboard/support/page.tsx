import { getCustomerTickets, getPortalSession, getTicketMessages } from '@/lib/customerPortal/service'
import { addSupportMessageAction, createSupportTicketAction } from './actions'

export const dynamic = 'force-dynamic'

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

export default async function DashboardSupportPage() {
  const { supabase, user } = await getPortalSession()
  const tickets = await getCustomerTickets(supabase, user.id)
  const expanded = await Promise.all(
    tickets.slice(0, 5).map(async (ticket) => ({
      ticket,
      messages: await getTicketMessages(supabase, ticket.id),
    }))
  )

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Support</h1>
        <p className="mt-2 text-sm text-white/60">
          Kundportalen har ett eget ärendespår med ticket-tabell, meddelanden och tydlig statusmodell. Det går att koppla vidare till externt kundservicesystem via provider_case_ref.
        </p>
      </div>

      <form action={createSupportTicketAction} className="rounded-3xl border border-white/10 bg-black/30 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Skapa nytt ärende</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <input name="subject" placeholder="Ämne" className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 md:col-span-2" />
          <select name="category" className="h-11 rounded-xl border border-white/10 bg-black/40 px-3">
            <option value="general">Allmänt</option>
            <option value="invoice">Faktura</option>
            <option value="move">Flytt</option>
            <option value="contract">Avtal</option>
          </select>
        </div>
        <select name="priority" className="h-11 rounded-xl border border-white/10 bg-black/40 px-3">
          <option value="normal">Normal</option>
          <option value="high">Hög</option>
          <option value="urgent">Akut</option>
        </select>
        <textarea name="description" placeholder="Beskriv ärendet" className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3" />
        <button className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black">Skapa ärende</button>
      </form>

      <div className="space-y-4">
        {expanded.map(({ ticket, messages }) => (
          <section key={ticket.id} className="rounded-3xl border border-white/10 bg-black/30 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{ticket.subject}</h2>
                <div className="mt-1 text-sm text-white/60">
                  {ticket.category} • {ticket.priority} • {ticket.status}
                </div>
              </div>
              <div className="text-xs text-white/45">Skapad {formatDate(ticket.created_at)}</div>
            </div>

            <div className="mt-5 space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/45">{message.sender_type} • {formatDate(message.created_at)}</div>
                  <div className="mt-2 text-sm text-white/85">{message.body}</div>
                </div>
              ))}
            </div>

            <form action={addSupportMessageAction} className="mt-5 space-y-3">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <textarea name="body" placeholder="Skriv svar eller komplettering" className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3" />
              <button className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black">Skicka svar</button>
            </form>
          </section>
        ))}

        {tickets.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/60">
            Inga supportärenden ännu.
          </div>
        )}
      </div>
    </div>
  )
}
