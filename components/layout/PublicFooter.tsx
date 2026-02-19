import Link from 'next/link'

export default function PublicFooter() {
  return (
    <footer className="border-t border-gray-800 bg-black mt-16">
      <div className="max-w-6xl mx-auto px-6 py-12 grid gap-10 md:grid-cols-4 text-sm text-gray-400">
        <div className="space-y-2">
          <div className="text-white font-semibold">Gridex AB</div>
          <div>Org.nr: 550416-7149</div>
          <div>
            E-post:{' '}
            <a href="mailto:support@gridex.se" className="text-cyan-300 hover:text-cyan-200">
              support@gridex.se
            </a>
          </div>
          <div className="text-xs text-gray-500 pt-2">
            Gridex är en digital plattform för elavtal och prisinformation per elområde (SE1–SE4).
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-white font-semibold">Tjänster</div>
          <Link href="/avtal" className="block hover:text-white">Elavtal</Link>
          <Link href="/teckna" className="block hover:text-white">Teckna elavtal</Link>
          <Link href="/kundservice" className="block hover:text-white">Kundservice</Link>
        </div>

        <div className="space-y-2">
          <div className="text-white font-semibold">Juridik</div>
          <Link href="/gdpr" className="block hover:text-white">GDPR</Link>
          <Link href="/villkor" className="block hover:text-white">Allmänna villkor</Link>
        </div>

        <div className="space-y-2">
          <div className="text-white font-semibold">Kontakta oss</div>
          <Link href="/kundservice" className="block hover:text-white">Kontaktsida</Link>
          <a href="mailto:support@gridex.se" className="block hover:text-white">Maila support</a>
          <div className="text-xs text-gray-500 pt-2">
            Support: vardagar 09–17 (exempel). Anpassa senare om ni vill.
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-gray-600 pb-6">
        © {new Date().getFullYear()} Gridex AB. Alla rättigheter förbehållna.
      </div>
    </footer>
  )
}