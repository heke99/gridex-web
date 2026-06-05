import Link from 'next/link'
import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import FaqJsonLd from '@/components/seo/FaqJsonLd'
import {
  fetchLivePublishedContracts,
  type LivePublishedContract,
} from '@/lib/gridex/pricing/db'

export const metadata: Metadata = {
  title: 'Elavtal – jämför spot, portfölj och fastpris',
  description:
    'Jämför våra elavtal: tim/spot, portfölj och fastpris. Tydliga villkor, områdesbaserade priser (SE1–SE4) och full transparens innan du tecknar.',
  alternates: { canonical: 'https://gridex.se/avtal' },
}

function formatDate(dateIso: string) {
  try {
    const d = new Date(dateIso)
    return d.toLocaleDateString('sv-SE')
  } catch {
    return dateIso
  }
}

function contractTypeLabel(type: string) {
  switch (type) {
    case 'spot_hourly':
      return 'Tim / Spot'
    case 'portfolio_managed':
      return 'Portföljförvaltat'
    case 'fixed':
      return 'Fastpris'
    default:
      return type
  }
}

function getContractDescription(item: LivePublishedContract) {
  if (item.contract.short_description?.trim()) {
    return item.contract.short_description
  }

  switch (item.contract.contract_type) {
    case 'spot_hourly':
      return 'Föregående månads spotpris per elområde (SE1–SE4). Full specifikation visas innan teckning.'
    case 'portfolio_managed':
      return 'För dig som vill ha en mer aktiv prissättning med fokus på balans mellan risk och stabilitet.'
    case 'fixed':
      return 'För dig som vill ha mer förutsägbarhet och enklare planering av elkostnaden.'
    default:
      return 'Föregående månads spotpris per elområde (SE1–SE4). Full specifikation visas innan teckning.'
  }
}

function ContractCard({ item }: { item: LivePublishedContract }) {
  const { contract, pricingVersion } = item

  return (
    <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#0B0F17] p-8 transition hover:border-cyan-500/30">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-white">{contract.name}</div>

              {contract.badge_text ? (
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">
                  {contract.badge_text}
                </span>
              ) : null}
            </div>

            <div className="mt-1 text-sm text-gray-400">
              {contractTypeLabel(contract.contract_type)}
            </div>
          </div>

          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">
            Publicerat
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
          {getContractDescription(item)}
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Version {pricingVersion.version_number ?? '—'} • Giltig från{' '}
          {formatDate(pricingVersion.valid_from)}
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <Link
          href={`/teckna?contract=${contract.slug ?? contract.id}`}
          className="rounded-xl bg-cyan-500 px-5 py-3 text-center font-bold text-black transition hover:bg-cyan-400"
        >
          Teckna avtal
        </Link>

        <Link
          href="/kundservice"
          className="rounded-xl border border-white/10 px-5 py-3 text-center text-sm text-gray-200 transition hover:border-cyan-500/40 hover:bg-white/5"
        >
          Frågor om avtalet?
        </Link>
      </div>
    </div>
  )
}

