import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Allmänna villkor – Gridex elavtal',
  description: 'Allmänna villkor för Gridex elavtal, ansökan, avtal, fullmakt, ångerrätt, fakturering och leverantörsbyte.',
  alternates: { canonical: 'https://gridex.se/allmanna-villkor' },
}

const UPDATED_AT = '2026-06-15'

const sections = [
  ['1. Parter', 'Dessa villkor gäller mellan Gridex AB, org.nr 559416-7149, och dig som ansöker om eller ingår elhandelsavtal med Gridex som privatperson eller företag.'],
  ['2. Ansökan och avtal', 'När du skickar in en ansökan behandlar Gridex dina uppgifter och kontrollerar att valt avtal, prisuppgifter, kunduppgifter och anläggningsuppgifter är tillräckliga. Avtalsstart sker först när uppgifterna är verifierade och Gridex har bekräftat nästa steg.'],
  ['3. Pris och avgifter', 'Elhandelspriset kan bestå av elpris, påslag, månadsavgift, fakturaavgift, skatter, moms och andra avgifter som visas innan ansökan skickas. Elnätsavgiften faktureras normalt av elnätsföretaget och ingår inte i Gridex elhandelspris.'],
  ['4. Avtalsstart och leverantörsbyte', 'Start sker enligt önskat datum eller så snart som möjligt när marknadsregler, ångerrätt, befintligt avtal och verifierade anläggningsuppgifter tillåter det. Gridex kan behöva kontakta nätägare eller andra marknadsaktörer för att slutföra processen.'],
  ['5. Fullmakt för anläggningsuppgifter', 'När du godkänner fullmakten får Gridex begära, ta emot och hantera uppgifter om elanläggningen som behövs för att starta och administrera avtalet, till exempel anläggnings-ID, mätpunkts-ID, nätområde, nätägare och uppgifter för leverantörsbyte.'],
  ['6. Kundens ansvar', 'Du ansvarar för att lämna korrekta uppgifter och för att informera Gridex om ändringar som kan påverka avtalet. Du bör själv kontrollera eventuell bindningstid eller uppsägningstid hos nuvarande elhandlare.'],
  ['7. Gridex ansvar', 'Gridex ansvarar för att behandla ansökan, administrera avtalet, hantera kommunikation och informera om viktiga steg. Om uppgifter saknas kan avtalsstart pausas tills uppgifterna är kompletterade.'],
  ['8. Ångerrätt för konsument', 'Konsumenter har normalt 14 dagars ångerrätt vid distansavtal. Information om ångerrätt lämnas separat innan ansökan skickas och finns på sidan Ångerrätt.'],
  ['9. Fakturering och betalning', 'Fakturering sker enligt avtalet och den prisinformation som gäller för valt avtal. Vid sen betalning kan påminnelseavgift, dröjsmålsränta och inkasso tillkomma enligt lag och villkor.'],
  ['10. Ändringar, uppsägning och tvist', 'Bindningstid, uppsägningstid och ändringsvillkor framgår av valt avtal. Tvist kan prövas av Allmänna reklamationsnämnden eller svensk domstol enligt svensk rätt.'],
]

export default function AllmannaVillkorPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 md:py-18">
      <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Allmänna villkor • Version 1.0 • Gäller från {UPDATED_AT}
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">Allmänna villkor</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 md:text-base">
          Villkoren beskriver hur ansökan, avtal, pris, fullmakt, ångerrätt och fakturering fungerar hos Gridex.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {sections.map(([title, body]) => (
          <section key={title} className="rounded-3xl border border-white/10 bg-gray-950 p-6">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <p className="mt-4 text-sm leading-7 text-gray-300">{body}</p>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-gray-300">
        <h2 className="text-lg font-semibold text-white">Kontakt</h2>
        <p className="mt-3">Gridex AB, org.nr 559416-7149.</p>
        <p>E-post: <a href="mailto:support@gridex.se" className="text-cyan-300 underline underline-offset-4">support@gridex.se</a></p>
        <p className="mt-3">Se även <Link href="/integritetspolicy" className="text-cyan-300 underline underline-offset-4">integritetspolicy</Link>, <Link href="/angerratt" className="text-cyan-300 underline underline-offset-4">ångerrätt</Link> och <Link href="/prisvillkor" className="text-cyan-300 underline underline-offset-4">prisinformation</Link>.</p>
      </section>
    </div>
  )
}
