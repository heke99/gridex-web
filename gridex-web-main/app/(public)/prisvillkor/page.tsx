import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Prisinformation – Gridex elavtal',
  description: 'Prisinformation för Gridex elavtal, inklusive elpris, påslag, månadsavgift, fakturaavgift och vad som inte ingår.',
  alternates: { canonical: 'https://gridex.se/prisvillkor' },
}

const UPDATED_AT = '2026-06-15'

export default function PrisvillkorPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 md:py-18">
      <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Prisinformation • Version 1.0 • Gäller från {UPDATED_AT}
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">Prisinformation</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 md:text-base">
          Här förklarar vi vad som kan ingå i Gridex elhandelspris och vad som normalt faktureras separat av elnätsföretaget.
        </p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Info title="Rörligt elpris" text="Rörligt pris följer marknaden och kan variera över tid. Påslag, månadsavgift och fakturaavgift visas innan du tecknar." />
        <Info title="Fastpris" text="Fastpris ger ett mer förutsägbart elhandelspris under avtalad period. Bindningstid och uppsägningstid ska framgå av avtalet." />
        <Info title="Förvaltat avtal" text="Ett förvaltat avtal kan kombinera marknadspris med en aktivt förvaltad prisdel. Fördelning och villkor visas i avtalsinformationen." />
        <Info title="Mixavtal" text="Om ett mixavtal erbjuds visas andel rörligt och förvaltat i procent. Summan ska alltid vara 100 procent." />
      </div>

      <section className="mt-6 rounded-3xl border border-white/10 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold text-white">Detta kan ingå</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-gray-300">
          <li>Elhandelspris eller spotpris enligt valt avtal.</li>
          <li>Påslag i öre/kWh.</li>
          <li>Månadsavgift.</li>
          <li>Fakturaavgift, om sådan används.</li>
          <li>Moms och andra avgifter när de framgår av prisinformationen.</li>
        </ul>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold text-white">Detta ingår normalt inte</h2>
        <p className="mt-4 text-sm leading-7 text-gray-300">
          Elnätsavgift och kostnader som hör till nätabonnemanget faktureras normalt av ditt elnätsföretag och ingår inte i Gridex elhandelspris.
        </p>
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-gray-300">
        <h2 className="text-lg font-semibold text-white">Kontakt</h2>
        <p className="mt-3">Gridex AB, org.nr 559416-7149.</p>
        <p>E-post: <a href="mailto:support@gridex.se" className="text-cyan-300 underline underline-offset-4">support@gridex.se</a></p>
        <p className="mt-3">Se även <Link href="/elavtal" className="text-cyan-300 underline underline-offset-4">aktuella elavtal</Link> och <Link href="/allmanna-villkor" className="text-cyan-300 underline underline-offset-4">allmänna villkor</Link>.</p>
      </section>
    </div>
  )
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gray-950 p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-gray-300">{text}</p>
    </div>
  )
}
