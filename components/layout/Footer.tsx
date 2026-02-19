import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-black mt-20">
      <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-10 text-sm text-gray-400">

        <div>
          <div className="text-white font-semibold mb-3">Gridex AB</div>
          <div>Org.nr: 550416-7149</div>
          <div>support@gridex.se</div>
        </div>

        <div>
          <div className="text-white font-semibold mb-3">Tjänster</div>
          <Link href="/avtal" className="block hover:text-white">Elavtal</Link>
          <Link href="/teckna" className="block hover:text-white">Teckna elavtal</Link>
        </div>

        <div>
          <div className="text-white font-semibold mb-3">Juridik</div>
          <Link href="/gdpr" className="block hover:text-white">GDPR</Link>
          <Link href="/villkor" className="block hover:text-white">Allmänna villkor</Link>
        </div>

        <div>
          <div className="text-white font-semibold mb-3">Kundservice</div>
          <Link href="/kundservice" className="block hover:text-white">Kontakta oss</Link>
        </div>

      </div>

      <div className="text-center text-xs text-gray-600 pb-6">
        © {new Date().getFullYear()} Gridex AB. Alla rättigheter förbehållna.
      </div>
    </footer>
  )
}