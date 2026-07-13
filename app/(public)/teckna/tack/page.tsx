import Link from 'next/link'
import type { Metadata } from 'next'
import { readWebsiteApplicationResult } from '@/lib/website/applicationResultStore'
import {
  statusLabel as friendlyStatusLabel,
  statusDescription as friendlyStatusDescription,
  nextStepDescription as friendlyNextStepDescription,
  missingFieldLabel as friendlyMissingFieldLabel,
} from '@/lib/customerPortal/statusHelper'

export const metadata: Metadata = {
  title: 'Teckning mottagen – Gridex',
  description: 'Bekräftelse på att Gridex har tagit emot din teckning.',
  robots: { index: false, follow: false },
}

type PortalStatus =
  | 'email_confirmation_sent'
  | 'invite_sent'
  | 'profile_linked'
  | 'pending'
  | 'failed'
  | 'skipped'
  | string

function portalMessage(status: PortalStatus | undefined) {
  switch (status) {
    case 'email_confirmation_sent':
    case 'invite_sent':
      return {
        title: 'Ny kund: bekräfta din e-post',
        body: 'Vi har skickat ett mail där du bekräftar din e-postadress och skapar lösenord till Mina sidor.',
        tone: 'success' as const,
      }
    case 'profile_linked':
      return {
        title: 'Redan kund? Logga in',
        body: 'Din teckning är kopplad till ditt befintliga kundkonto. Logga in med ditt nuvarande lösenord för att se Mina sidor.',
        tone: 'info' as const,
      }
    case 'pending':
    case 'failed':
      return {
        title: 'Inloggning skickas separat',
        body: 'Din teckning är mottagen. Om inloggningsmailet inte kommer fram skickar vi ny länk när kundprofilen är färdigkopplad.',
        tone: 'warning' as const,
      }
    case 'skipped':
      return {
        title: 'Inloggning kommer separat',
        body: 'Din teckning är mottagen. Du får information om Mina sidor när kundprofilen är klar.',
        tone: 'info' as const,
      }
    default:
      return {
        title: 'Nästa steg kommer via e-post',
        body: 'Vi har tagit emot din teckning. Kontrollera din inkorg för bekräftelse och nästa steg.',
        tone: 'info' as const,
      }
  }
}

export default async function TackPage({
  searchParams,
}: {
  searchParams?: Promise<{ result?: string }>
}) {
  const params = (await searchParams) ?? {}
  const stored = await readWebsiteApplicationResult(params.result).catch((error) => {
    console.error('[website signup] result token read failed', error)
    return null
  })
  const missing = stored?.missingFields ?? []
  const status = stored?.status ?? 'application_received'
  const portalStatus = stored?.portalStatus
  const portal = portalMessage(portalStatus)
  const showLogin = portalStatus === 'profile_linked'

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          Teckning mottagen
        </div>

        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Tack! Din teckning är skickad.
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">
          {friendlyStatusDescription(status)} Om du är ny kund får du ett separat mail där du bekräftar din e-postadress och skapar lösenord till Mina sidor. Om du redan är kund loggar du in som vanligt.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Info label="Kundnummer" value={stored?.customerNumber ?? 'Kommer i bekräftelsen'} />
          <Info label="Avtalsnummer" value={stored?.contractNumber ?? 'Kommer i bekräftelsen'} />
          <Info label="Ärendenummer" value={stored?.applicationNumber ?? '—'} />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-semibold text-white">Status</div>
          <div className="mt-1 text-sm text-gray-300">{friendlyStatusLabel(status)}</div>
          <div className="mt-2 text-xs text-gray-500">
            Nästa steg: {friendlyNextStepDescription(stored?.nextStep)}
          </div>
          {stored?.nextActionMessage ? (
            <p className="mt-3 text-sm leading-6 text-gray-300">{stored?.nextActionMessage}</p>
          ) : null}
          {stored?.caseReference ? (
            <div className="mt-3 text-xs text-gray-500">Ärendereferens: {stored?.caseReference}</div>
          ) : null}
          {stored?.powerOfAttorneySigned === true ? (
            <div className="mt-3 text-xs text-emerald-300">Fullmakten är mottagen.</div>
          ) : null}
        </div>

        <div
          className={[
            'mt-6 rounded-2xl border p-5',
            portal.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : portal.tone === 'warning'
                ? 'border-amber-500/30 bg-amber-500/10'
                : 'border-cyan-500/20 bg-cyan-500/10',
          ].join(' ')}
        >
          <div className="text-sm font-semibold text-white">{portal.title}</div>
          <p className="mt-2 text-sm leading-6 text-gray-200">{portal.body}</p>
        </div>

        {missing.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="text-sm font-semibold text-amber-100">
              Uppgifter som kan behöva kompletteras
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-50/80">
              {missing.map((field) => (
                <li key={field}>{friendlyMissingFieldLabel(field)}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-amber-50/70">
              Vi kontrollerar detta och kontaktar dig om vi behöver något mer.
            </p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-xl bg-cyan-500 px-6 py-3 text-center font-bold text-black transition hover:bg-cyan-400"
          >
            Till startsidan
          </Link>
          {showLogin ? (
            <Link
              href="/login"
              className="rounded-xl border border-white/10 px-6 py-3 text-center text-gray-200 transition hover:border-cyan-500/40 hover:bg-white/5"
            >
              Logga in
            </Link>
          ) : null}
          <Link
            href="/kundservice"
            className="rounded-xl border border-white/10 px-6 py-3 text-center text-gray-200 transition hover:border-cyan-500/40 hover:bg-white/5"
          >
            Kontakta oss
          </Link>
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 break-words text-lg font-semibold text-white">{value}</div>
    </div>
  )
}
