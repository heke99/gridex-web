import Link from 'next/link'
import { readWebsiteApplicationResultState, type WebsiteCommunicationItem } from '@/lib/website/applicationResultStore'
import SwitchStatusCard from '@/components/signup/SwitchStatusCard'
import ApplicationStatusCard from '@/components/signup/ApplicationStatusCard'
import {
  statusLabel as friendlyStatusLabel,
  statusDescription as friendlyStatusDescription,
  nextStepDescription as friendlyNextStepDescription,
} from '@/lib/customerPortal/statusHelper'

type PortalStatus =
  | 'email_confirmation_sent'
  | 'invite_sent'
  | 'profile_linked'
  | 'pending'
  | 'failed'
  | 'skipped'
  | string

function portalMessage(status: PortalStatus | undefined, detail?: string | null) {
  if (status === 'pending' && detail?.toLowerCase().includes('konto finns redan')) {
    return {
      title: 'Ett konto finns redan',
      body: 'Logga in via knappen nedan. Den här teckningen kopplas till ditt befintliga Mina sidor-konto. Ett nytt avtal eller en ny anläggning läggs till utan att tidigare avtal eller anläggningar ersätts.',
      tone: 'info' as const,
      showLogin: true,
      needsClaim: true,
    }
  }
  switch (status) {
    case 'email_confirmation_sent':
    case 'invite_sent':
      return { title: 'Ny kund: bekräfta din e-post', body: 'Vi har skickat ett mail där du bekräftar din e-postadress och skapar lösenord till Mina sidor.', tone: 'success' as const, showLogin: false, needsClaim: false }
    case 'profile_linked':
      return { title: 'Redan kund? Logga in', body: 'Den här teckningen är kopplad till ditt befintliga kundkonto. Om avtalet gäller en ny anläggning visas den som en ny anläggning och tidigare avtal och anläggningar ligger kvar.', tone: 'info' as const, showLogin: true, needsClaim: false }
    case 'pending':
    case 'failed':
      return { title: 'Inloggning skickas separat', body: 'Din teckning är mottagen. Om inloggningsmailet inte kommer fram skickar vi en ny länk när Mina sidor är klart.', tone: 'warning' as const, showLogin: false, needsClaim: false }
    case 'skipped':
      return { title: 'Inloggning kommer separat', body: 'Din teckning är mottagen. Du får information om Mina sidor när ditt konto är klart.', tone: 'info' as const, showLogin: false, needsClaim: false }
    default:
      return { title: 'Nästa steg kommer via e-post', body: 'Vi har tagit emot din teckning. Kontrollera din inkorg för bekräftelse och nästa steg.', tone: 'info' as const, showLogin: false, needsClaim: false }
  }
}

function newCustomerState(status: PortalStatus | undefined, detail?: string | null): boolean | null {
  if (status === 'email_confirmation_sent' || status === 'invite_sent') return true
  if (status === 'profile_linked') return false
  if (status === 'pending' && detail?.toLowerCase().includes('konto finns redan')) return false
  return null
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })
}

function includesCommunicationEvent(events: WebsiteCommunicationItem[] | undefined, event: string) {
  return (events ?? []).some((value) => value.event_type === event || value.code === event)
}

