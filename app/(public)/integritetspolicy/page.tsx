import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Integritetspolicy – Gridex',
  description:
    'Så behandlar Gridex AB personuppgifter när du besöker hemsidan, tecknar elavtal eller använder Mina sidor.',
  alternates: { canonical: 'https://gridex.se/integritetspolicy' },
}

const sections = [
  {
    title: '1. Personuppgiftsansvarig',
    body: [
      'Gridex AB, org.nr 559416-7149, är personuppgiftsansvarig för behandling av personuppgifter som sker när du besöker vår webbplats, tecknar elavtal eller använder Mina sidor.',
      'Kontakt: support@gridex.se.',
    ],
  },
  {
    title: '2. Uppgifter vi behandlar',
    bullets: [
      'Namn, kontaktuppgifter och kundnummer.',
      'Personnummer eller organisationsnummer när det behövs för avtal, identifiering eller fakturering.',
      'Adress, anläggningsadress, anläggnings-ID, mätpunkts-ID, nätområde och nätägare.',
      'Avtalsuppgifter, prisuppgifter, godkännanden, fullmakt och ångerrättsinformation.',
      'Fakturauppgifter, betalningsstatus och kundkommunikation.',
      'Förbruknings- och mätvärden när de behövs för avtal, fakturering eller administration.',
      'Teknisk information, till exempel IP-adress, webbläsare och säkerhetsloggar.',
    ],
  },
  {
    title: '3. Varför vi behandlar uppgifter',
    bullets: [
      'För att ta emot och behandla din ansökan om elavtal.',
      'För att skapa och administrera kundrelation, avtal, anläggningar och fakturering.',
      'För att begära och ta emot nödvändiga anläggningsuppgifter från nätägare när du har godkänt detta.',
      'För att hantera leverantörsbyte, avtalsstart, kundkommunikation och Mina sidor.',
      'För att uppfylla krav enligt elmarknadsregler, bokföringsregler och annan lagstiftning.',
      'För att skydda våra tjänster mot fel, missbruk och obehörig åtkomst.',
    ],
  },
  {
    title: '4. Rättslig grund',
    body: [
      'Behandlingen sker främst för att ingå och fullgöra avtal, uppfylla rättsliga skyldigheter och skydda berättigade intressen som säkerhet, dokumentation och kundkommunikation. Samtycke används bara där det faktiskt behövs.',
    ],
  },
  {
    title: '5. Mottagare av uppgifter',
    bullets: [
      'Elnätsföretag och andra elmarknadsaktörer när det krävs för anläggningsuppgifter eller leverantörsbyte.',
      'Fakturerings-, betalnings- och driftleverantörer som hjälper oss leverera tjänsten.',
      'E-post- och kommunikationsleverantörer för avtalsrelaterade meddelanden.',
      'Myndigheter när vi är skyldiga enligt lag.',
    ],
  },
  {
    title: '6. Lagringstid',
    body: [
      'Uppgifter sparas så länge de behövs för kundrelationen, avtalet, fakturering, rättsliga krav och dokumentation. Ansökningar som inte leder till kundrelation ska ha begränsad lagringstid. Bokföringsuppgifter sparas enligt bokföringsregler.',
    ],
  },
  {
    title: '7. Dina rättigheter',
    body: [
      'Du kan begära tillgång till dina uppgifter, rättelse, radering i vissa fall, begränsning, dataportabilitet och invända mot viss behandling. Du kan också lämna klagomål till Integritetsskyddsmyndigheten.',
    ],
  },
  {
    title: '8. Säkerhet',
    body: [
      'Vi arbetar med åtkomstkontroll, loggning, behörighetsstyrning och tekniska skydd för att personuppgifter bara ska användas av rätt personer för rätt ändamål.',
    ],
  },
]

export default function IntegritetspolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 md:py-18">
      <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Juridisk information • Version 1.0
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Integritetspolicy
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 md:text-base">
          Här förklarar vi hur Gridex behandlar personuppgifter när du besöker hemsidan,
          tecknar elavtal eller använder Mina sidor.
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

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-gray-300">
        Läs även våra <Link href="/allmanna-villkor" className="text-cyan-300 hover:text-cyan-200">allmänna villkor</Link>,
        {' '}<Link href="/angerratt" className="text-cyan-300 hover:text-cyan-200">information om ångerrätt</Link> och
        {' '}<Link href="/cookies" className="text-cyan-300 hover:text-cyan-200">cookiepolicy</Link>.
      </div>
    </div>
  )
}
