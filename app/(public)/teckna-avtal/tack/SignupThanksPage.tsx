import Link from 'next/link'
import { readWebsiteApplicationResultState, type WebsiteCommunicationItem } from '@/lib/website/applicationResultStore'
import SwitchStatusCard from '@/components/signup/SwitchStatusCard'
import ApplicationStatusCard from '@/components/signup/ApplicationStatusCard'
import {
  statusLabel as friendlyStatusLabel,
  statusDescription as friendlyStatusDescription,
  nextStepDescription as friendlyNextStepDescription,
  missingFieldLabel as friendlyMissingFieldLabel,
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
      body: 'Logga in via knappen nedan. Gridex verifierar just den här teckningen mot ditt befintliga Mina sidor-konto och OPS kundidentitet. Ett nytt avtal eller en ny anläggning läggs till utan att tidigare avtal eller anläggningar ersätts.',
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
      return { title: 'Teckningen är kopplad till Mina sidor', body: 'Den här teckningen är kopplad till ditt befintliga kundkonto. Om avtalet gäller en ny anläggning visas den som en ny anläggning och tidigare avtal och anläggningar ligger kvar.', tone: 'info' as const, showLogin: true, needsClaim: false }
    case 'pending':
    case 'failed':
      return { title: 'Inloggning skickas separat', body: 'Din teckning är mottagen. Om inloggningsmailet inte kommer fram skickar vi ny länk när kundprofilen är färdigkopplad.', tone: 'warning' as const, showLogin: false, needsClaim: false }
    case 'skipped':
      return { title: 'Inloggning kommer separat', body: 'Din teckning är mottagen. Du får information om Mina sidor när kundprofilen är klar.', tone: 'info' as const, showLogin: false, needsClaim: false }
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
  const missing = stored.missingFields ?? []
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
  const portalActionLabel = portal.needsClaim ? 'Logga in och koppla den här teckningen' : 'Gå till Mina sidor'

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
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">{friendlyStatusDescription(status)} Nästa steg för avtal, leverantörsbyte och Mina sidor visas nedan och skickas när respektive del är redo.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Info label="Kundnummer" value={stored.customerNumber ?? '—'} />
          <Info label="Avtalsnummer" value={stored.contractNumber ?? 'Kommer i bekräftelsen'} />
          <Info label="Ärendenummer" value={stored.applicationNumber ?? '—'} />
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-semibold text-white">Status</div>
          <div className="mt-1 text-sm text-gray-300">{friendlyStatusLabel(status)}</div>
          <div className="mt-2 text-xs text-gray-500">Nästa steg: {friendlyNextStepDescription(stored.nextStep)}</div>
          {stored.nextActionMessage ? <p className="mt-3 text-sm leading-6 text-gray-300">{stored.nextActionMessage}</p> : null}
          {stored.caseReference ? <div className="mt-3 text-xs text-gray-500">Ärendereferens: {stored.caseReference}</div> : null}
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
            <div className={`mt-2 text-sm ${confirmationFailed ? 'text-rose-200' : 'text-gray-300'}`}>{confirmationFailed ? 'Det första utskicksförsöket misslyckades. Aktuell status följer via e-post eller Mina sidor.' : confirmationSent ? 'Avtalsbekräftelsen skickades i samband med teckningen.' : confirmationQueued ? 'Avtalsbekräftelsen köades vid teckningen. Aktuell status följer via e-post eller Mina sidor.' : stored.canSendAgreementConfirmation === false ? 'Avtalsbekräftelsen kan ännu inte skickas.' : 'Utskicksstatus meddelas separat.'}</div>
            <div className="mt-2 text-xs text-gray-500">{stored.canDispatchSupplierSwitch === true ? 'Leverantörsbytet kan skickas till marknaden.' : stored.canCreateSupplierSwitchRequest === true ? 'Underlaget för leverantörsbyte kan skapas, men inväntar nästa kontroll.' : stored.canStartSwitch === true ? 'Leverantörsbytet kan startas.' : 'Leverantörsbytet startar först när anläggningsuppgifterna är kompletta och verifierade.'}</div>
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
            <li>När avtalet är klart kommer avtalsbekräftelse, fryst PDF och information om ångerrätten.</li>
            <li>Om du är ny kund kommer därefter en separat länk för att aktivera Mina sidor. Har du redan konto kopplas just den här teckningen till samma kundkonto. Ett nytt avtal eller en ny anläggning läggs till separat och tidigare avtal och anläggningar ligger kvar.</li>
          </ol>
        </div>
        {missing.length > 0 ? <StatusList title="Uppgifter som kan behöva kompletteras" items={missing.map(friendlyMissingFieldLabel)} tone="warning" /> : null}
        {stored.blockingReasons.length > 0 ? <StatusList title="Teckningen behöver hanteras innan nästa steg" items={stored.blockingReasons} tone="warning" /> : null}
        {stored.warnings.length > 0 ? <StatusList title="Information från handläggningen" items={stored.warnings} tone="neutral" /> : null}
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

function StatusList({ title, items, tone }: { title: string; items: string[]; tone: 'warning' | 'neutral' }) {
  return <div className={`mt-6 rounded-2xl border p-5 ${tone === 'warning' ? 'border-amber-500/30 bg-amber-500/10 text-amber-50' : 'border-white/10 bg-white/5 text-gray-300'}`}><div className="text-sm font-semibold">{title}</div><ul className="mt-3 list-disc space-y-1 pl-5 text-sm opacity-80">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="text-xs uppercase tracking-wide text-gray-500">{label}</div><div className="mt-1 break-words text-lg font-semibold text-white">{value}</div></div>
}
