import Link from 'next/link'
import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ElectricityCalculator from '@/components/ElectricityCalculator'
import FaqJsonLd from '@/components/seo/FaqJsonLd'

export const metadata: Metadata = {
  title: 'Elpris idag – Billiga & datadrivna elavtal',
  description:
    'Jämför elpris idag per elområde (SE1–SE4). Datadrivna elavtal med full transparens: spot/portfölj/fastpris, påslag och månadsavgift.',
  alternates: {
    canonical: 'https://gridex.se',
  },
}

type ContractOption = {
  name: string
  slug: string
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient()
  const nowIso = new Date().toISOString()

  // 1) Hämta aktiva kontrakt
  const { data: contracts, error: cErr } = await supabase
    .from('contract_products')
    .select('id,name,slug,is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (cErr) {
    // Fail-safe: visa sidan utan kalkylator-kontrakt om DB felar
    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold">Elpris idag</h1>
        <p className="text-gray-400 mt-3">
          Vi upplever just nu ett tekniskt fel. För support: support@gridex.se
        </p>
      </div>
    )
  }

  const contractIds = (contracts ?? []).map((c) => c.id)

  // 2) Hämta vilka kontrakt som har publicerad prisversion giltig nu
  // Enterprise: endast “published” med valid_from <= nu
  const { data: publishedRows, error: pErr } = await supabase
    .from('contract_pricing_versions')
    .select('contract_id')
    .in('contract_id', contractIds.length ? contractIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('status', 'published')
    .lte('valid_from', nowIso)

  if (pErr) {
    // Om versions-tabellen inte är redo än, visa ändå kontrakten (men kalkylatorn kan svara med “ingen publicerad version”)
    const options: ContractOption[] = (contracts ?? []).map((c) => ({
      name: c.name,
      slug: c.slug,
    }))

    return (
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-16">
        <HeroBlock />
        <ElectricityCalculator contracts={options} />
        <HomeSeoBlocks />
      </div>
    )
  }

  const publishedContractIds = new Set((publishedRows ?? []).map((r) => r.contract_id as string))

  const options: ContractOption[] = (contracts ?? [])
    .filter((c) => publishedContractIds.has(c.id))
    .map((c) => ({
      name: c.name,
      slug: c.slug,
    }))

  const faqItems = [
    {
      question: 'Vad är elpris idag?',
      answer:
        'Elpris idag beror på ditt elområde (SE1–SE4) och vilken avtalsform du har. Gridex visar pris och specifikation öppet innan du tecknar.',
    },
    {
      question: 'Är rörligt elpris billigast?',
      answer:
        'Rörligt elpris har ofta varit konkurrenskraftigt över tid, men det varierar med marknadsläget. Med Gridex ser du alltid vad som ingår: baspris, påslag och månadsavgift.',
    },
    {
      question: 'Hur tecknar jag elavtal hos Gridex?',
      answer:
        'Du kan teckna online via Gridex. Börja med att räkna på ditt elpris och gå sedan vidare till teckningsflödet.',
    },
    {
      question: 'Vad är skillnaden mellan elområden (SE1–SE4)?',
      answer:
        'Sverige är indelat i fyra elområden. Prisskillnader uppstår bland annat på grund av produktion, efterfrågan och överföringskapacitet.',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-16">
      <FaqJsonLd items={faqItems} />

      <HeroBlock />

      {/* Kalkylator – kopplad */}
      <ElectricityCalculator contracts={options} />

      <HomeSeoBlocks />
    </div>
  )
}

function HeroBlock() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-10 md:p-14">
      <div className="absolute -top-48 -right-48 w-[520px] h-[520px] bg-cyan-500/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 text-xs text-cyan-300 border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 rounded-full">
            Datadrivet elpris • SE1–SE4 • Transparens på riktigt
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Elpris idag.
            <br />
            Billigt – och förklarat.
          </h1>

          <p className="text-gray-400 max-w-xl">
            Gridex kombinerar smart data med tydlig specifikation.
            Du ser spot/portfölj/fastpris, påslag och månadsavgift innan du tecknar.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/teckna"
              className="bg-cyan-500 hover:bg-cyan-400 transition text-black font-bold px-6 py-3 rounded-xl text-center shadow-[0_0_40px_rgba(34,211,238,0.35)]"
            >
              Teckna elavtal
            </Link>
            <Link
              href="/avtal"
              className="border border-white/10 hover:border-cyan-500/40 transition px-6 py-3 rounded-xl text-center text-gray-200"
            >
              Se våra elavtal
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-xs text-gray-400">
            <div className="border border-white/10 rounded-xl p-3">
              <div className="text-white font-semibold">SE1–SE4</div>
              <div>Områdesbaserat</div>
            </div>
            <div className="border border-white/10 rounded-xl p-3">
              <div className="text-white font-semibold">Data</div>
              <div>Prislogik & specifikation</div>
            </div>
            <div className="border border-white/10 rounded-xl p-3">
              <div className="text-white font-semibold">Transparens</div>
              <div>Inget “dolt”</div>
            </div>
            <div className="border border-white/10 rounded-xl p-3">
              <div className="text-white font-semibold">Support</div>
              <div>support@gridex.se</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400">Snabb överblick</div>
              <div className="text-xl font-semibold">Pris + specifikation</div>
            </div>
            <div className="text-xs text-gray-400">
              <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2" />
              Live
            </div>
          </div>

          <div className="text-gray-400 text-sm">
            Räkna priset nedan och se exakt vad som ingår.
          </div>

          <Link
            href="/teckna"
            className="block w-full bg-white text-black font-bold py-3 rounded-xl text-center"
          >
            Teckna nu
          </Link>

          <div className="text-xs text-gray-500">
            *Visar alltid full specifikation innan teckning.
          </div>
        </div>
      </div>
    </section>
  )
}

