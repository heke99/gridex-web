import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ångerrätt – Gridex elavtal',
  description:
    'Information om ångerrätt när du tecknar elavtal med Gridex på distans.',
  alternates: { canonical: 'https://gridex.se/angerratt' },
}

export default function AngerrattPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 md:py-18">
      <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Konsumentinformation • Version 1.0
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Ångerrätt
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 md:text-base">
          När du som konsument tecknar elavtal på distans har du normalt rätt att ångra
          avtalet inom 14 dagar. Här beskriver vi hur det fungerar hos Gridex.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gray-950 p-6">
          <h2 className="text-xl font-semibold text-white">14 dagars ångerrätt</h2>
          <p className="mt-4 text-sm leading-7 text-gray-300">
            Som konsument kan du normalt ångra ett elavtal som tecknats på distans inom
            14 dagar från att avtalet ingåtts och du fått information om ångerrätten.
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-gray-950 p-6">
          <h2 className="text-xl font-semibold text-white">Så ångrar du avtalet</h2>
          <p className="mt-4 text-sm leading-7 text-gray-300">
            Kontakta Gridex skriftligen och ange att du vill ångra ditt elhandelsavtal.
            Ange gärna namn, kundnummer eller ansökningsnummer och vilken anläggningsadress
            det gäller.
          </p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
            E-post: support@gridex.se
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-gray-950 p-6">
          <h2 className="text-xl font-semibold text-white">Om leverans har påbörjats</h2>
          <p className="mt-4 text-sm leading-7 text-gray-300">
            Om du uttryckligen begär att elavtalet ska starta under ångerfristen kan du
            behöva betala för den el som faktiskt levererats fram till att avtalet ångras.
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-gray-950 p-6">
          <h2 className="text-xl font-semibold text-white">Ångerblankett</h2>
          <p className="mt-4 text-sm leading-7 text-gray-300">
            Du kan använda vår ångerblankett, men det går också bra att kontakta oss på
            annat tydligt sätt.
          </p>
          <Link
            href="/angerblankett"
            className="mt-4 inline-flex rounded-xl border border-cyan-500/40 px-5 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/10"
          >
            Visa ångerblankett
          </Link>
        </section>
      </div>
    </div>
  )
}
