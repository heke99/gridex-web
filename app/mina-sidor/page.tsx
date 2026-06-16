import Link from 'next/link'
import LogoutForm from '@/components/account/LogoutForm'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCustomerPortalOverview } from '@/lib/customerPortal/service'
import { statusLabel, nextStepDescription } from '@/lib/customerPortal/statusHelper'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

function buildLoginRedirect() {
  const qs = new URLSearchParams()
  qs.set('next', '/mina-sidor')
  return `/login?${qs.toString()}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function displayName(profile: { full_name?: string | null; email?: string | null } | null) {
  return profile?.full_name || profile?.email || 'kund'
}

export default async function MinaSidorPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(buildLoginRedirect())

  const overview = await getCustomerPortalOverview()
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
          <div className="flex flex-col gap-2 sm:flex-row">
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

        {!overview.opsAvailable ? (
          <div className="mt-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-50/90">
            Vi kunde inte hämta alla kunduppgifter just nu. Försök igen om en stund.
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <InfoCard label="Kundnummer" value={profile?.customer_number || profile?.contract_customer_ref || 'Kommer senare'} />
          <InfoCard label="Avtalsstatus" value={statusLabel(latestContract?.status)} />
          <InfoCard label="Anläggning" value={statusLabel(latestSite?.verification_status || latestSite?.resolution_status)} />
          <InfoCard label="Fullmakt" value={activePowerOfAttorney ? statusLabel(activePowerOfAttorney.status) : 'Saknas eller kontrolleras'} />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Mina uppgifter</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoCard label="Namn" value={profile?.full_name || profile?.company_name || '—'} />
              <InfoCard label="E-post" value={profile?.email || user.email || '—'} />
              <InfoCard label="Telefon" value={profile?.phone || '—'} />
              <InfoCard label="Kundtyp" value={profile?.customer_type === 'company' ? 'Företag' : 'Privatkund'} />
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
              Visa mer
            </Link>
          </div>
          {latestContract ? (
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <InfoCard label="Avtal" value={latestContract.contract_name || latestContract.contract_slug || 'Elavtal'} />
              <InfoCard label="Avtalsnummer" value={latestContract.contract_number || latestContract.contract_external_ref || '—'} />
              <InfoCard label="Startdatum" value={formatDate(latestContract.starts_at)} />
              <InfoCard label="Status" value={statusLabel(latestContract.status)} />
            </div>
          ) : (
            <EmptyText>Inget elavtal visas ännu.</EmptyText>
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
              {overview.legalAcceptances.length === 0 ? (
                <EmptyText>Inga godkännanden visas ännu.</EmptyText>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Fullmakt för anläggningsuppgifter</h2>
            {activePowerOfAttorney ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-gray-300">
                <div className="font-semibold text-white">{activePowerOfAttorney.title || 'Fullmakt'}</div>
                <div className="mt-2">Status: {statusLabel(activePowerOfAttorney.status)}</div>
                <div>Godkänd: {formatDate(activePowerOfAttorney.accepted_at)}</div>
                <div>Version: {activePowerOfAttorney.version || '—'}</div>
                <p className="mt-3 text-xs leading-6 text-gray-500">
                  Fullmakten gör att Gridex kan begära och ta emot de uppgifter från
                  elnätsföretaget som behövs för att starta och administrera ditt elavtal.
                </p>
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
                  badge={statusLabel(invoice.status)}
                />
              ))}
              {overview.invoices.length === 0 ? <EmptyText>Inga fakturor visas ännu.</EmptyText> : null}
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
              {overview.documents.length === 0 ? <EmptyText>Inga dokument visas ännu.</EmptyText> : null}
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
              <ActionLink href="/dashboard/support" title="Begär datautdrag" text="Få en sammanställning av uppgifter kopplade till din kundprofil." />
              <ActionLink href="/dashboard/profile" title="Begär rättelse" text="Uppdatera uppgifter eller be oss rätta felaktig information." />
              <ActionLink href="/dashboard/support" title="Begär radering eller avslut" text="Kontakta kundservice om du vill avsluta kundrelation eller begära radering där det är möjligt enligt lag." />
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
