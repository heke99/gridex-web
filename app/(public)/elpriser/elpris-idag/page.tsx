import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { connection } from 'next/server'
import {
  GENERIC_MARKET_INFORMATION_NOTICE,
  getGenericCurrentMarketInformation,
  getGenericMonthlyMarketInformation,
} from '@/lib/website/marketInformationAdapter'
import type { PriceArea } from '@/lib/gridex/pricing/types'
import { prevYearMonth } from '@/lib/gridex/pricing/validators'
import FaqJsonLd from '@/components/seo/FaqJsonLd'
import JsonLd, { breadcrumbJsonLd, webPageJsonLd } from '@/components/seo/JsonLd'
import Breadcrumbs from '@/components/seo/Breadcrumbs'
import { SITE_OG_IMAGE, SITE_URL } from '@/lib/seo/content'

const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

export const metadata: Metadata = {
  title: 'Elpris idag – aktuellt spotpris i SE1, SE2, SE3 och SE4',
  description:
    'Se elpris idag och föregående månads genomsnittliga spotpris per svenskt elområde. Jämför SE1, SE2, SE3 och SE4 innan du väljer elavtal.',
  alternates: { canonical: `${SITE_URL}/elpriser/elpris-idag` },
  openGraph: {
    images: [SITE_OG_IMAGE],
    title: 'Elpris idag – SE1, SE2, SE3 och SE4',
    description:
      'Aktuellt elpris och föregående månads spotpris per elområde. Se marknadspris innan påslag, avgifter och moms.',
    url: `${SITE_URL}/elpriser/elpris-idag`,
    type: 'website',
    locale: 'sv_SE',
    siteName: 'Gridex El AB',
  },
  robots: { index: true, follow: true },
}

function formatOre(value: number | null | undefined) {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('sv-SE', {
    maximumFractionDigits: 2,
  }).format(value)} öre/kWh`
}

const marketTime = new Intl.DateTimeFormat('sv-SE', { timeStyle: 'short', timeZone: 'Europe/Stockholm' })

const priceCardClass = 'rounded-3xl border border-white/10 bg-gray-950 p-6'

function MarketPriceCard({ area, period, selected, children }: {
  area: PriceArea
  period: 'dagens-pris' | 'manadspris'
  selected: boolean
  children: ReactNode
}) {
  if (selected) return <article className={priceCardClass}>{children}</article>
  const label = period === 'dagens-pris' ? 'Dagens marknadspris' : 'Föregående månads spotpris'
  return (
    <Link href={`/elpriser/elpris-idag?area=${area}#${period}`} aria-label={`${label} för ${area}`}
      className={`${priceCardClass} transition hover:border-cyan-500/40`}>
      {children}
    </Link>
  )
}

async function PreviousMonthPrices({ areas, averages }: {
  areas: readonly PriceArea[]
  averages: Promise<Awaited<ReturnType<typeof getGenericMonthlyMarketInformation>>[]>
}) {
  const previousMonthAverages = await averages
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {areas.map((area, index) => {
        const average = previousMonthAverages[index]
        return (
          <MarketPriceCard key={area} area={area} period="manadspris" selected={areas.length === 1}>
            <div className="text-sm text-gray-400">{area}</div>
            <div className="mt-2 text-3xl font-bold">{formatOre(average?.avgSpotOre)}</div>
            <div className="mt-3 text-xs text-gray-500">
              {average?.samples ? `${average.samples} datapunkter i snittet` : 'Pris kunde inte hämtas'}
            </div>
            {areas.length === 1 && average && (
              <p className="mt-2 text-xs text-gray-400">{average.periodStart}–{average.periodEnd}</p>
            )}
          </MarketPriceCard>
        )
      })}
    </div>
  )
}

