import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ångerblankett – Gridex',
  description: 'Ångerblankett för konsumenter som vill ångra ett elhandelsavtal med Gridex.',
  alternates: { canonical: 'https://gridex.se/angerblankett' },
}

const UPDATED_AT = '2026-06-15'

export default function AngerblankettPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-16">
      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Ångerblankett • Version 1.0 • Gäller från {UPDATED_AT}
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">Ångerblankett</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 md:text-base">
          Blanketten kan användas om du som konsument vill ångra ditt elhandelsavtal inom ångerfristen. Det går även bra att meddela Gridex på annat tydligt sätt.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-gray-950 p-6 text-sm leading-7 text-gray-300">
        <h2 className="text-xl font-semibold text-white">Skicka till</h2>
        <p className="mt-4">Gridex AB, org.nr 559416-7149</p>
        <p>E-post: <a href="mailto:support@gridex.se" className="text-cyan-300 underline underline-offset-4">support@gridex.se</a></p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm leading-8 text-gray-300">
        <h2 className="text-xl font-semibold text-white">Meddelande om ånger</h2>
        <p className="mt-4">Jag meddelar härmed att jag vill ångra mitt elhandelsavtal med Gridex.</p>
        <div className="mt-6 space-y-3">
          <p>Namn: __________________________________________</p>
          <p>Personnummer eller kundnummer: ______________________________</p>
          <p>Anläggningsadress: __________________________________________</p>
          <p>Ansöknings- eller avtalsnummer om du har det: __________________</p>
          <p>Datum: __________________________________________</p>
          <p>Underskrift, om blanketten skrivs ut: __________________________</p>
        </div>
      </section>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-xs leading-6 text-gray-400">
        Konsumenter har normalt 14 dagars ångerrätt vid distansavtal. Läs mer på sidan Ångerrätt eller kontakta kundservice om du är osäker.
      </div>
    </div>
  )
}
