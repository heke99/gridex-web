"use client";
import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import type { FormAction } from "./ActionForm";

export default function PasswordRecoveryForm({ action, code }: { action: FormAction; code: string }) {
  const [state, dispatch, pending] = useActionState(action, {});
  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (codeInput.current) codeInput.current.value = code;
    const clean = new URL(window.location.href);
    clean.hash = "";
    clean.searchParams.delete("code");
    clean.searchParams.delete("token_hash");
    clean.searchParams.delete("type");
    window.history.replaceState(null, "", clean.pathname + clean.search);
  }, [code]);
  return (
    <form action={dispatch} className="stack" aria-busy={pending}>
      <input type="hidden" name="code" ref={codeInput} defaultValue="" />
      {state.error ? <p className="alert" role="alert">{state.error}</p> : null}
      {code && !state.error ? (
        <button className="primary" type="submit" disabled={pending}>
          {pending ? "Kontrollerar…" : "Fortsätt och välj lösenord"}
        </button>
      ) : (
        <>
          {!state.error ? <p className="alert" role="alert">Länken är ogiltig eller har gått ut.</p> : null}
          <Link href="/login/forgot-password">Begär en ny länk</Link>
        </>
      )}
    </form>
  );
}
