import Link from 'next/link'
import type { Metadata } from 'next'
import FaqJsonLd from '@/components/seo/FaqJsonLd'
import {
  fetchOpsPublicContracts,
  getOpsClientStatus,
  type OpsPublicContract,
} from '@/lib/ops/client'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'

export const metadata: Metadata = {
  title: 'Elavtal – jämför rörligt, portfölj och fastpris',
  description:
    'Jämför Gridex elavtal: rörligt elpris, portföljavtal och fastpris. Se aktuella priser och villkor innan du går vidare.',
  alternates: { canonical: 'https://gridex.se/elavtal' },
}

function ContractCard({ contract }: { contract: OpsPublicContract }) {
  const display = buildPublicContractDisplay(contract)

  return (
    <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#0B0F17] p-8 transition hover:border-cyan-500/30">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-white">{display.headline}</div>

              {contract.badge_text ? (
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">
                  {contract.badge_text}
                </span>
              ) : null}
            </div>

            <div className="mt-1 text-sm text-gray-400">{display.typeLabel}</div>
          </div>

          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">
            Valbart
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
          {display.description}
        </div>

        <div className="mt-5 grid gap-2 text-sm text-gray-300">
          {display.rows.map((row) => (
            <div key={row.key} className="flex justify-between gap-4">
              <span className="text-gray-500">{row.label}</span>
              <span>{row.formatted}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-gray-400">
          <div>Allmänna villkor: version {display.legalVersions.terms}</div>
          <div>Integritetspolicy: version {display.legalVersions.privacyPolicy}</div>
          <div>Ångerrätt: version {display.legalVersions.cancellationRight}</div>
          <div>Fullmakt: version {display.legalVersions.powerOfAttorney}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <Link
          href={display.ctaHref}
          className="rounded-xl bg-cyan-500 px-5 py-3 text-center font-bold text-black transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
        >
          Ansök om avtal
        </Link>

        <Link
          href="/kundservice"
          className="rounded-xl border border-white/10 px-5 py-3 text-center text-sm text-gray-200 transition hover:border-cyan-500/40 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
        >
          Frågor om avtalet?
        </Link>
      </div>
    </div>
  )
}

export default async function AvtalPage() {
  const status = getOpsClientStatus()
  let contracts: OpsPublicContract[] = []
  let loadError: string | null = null

  if (status.configured) {
    try {
      contracts = await fetchOpsPublicContracts()
    } catch (error) {
      loadError =
        error instanceof Error
          ? error.message
          : 'Kunde inte hämta aktuella elavtal.'
    }
  } else {
    loadError = 'Aktuella elavtal kan inte hämtas just nu.'
  }

  const faqItems = [
    {
      question: 'Vilket elavtal är billigast?',
      answer:
        'Det beror på marknadsläget, din förbrukning och vilken risknivå du är bekväm med. Gridex visar aktuella elavtal så att du kan jämföra innan du går vidare.',
    },
    {
      question: 'Vad är skillnaden mellan rörligt och fast elpris?',
      answer:
        'Rörligt elpris följer marknadspriset och kan variera över tid. Fastpris ger mer förutsägbarhet. Portföljavtal ligger mellan dessa med en mer aktiv prissättning.',
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 py-12 md:py-16">
      <FaqJsonLd items={faqItems} />

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-[120px]" />

        <div className="relative grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
              Jämför elavtal • Tydliga villkor • Aktuella priser
            </div>

            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                Hitta rätt elavtal
                <br />
                för ditt hushåll
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">
                Jämför rörligt, portfölj och fastpris på ett sätt som är lätt att
                förstå. Här ser du våra aktuella elavtal och villkor innan du
                går vidare med din ansökan.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/teckna-avtal"
                className="rounded-xl bg-cyan-500 px-6 py-3 text-center font-bold text-black transition hover:bg-cyan-400"
              >
                Ansök om elavtal
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
              <div className="text-sm font-semibold text-white">Aktuella villkor</div>
              <p className="mt-1 text-sm text-gray-400">
                Här ser du våra aktuella elavtal, priser och villkor.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">Flera avtalsformer</div>
              <p className="mt-1 text-sm text-gray-400">
                Välj det upplägg som passar din vardag, din förbrukning och din risknivå.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">Enkel teckning</div>
              <p className="mt-1 text-sm text-gray-400">
                När du hittat rätt avtal går du vidare till ansökningsflödet.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-gray-950 p-5">
          <div className="text-sm font-semibold text-white">Rörligt elpris</div>
          <p className="mt-2 text-sm text-gray-400">
            För dig som vill följa marknadspriset och ha ett avtal som rör sig med elmarknaden.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gray-950 p-5">
          <div className="text-sm font-semibold text-white">Portföljavtal</div>
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

      <section className="space-y-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-white">Våra elavtal</h2>
          <p className="mt-3 text-gray-400">
            Alla valbara avtal nedan visar aktuella priser och villkor.
          </p>
        </div>

        {loadError ? (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8">
            <div className="text-lg font-semibold text-amber-100">
              Avtalen kan inte laddas just nu
            </div>
            <p className="mt-2 max-w-2xl text-sm text-amber-50/80">
              {loadError} Teckning är därför tillfälligt pausad.
            </p>
          </div>
        ) : null}

        {!loadError && contracts.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8">
            <div className="text-lg font-semibold text-white">
              Inga elavtal finns att visa just nu
            </div>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              När nya avtal finns tillgängliga visas de här.
            </p>
          </div>
        ) : null}

        {contracts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-3">
            {contracts.map((contract) => (
              <ContractCard key={contract.price_plan_version_id} contract={contract} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-gray-950 p-6 md:p-8">
        <h2 className="text-2xl font-bold text-white">Vanliga frågor</h2>
        <div className="mt-6 space-y-4">
          {faqItems.map((item) => (
            <details key={item.question} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-6 text-gray-300">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