export default async function AvtalPage() {
  const supabase = await createSupabaseServerClient()

  const nowIso = new Date().toISOString()
  const todayIsoDate = nowIso.slice(0, 10)

  const visibleContracts: LivePublishedContract[] =
    await fetchLivePublishedContracts(supabase, todayIsoDate)

  const faqItems = [
    {
      question: 'Vilket elavtal är billigast?',
      answer:
        'Det beror på marknadsläget, din förbrukning och vilken risknivå du är bekväm med. Gridex visar helheten så att du kan jämföra rättvist.',
    },
    {
      question: 'Vad är skillnaden mellan spot och fast elpris?',
      answer:
        'Spot följer marknadspriset och kan variera över tid, medan fastpris ger mer förutsägbarhet. Hos Gridex ser du tydligt vad som ingår innan du väljer.',
    },
  ]

  const hasLiveContracts = visibleContracts.length > 0

  const featuredContracts = visibleContracts.filter(
    (item) => item.contract.is_featured === true
  )
  const regularContracts = visibleContracts.filter(
    (item) => item.contract.is_featured !== true
  )

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 py-12 md:py-16">
      <FaqJsonLd items={faqItems} />

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-[120px]" />

        <div className="relative grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
              Jämför elavtal • Tydliga villkor • SE1–SE4
            </div>

            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                Hitta rätt elavtal
                <br />
                för ditt hushåll
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">
                Jämför spot, portfölj och fastpris på ett sätt som är lätt att
                förstå. Hos Gridex ser du alltid hur priset är uppbyggt innan du
                går vidare till teckning.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/teckna"
                className="rounded-xl bg-cyan-500 px-6 py-3 text-center font-bold text-black transition hover:bg-cyan-400"
              >
                Teckna elavtal
              </Link>
              <Link
                href="/kundservice"
                className="rounded-xl border border-white/10 px-6 py-3 text-center text-gray-200 transition hover:border-cyan-500/40 hover:bg-white/5"
              >
                Få hjälp att välja
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                Tydlig prisbild
              </div>
              <p className="mt-1 text-sm text-gray-400">
                Se baspris, avgifter och eventuella påslag öppet innan du väljer.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                Flera avtalsformer
              </div>
              <p className="mt-1 text-sm text-gray-400">
                Välj det upplägg som passar din vardag, din förbrukning och din
                risknivå.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                Enkel väg till teckning
              </div>
              <p className="mt-1 text-sm text-gray-400">
                När du hittat rätt avtal går du vidare direkt till teckningsflödet.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-gray-950 p-5">
          <div className="text-sm font-semibold text-white">Spot / timpris</div>
          <p className="mt-2 text-sm text-gray-400">
            För dig som vill följa marknadspriset och ha ett avtal som rör sig med elmarknaden.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gray-950 p-5">
          <div className="text-sm font-semibold text-white">Portföljförvaltat</div>
          <p className="mt-2 text-sm text-gray-400">
            För dig som vill ha en mer aktiv prissättning med fokus på balans mellan risk och stabilitet.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gray-950 p-5">
          <div className="text-sm font-semibold text-white">Fastpris</div>
          <p className="mt-2 text-sm text-gray-400">
            För dig som vill ha mer förutsägbarhet och enklare planering av elkostnaden.
          </p>
        </div>
      </section>

      {featuredContracts.length > 0 && (
        <section className="space-y-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-white">Utvalda elavtal</h2>
            <p className="mt-3 text-gray-400">
              Avtal markerade som utvalda i admin visas här först.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {featuredContracts.map((item) => (
              <ContractCard key={item.contract.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-white">Våra elavtal</h2>
          <p className="mt-3 text-gray-400">
            Alla publicerade avtal nedan är tillgängliga för teckning.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {regularContracts.map((item) => (
            <ContractCard key={item.contract.id} item={item} />
          ))}

          {!hasLiveContracts && (
            <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:col-span-3">
              <div className="text-lg font-semibold text-white">
                Inga publicerade avtal ännu
              </div>
              <p className="mt-2 max-w-2xl text-sm text-gray-400">
                När en prisversion publiceras och dess <span className="text-gray-200">valid_from</span>{' '}
                är idag eller tidigare, kommer avtalet automatiskt att visas här.
              </p>

              <div className="mt-4 text-xs text-gray-600">
                Diagnostik: nowIso={nowIso} • today={todayIsoDate}
              </div>

              <Link
                href="/kundservice"
                className="mt-5 inline-flex rounded-xl border border-white/10 px-5 py-3 text-sm text-gray-200 transition hover:border-cyan-500/40"
              >
                Kontakta oss
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-gray-950 p-8">
          <h2 className="text-2xl font-bold text-white">
            Så väljer du rätt elavtal
          </h2>
          <p className="mt-3 text-gray-400">
            När du jämför elavtal ska du alltid se till helheten. Många tittar
            bara på öre per kWh, men missar månadsavgift och påslag. Därför visar
            Gridex hela strukturen tydligt.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8">
          <h2 className="text-2xl font-bold text-white">
            Behöver du hjälp att välja?
          </h2>
          <p className="mt-3 text-gray-400">
            Vi hjälper dig gärna att förstå skillnaden mellan avtalsformerna och
            hitta det upplägg som passar dig bäst.
          </p>

          <div className="mt-6 flex gap-3">
            <Link
              href="/teckna"
              className="rounded-xl bg-cyan-500 px-6 py-3 font-bold text-black transition hover:bg-cyan-400"
            >
              Teckna elavtal
            </Link>
            <Link
              href="/kundservice"
              className="rounded-xl border border-white/10 px-6 py-3 text-gray-200 transition hover:border-cyan-500/40"
            >
              Kontakta oss
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}