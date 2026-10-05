import Link from "next/link";
import { requireSupportSession } from "@/support/lib/session";
import { signOut } from "@/support/app/login/actions";

export const dynamic = "force-dynamic";
export default async function Workspace({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSupportSession();
  return (
    <>
      <a href="#content" className="skip">
        Hoppa till innehållet
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              G
            </span>
            <span>
              Gridex Support<small>Kundtjänstens arbetsyta</small>
            </span>
          </Link>
          <nav aria-label="Huvudnavigation">
            <Link href="/">Ärenden</Link>
            <Link href="/contact-requests">Kontaktförfrågningar</Link>
            <Link href="/customers">Kunder</Link>
            <Link href="/team">Personal</Link>
          </nav>
          <div className="account">
            <span title={session.email ?? undefined}>{session.email}</span>
            <form action={signOut}>
              <button>Logga ut</button>
            </form>
          </div>
        </div>
      </header>
      <main id="content" className="workspace">
        {children}
      </main>
    </>
  );
}
