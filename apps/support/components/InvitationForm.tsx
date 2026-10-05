"use client";
import { useActionState, useEffect, useRef } from "react";
import type { FormAction } from "./ActionForm";

/** Default Auth email fragments are captured locally; only explicit submit sends them. */
export default function InvitationForm({
  action,
  token,
  code,
  tokenHash,
  type,
  idempotencyKey,
}: {
  action: FormAction;
  token: string;
  code: string;
  tokenHash: string;
  type: string;
  idempotencyKey: string;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const accessInput = useRef<HTMLInputElement>(null);
  const refreshInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const hashInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // External URL credentials live only in these uncontrolled hidden fields.
    // React's successful action reset clears them. An established host-only
    // Auth session can then retry without consuming the email credential twice.
    if (codeInput.current) codeInput.current.value = code;
    if (hashInput.current) hashInput.current.value = tokenHash;
    const values = new URLSearchParams(window.location.hash.slice(1));
    const access = values.get("access_token") ?? "",
      refresh = values.get("refresh_token") ?? "";
    const clean = new URL(window.location.href);
    clean.hash = "";
    clean.searchParams.delete("code");
    clean.searchParams.delete("token_hash");
    clean.searchParams.delete("type");
    window.history.replaceState(null, "", clean.pathname + clean.search);
    if (access && refresh) {
      if (accessInput.current) accessInput.current.value = access;
      if (refreshInput.current) refreshInput.current.value = refresh;
    }
  }, [code, tokenHash]);
  return (
    <form action={dispatch} className="stack">
      <input type="hidden" name="invitation_token" value={token} />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <input type="hidden" name="code" ref={codeInput} defaultValue="" />
      <input type="hidden" name="token_hash" ref={hashInput} defaultValue="" />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="access_token" ref={accessInput} defaultValue="" />
      <input type="hidden" name="refresh_token" ref={refreshInput} defaultValue="" />
      <label>
        Nytt lösenord
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={1024}
          required
        />
      </label>
      <label>
        Bekräfta lösenord
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={1024}
          required
        />
      </label>
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? "Accepterar…" : "Välj lösenord och acceptera inbjudan"}
      </button>
    </form>
  );
}