export default async function ElprisIdagPage({ searchParams }: {
  searchParams?: Promise<{ area?: string | string[] }>
}) {
  await connection()
  const requestedArea = (await searchParams)?.area
  const selectedArea = AREAS.find(area => area === requestedArea)
  const areas = selectedArea ? [selectedArea] : AREAS
  const period = prevYearMonth(new Date())

  const previousMonthAverages = Promise.all(
    areas.map(priceArea => getGenericMonthlyMarketInformation({ ...period, priceArea }).catch(() => null))
  )
  const summaries = await Promise.all(
    areas.map(area => getGenericCurrentMarketInformation({ area }).catch(() => null))
  )
  const renderTime = new Date().getTime()

  const faqItems = [
    {
      question: 'Är elpris idag samma sak som mitt slutpris?',
      answer:
        'Nej. Elpris idag visar marknadspris/spotpris. Ditt slutpris påverkas också av avtalets påslag, månadsavgift, moms, energiskatt och elnätsavgift.',
    },
    {
      question: 'Varför skiljer sig elpriset mellan SE1 och SE4?',
      answer:
        'Prisskillnader beror på produktion, efterfrågan och överföringskapacitet mellan elområdena.',
    },
    {
      question: 'Hur använder jag dagens elpris när jag väljer elavtal?',
      answer:
        'Använd dagens pris som marknadssignal och jämför sedan totalen för din förbrukning, ditt elområde och den avtalsform du väljer.',
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-16">
      <FaqJsonLd items={faqItems} />
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Start', url: SITE_URL },
            { name: 'Elpriser', url: `${SITE_URL}/elpriser` },
            { name: 'Elpris idag', url: `${SITE_URL}/elpriser/elpris-idag` },
          ]),
          webPageJsonLd({
            name: 'Elpris idag',
            description: metadata.description as string,
            url: `${SITE_URL}/elpriser/elpris-idag`,
          }),
        ]}
      />

      <Breadcrumbs
        items={[
          { label: 'Start', href: '/' },
          { label: 'Elpriser', href: '/elpriser' },
          { label: 'Elpris idag', href: '/elpriser/elpris-idag' },
        ]}
      />

      <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          spotpris • SE1-SE4 • dagspris
        </div>
        <h1 className="mt-4 text-4xl font-bold">
          Elpris idag i SE1, SE2, SE3 och SE4
        </h1>
        <p className="mt-3 max-w-3xl text-gray-400">
          Här visas generell marknadsinformation för elområdena. Informationen används inte som avtals- eller faktureringspris.
          {` ${GENERIC_MARKET_INFORMATION_NOTICE}`}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/#rakna-elpris" className="rounded-xl bg-cyan-500 px-5 py-3 text-center text-sm font-bold text-black transition hover:bg-cyan-400">
            Räkna totalpris
          </Link>
          <Link href="/elavtal/jamfor-elavtal" className="rounded-xl border border-white/10 px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-cyan-500/40">
            Jämför elavtal
          </Link>
        </div>
      </section>

      {selectedArea && (
        <nav aria-label="Elområden" className="flex flex-wrap gap-4 text-sm">
          <span className="text-gray-200">Visar {selectedArea}</span>
          <Link href="/elpriser/elpris-idag" className="text-cyan-300 underline">Visa alla elområden</Link>
          <Link href={`/elpriser/${selectedArea.toLowerCase()}`} className="text-cyan-300 underline">Om elområde {selectedArea}</Link>
        </nav>
      )}

      <section id="dagens-pris" className="scroll-mt-24 space-y-4">
        <h2 className="text-2xl font-bold text-white">Dagens marknadspris{selectedArea ? ` i ${selectedArea}` : ''}</h2>
        <p className="text-sm text-gray-400">
          Dagens pris visas som marknadsinformation. Det är inte samma sak som rörligt månadspris, där föregående månads snittspot ofta används som bas.
        </p>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {areas.map((area, index) => {
            const summary = summaries[index]
            const current = summary?.entries.find(entry =>
              Date.parse(entry.timeStart) <= renderTime && renderTime < Date.parse(entry.timeEnd)
            )
            const min = summary?.stats.minSekPerKwh ?? null
            const max = summary?.stats.maxSekPerKwh ?? null
            return (
              <MarketPriceCard key={area} area={area} period="dagens-pris" selected={areas.length === 1}>
                <div className="text-sm text-gray-400">{area}</div>
                <div className="mt-2 text-3xl font-bold">{formatOre(current ? current.sekPerKwh * 100 : null)}</div>
                {current && (
                  <p className="mt-2 text-xs text-gray-400">
                    {marketTime.format(new Date(current.timeStart))}–{marketTime.format(new Date(current.timeEnd))} svensk tid
                  </p>
                )}
                {!summary && <p className="mt-3 text-xs text-gray-400">Dagens pris kunde inte hämtas.</p>}
                {summary?.stats.samples === 0 && <p className="mt-3 text-xs text-gray-400">Prisdata saknas för dagen.</p>}
                {summary && summary.stats.samples > 0 && summary.stats.averageOrePerKwh === null && (
                  <p className="mt-3 text-xs text-gray-400">Prisdata täcker bara delar av dagen.</p>
                )}
                <div className="mt-3 text-xs text-gray-500">
                  Dagens snitt: {formatOre(summary ? summary.stats.averageOrePerKwh : null)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Lägst/högst:{' '}
                  {min !== null && max !== null
                    ? `${formatOre(min * 100)} / ${formatOre(max * 100)}`
                    : '—'}
                </div>
              </MarketPriceCard>
            )
          })}
        </div>
      </section>

      <section id="manadspris" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Föregående månads spotpris</h2>
            <p className="mt-1 text-sm text-gray-400">
              Snitt för {String(period.month).padStart(2, '0')}/{period.year}, hämtat från vår prisdatakälla.
            </p>
          </div>
          <Link href="/#rakna-elpris" className="rounded-xl bg-cyan-500 px-5 py-3 text-center text-sm font-bold text-black transition hover:bg-cyan-400">
            Räkna totalpris
          </Link>
        </div>

        <Suspense fallback={<p className="text-sm text-gray-400">Hämtar månadens spotpriser…</p>}>
          <PreviousMonthPrices areas={areas} averages={previousMonthAverages} />
        </Suspense>
      </section>

      <p className="text-sm text-gray-400">
        Bor du i Uppsala?{' '}
        <Link href="/elpriser/uppsala" className="text-cyan-300 underline">Se hur spotpriset i SE3 påverkar ditt elavtal</Link>.
      </p>

      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-6">
        <h2 className="text-2xl font-bold text-white">Från elpris till elavtal</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-300">
          Spotpris visas utan moms, skatter, elnätsavgifter och elhandlarens påslag. I Gridex teckningsflöde visas totalen med avtalade avgifter och moms innan teckning.
        </p>
        <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
          <Link href="/elavtal/rorligt-elpris" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-cyan-500/40">Rörligt elpris →</Link>
          <Link href="/elavtal/fast-elpris" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-cyan-500/40">Fast elpris →</Link>
          <Link href="/elavtal/kvartspris-el" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-cyan-500/40">Kvartspris el →</Link>
        </div>
      </section>
    </div>
  )
}
