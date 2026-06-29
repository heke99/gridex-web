import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fullmakt för anläggningsuppgifter – Gridex',
  description:
    'Fullmakt som gör att Gridex kan begära och hantera anläggningsuppgifter från elnätsföretaget för att behandla en teckning om elavtal.',
  alternates: { canonical: 'https://gridex.se/fullmakt' },
}

const UPDATED_AT = '2026-06-16'

export default function FullmaktPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 md:py-18">
      <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Fullmakt • Version 1.0 • Gäller från {UPDATED_AT}
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Fullmakt för anläggningsuppgifter
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 md:text-base">
          När du tecknar elavtal kan Gridex behöva kontrollera uppgifter om din elanläggning hos ditt elnätsföretag. Fullmakten gör att vi får begära och hantera de uppgifter som krävs för att behandla teckning och starta avtalet korrekt.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <Info
          title="Varför behövs fullmakten?"
          text="För att kunna verifiera anläggningen, kontrollera nätägare och hantera ett eventuellt leverantörsbyte behöver Gridex kunna begära nödvändiga uppgifter från elnätsföretaget."
        />
        <Info
          title="Vilka uppgifter får Gridex begära?"
          text="Fullmakten omfattar uppgifter som anläggnings-ID, mätpunkts-ID, nätområde, nätägare, adresskoppling, mätarrelaterade uppgifter och annan information som behövs för att behandla teckning och administrera elavtalet."
        />
        <Info
          title="Hur används uppgifterna?"
          text="Uppgifterna används för att kontrollera att teckning gäller rätt anläggning, skapa korrekt kund- och avtalsunderlag, hantera leverantörsbyte och administrera avtalet. Uppgifterna används inte för andra ändamål än vad som behövs för elavtalet och tillhörande administration."
        />
        <Info
          title="Hur länge gäller fullmakten?"
          text="Fullmakten gäller så länge den behövs för att behandla teckning, starta avtalet och administrera elavtalet. Den sparas tillsammans med teckning och kan användas som underlag om nätägaren eller Gridex behöver verifiera behörigheten."
        />
      </div>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-gray-300">
        <h2 className="text-lg font-semibold text-white">Godkännande</h2>
        <p className="mt-3">
          När du markerar fullmakten i teckningsflödet godkänner du att Gridex AB, org.nr 559416-7149, får begära, ta emot och hantera dessa uppgifter från ditt elnätsföretag för att kunna behandla din teckning och starta ditt elavtal.
        </p>
        <p className="mt-3">
          Läs även <Link href="/integritetspolicy" className="text-cyan-300 underline underline-offset-4">integritetspolicyn</Link>, <Link href="/allmanna-villkor" className="text-cyan-300 underline underline-offset-4">allmänna villkor</Link> och <Link href="/prisvillkor" className="text-cyan-300 underline underline-offset-4">prisvillkor</Link>.
        </p>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-gray-950 p-6 text-sm leading-7 text-gray-300">
        <h2 className="text-lg font-semibold text-white">Kontakt</h2>
        <p className="mt-3">Gridex AB, org.nr 559416-7149.</p>
        <p>
          E-post: <a href="mailto:support@gridex.se" className="text-cyan-300 underline underline-offset-4">support@gridex.se</a>
        </p>
      </section>
    </div>
  )
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-gray-950 p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-gray-300">{text}</p>
    </section>
  )
}