export default async function SignupThanksPage({
  searchParams,
}: {
  searchParams?: Promise<{ result?: string }>
}) {
  const params = (await searchParams) ?? {}
  const resultToken = typeof params.result === 'string' ? params.result : ''
  const resultState = await readWebsiteApplicationResultState(resultToken)

  if (resultState.status !== 'verified') {
    return <UnverifiedResult state={resultState.status} />
  }

  const stored = resultState.result
  const status = stored.status
  const portal = portalMessage(stored.portalStatus, stored.portalMessage)
  const isNewCustomer = newCustomerState(stored.portalStatus, stored.portalMessage)
  const signedAt = formatTimestamp(stored.signedAt)
  const withdrawalDeadline = formatTimestamp(stored.withdrawalDeadlineAt)
  const confirmationFailed = includesCommunicationEvent(stored.communicationFailed, 'contract.confirmation_sent')
  const confirmationSent = includesCommunicationEvent(stored.communicationSent, 'contract.confirmation_sent')
  const confirmationQueued = includesCommunicationEvent(stored.communicationQueued, 'contract.confirmation_sent')
  const portalClaimHref = resultToken
    ? `/auth/portal-claim?result=${encodeURIComponent(resultToken)}`
    : '/login'
  const portalActionHref = portal.needsClaim ? portalClaimHref : '/mina-sidor'
  const portalActionLabel = portal.needsClaim ? 'Logga in och koppla den här teckningen' : 'Öppna Mina sidor'

  const confirmationCopy = confirmationFailed
    ? 'Vi följer upp avtalsbekräftelsen och kontaktar dig vid behov.'
    : confirmationSent
      ? 'Avtalsbekräftelsen har skickats till din e-post.'
      : confirmationQueued
        ? 'Avtalsbekräftelsen skickas till din e-post.'
        : stored.canSendAgreementConfirmation === false
          ? 'Avtalsbekräftelsen skickas så snart den är klar.'
          : 'Du får avtalsbekräftelsen via e-post.'

  const switchCopy = stored.canDispatchSupplierSwitch === true || stored.canCreateSupplierSwitchRequest === true || stored.canStartSwitch === true
    ? 'Vi förbereder nu leverantörsbytet och håller dig uppdaterad om nästa steg.'
    : 'Gridex hanterar de uppgifter som krävs för leverantörsbytet. Vi kontaktar dig endast om vi behöver något från dig.'

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <span
        hidden
        data-gridex-verified-application-received="true"
        data-gridex-contract-signed={stored.contractStatus === 'signed' ? 'true' : 'false'}
        data-gridex-application-number={stored.applicationNumber ?? undefined}
        data-gridex-new-customer={isNewCustomer === null ? undefined : isNewCustomer ? 'true' : 'false'}
      />
      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">Teckning mottagen</div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">Tack! Din teckning är skickad.</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">{friendlyStatusDescription(status)} Du får information om avtal, leverantörsbyte och Mina sidor när respektive del är klar.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Info label="Kundnummer" value={stored.customerNumber ?? '—'} />
          <Info label="Avtalsnummer" value={stored.contractNumber ?? 'Kommer i bekräftelsen'} />
          <Info label="Ärendenummer" value={stored.applicationNumber ?? '—'} />
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-semibold text-white">Status</div>
          <div className="mt-1 text-sm text-gray-300">{friendlyStatusLabel(status)}</div>
          <div className="mt-2 text-xs text-gray-500">Nästa steg: {friendlyNextStepDescription(stored.nextStep)}</div>
          {stored.powerOfAttorneySigned ? <div className="mt-3 text-xs text-emerald-300">Fullmakten är mottagen.</div> : null}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold text-white">Avtal och ångerrätt</div>
            <div className="mt-2 text-sm text-gray-300">{stored.contractStatus === 'signed' ? `Avtalet är signerat${signedAt ? ` ${signedAt}` : ''}.` : 'Avtalet behandlas fortfarande.'}</div>
            {withdrawalDeadline ? <div className="mt-2 text-xs text-gray-500">Ångerfristen löper till {withdrawalDeadline}.</div> : null}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold text-white">Bekräftelse och leverantörsbyte</div>
            <div className={`mt-2 text-sm ${confirmationFailed ? 'text-amber-100' : 'text-gray-300'}`}>{confirmationCopy}</div>
            <div className="mt-2 text-xs text-gray-500">{switchCopy}</div>
          </div>
        </div>
        <div className={['mt-6 rounded-2xl border p-5', portal.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/10' : portal.tone === 'warning' ? 'border-amber-500/30 bg-amber-500/10' : 'border-cyan-500/20 bg-cyan-500/10'].join(' ')}>
          <div className="text-sm font-semibold text-white">{portal.title}</div>
          <p className="mt-2 text-sm leading-6 text-gray-200">{portal.body}</p>
        </div>
        {stored.applicationNumber && resultToken ? (
          <ApplicationStatusCard
            applicationNumber={stored.applicationNumber}
            resultToken={resultToken}
            initialStatus={stored.status}
          />
        ) : null}
        {stored.applicationNumber && resultToken ? (
          <SwitchStatusCard resultToken={resultToken} initialStatus={stored.supplierSwitchStatus} />
        ) : null}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-semibold text-white">E-post och Mina sidor – i den här ordningen</div>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-gray-300">
            <li>Först får du besked att teckningen har tagits emot.</li>
            <li>När avtalet är klart får du avtalsbekräftelse, en PDF-kopia av avtalet och information om ångerrätten.</li>
            <li>Om du är ny kund får du därefter en separat länk för att aktivera Mina sidor. Har du redan ett konto kopplas den här teckningen till samma kundkonto utan att tidigare avtal eller anläggningar ersätts.</li>
          </ol>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="rounded-xl bg-cyan-500 px-6 py-3 text-center font-bold text-black transition hover:bg-cyan-400">Till startsidan</Link>
          {portal.showLogin ? <Link href={portalActionHref} className="rounded-xl border border-white/10 px-6 py-3 text-center text-gray-200 transition hover:border-cyan-500/40 hover:bg-white/5">{portalActionLabel}</Link> : null}
          <Link href="/kundservice" className="rounded-xl border border-white/10 px-6 py-3 text-center text-gray-200 transition hover:border-cyan-500/40 hover:bg-white/5">Kontakta oss</Link>
        </div>
      </section>
    </div>
  )
}

function UnverifiedResult({
  state,
}: {
  state: 'missing' | 'invalid' | 'expired' | 'storage_error'
}) {
  const expired = state === 'expired'
  const temporarilyUnavailable = state === 'storage_error'
  const title = expired
    ? 'Resultatlänken har gått ut'
    : temporarilyUnavailable
      ? 'Statusen kan inte hämtas just nu'
      : 'Teckningen kan inte verifieras från länken'
  const body = expired
    ? 'Av säkerhetsskäl gäller resultatlänken i 24 timmar. Logga in på Mina sidor eller kontakta kundservice för att få aktuell status.'
    : temporarilyUnavailable
      ? 'Vi visar inget framgångsbesked utan ett verifierat resultat. Kontrollera din e-post och försök igen senare, eller kontakta kundservice.'
      : 'Länken saknas eller är ogiltig. Vi visar därför inte att en teckning har lyckats. Kontrollera din e-post, logga in på Mina sidor eller kontakta kundservice.'

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <section className="rounded-3xl border border-amber-500/30 bg-[#0B0F17] p-8 md:p-12">
        <div className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
          Status ej verifierad
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-gray-300">{body}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/login" className="rounded-xl bg-cyan-500 px-6 py-3 text-center font-bold text-black transition hover:bg-cyan-400">
            Logga in på Mina sidor
          </Link>
          <Link href="/kundservice" className="rounded-xl border border-white/10 px-6 py-3 text-center text-gray-200 transition hover:border-cyan-500/40 hover:bg-white/5">
            Kontakta kundservice
          </Link>
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="text-xs uppercase tracking-wide text-gray-500">{label}</div><div className="mt-1 break-words text-lg font-semibold text-white">{value}</div></div>
}
