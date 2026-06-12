import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Prisvillkor – Gridex elavtal',
  description:
    'Förklaring av pris, påslag, månadsavgift, fakturaavgift och prisversioner för Gridex elavtal.',
  alternates: { canonical: 'https://gridex.se/prisvillkor' },
}

export default function PrisvillkorPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 md:py-18">
      <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Prisinformation • Version 1.0
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Prisvillkor
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 md:text-base">
          Här förklarar vi hur Gridex visar och sparar prisinformation när du väljer
          och tecknar elavtal.
        </p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Info title="Rörligt elpris" text="Rörligt elpris följer marknadspriset. Påslag, månadsavgift och fakturaavgift visas innan du skickar ansökan." />
        <Info title="Fast elpris" text="Fastpris ger mer förutsägbarhet under avtalad period. Pris, bindningstid och uppsägningstid ska framgå innan ansökan skickas." />
        <Info title="Portföljavtal" text="Portföljavtal kan bygga på en blandning av marknadspris och förvaltad prisdel. Villkor och priskomponenter visas i sammanfattningen." />
        <Info title="Mixavtal" text="Om Gridex erbjuder mixavtal visas andelen rörligt och portfölj i procent. Totalen ska alltid vara 100 procent." />
      </div>

      <section className="mt-6 rounded-3xl border border-white/10 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold text-white">Vad sparas när du tecknar?</h2>
        <p className="mt-4 text-sm leading-7 text-gray-300">
          När du skickar ansökan sparas valt avtal, prisversion, avgifter, påslag,
          startval och de juridiska versioner du godkänt. Det gör att Gridex kan visa
          vilken prisinformation som gällde när ansökan skickades.
        </p>
      </section>

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-gray-300">
        Se även <Link href="/elavtal" className="text-cyan-300 hover:text-cyan-200">aktuella elavtal</Link> och
        {' '}<Link href="/allmanna-villkor" className="text-cyan-300 hover:text-cyan-200">allmänna villkor</Link>.
      </div>
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
