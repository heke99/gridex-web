import Link from 'next/link'

export default function AdminShell({
  email,
  children,
}: {
  email: string | null
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="grid lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="border-r border-gray-800 bg-gray-950/40">
          <div className="px-6 py-5 border-b border-gray-800">
            <div className="font-bold tracking-tight">Gridex Admin</div>
            <div className="text-xs text-gray-400 mt-1">{email ?? ''}</div>
          </div>

          <nav className="px-4 py-4 space-y-1 text-sm">
            <Link
              href="/admin"
              className="block px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5"
            >
              Dashboard
            </Link>

            <div className="pt-3 pb-1 px-3 text-xs text-gray-500 uppercase tracking-wider">
              Pricing
            </div>

            <Link
              href="/admin/pricing"
              className="block px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5"
            >
              Versions & Contracts
            </Link>

            <Link
              href="/admin/monthly-spot"
              className="block px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5"
            >
              Månads-Spot
            </Link>

            <Link
              href="/admin/spot-settings"
              className="block px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5"
            >
              Spot-inställningar
            </Link>

            <Link
              href="/admin/portfolio-pricing"
              className="block px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5"
            >
              Portfölj & Fastpris
            </Link>

            <div className="pt-4 px-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center w-full border border-gray-800 hover:border-cyan-500/40 transition px-3 py-2 rounded-lg text-gray-200"
              >
                Till publika sidan
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main */}
        <div>
          <div className="border-b border-gray-800">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-300">Enterprise Pricing Console</div>
              <div className="text-xs text-gray-500">
                Publish-versioner • valid_from • audit-ready
              </div>
            </div>
          </div>

          <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        </div>
      </div>
    </div>
  )
}