import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import FaqJsonLd from '@/components/seo/FaqJsonLd'

type Area = 'SE1' | 'SE2' | 'SE3' | 'SE4'

function areaTitle(area: Area) {
  return `Elpris ${area}`
}

function areaDescription(area: Area) {
  return `Se elpris idag i ${area}. Datadrivna elavtal med transparent specifikation: spot/portfölj/fastpris, påslag och månadsavgift.`
}

function prevYearMonth(now: Date): { year: number; month: number } {
  const m = now.getMonth() + 1
  if (m === 1) return { year: now.getFullYear() - 1, month: 12 }
  return { year: now.getFullYear(), month: m - 1 }
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('sv-SE').format(n)
}

export default async function ElprisAreaLanding({ area }: { area: Area }) {
  const supabase = await createSupabaseServerClient()
  const { year, month } = prevYearMonth(new Date())

  // Vi visar ett stabilt “senast kända” spot-snittutdrag (föregående månad)
  // och pekar sedan användaren till kalkylatorn för full specifikation.
  const { data: spotRow } = await supabase
    .from('gridex_monthly_spot_prices')
    .select('avg_spot_ore')
    .eq('price_area', area)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  const spotAvgOre = spotRow?.avg_spot_ore != null ? Number(spotRow.avg_spot_ore) : null

  const faqItems = [
    {
      question: `Vad påverkar elpriset i ${area}?`,
      answer:
        'Elpriset påverkas bland annat av efterfrågan, produktion, överföringskapacitet och marknadspriset. Eftersom Sverige är indelat i elområden kan priset skilja sig mellan SE1–SE4.',
    },
    {
      question: `Hur kan jag få ett billigt elavtal i ${area}?`,
      answer:
        'Välj avtalsform utifrån din risknivå och jämför totalen: baspris + påslag + månadsavgift. Gridex visar specifikationen öppet innan du tecknar.',
    },
    {
      question: `Är rörligt elpris bättre än fast i ${area}?`,
      answer:
        'Det beror på marknadsläget och din preferens. Rörligt kan vara konkurrenskraftigt över tid, medan fast ger förutsägbarhet. Gridex visar båda tydligt.',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-10">
      <FaqJsonLd items={faqItems} />

      <div className="space-y-3">
        <h1 className="text-4xl font-bold">{areaTitle(area)} – elpris idag</h1>
        <p className="text-gray-400 max-w-2xl">
          {areaDescription(area)} Gridex kombinerar smart data med full transparens så att du ser hela kostnadsbilden.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-gray-950 p-8">
          <div className="text-white font-semibold">Senaste spot-snitt</div>
          <div className="text-xs text-gray-500 mt-1">
            Föregående månad ({year}-{String(month).padStart(2, '0')})
          </div>
          <div className="text-3xl font-bold mt-4">
            {spotAvgOre == null ? '—' : `${formatNumber(spotAvgOre)} öre`}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Spot-snitt är underlag. Totalpris beror på avtalsform, påslag och månadsavgift.
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gray-950 p-8">
          <div className="text-white font-semibold">Välj avtalsform</div>
          <p className="text-gray-400 mt-2 text-sm">
            Jämför tim/spot, portfölj och fastpris. Se alltid specifikation innan du tecknar.
          </p>
          <Link href="/avtal" className="inline-block mt-5 text-cyan-300 hover:text-cyan-200 text-sm">
            Se våra elavtal →
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gray-950 p-8">
          <div className="text-white font-semibold">Räkna din total</div>
          <p className="text-gray-400 mt-2 text-sm">
            Totalen är baspris + påslag + rörliga avgifter + månadsavgift. Gridex visar allt öppet.
          </p>
          <Link
            href="/#kalkylator"
            className="inline-block mt-5 text-cyan-300 hover:text-cyan-200 text-sm"
          >
            Gå till kalkylatorn →
          </Link>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Så jämför du elpris i {area}</h2>
        <div className="text-gray-400 space-y-3">
          <p>
            När du jämför elavtal i {area} ska du alltid titta på <span className="text-white">totalen</span>.
            Många jämför bara öre/kWh men missar månadsavgift och andra delar.
          </p>
          <p>
            Gridex gör det enkelt: du ser både pris per kWh och hur det är uppbyggt – så att du kan välja billigt
            utan överraskningar.
          </p>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/teckna"
          className="bg-cyan-500 hover:bg-cyan-400 transition text-black font-bold px-6 py-3 rounded-xl text-center"
        >
          Teckna elavtal i {area}
        </Link>
        <a
          href="mailto:support@gridex.se"
          className="border border-white/10 hover:border-cyan-500/40 transition px-6 py-3 rounded-xl text-center text-gray-200"
        >
          Fråga support
        </a>
      </div>
    </div>
  )
}