function HomeSeoBlocks() {
  return (
    <>
      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-gray-950 p-8">
          <div className="text-white font-semibold text-lg">Olika elavtal</div>
          <p className="text-gray-400 mt-2 text-sm">
            Tim/spot, portfölj och fastpris – per elområde. Du ser exakt specifikation innan du väljer.
          </p>
          <Link href="/avtal" className="inline-block mt-5 text-cyan-300 hover:text-cyan-200 text-sm">
            Läs mer →
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gray-950 p-8">
          <div className="text-white font-semibold text-lg">Datadrivet elpris</div>
          <p className="text-gray-400 mt-2 text-sm">
            Gridex bygger på områdesbaserad prismotor (SE1–SE4) med publicerade prisversioner.
          </p>
          <Link href="/elpris-se3" className="inline-block mt-5 text-cyan-300 hover:text-cyan-200 text-sm">
            Se elpris per område →
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gray-950 p-8">
          <div className="text-white font-semibold text-lg">Kundservice</div>
          <p className="text-gray-400 mt-2 text-sm">
            Skicka in ärende via formulär eller maila direkt.
          </p>
          <Link href="/kundservice" className="inline-block mt-5 text-cyan-300 hover:text-cyan-200 text-sm">
            Kontakta oss →
          </Link>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold">Elpris per elområde (SE1–SE4)</h2>
        <p className="text-gray-400">
          Elpriset varierar mellan Sveriges elområden. Gridex visar elpris och avtalsalternativ på ett sätt som är enkelt att förstå,
          utan att dölja påslag eller avgifter.
        </p>

        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <Link href="/elpris-se1" className="border border-white/10 p-4 rounded-xl hover:border-cyan-500/40 transition">
            Elpris SE1
          </Link>
          <Link href="/elpris-se2" className="border border-white/10 p-4 rounded-xl hover:border-cyan-500/40 transition">
            Elpris SE2
          </Link>
          <Link href="/elpris-se3" className="border border-white/10 p-4 rounded-xl hover:border-cyan-500/40 transition">
            Elpris SE3
          </Link>
          <Link href="/elpris-se4" className="border border-white/10 p-4 rounded-xl hover:border-cyan-500/40 transition">
            Elpris SE4
          </Link>
        </div>
      </section>
    </>
  )
}