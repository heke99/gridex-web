import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Allmänna villkor – Gridex elavtal',
  description:
    'Allmänna villkor för Gridex elavtal, priser, avtalsstart, leverantörsbyte, fullmakt, ångerrätt och fakturering.',
  alternates: { canonical: 'https://gridex.se/allmanna-villkor' },
}

const sections = [
  {
    title: '1. Parter',
    body: 'Dessa villkor gäller mellan Gridex AB, org.nr 559416-7149, och dig som tecknar elavtal som privatperson eller företag.',
  },
  {
    title: '2. Avtal och pris',
    body: 'Gridex kan erbjuda rörligt elpris, fast elpris, portföljavtal och blandade prisupplägg. Det avtal, den prisversion och de avgifter som visas när du tecknar sparas som underlag för avtalet.',
  },
  {
    title: '3. Prisuppgifter',
    body: 'Priset kan bestå av elpris, påslag, månadsavgift, fakturaavgift, skatter, moms och andra avgifter som framgår innan du skickar ansökan. Elnätsavgifter faktureras normalt av ditt elnätsföretag och ingår inte i elhandelspriset.',
  },
  {
    title: '4. Avtalsstart och leverantörsbyte',
    body: 'Avtalsstart sker enligt valt startdatum eller så snart som möjligt när uppgifterna är kompletta. Start kan påverkas av nätägare, nuvarande avtal, ångerrätt, anläggningsuppgifter och marknadsregler.',
  },
  {
    title: '5. Fullmakt för anläggningsuppgifter',
    body: 'När du godkänner fullmakten får Gridex begära, ta emot och hantera de uppgifter från nätägare som behövs för att starta och administrera ditt elavtal, till exempel anläggnings-ID, mätpunkts-ID, nätområde, nätägare och information för leverantörsbyte.',
  },
  {
    title: '6. Kundens ansvar',
    body: 'Du ansvarar för att uppgifterna du lämnar är korrekta och att du informerar Gridex om ändringar som kan påverka avtalet. Du bör även kontrollera eventuell bindningstid hos nuvarande elhandlare.',
  },
  {
    title: '7. Gridex ansvar',
    body: 'Gridex ansvarar för att behandla din ansökan, hantera avtalet och informera dig om viktiga steg. Om uppgifter saknas kan Gridex behöva komplettera innan leverantörsbyte eller avtalsstart kan genomföras.',
  },
  {
    title: '8. Ångerrätt',
    body: 'Konsumenter har normalt 14 dagars ångerrätt vid distansavtal. Mer information finns på sidan om ångerrätt och i bekräftelsen du får efter ansökan.',
  },
  {
    title: '9. Fakturering och betalning',
    body: 'Fakturering sker enligt avtalet och de faktureringsvillkor som framgår i pris- och avtalsinformationen. Vid sen betalning kan påminnelse, dröjsmålsränta och inkasso tillkomma enligt lag och villkor.',
  },
  {
    title: '10. Ändringar, uppsägning och tvist',
    body: 'Bindningstid, uppsägningstid och ändringsvillkor framgår av valt avtal. Tvist kan prövas av Allmänna reklamationsnämnden eller domstol enligt svensk rätt.',
  },
]

export default function AllmannaVillkorPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 md:py-18">
      <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Gridex elavtal • Version 1.0
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Allmänna villkor
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 md:text-base">
          Dessa villkor beskriver grunden för Gridex elavtal. Det exakta priset,
          vald prisversion och kundens godkännanden sparas när ansökan skickas.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <section key={section.title} className="rounded-3xl border border-white/10 bg-gray-950 p-6">
            <h2 className="text-xl font-semibold text-white">{section.title}</h2>
            <p className="mt-4 text-sm leading-7 text-gray-300">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-gray-300">
        Innan du skickar ansökan ska du även ta del av vår{' '}
        <Link href="/integritetspolicy" className="text-cyan-300 hover:text-cyan-200">integritetspolicy</Link>,
        {' '}<Link href="/angerratt" className="text-cyan-300 hover:text-cyan-200">ångerrättsinformation</Link> och aktuell
        {' '}<Link href="/prisvillkor" className="text-cyan-300 hover:text-cyan-200">prisinformation</Link>.
      </div>
    </div>
  )
}
