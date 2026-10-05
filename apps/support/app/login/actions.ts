"use server";
import { redirect } from "next/navigation";
import {
  createSupportAuthClient,
  requireSupportSession,
} from "@/support/lib/session";
import { StaffApiError } from "@/staff-api/client";
import type { FormState } from "@/support/components/ActionForm";

export async function signIn(
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const email = String(data.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(data.get("password") ?? "");
  if (!email || !password || email.length > 320 || password.length > 1024)
    return { error: "Ange e-post och lösenord." };
  const auth = await createSupportAuthClient();
  let result;
  try {
    result = await auth.auth.signInWithPassword({ email, password });
  } catch {
    return { error: "Inloggningen kunde inte slutföras. Försök igen senare." };
  }
  if (result.error || !result.data.user)
    return {
      error: "Inloggningen misslyckades. Kontrollera e-post och lösenord.",
    };
  if (result.data.user.user_metadata?.must_change_password === true)
    redirect("/login/update-password");
  // API membership and RBAC, rather than the Auth credential alone, admit access.
  try {
    await requireSupportSession();
  } catch (error) {
    if (error instanceof StaffApiError) return { error: error.message };
    throw error;
  }
  redirect("/");
}
export async function signOut(): Promise<void> {
  const auth = await createSupportAuthClient();
  await auth.auth.signOut({ scope: "local" });
  redirect("/login");
}
export async function updatePassword(
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const password = String(data.get("password") ?? "");
  if (password.length < 12 || password.length > 1024)
    return { error: "Lösenordet ska vara minst 12 tecken." };
  if (password !== String(data.get("confirm") ?? ""))
    return { error: "Lösenorden måste vara lika." };
  const auth = await createSupportAuthClient();
  const verified = await auth.auth.getUser();
  if (verified.error || !verified.data.user) redirect("/login");
  const result = await auth.auth.updateUser({
    password,
    data: {
      must_change_password: false,
      password_changed_at: new Date().toISOString(),
    },
  });
  if (result.error)
    return { error: "Lösenordet kunde inte uppdateras. Försök igen." };
  redirect("/");
}
