import Link from 'next/link'
import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import FaqJsonLd from '@/components/seo/FaqJsonLd'
import { fetchLivePublishedContracts } from '@/lib/gridex/pricing/db'

export const metadata: Metadata = {
  title: 'Elavtal – jämför spot, portfölj och fastpris',
  description:
    'Jämför våra elavtal: tim/spot, portfölj och fastpris. Alla priser är områdesbaserade (SE1–SE4) och publiceras via versioner.',
  alternates: { canonical: 'https://gridex.se/avtal' },
}

export default async function AvtalPage() {
  const supabase = await createSupabaseServerClient()
  const nowIso = new Date().toISOString()

  const visibleContracts = await fetchLivePublishedContracts(supabase, nowIso)

  const faqItems = [
    {
      question: 'Vilket elavtal är billigast?',
      answer:
        'Det beror på marknadsläget och din risknivå. Gridex visar totalen öppet så att du kan jämföra korrekt.',
    },
    {
      question: 'Vad är skillnaden mellan spot och fast elpris?',
      answer:
        'Spot följer marknadspriset medan fast ger förutsägbarhet. Båda visas med full specifikation hos Gridex.',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-12">
      <FaqJsonLd items={faqItems} />

      <div>
        <h1 className="text-4xl font-bold">Elavtal</h1>
        <p className="text-gray-400 mt-3 max-w-2xl">
          Alla elavtal är områdesbaserade (SE1–SE4) och publiceras via versioner.
          Du ser alltid baspris, påslag och månadsavgift innan du tecknar.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {visibleContracts.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-white/10 bg-gray-950 p-8 flex flex-col justify-between"
          >
            <div>
              <div className="text-white font-semibold text-lg">{c.name}</div>

              <div className="text-xs text-gray-500 mt-1">{c.contract_type}</div>

              <p className="text-gray-400 mt-3 text-sm">
                LIVE-priser per elområde (SE1–SE4). Full specifikation visas innan teckning.
              </p>
            </div>

            <Link
              href="/teckna"
              className="mt-6 bg-cyan-500 hover:bg-cyan-400 transition text-black font-bold px-5 py-3 rounded-xl text-center"
            >
              Teckna
            </Link>
          </div>
        ))}

        {visibleContracts.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-gray-950 p-8 md:col-span-3">
            <div className="text-white font-semibold text-lg">Inga LIVE-avtal ännu</div>
            <p className="text-gray-400 mt-2 text-sm">
              När en prisversion publiceras och dess <span className="text-gray-200">valid_from</span> är idag eller tidigare,
              kommer avtalet automatiskt att visas här.
            </p>
            <Link
              href="/kundservice"
              className="inline-flex mt-5 border border-white/10 hover:border-cyan-500/40 transition px-5 py-3 rounded-xl text-gray-200 text-sm"
            >
              Kontakta oss
            </Link>
          </div>
        )}
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Så väljer du rätt elavtal</h2>
        <p className="text-gray-400">
          När du jämför elavtal ska du alltid se till helheten. Många jämför endast öre/kWh,
          men missar månadsavgift och påslag. Gridex visar hela strukturen.
        </p>
      </section>

      <div className="flex gap-3">
        <Link
          href="/teckna"
          className="bg-cyan-500 hover:bg-cyan-400 transition text-black font-bold px-6 py-3 rounded-xl"
        >
          Teckna elavtal
        </Link>
        <Link
          href="/kundservice"
          className="border border-white/10 hover:border-cyan-500/40 transition px-6 py-3 rounded-xl text-gray-200"
        >
          Kontakta oss
        </Link>
      </div>
    </div>
  )
}