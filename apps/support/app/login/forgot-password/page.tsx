import Image from "next/image";
import Link from "next/link";
import ActionForm from "@/support/components/ActionForm";
import { requestPasswordRecovery } from "../actions";

export default function ForgotPassword() {
  return (
    <main className="staff-login">
      <section className="staff-login-card" aria-labelledby="recovery-title">
        <Image src="/brand/gridex-logo.svg" alt="Gridex" width={160} height={46} priority />
        <h1 id="recovery-title">Återställ lösenord</h1>
        <ActionForm action={requestPasswordRecovery} submit="Skicka länk" idempotencyKey="password-recovery">
          <label htmlFor="recovery-email">E-post</label>
          <input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={320} spellCheck={false} />
        </ActionForm>
        <Link href="/login">Till inloggningen</Link>
      </section>
    </main>
  );
}
