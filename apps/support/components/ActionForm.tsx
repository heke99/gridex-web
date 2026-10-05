"use client";
import { useActionState } from "react";
import type { ReactNode } from "react";
export type FormState = { error?: string; success?: string };
export type FormAction = (
  previous: FormState,
  data: FormData,
) => Promise<FormState>;
export default function ActionForm({
  action,
  children,
  submit = "Spara",
  idempotencyKey,
}: {
  action: FormAction;
  children?: ReactNode;
  submit?: string;
  idempotencyKey: string;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  return (
    <form action={dispatch} className="stack">
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      {children}
      {state.error ? (
        <p role="alert" className="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="alert success">
          {state.success}
        </p>
      ) : null}
      <button type="submit" className="primary" disabled={pending}>
        {pending ? "Sparar…" : submit}
      </button>
    </form>
  );
}
