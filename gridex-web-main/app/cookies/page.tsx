import type { Metadata } from 'next'
import CookieSettings from '@/components/legal/CookieSettings'

export const metadata: Metadata = {
  title: 'Cookiepolicy – Gridex',
  description: 'Information om hur Gridex använder nödvändiga cookies och, med ditt samtycke, mätning för Google Ads och Analytics.',
  alternates: { canonical: 'https://gridex.se/cookies' },
}

const UPDATED_AT = '2026-06-15'

export default function CookiePolicyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-16">
      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Cookiepolicy • Version 1.0 • Gäller från {UPDATED_AT}
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">Cookiepolicy</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-300 md:text-base">
          Den här sidan beskriver den faktiska cookieanvändningen på Gridex webbplats. Nödvändiga cookies används för funktionalitet. Analys- och marknadsföringstaggar laddas endast om du accepterar cookies.
        </p>
      </section>

      <CookieSettings />

      <section className="rounded-3xl border border-white/10 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold text-white">1. Vad är cookies?</h2>
        <p className="mt-4 text-sm leading-7 text-gray-300">
          Cookies är små textfiler som kan sparas i webbläsaren. Liknande tekniker, till exempel lokal lagring i webbläsaren, kan användas för att spara ett val eller hålla en session aktiv.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold text-white">2. Vad använder Gridex?</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-gray-300">
          <li><strong className="text-white">Nödvändiga cookies</strong> används för inloggning, säkerhet och formulärfunktioner.</li>
          <li><strong className="text-white">Cookieval</strong> sparas lokalt i webbläsaren så att vi vet om bannern ska visas igen.</li>
          <li><strong className="text-white">Analys och annonsering</strong> kan användas för att mäta besök och teckningar efter att du har accepterat cookies.</li>
        </ul>
      </section>

      <section className="rounded-3xl border border-white/10 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold text-white">3. Tredjepartstjänster</h2>
        <p className="mt-4 text-sm leading-7 text-gray-300">
          Tjänster för hosting, inloggning, signering, betalning eller drift kan behöva tekniska cookies för att fungera. Om du accepterar cookies kan Google-taggar användas för att mäta trafik och konverteringar, utan att Gridex skickar personnummer, kundnummer eller andra känsliga kunduppgifter i annonsmätningen.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold text-white">4. Ändra eller ta bort cookies</h2>
        <p className="mt-4 text-sm leading-7 text-gray-300">
          Du kan ändra ditt val på den här sidan när som helst. Du kan också rensa cookies och lokal webbplatsdata direkt i webbläsaren.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-gray-300">
        <h2 className="text-lg font-semibold text-white">Kontakt</h2>
        <p className="mt-3">Gridex AB, org.nr 559416-7149.</p>
        <p>E-post: <a href="mailto:support@gridex.se" className="text-cyan-300 underline underline-offset-4">support@gridex.se</a></p>
      </section>
    </div>
  )
}
