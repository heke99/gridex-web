"use client";
import { useActionState, useEffect, useReducer, useRef } from "react";
import Link from "next/link";
import type { FormAction } from "./ActionForm";

export default function PasswordRecoveryForm({ action }: { action: FormAction }) {
  const [revision, replaceLink] = useReducer((value: number) => value + 1, 0);
  useEffect(() => {
    // A second email link can replace only the fragment in an existing tab.
    // Give it fresh form state even if the previous link was rejected.
    const onHashChange = () => replaceLink();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return <RecoveryLinkForm key={revision} action={action} />;
}

function RecoveryLinkForm({ action }: { action: FormAction }) {
  const [state, dispatch, pending] = useActionState(action, {});
  const codeInput = useRef<HTMLInputElement>(null);
  const accessInput = useRef<HTMLInputElement>(null);
  const refreshInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const clean = new URL(window.location.href);
    const code = clean.searchParams.get("code") ?? "";
    if (code && codeInput.current) codeInput.current.value = code;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const access = fragment.get("access_token") ?? "", refresh = fragment.get("refresh_token") ?? "";
    // Keep an already captured fragment when Strict Mode re-runs the effect
    // after history.replaceState has removed it from the address bar.
    if (access || refresh) {
      if (codeInput.current) codeInput.current.value = code;
      if (accessInput.current) { accessInput.current.value = access; accessInput.current.disabled = false; }
      if (refreshInput.current) { refreshInput.current.value = refresh; refreshInput.current.disabled = false; }
    }
    clean.hash = "";
    clean.searchParams.delete("code");
    clean.searchParams.delete("token_hash");
    clean.searchParams.delete("type");
    window.history.replaceState(null, "", clean.pathname + clean.search);
  }, []);
  return (
    <form action={dispatch} className="stack" aria-busy={pending}>
      <input type="hidden" name="code" ref={codeInput} defaultValue="" />
      <input type="hidden" name="access_token" ref={accessInput} defaultValue="" disabled />
      <input type="hidden" name="refresh_token" ref={refreshInput} defaultValue="" disabled />
      {state.error ? <p className="alert" role="alert">{state.error}</p> : null}
      {!state.error ? (
        <button className="primary" type="submit" disabled={pending}>
          {pending ? "Kontrollerar…" : "Fortsätt och välj lösenord"}
        </button>
      ) : (
        <>
          <Link href="/login/forgot-password">Begär en ny länk</Link>
        </>
      )}
    </form>
  );
}
