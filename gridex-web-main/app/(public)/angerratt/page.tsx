import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ångerrätt – Gridex elavtal',
  description: 'Information om 14 dagars ångerrätt när du som konsument tecknar elavtal med Gridex på distans.',
  alternates: { canonical: 'https://gridex.se/angerratt' },
}

const UPDATED_AT = '2026-06-15'

export default function AngerrattPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 md:py-18">
      <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Ångerrätt • Version 1.0 • Gäller från {UPDATED_AT}
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">Ångerrätt</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 md:text-base">
          När du som konsument ingår elavtal på distans har du normalt 14 dagars ångerrätt. Här beskriver vi hur du använder den.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <Info title="14 dagar" text="Ångerfristen är normalt 14 dagar från den dag avtalet ingicks och du har fått information om ångerrätten." />
        <Info title="Så ångrar du" text="Meddela Gridex skriftligen att du vill ångra avtalet. Ange gärna namn, kundnummer eller ärendenummer och anläggningsadress." />
        <Info title="Om leverans redan startat" text="Om du uttryckligen begär att leverans ska starta under ångerfristen kan du behöva betala för den el som faktiskt levererats fram till att avtalet ångras." />
      </div>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-gray-300">
        <h2 className="text-lg font-semibold text-white">Kontakt</h2>
        <p className="mt-3">Gridex AB, org.nr 559416-7149.</p>
        <p>E-post: <a href="mailto:support@gridex.se" className="text-cyan-300 underline underline-offset-4">support@gridex.se</a></p>
        <p className="mt-3"><Link href="/angerblankett" className="text-cyan-300 underline underline-offset-4">Visa ångerblankett</Link>. Du måste inte använda blanketten, men den kan göra ärendet tydligare.</p>
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
