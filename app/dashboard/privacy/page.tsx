import Link from 'next/link'
import { getPortalSession } from '@/lib/customerPortal/service'
import { listPrivacyRequests } from '@/lib/customerPortal/privacy'
import { PRIVACY_REQUEST_LABELS } from '@/lib/customerPortal/privacyRules'
import PrivacyRequestForm from './PrivacyRequestForm'

export const dynamic = 'force-dynamic'
const statusLabels = { queued: 'Sparad – väntar på överföring', submitted: 'Överförd till kundservice', needs_attention: 'Behöver hjälp av kundservice' }

export default async function PrivacyPage() {
  const { user } = await getPortalSession()
  let requests: Awaited<ReturnType<typeof listPrivacyRequests>> | null = null
  try { requests = await listPrivacyRequests(user.id) } catch { /* Never present a failed read as an empty history. */ }
  return <div className="space-y-6">
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h1 className="text-2xl font-semibold">Mina personuppgifter</h1>
      <p className="mt-3 text-sm leading-6 text-white/70">Här kan du begära registerutdrag eller radering. Kundservice återkommer med besked. En sparad begäran betyder att den är mottagen för hantering.</p>
      <Link href="/integritetspolicy" className="mt-3 inline-block text-sm text-cyan-300 underline">Läs om hur vi behandlar personuppgifter</Link>
    </section>
    <div className="grid gap-4 lg:grid-cols-2">
      <PrivacyRequestForm kind="access" userId={user.id} />
      <PrivacyRequestForm kind="erasure" userId={user.id} />
    </div>
    <section className="rounded-3xl border border-white/10 p-6">
      <h2 className="text-xl font-semibold">Dina senaste begäranden</h2>
      <p className="mt-2 text-sm text-white/60">Överföring sker automatiskt, normalt inom en timme. Ärenden hanteras därefter av kundservice. Här visas de senaste 50 begärandena.</p>
      <Link href="/dashboard/privacy" prefetch={false} className="my-3 inline-block text-sm text-cyan-300 underline">Uppdatera status</Link>
      {requests === null ? <p role="alert">Status kunde inte hämtas. Försök igen senare.</p> : requests.length === 0 ? <p className="text-white/60">Du har inga sparade begäranden.</p> :
        <ul className="space-y-4">{requests.map(request => <li key={request.id} className="rounded-xl bg-white/5 p-4 text-sm">
          <p className="font-semibold">{PRIVACY_REQUEST_LABELS[request.kind]}</p>
          <p>{statusLabels[request.status]}</p>
          <p className="mt-1 text-white/60">{new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Stockholm' }).format(new Date(request.created_at))}</p>
          <p className="mt-1 break-all text-xs text-white/60">Referens: {request.case_reference ?? request.id}</p>
        </li>)}</ul>}
      <Link href="/dashboard/support" className="mt-5 inline-block text-sm text-cyan-300 underline">Kontakta kundservice och följ ditt ärende</Link>
    </section>
  </div>
}
