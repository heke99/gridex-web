// components/layout/Footer.tsx
import Link from 'next/link'
import GridexLogo from '@/components/brand/GridexLogo'

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-gray-800 bg-black">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 text-sm text-gray-400 md:grid-cols-4">
        <div className="space-y-3">
          <GridexLogo className="h-10 w-auto max-w-[170px]" inverted />
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
          <div className="font-semibold text-white">Elavtal</div>
          <Link href="/elavtal/jamfor-elavtal" className="block hover:text-white">Jämför elavtal</Link>
          <Link href="/elavtal/billigt-elavtal" className="block hover:text-white">Billigt elavtal</Link>
          <Link href="/elavtal/rorligt-elpris" className="block hover:text-white">Rörligt elpris</Link>
          <Link href="/elavtal/fast-elpris" className="block hover:text-white">Fast elpris</Link>
          <Link href="/elavtal/kvartspris-el" className="block hover:text-white">Kvartspris el</Link>
          <Link href="/elavtal/foretag" className="block hover:text-white">Elavtal företag</Link>
          <Link href="/elavtal/villa" className="block hover:text-white">Elavtal villa</Link>
          <Link href="/teckna-avtal" className="block hover:text-white">Teckna elavtal</Link>
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-white">Elpriser och guider</div>
          <Link href="/elpriser/elpris-idag" className="block hover:text-white">Elpris idag</Link>
          <Link href="/elpriser/spotpris-el" className="block hover:text-white">Spotpris el</Link>
          <Link href="/elpriser/se1" className="block hover:text-white">Elpris SE1</Link>
          <Link href="/elpriser/se2" className="block hover:text-white">Elpris SE2</Link>
          <Link href="/elpriser/se3" className="block hover:text-white">Elpris SE3</Link>
          <Link href="/elpriser/se4" className="block hover:text-white">Elpris SE4</Link>
          <Link href="/guider" className="block hover:text-white">Alla guider</Link>
          <Link href="/ordlista" className="block hover:text-white">Ordlista</Link>
          <Link href="/sitemap" className="block hover:text-white">Sitemap</Link>
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-white">Juridik</div>
          <Link href="/allmanna-villkor" className="block hover:text-white">Allmänna villkor</Link>
          <Link href="/integritetspolicy" className="block hover:text-white">Integritetspolicy</Link>
          <Link href="/angerratt" className="block hover:text-white">Ångerrätt</Link>
          <Link href="/prisvillkor" className="block hover:text-white">Prisvillkor</Link>
          <Link href="/cookies" className="block hover:text-white">Cookies</Link>
          <Link href="/angerblankett" className="block hover:text-white">Ångerblankett</Link>
          <Link href="/foretagsvillkor" className="block hover:text-white">Företagsvillkor</Link>
          <Link href="/elbolag/gridex-el-ab" className="block hover:text-white">Om Gridex El AB</Link>
          <div className="pt-3 text-xs leading-5 text-gray-600">
            Tillsyn: Energimarknadsinspektionen, ARN och IMY.
          </div>
        </div>
      </div>

      <div className="pb-6 text-center text-xs text-gray-600">
        © {new Date().getFullYear()} Gridex AB. Alla rättigheter förbehållna.
      </div>
    </footer>
  )
}
