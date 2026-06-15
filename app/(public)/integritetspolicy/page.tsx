import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Integritetspolicy – Gridex',
  description: 'Så behandlar Gridex AB personuppgifter när du besöker hemsidan, ansöker om elavtal eller använder Mina sidor.',
  alternates: { canonical: 'https://gridex.se/integritetspolicy' },
}

const UPDATED_AT = '2026-06-15'

const sections = [
  {
    title: '1. Personuppgiftsansvarig',
    body: ['Gridex AB, org.nr 559416-7149, är personuppgiftsansvarig för behandling av personuppgifter som sker när du besöker webbplatsen, ansöker om elavtal eller använder Mina sidor.'],
  },
  {
    title: '2. Vilka uppgifter vi behandlar',
    bullets: [
      'Namn, kontaktuppgifter, kundnummer och inloggningsuppgifter.',
      'Personnummer eller organisationsnummer när det behövs för avtal, identifiering, fullmakt eller fakturering.',
      'Adress, anläggningsadress, anläggnings-ID, mätpunkts-ID, nätområde och nätägare.',
      'Avtalsuppgifter, prisuppgifter, startdatum, godkännanden, fullmakt och ångerrättsinformation.',
      'Fakturauppgifter, betalningsstatus, kundkommunikation och dokument.',
      'Förbruknings- och mätvärden när de behövs för avtal, fakturering eller administration.',
      'Teknisk information, till exempel IP-adress, webbläsare, säkerhetsloggar och cookieval.',
    ],
  },
  {
    title: '3. Varför vi behandlar uppgifter',
    bullets: [
      'För att ta emot och behandla din ansökan om elavtal.',
      'För att skapa och administrera kundrelation, avtal, anläggningar och fakturering.',
      'För att begära och ta emot nödvändiga anläggningsuppgifter från nätägare när du har godkänt fullmakt.',
      'För att hantera leverantörsbyte, avtalsstart, Mina sidor och avtalsrelaterad kommunikation.',
      'För att uppfylla elmarknadsregler, bokföringsregler och annan lagstiftning.',
      'För att skydda tjänsterna mot fel, missbruk och obehörig åtkomst.',
    ],
  },
  {
    title: '4. Rättslig grund',
    bullets: [
      'Avtal eller åtgärder inför avtal: när vi behandlar ansökan, avtal, anläggning och fakturering.',
      'Rättslig skyldighet: när vi måste spara eller lämna uppgifter enligt lag eller elmarknadsregler.',
      'Berättigat intresse: för säkerhet, felsökning, dokumentation, kundkommunikation och förbättring av tjänsten.',
      'Samtycke: när samtycke krävs, till exempel för vissa cookieval eller särskilda godkännanden.',
    ],
  },
  {
    title: '5. Mottagare och kategorier av mottagare',
    bullets: [
      'Elnätsföretag och andra elmarknadsaktörer när det krävs för anläggningsuppgifter eller leverantörsbyte.',
      'Fakturering-, betalnings-, e-post-, signerings- och driftleverantörer som behandlar uppgifter för Gridex räkning.',
      'Myndigheter, domstolar eller rådgivare när det krävs enligt lag eller för att ta tillvara rättsliga intressen.',
    ],
  },
  {
    title: '6. Lagringstid',
    body: ['Uppgifter sparas så länge de behövs för ansökan, kundrelation, avtal, fakturering, rättsliga krav och dokumentation. Bokföringsuppgifter sparas enligt bokföringsregler. Ansökningar som inte leder till kundrelation ska raderas eller avidentifieras när de inte längre behövs.'],
  },
  {
    title: '7. Dina rättigheter',
    bullets: [
      'Begära tillgång till de uppgifter vi behandlar om dig.',
      'Begära rättelse av felaktiga uppgifter.',
      'Begära radering eller begränsning när lagliga förutsättningar finns.',
      'Invända mot viss behandling.',
      'Begära dataportabilitet när det är tillämpligt.',
      'Lämna klagomål till Integritetsskyddsmyndigheten.',
    ],
  },
  {
    title: '8. Säkerhet',
    body: ['Gridex arbetar med behörighetsstyrning, loggning, tekniska skydd och åtkomstkontroll för att personuppgifter bara ska användas av rätt personer för rätt ändamål.'],
  },
]

export default function IntegritetspolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 md:py-18">
      <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Integritetspolicy • Version 1.0 • Gäller från {UPDATED_AT}
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">Integritetspolicy</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 md:text-base">
          Här förklarar vi vilka personuppgifter Gridex behandlar, varför vi gör det, vilken rättslig grund vi använder och hur du kan utöva dina rättigheter.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <section key={section.title} className="rounded-3xl border border-white/10 bg-gray-950 p-6">
            <h2 className="text-xl font-semibold text-white">{section.title}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-gray-300">
              {section.body?.map((p) => <p key={p}>{p}</p>)}
              {section.bullets ? (
                <ul className="list-disc space-y-2 pl-5">
                  {section.bullets.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-gray-300">
        <h2 className="text-lg font-semibold text-white">Kontakt och rättigheter</h2>
        <p className="mt-3">Gridex AB, org.nr 559416-7149.</p>
        <p>E-post: <a href="mailto:support@gridex.se" className="text-cyan-300 underline underline-offset-4">support@gridex.se</a></p>
        <p className="mt-3">På Mina sidor kan du också se kunduppgifter och begära hjälp med datautdrag, rättelse eller avslut.</p>
        <p className="mt-3">Läs även våra <Link href="/allmanna-villkor" className="text-cyan-300 underline underline-offset-4">allmänna villkor</Link>, <Link href="/angerratt" className="text-cyan-300 underline underline-offset-4">ångerrätt</Link> och <Link href="/cookies" className="text-cyan-300 underline underline-offset-4">cookiepolicy</Link>.</p>
      </section>
    </div>
  )
}
