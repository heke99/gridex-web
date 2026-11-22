import Link from 'next/link'
import LogoutForm from '@/components/account/LogoutForm'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CustomerPortalAccessError, getCustomerPortalOverview, getPortalSession } from '@/lib/customerPortal/service'
import { statusLabel, nextStepDescription, powerOfAttorneyScopeLabel, powerOfAttorneyStatusLabel } from '@/lib/customerPortal/statusHelper'
import { readPortalQueueStatus } from '@/lib/customerPortal/queueStatus'
import { customerInvoiceStatusLabel, formatCustomerDate as formatDate } from '@/lib/customerPortal/display'
import ContractPricing from '@/components/customer/ContractPricing'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

function buildLoginRedirect() {
  const qs = new URLSearchParams()
  qs.set('next', '/mina-sidor')
  return `/login?${qs.toString()}`
}

function displayName(
  profile: {
    company_name?: string | null
    first_name?: string | null
    full_name?: string | null
    last_name?: string | null
  } | null
) {
  const personalName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  return profile?.company_name || profile?.full_name || personalName || 'kund'
}

function PortalLinkNotice({ message, action }: { message: string; action?: 'activate' | 'support' }) {
  return (
    <div role="status" className="mt-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-50/90">
      <p>{message}</p>
      {action === 'activate' && <Link href="/aktivera-kundkonto" className="mt-2 inline-block underline">Koppla ditt kundkonto</Link>}
      {action === 'support' && <Link href="/kundservice" className="mt-2 inline-block underline">Kontakta kundservice</Link>}
    </div>
  )
}

