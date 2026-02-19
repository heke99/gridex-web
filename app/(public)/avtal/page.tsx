import Link from 'next/link'
import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import FaqJsonLd from '@/components/seo/FaqJsonLd'

export const metadata: Metadata = {
  title: 'Elavtal – jämför spot, portfölj och fastpris',
  description:
    'Jämför våra elavtal: tim/spot, portfölj och fastpris. Alla priser är områdesbaserade (SE1–SE4) och publiceras via versioner.',
  alternates: { canonical: 'https://gridex.se/avtal' },
}

type ContractRow = {
  id: string
  name: string
  slug: string
  contract_type: 'spot_hourly' | 'portfolio_managed' | 'fixed'
}

export default async function AvtalPage() {
  const supabase = await createSupabaseServerClient()
  const nowIso = new Date().toISOString()

  const { data: contracts } = await supabase
    .from('contract_products')
    .select('id,name,slug,contract_type')
    .eq('is_active', true)

  const contractIds = (contracts ?? []).map((c) => c.id)

  const { data: published } = await supabase
    .from('contract_pricing_versions')
    .select('contract_id')
    .in('contract_id', contractIds.length ? contractIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('status', 'published')
    .lte('valid_from', nowIso)

  const publishedIds = new Set((published ?? []).map((r) => r.contract_id as string))

  const visibleContracts = (contracts ?? []).filter((c) =>
    publishedIds.has(c.id)
  ) as ContractRow[]

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
              <div className="text-white font-semibold text-lg">
                {c.name}
              </div>

              <div className="text-xs text-gray-500 mt-1">
                {c.contract_type}
              </div>

              <p className="text-gray-400 mt-3 text-sm">
                Publicerad prisversion per elområde. Full specifikation visas innan teckning.
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