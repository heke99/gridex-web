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
      <section className="staff-login-card" aria-labelledby="staff-login-title">
        <Image src="/brand/gridex-logo.svg" alt="Gridex" width={160} height={46} priority />
        <h1 id="staff-login-title">Logga in</h1>
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
    </main>
  );
}
