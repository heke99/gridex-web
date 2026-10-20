"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormAction } from "./ActionForm";

export default function LoginForm({ action }: { action: FormAction }) {
  const [state, dispatch, pending] = useActionState(action, {});
  const [visible, setVisible] = useState(false);
  return (
    <form action={dispatch} className="staff-login-form" aria-busy={pending}>
      <label htmlFor="staff-email">E-post</label>
      <input id="staff-email" name="email" type="email" autoComplete="username"
        placeholder="namn@gridex.se" required maxLength={320} spellCheck={false} />
      <label htmlFor="staff-password">Lösenord</label>
      <div className="staff-password">
        <input id="staff-password" name="password" type={visible ? "text" : "password"}
          autoComplete="current-password" required maxLength={1024} />
        <button type="button" aria-label={visible ? "Dölj lösenord" : "Visa lösenord"}
          aria-pressed={visible} aria-controls="staff-password" onClick={() => setVisible(value => !value)}>
          {visible ? "Dölj" : "Visa"}
        </button>
      </div>
      {state.error ? <p className="alert" role="alert">{state.error}</p> : null}
      <button type="submit" className="primary staff-login-submit" disabled={pending}>
        {pending ? "Loggar in…" : "Logga in"}
      </button>
      <Link href="/login/forgot-password">Glömt lösenord?</Link>
    </form>
  );
}
