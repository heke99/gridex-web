import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createSupportAuthClient } from "@/support/lib/session";
import ActionForm from "@/support/components/ActionForm";
import { updatePassword, signOut } from "../actions";
export default async function Password() {
  const auth = await createSupportAuthClient();
  const verified = await auth.auth.getUser();
  if (verified.error || !verified.data.user) redirect("/login");
  return (
    <main className="login-wrap">
      <div className="login">
        <section className="panel">
          <h1>Välj ditt lösenord</h1>
          <p className="muted">
            Ditt konto behöver ett personligt lösenord innan du fortsätter.
          </p>
          <ActionForm
            action={updatePassword}
            idempotencyKey={randomUUID()}
            submit="Spara lösenord"
          >
            <label>
              Nytt lösenord
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={1024}
              />
            </label>
            <label>
              Bekräfta lösenord
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={1024}
              />
            </label>
          </ActionForm>
          <form action={signOut} className="actions">
            <button>Logga ut</button>
          </form>
        </section>
      </div>
    </main>
  );
}
