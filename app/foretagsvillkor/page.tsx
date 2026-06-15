import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Företagsvillkor – Gridex elavtal',
  description: 'Särskilda villkor för företag och näringsidkare som ingår elhandelsavtal med Gridex.',
  alternates: { canonical: 'https://gridex.se/foretagsvillkor' },
}

const UPDATED_AT = '2026-06-15'

const sections = [
  ['1. Tillämpning', 'Dessa villkor gäller för juridiska personer och näringsidkare som ansöker om eller ingår elhandelsavtal med Gridex. De gäller tillsammans med allmänna villkor och den prisinformation som visas för valt avtal.'],
  ['2. Behörighet', 'Den som skickar ansökan för ett företag ansvarar för att ha rätt att företräda företaget eller att ansökan godkänns av behörig företrädare.'],
  ['3. Pris och betalning', 'Pris, avgifter, bindningstid och uppsägningstid framgår av valt avtal. Betalning ska ske enligt faktura. Vid sen betalning kan dröjsmålsränta, påminnelseavgift och inkasso tillkomma enligt lag och villkor.'],
  ['4. Anläggningsuppgifter och fullmakt', 'Företagskunden ansvarar för att uppgifter om anläggning, kontaktperson och fakturering är korrekta. Gridex kan begära och hantera anläggningsuppgifter från nätägare när fullmakt eller annan rättslig grund finns.'],
  ['5. Ansvarsbegränsning', 'Gridex ansvarar inte för indirekta skador, utebliven vinst, produktionsbortfall eller följdskador om inte annat följer av tvingande lag.'],
  ['6. Uppsägning och tvist', 'Uppsägningstid, bindningstid och ändringsvillkor framgår av avtalet. Tvist prövas enligt svensk rätt av svensk domstol om inte annat avtalats.'],
]

export default function ForetagsVillkorPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-16">
      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Företagsvillkor • Version 1.0 • Gäller från {UPDATED_AT}
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">Företagsvillkor</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 md:text-base">
          Särskilda villkor för företag och näringsidkare som ansöker om eller ingår elhandelsavtal med Gridex.
        </p>
      </section>

      {sections.map(([title, body]) => (
        <section key={title} className="rounded-3xl border border-white/10 bg-gray-950 p-6">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="mt-4 text-sm leading-7 text-gray-300">{body}</p>
        </section>
      ))}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-gray-300">
        <h2 className="text-lg font-semibold text-white">Kontakt</h2>
        <p className="mt-3">Gridex AB, org.nr 559416-7149.</p>
        <p>E-post: <a href="mailto:support@gridex.se" className="text-cyan-300 underline underline-offset-4">support@gridex.se</a></p>
      </section>
    </div>
  )
}
