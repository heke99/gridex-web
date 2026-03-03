// components/layout/Footer.tsx
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-black mt-20">
      <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-10 text-sm text-gray-400">

        <div className="space-y-2">
          <div className="text-white font-semibold">Gridex AB</div>
          <div>Org.nr: 559416-7149</div>
          <div>
            <a href="mailto:support@gridex.se" className="hover:text-white">
              support@gridex.se
            </a>
          </div>
          <div className="text-xs text-gray-600 pt-2">
            Registrerat elhandelsföretag i Sverige
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
          <Link href="/villkor" className="block hover:text-white">Allmänna villkor</Link>
          <Link href="/integritet" className="block hover:text-white">Integritetspolicy</Link>
          <Link href="/cookies" className="block hover:text-white">Cookiepolicy</Link>
          <Link href="/angerblankett" className="block hover:text-white">Ångerblankett</Link>
          <Link href="/foretagsvillkor" className="block hover:text-white">Företagsvillkor</Link>
        </div>

        <div className="space-y-2">
          <div className="text-white font-semibold">Tillsyn</div>
          <div>Energimarknadsinspektionen</div>
          <div>Allmänna reklamationsnämnden (ARN)</div>
          <div>Integritetsskyddsmyndigheten (IMY)</div>
        </div>

      </div>

      <div className="text-center text-xs text-gray-600 pb-6">
        © {new Date().getFullYear()} Gridex AB. Alla rättigheter förbehållna.
      </div>
    </footer>
  )
}