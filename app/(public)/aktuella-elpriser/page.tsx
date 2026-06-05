import type { Metadata } from 'next'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getLivePriceSummary } from '@/lib/gridex/livePrices'
import { fetchMonthlySpotAverageFromElprisetJustNu } from '@/lib/gridex/pricing/elprisetjustnu'
import type { PriceArea } from '@/lib/gridex/pricing/types'

const AREAS: PriceArea[] = ['SE1', 'SE2', 'SE3', 'SE4']

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Elpris idag och föregående månads spotpris – SE1, SE2, SE3, SE4',
  description:
    'Se dagens elpris och föregående månads genomsnittliga spotpris per svenskt elområde. Priser hämtas från elprisetjustnu API.',
  alternates: { canonical: 'https://gridex.se/aktuella-elpriser' },
}

function formatOre(value: number | null | undefined) {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('sv-SE', {
    maximumFractionDigits: 2,
  }).format(value)} öre/kWh`
}

function previousMonth(now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

export default async function AktuellaElpriserPage() {
  const supabase = await createSupabaseServerClient()
  const period = previousMonth()

  const [summaries, previousMonthAverages] = await Promise.all([
    Promise.all(
      AREAS.map((area) =>
        getLivePriceSummary({ supabase, area }).catch(() => null)
      )
    ),
    Promise.all(
      AREAS.map((area) =>
        fetchMonthlySpotAverageFromElprisetJustNu({
          year: period.year,
          month: period.month,
          priceArea: area,
        }).catch(() => null)
      )
    ),
  ])

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-16">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          elprisetjustnu API • spotpris • SE1-SE4
        </div>
        <h1 className="mt-4 text-4xl font-bold">
          Elpris idag och föregående månads spotpris
        </h1>
        <p className="mt-3 max-w-3xl text-gray-400">
          Här visas aktuellt marknadspris samt föregående månads genomsnittliga
          spotpris per elområde. Gridex använder föregående månads snittspot som
          prisbas i rörliga månadsavtal, innan avtalade påslag, avgifter och moms
          läggs till.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Föregående månads spotpris
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Snitt för {String(period.month).padStart(2, '0')}/{period.year},
              hämtat från elprisetjustnu API.
            </p>
          </div>
          <Link
            href="/#rakna-elpris"
            className="rounded-xl bg-cyan-500 px-5 py-3 text-center text-sm font-bold text-black transition hover:bg-cyan-400"
          >
            Räkna med detta pris
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {AREAS.map((area, index) => {
            const average = previousMonthAverages[index]

            return (
              <Link
                key={area}
                href={`/elpris-${area.toLowerCase()}`}
                className="rounded-3xl border border-white/10 bg-gray-950 p-6 transition hover:border-cyan-500/40"
              >
                <div className="text-sm text-gray-400">{area}</div>
                <div className="mt-2 text-3xl font-bold">
                  {formatOre(average?.avgSpotOre)}
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  {average?.samples
                    ? `${average.samples} datapunkter i snittet`
                    : 'Pris kunde inte hämtas'}
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Dagens marknadspris</h2>
        <p className="text-sm text-gray-400">
          Dagens pris visas som marknadsinformation. Det är inte samma sak som
          rörligt månadspris, där föregående månads snittspot används som bas.
        </p>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {AREAS.map((area, index) => {
            const summary = summaries[index]
            const current = summary?.current

            return (
              <Link
                key={area}
                href={`/elpris-${area.toLowerCase()}`}
                className="rounded-3xl border border-white/10 bg-gray-950 p-6 transition hover:border-cyan-500/40"
              >
                <div className="text-sm text-gray-400">{area}</div>
                <div className="mt-2 text-3xl font-bold">
                  {formatOre(current ? current.sekPerKwh * 100 : null)}
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Dagens snitt:{' '}
                  {formatOre(summary ? summary.stats.averageOrePerKwh : null)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Lägst/högst:{' '}
                  {summary
                    ? `${formatOre(summary.stats.minSekPerKwh * 100)} / ${formatOre(
                        summary.stats.maxSekPerKwh * 100
                      )}`
                    : '—'}
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm leading-relaxed text-amber-100">
        API-priserna kommer från elprisetjustnu.se. Spotpris visas utan moms,
        skatter, elnätsavgifter och elhandlarens påslag. I Gridex offertflöde
        visas totalen med avtalade avgifter och moms innan teckning.
      </section>
    </div>
  )
}