export default async function MinaSidorPage({ searchParams }: {
  searchParams?: Promise<{ portal_link?: string | string[] }>
}) {
  const session = await getPortalSession().catch((error: unknown) => {
    if (error instanceof CustomerPortalAccessError) redirect(buildLoginRedirect())
    throw error
  })
  const { user } = session
  const portalLink = (await searchParams)?.portal_link
  const hasLinkResult = portalLink === 'invalid' || portalLink === 'review' ||
    portalLink === 'pending' || portalLink === 'completed'

  const [overview, onboardingStatus, profileSyncStatus] = await Promise.all([
    getCustomerPortalOverview(undefined, session).catch((error: unknown) => {
      if (!hasLinkResult) throw error
      return null
    }),
    readPortalQueueStatus('portal_onboarding_jobs', user.id),
    readPortalQueueStatus('auth_profile_sync_jobs', user.id),
  ])
  const queueStatuses = [onboardingStatus, profileSyncStatus]
  const queueMessage = queueStatuses.includes('unavailable')
    ? 'Kopplingens status kan inte visas just nu. Försök igen senare.'
    : queueStatuses.includes('manual_review')
      ? 'Kopplingen till alla uppgifter på Mina sidor behöver granskas av kundservice. Du behöver inte teckna avtalet igen.'
      : queueStatuses.includes('pending')
        ? 'Kopplingen till alla uppgifter på Mina sidor slutförs fortfarande. Du behöver inte teckna avtalet igen. Systemet försöker automatiskt igen.'
        : null
  const linkMessage = portalLink === 'invalid'
    ? 'Kopplingslänken kunde inte verifieras. Du kan koppla kontot med ditt kundnummer eller kontakta kundservice.'
    : portalLink === 'review'
      ? 'Kopplingsförsöket behöver granskas av kundservice.'
      : queueMessage ?? (portalLink === 'pending'
        ? 'Kopplingen är ännu inte bekräftad. Kontrollera status igen om en stund.'
        : portalLink === 'completed'
          ? overview?.verifiedCustomerAccess
            ? 'Din kundåtkomst är verifierad. Du kan se dina uppgifter på Mina sidor.'
            : 'Kundåtkomsten kunde inte bekräftas just nu. Försök igen om en stund eller kontakta kundservice.'
          : null)
  const linkAction = portalLink === 'invalid' ? 'activate' : portalLink === 'review' ||
    queueStatuses.includes('manual_review') || (portalLink === 'completed' && !overview?.verifiedCustomerAccess)
    ? 'support' : undefined

  if (!overview) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 text-white">
        <h1 className="text-3xl font-bold">Mina sidor</h1>
        {linkMessage && <PortalLinkNotice message={linkMessage} action={linkAction} />}
        <p className="mt-4">Kunduppgifterna kan inte hämtas just nu.</p>
        <Link href="/mina-sidor" className="mt-2 inline-block underline">Försök igen</Link>
      </main>
    )
  }

  const unavailable = overview.unavailableSections ?? []
  const profile = overview.profile
  const latestContract = overview.contracts[0] ?? null
  const latestSite = overview.sites[0] ?? null
  const activePowerOfAttorney = overview.powersOfAttorney.find(
    (item) => item.status === 'active'
  ) ?? overview.powersOfAttorney[0] ?? null

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-[#0B0F17] p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <Link href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
              Gridex AB
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Mina sidor
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">
              Välkommen {displayName(profile)}. Här ser du dina uppgifter, elavtal,
              anläggning, fakturor, dokument, godkännanden och fullmakt.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link href="/dashboard/support" className="rounded-xl border border-white/10 px-4 py-2 text-center text-sm text-white/80 hover:bg-white/5">
              Mina supportärenden
            </Link>
            <Link href="/dashboard/privacy" className="rounded-xl border border-white/10 px-4 py-2 text-center text-sm text-white/80 hover:bg-white/5">
              Mina personuppgifter
            </Link>
            <Link
              href="/dashboard/profile"
              className="rounded-xl border border-white/10 px-4 py-2 text-center text-sm text-white/80 transition hover:bg-white/5"
            >
              Uppdatera profil
            </Link>
            <LogoutForm
              redirectTo="/login"
              label="Logga ut"
              className="sm:w-auto"
            />
          </div>
        </header>

        {!linkMessage && !profile?.customer_number && !profile?.external_customer_id ? (
          <Link href="/aktivera-kundkonto" className="mt-6 block rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-5 text-cyan-200 underline">
            Har du redan ett kundnummer? Koppla ditt kundkonto.
          </Link>
        ) : null}

        {!overview.opsAvailable ? (
          <div className="mt-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-50/90">
            Vi visar senast lokalt sparade uppgifter. Uppgifter från Gridex kan vara äldre tills anslutningen är återställd.
          </div>
        ) : null}


        {overview.dataFreshnessMessage && <p role="status" className="mt-4 text-sm text-amber-100">{overview.dataFreshnessMessage}</p>}

        {linkMessage && <PortalLinkNotice message={linkMessage} action={linkAction} />}

        {overview.customerStatus ? (
          <div className={`mt-6 rounded-3xl border p-5 ${overview.customerStatus.can_start_switch === false ? 'border-amber-500/30 bg-amber-500/10 text-amber-50/90' : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-50/90'}`}>
            <div className="font-semibold text-white">
              {overview.customerStatus.label || statusLabel(overview.customerStatus.code)}
            </div>
            {overview.customerStatus.message ? (
              <p className="mt-2 text-sm leading-6">{overview.customerStatus.message}</p>
            ) : null}
            {overview.dataQuality?.issues.length ? (
              <div className="mt-3 text-xs text-white/70">
                Uppgifter som kontrolleras: {overview.dataQuality.issues.map((issue) => statusLabel(issue)).join(', ')}
              </div>
            ) : null}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <InfoCard label="Kundnummer" value={profile?.customer_number || profile?.contract_customer_ref || 'Kommer senare'} />
          <InfoCard label="Avtalsstatus" value={statusLabel(latestContract?.status)} />
          <InfoCard label="Anläggning" value={statusLabel(latestSite?.verification_status || latestSite?.resolution_status)} />
          <InfoCard label="Fullmakt" value={unavailable.includes('powers_of_attorney') ? 'Kan inte visas just nu' : activePowerOfAttorney ? powerOfAttorneyStatusLabel(activePowerOfAttorney.status) : 'Saknas eller kontrolleras'} />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Mina uppgifter</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoCard label="Namn" value={profile?.full_name || profile?.company_name || '—'} />
              <InfoCard label="E-post för inloggning" value={user.email || '—'} />
              {profile?.email && profile.email.toLowerCase() !== user.email?.toLowerCase() && (
                <InfoCard label="Kontaktadress i kundsystemet" value={profile.email} />
              )}
              <InfoCard label="Telefon" value={profile?.phone || '—'} />
              <InfoCard label="Kundtyp" value={profile?.customer_type === 'business' ? 'Företag' : 'Privatkund'} />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Status för mitt byte</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-300">
              <p>Status: <span className="text-white">{statusLabel(overview.switchStatus?.status || latestContract?.status)}</span></p>
              <p>Nästa steg: <span className="text-white">{overview.switchStatus?.next_step ? nextStepDescription(overview.switchStatus.next_step) : 'Vi uppdaterar när nästa steg är klart.'}</span></p>
              <p>Önskat startdatum: <span className="text-white">{formatDate(overview.switchStatus?.requested_start_date || latestContract?.requested_start_date)}</span></p>
              <p>Bekräftat startdatum: <span className="text-white">{formatDate(overview.switchStatus?.confirmed_start_date || latestContract?.confirmed_start_date)}</span></p>
            </div>
            {overview.switchStatus?.missing_fields?.length ? (
              <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-50/90">
                Vi kontrollerar några uppgifter innan nästa steg kan slutföras.
              </div>
            ) : null}
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Mitt elavtal</h2>
              <p className="mt-1 text-sm text-white/60">Avtalsuppgifter hämtas från Gridex kundsystem.</p>
            </div>
            <Link href="/dashboard/contracts" className="text-sm text-cyan-300 hover:text-cyan-200">
              Visa alla avtal och priser
            </Link>
          </div>
          {latestContract ? (
            <div>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <InfoCard label="Avtal" value={latestContract.contract_name || latestContract.contract_slug || 'Elavtal'} />
                <InfoCard label="Avtalsnummer" value={latestContract.contract_number || latestContract.contract_external_ref || '—'} />
                {latestContract.requested_start_date ? <InfoCard label="Önskat startdatum" value={formatDate(latestContract.requested_start_date)} /> : null}
                {latestContract.confirmed_start_date ? <InfoCard label="Bekräftat startdatum" value={formatDate(latestContract.confirmed_start_date)} /> : null}
                {latestContract.actual_start_date ? <InfoCard label="Faktiskt startdatum" value={formatDate(latestContract.actual_start_date)} /> : null}
                {!latestContract.requested_start_date && !latestContract.confirmed_start_date && !latestContract.actual_start_date
                  ? <InfoCard label="Startdatum" value={formatDate(latestContract.starts_at)} /> : null}
                <InfoCard label="Status" value={statusLabel(latestContract.status)} />
              </div>
              <ContractPricing contract={latestContract} />
            </div>
          ) : (
            <EmptyText>Inget elavtal visas ännu. <Link href="/teckna-avtal" className="text-cyan-300 underline">Teckna ett elavtal</Link> eller <Link href="/aktivera-kundkonto" className="text-cyan-300 underline">koppla ett befintligt kundkonto</Link>.</EmptyText>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Min anläggning</h2>
          {latestSite ? (
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <InfoCard label="Adress" value={[latestSite.address, latestSite.postal_code, latestSite.city].filter(Boolean).join(', ') || '—'} />
              <InfoCard label="Anläggnings-ID" value={latestSite.facility_id || 'Kontrolleras'} />
              <InfoCard label="Mätpunkts-ID" value={latestSite.metering_point_id || 'Kontrolleras'} />
              <InfoCard label="Nätägare" value={latestSite.grid_owner_name || 'Kontrolleras'} />
            </div>
          ) : (
            <EmptyText>Ingen anläggning visas ännu.</EmptyText>
          )}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Mina godkännanden</h2>
            <div className="mt-4 space-y-3">
              {overview.legalAcceptances.slice(0, 6).map((item) => (
                <ListRow
                  key={item.id}
                  title={item.title || statusLabel(item.acceptance_type)}
                  meta={`Version ${item.version || '—'} • ${formatDate(item.accepted_at)}`}
                  badge={statusLabel(item.status)}
                />
              ))}
              {unavailable.includes('legal_acceptances') ? <EmptyText>Godkännanden kunde inte hämtas just nu.</EmptyText> : overview.legalAcceptances.length === 0 ? (
                <EmptyText>Inga godkännanden visas ännu.</EmptyText>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Fullmakt</h2>
            {activePowerOfAttorney ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-gray-300">
                <div className="font-semibold text-white">{activePowerOfAttorney.title || 'Fullmakt'}</div>
                <div className="mt-2">Status: {powerOfAttorneyStatusLabel(activePowerOfAttorney.status)}</div>
                <div>Godkänd: {formatDate(activePowerOfAttorney.accepted_at)}</div>
                {activePowerOfAttorney.valid_until ? <div>Giltig till: {formatDate(activePowerOfAttorney.valid_until)}</div> : null}
                {activePowerOfAttorney.revoked_at ? <div>Återkallad: {formatDate(activePowerOfAttorney.revoked_at)}</div> : null}
                <div>Version: {activePowerOfAttorney.version || '—'}</div>
                <div>Omfattning: {activePowerOfAttorney.scopes.length ? activePowerOfAttorney.scopes.map(powerOfAttorneyScopeLabel).join(', ') : '—'}</div>
             </div>
            ) : (
              <EmptyText>Fullmakt visas när den är kopplad till din kundprofil.</EmptyText>
            )}
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Mina fakturor</h2>
              <Link href="/dashboard/invoices" className="text-sm text-cyan-300 hover:text-cyan-200">Visa alla</Link>
            </div>
            <div className="mt-4 space-y-3">
              {overview.invoices.slice(0, 3).map((invoice) => (
                <ListRow
                  key={invoice.id}
                  title={invoice.invoice_number || invoice.external_invoice_ref || 'Faktura'}
                  meta={`Förfallodatum ${formatDate(invoice.due_at)}`}
                  badge={customerInvoiceStatusLabel(invoice.status)}
                />
              ))}
              {unavailable.includes('invoices') ? <EmptyText>Fakturor kunde inte hämtas just nu.</EmptyText> : overview.invoices.length === 0 ? <EmptyText>Inga fakturor visas ännu.</EmptyText> : null}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Mina dokument</h2>
              <Link href="/dashboard/documents" className="text-sm text-cyan-300 hover:text-cyan-200">Visa alla</Link>
            </div>
            <div className="mt-4 space-y-3">
              {overview.documents.slice(0, 3).map((doc) => (
                <ListRow
                  key={doc.id}
                  title={doc.title || doc.document_type || 'Dokument'}
                  meta={`Version ${doc.version || '—'} • ${formatDate(doc.created_at)}`}
                  badge={statusLabel(doc.status)}
                />
              ))}
              {unavailable.includes('documents') ? <EmptyText>Dokument kunde inte hämtas just nu.</EmptyText> : overview.documents.length === 0 ? <EmptyText>Inga dokument visas ännu.</EmptyText> : null}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Data och rättigheter</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Du kan begära hjälp med dina personuppgifter. Vissa åtgärder behöver hanteras av kundservice för att vi ska kunna identifiera dig korrekt.
            </p>
            <div className="mt-4 grid gap-3">
              <ActionLink href="/dashboard/privacy" title="Begär datautdrag" text="Få en sammanställning av uppgifter kopplade till din kundprofil." />
              <ActionLink href="/dashboard/profile" title="Begär rättelse" text="Uppdatera uppgifter eller be oss rätta felaktig information." />
              <ActionLink href="/dashboard/privacy" title="Begär radering av personuppgifter" text="Skicka en begäran om radering och följ dess status. Vissa uppgifter måste sparas enligt lag." />
              <ActionLink href="/dashboard/support" title="Frågor om att avsluta avtal" text="Kontakta kundservice om du vill avsluta ett avtal." />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Säkerhet</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Håll dina inloggningsuppgifter privata. Kontakta oss direkt om du misstänker obehörig åtkomst.
            </p>
            <div className="mt-4 grid gap-3">
              <ActionLink href="/dashboard/profile" title="Byt lösenord" text="Uppdatera ditt lösenord från profilsidan." />
              <ActionLink href="/dashboard/support" title="Misstänkt aktivitet" text="Skapa ett ärende så hjälper kundservice dig att kontrollera kontot." />
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                Senaste inloggning visas när uppgiften finns tillgänglig i kundportalen.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs text-white/45">{label}</div>
      <div className="mt-2 break-words text-sm font-medium text-white/90">{value}</div>
    </div>
  )
}

function ListRow({ title, meta, badge }: { title: string; meta: string; badge: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="mt-1 text-xs text-white/50">{meta}</div>
      </div>
      <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
        {badge}
      </span>
    </div>
  )
}

function EmptyText({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/60">
      {children}
    </div>
  )
}

function ActionLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-cyan-500/40 hover:bg-white/5">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs leading-5 text-white/55">{text}</div>
    </Link>
  )
}
