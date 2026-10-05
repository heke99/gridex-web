import { randomUUID } from "node:crypto";
import ActionForm from "@/support/components/ActionForm";
import { signIn, signOut } from "./actions";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <main className="login-wrap">
      <div className="login">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <span>
            Gridex Support<small>Arbetsyta för kundtjänst</small>
          </span>
        </div>
        <section className="panel">
          <p className="eyebrow">Personalinloggning</p>
          <h1>Logga in till kundtjänsten</h1>
          <p className="muted">
            Hantera Gridex kundärenden, kunder och uppföljning med ditt
            personliga konto.
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
            <div style={{ marginTop: 25 }}>
              <ActionForm
                action={signIn}
                submit="Logga in"
                idempotencyKey={randomUUID()}
              >
                <label>
                  E-post
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    maxLength={320}
                  />
                </label>
                <label>
                  Lösenord
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={1024}
                  />
                </label>
              </ActionForm>
            </div>
          )}
          <p className="small muted" style={{ marginTop: 22 }}>
            Kontakta din bolagsadministratör om du behöver ett konto eller hjälp
            med inloggningen.
          </p>
        </section>
        <p className="login-footer">
          Gridex egen support · Endast behörig personal
        </p>
      </div>
    </main>
  );
}
