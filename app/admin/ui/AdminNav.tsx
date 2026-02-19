import Link from 'next/link'
import type { AdminRole } from '@/lib/auth/rbac'

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex h-10 items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white/85 hover:bg-white/10"
    >
      <span>{label}</span>
      <span className="text-white/30">→</span>
    </Link>
  )
}

export default function AdminNav({ role }: { role: AdminRole }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
        <div className="text-xs text-white/60">Navigation</div>
        <div className="mt-3 space-y-2">
          <NavItem href="/admin" label="Dashboard" />
          <NavItem href="/admin/pricing" label="Pricing & Versioner" />
          <NavItem href="/admin/contracts" label="Kontrakt (publish)" />
          <NavItem href="/admin/spot" label="Spot Settings" />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
        <div className="text-xs text-white/60">Behörighet</div>
        <div className="mt-2 text-xs text-white/80">
          Du är inloggad som <span className="text-white">{role}</span>.
        </div>
        <div className="mt-2 text-[11px] leading-5 text-white/55">
          <div>• admin: publish/unpublish + allt</div>
          <div>• editor: (framtid) edit utan publish</div>
        </div>
      </div>
    </div>
  )
}