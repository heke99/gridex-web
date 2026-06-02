import type { Metadata } from 'next'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getLivePriceSummary } from '@/lib/gridex/livePrices'

const AREAS = ['SE1', 'SE2', 'SE3', 'SE4'] as const

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Aktuella elpriser idag – SE1, SE2, SE3, SE4',
  description:
    'Se aktuella elpriser idag per svenskt elområde. Priser från Elpriset just nu.se utan moms, skatter och påslag.',
  alternates: { canonical: 'https://gridex.se/aktuella-elpriser' },
}

function formatOre(value: number | null | undefined) {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('sv-SE', {
    maximumFractionDigits: 2,
  }).format(value)} öre/kWh`
}

export default async function AktuellaElpriserPage() {
  const supabase = await createSupabaseServerClient()
  const summaries = await Promise.all(
    AREAS.map((area) =>
      getLivePriceSummary({ supabase, area }).catch(() => null)
    )
  )

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-16">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-4xl font-bold">Aktuella elpriser idag</h1>
        <p className="mt-3 max-w-3xl text-gray-400">
          Här visas aktuellt marknadspris för SE1-SE4. Priserna kommer från
          Elpriset just nu.se och är utan moms, skatter, elnätsavgifter och
          elhandlarens påslag.
        </p>
      </section>

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

      <section className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm leading-relaxed text-amber-100">
        API-priserna används för att visa marknaden idag. Rörliga månadsavtal i
        Gridex offertflöde baseras däremot på föregående månads snittpris plus
        avtalade påslag och avgifter. Endast fastprisavtal har fast kWh-pris.
      </section>
    </div>
  )
}
