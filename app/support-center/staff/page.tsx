import Link from 'next/link'
import { randomUUID } from 'node:crypto'
import { requireGlobalAdminPageAccess } from '@/lib/admin/guards'
import { opsStaffSupportUrl } from '@/lib/support/staff'
import { assignSupportTicketAction, replyToSupportTicketAction, updateSupportTicketStatusAction } from '@/app/admin/support-tickets/actions'

export const dynamic = 'force-dynamic'

type Prospect = {
  id: string
  subject: string
  description: string
  status: string
  category: string
  created_at: string
  assigned_user_id: string | null
  metadata: { customer_name?: string; customer_email?: string; customer_phone?: string }
}
type Note = { id: string; body: string; created_at: string; is_internal_note: boolean }
const statuses: Record<string, string> = { open: 'Ny', waiting_on_internal: 'Under behandling', waiting_on_customer: 'Väntar på kontakt', resolved: 'Löst', closed: 'Avslutad' }
const fields = 'id,subject,description,status,category,created_at,assigned_user_id,metadata'

function date(value: string) {
  return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default async function StaffSupportPage({ searchParams }: { searchParams?: Promise<{ id?: string; offset?: string; status?: string }> }) {
  const ctx = await requireGlobalAdminPageAccess({ allOf: ['support_tickets.read'] })
  const params = await searchParams ?? {}
  const offset = /^\d{1,6}$/.test(params.offset ?? '') ? Math.min(100000, Number(params.offset)) : 0
  const status = params.status && Object.hasOwn(statuses, params.status) ? params.status : null
  const selectedId = typeof params.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.id) ? params.id : null
  let listQuery = ctx.supabase.from('customer_support_tickets').select(fields).is('user_id', null).eq('metadata->>source', 'public_kundservice_form')
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 49)
  if (status) listQuery = listQuery.eq('status', status)
  const [listResult, detailResult, notesResult] = await Promise.all([
    listQuery,
    selectedId ? ctx.supabase.from('customer_support_tickets').select(fields).eq('id', selectedId).is('user_id', null).eq('metadata->>source', 'public_kundservice_form').maybeSingle() : Promise.resolve({ data: null, error: null }),
    selectedId ? ctx.supabase.from('customer_support_messages').select('id,body,created_at,is_internal_note').eq('ticket_id', selectedId).eq('is_internal_note', true).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
  ])
  const tickets = (listResult.data ?? []) as unknown as Prospect[]
  const selected = detailResult.data as unknown as Prospect | null
  const notes = ((notesResult.data ?? []) as unknown as Note[]).toReversed()
  const canManage = ctx.permissions.includes('support_tickets.manage')
  const canNote = ctx.permissions.includes('support_tickets.reply')
  const query = (extra: Record<string, string>) => {
    const values = new URLSearchParams({ ...(status ? { status } : {}), ...extra })
    return `/support-center/staff?${values}`
  }
  const mailAddress = selected?.metadata.customer_email
  const mailLink = mailAddress && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailAddress)
    ? `mailto:${encodeURIComponent(mailAddress)}?subject=${encodeURIComponent(`Angående: ${selected?.subject ?? ''}`)}` : null

  return <div className="space-y-6">
    <header><h1 className="text-2xl font-semibold">Personal · kundservice</h1><p className="mt-2 text-sm text-white/60">Kundärenden hanteras i OPS. Kontaktförfrågningar från webbplatsens öppna formulär visas nedan.</p></header>
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5"><div><h2 className="font-semibold">Kundärenden och konversationer</h2><p className="mt-2 text-sm text-white/60">Öppna OPS för att läsa kundärenden, svara, tilldela handläggare och hantera interna anteckningar. Åtkomst styrs av ditt personalkonto i OPS.</p></div><a href={opsStaffSupportUrl()} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950">Öppna kundservice i OPS</a></section>
    {listResult.error || detailResult.error || notesResult.error ? <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100">Kontaktförfrågningarna kunde inte hämtas. Försök igen.</p> : null}
    <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-white/10 p-4"><h2 className="font-semibold">Kontaktförfrågningar</h2><form className="mt-4 flex gap-2"><label htmlFor="prospect-status" className="sr-only">Filtrera efter status</label><select id="prospect-status" name="status" defaultValue={status ?? ''} className="min-w-0 flex-1 rounded-lg border border-white/20 bg-slate-900 p-2 text-sm"><option value="">Alla statusar</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="rounded-lg border border-white/20 px-3 py-2 text-sm">Filtrera</button></form><div className="mt-4 space-y-2">{tickets.map((ticket) => <Link href={query({ id: ticket.id, offset: String(offset) })} key={ticket.id} className={`block rounded-xl border p-3 ${selectedId === ticket.id ? 'border-cyan-300/50 bg-cyan-300/10' : 'border-white/10 hover:border-white/30'}`}><div className="break-words text-sm font-medium">{ticket.subject}</div><div className="mt-2 text-xs text-white/50">{statuses[ticket.status] ?? ticket.status} · {date(ticket.created_at)}</div></Link>)}{!tickets.length && !listResult.error ? <p className="py-4 text-sm text-white/50">Inga förfrågningar i detta urval.</p> : null}</div><nav className="mt-4 flex justify-between text-sm text-cyan-200" aria-label="Sidindelning">{offset > 0 ? <Link href={query({ offset: String(Math.max(0, offset - 50)) })}>Föregående</Link> : <span />}{tickets.length === 50 ? <Link href={query({ offset: String(offset + 50) })}>Nästa</Link> : null}</nav></aside>
      <section className="min-w-0 rounded-2xl border border-white/10 p-5">{selected ? <div className="space-y-5">
        <header><h2 className="break-words text-xl font-semibold">{selected.subject}</h2><p className="mt-2 text-sm text-white/55">{statuses[selected.status] ?? selected.status} · {date(selected.created_at)}</p></header>
        <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-white/50">Namn</dt><dd className="mt-1">{selected.metadata.customer_name ?? '—'}</dd></div><div><dt className="text-white/50">E-post</dt><dd className="mt-1 break-all">{selected.metadata.customer_email ?? '—'}</dd></div><div><dt className="text-white/50">Telefon</dt><dd className="mt-1">{selected.metadata.customer_phone ?? '—'}</dd></div><div><dt className="text-white/50">Tilldelning</dt><dd className="mt-1">{selected.assigned_user_id === ctx.userId ? 'Tilldelad dig' : selected.assigned_user_id ? 'Tilldelad kollega' : 'Otilldelad'}</dd></div></dl>
        <p className="whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-6">{selected.description}</p>
        {canNote && mailLink ? <a href={mailLink} className="inline-flex rounded-lg border border-cyan-300/30 px-4 py-2 text-sm text-cyan-200">Öppna e-post för återkoppling</a> : null}
        <p className="text-xs text-white/50">Interna anteckningar skickas inte till den som kontaktat oss. Registrera eventuell återkoppling efter att den har skickats.</p>
        {canManage ? <div className="flex flex-wrap gap-3"><form action={assignSupportTicketAction}><input type="hidden" name="ticket_id" value={selected.id} /><button className="rounded-lg border border-white/20 px-4 py-2 text-sm">Tilldela mig</button></form><form action={updateSupportTicketStatusAction} className="flex flex-wrap gap-2"><input type="hidden" name="ticket_id" value={selected.id} /><label htmlFor="prospect-new-status" className="sr-only">Ändra status</label><select id="prospect-new-status" name="status" defaultValue={selected.status} className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="rounded-lg border border-white/20 px-4 py-2 text-sm">Spara status</button></form></div> : null}
        <div><h3 className="text-sm font-semibold">Interna anteckningar</h3>{notes.length === 100 ? <p className="mt-2 text-xs text-white/50">De senaste 100 anteckningarna visas.</p> : null}<div className="mt-3 space-y-3">{notes.map((note) => <article key={note.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><time className="text-xs text-white/45" dateTime={note.created_at}>{date(note.created_at)}</time><p className="mt-2 whitespace-pre-wrap break-words text-sm">{note.body}</p></article>)}</div></div>
        {canNote ? <form action={replyToSupportTicketAction} className="space-y-3"><input type="hidden" name="ticket_id" value={selected.id} /><input type="hidden" name="client_request_id" value={randomUUID()} /><label htmlFor="prospect-note" className="text-sm font-medium">Lägg till intern anteckning</label><textarea id="prospect-note" name="body" required maxLength={4000} rows={4} className="block w-full rounded-xl border border-white/15 bg-black/30 p-3 text-sm" /><button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950">Spara anteckning</button></form> : null}
      </div> : <p className="py-8 text-sm text-white/55">Välj en kontaktförfrågan för att läsa och följa upp.</p>}</section>
    </div>
  </div>
}
