// components/layout/Footer.tsx
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-gray-800 bg-black">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 text-sm text-gray-400 md:grid-cols-4">
        <div className="space-y-2">
          <div className="font-semibold text-white">Gridex AB</div>
          <div>Org.nr: 559416-7149</div>
          <div>Svenskt elhandelsbolag</div>
          <div>
            <a href="mailto:support@gridex.se" className="hover:text-white">
              support@gridex.se
            </a>
          </div>
          <div className="pt-2 text-xs text-gray-600">
            Elhandelspris visas separat från elnätsavgifter som hanteras av kundens nätägare.
          </div>
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-white">Tjänster</div>
          <Link href="/#rakna-elpris" className="block hover:text-white">
            Räkna elpris
          </Link>
          <Link href="/aktuella-elpriser" className="block hover:text-white">
            Elpris idag
          </Link>
          <Link href="/elavtal" className="block hover:text-white">
            Elavtal
          </Link>
          <Link href="/teckna-avtal" className="block hover:text-white">
            Teckna elavtal
          </Link>
          <Link href="/kundservice" className="block hover:text-white">
            Kundservice
          </Link>
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-white">Juridik</div>
          <Link href="/allmanna-villkor" className="block hover:text-white">
            Allmänna villkor
          </Link>
          <Link href="/integritetspolicy" className="block hover:text-white">
            Integritetspolicy
          </Link>
          <Link href="/angerratt" className="block hover:text-white">
            Ångerrätt
          </Link>
          <Link href="/prisvillkor" className="block hover:text-white">
            Prisvillkor
          </Link>
          <Link href="/cookies" className="block hover:text-white">
            Cookies
          </Link>
          <Link href="/angerblankett" className="block hover:text-white">
            Ångerblankett
          </Link>
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-white">Tillsyn och hjälp</div>
          <div>Energimarknadsinspektionen</div>
          <div>Allmänna reklamationsnämnden (ARN)</div>
          <div>Integritetsskyddsmyndigheten (IMY)</div>
        </div>
      </div>

      <div className="pb-6 text-center text-xs text-gray-600">
        © {new Date().getFullYear()} Gridex AB. Alla rättigheter förbehållna.
      </div>
    </footer>
  )
}
