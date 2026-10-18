import Image from "next/image";
import LoginForm from "@/support/components/LoginForm";
import { signIn, signOut } from "./actions";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <main className="staff-login">
      <header className="staff-login-header">
        <Image src="/brand/gridex-logo.svg" alt="Gridex" width={184} height={53} priority />
        <span className="staff-login-label"><span aria-hidden="true" />Personalportal</span>
      </header>
      <div className="staff-login-content">
        <section className="staff-login-intro" aria-labelledby="staff-workspace-title">
          <p className="eyebrow">Gridex Support</p>
          <h2 id="staff-workspace-title">En gemensam arbetsyta.<br /><span>Med kunden i fokus.</span></h2>
          <p>Kundärenden, kunduppgifter och uppföljning.<br />Samlat för dig som arbetar på Gridex.</p>
          <ul className="staff-login-features">
            <li><span aria-hidden="true">01</span><div><strong>Kundärenden</strong><small>Håll ihop dialogen och nästa steg.</small></div></li>
            <li><span aria-hidden="true">02</span><div><strong>Kundöversikt</strong><small>Hitta rätt kund och rätt uppgifter.</small></div></li>
            <li><span aria-hidden="true">03</span><div><strong>Trygg åtkomst</strong><small>Personliga konton och tilldelade behörigheter.</small></div></li>
          </ul>
        </section>
        <section className="staff-login-card" aria-labelledby="staff-login-title">
          <div className="staff-login-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>
          </div>
          <p className="eyebrow">Personalinloggning</p>
          <h1 id="staff-login-title">Logga in till kundtjänsten</h1>
          <p className="muted">
            Endast för behörig kundtjänst och Gridex personal. Logga in med
            ditt personliga personalkonto.
          </p>
          {reason === "access_denied" ? (
            <>
              <p className="alert" role="alert">
                Kontot saknar åtkomst till Gridex support. Använd ett behörigt
                personalkonto.
              </p>
              <form action={signOut}>
                <button>Logga ut och byt konto</button>
              </form>
            </>
          ) : (
            <LoginForm action={signIn} />
          )}
        </section>
      </div>
      <footer className="staff-login-footer"><span>Gridex El AB</span><span>Endast för kundtjänst och behörig Gridex personal</span></footer>
    </main>
  );
}
