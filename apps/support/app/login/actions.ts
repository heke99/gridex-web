"use server";
import { redirect } from "next/navigation";
import {
  createSupportAuthClient,
  requireSupportSession,
  SupportAuthError,
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
  let result;
  try {
    const auth = await createSupportAuthClient();
    result = await auth.auth.signInWithPassword({ email, password });
  } catch {
    return { error: "Inloggningen kunde inte slutföras. Försök igen senare." };
  }
  if (result.error?.status === 429)
    return { error: "För många inloggningsförsök. Vänta en stund och försök igen." };
  if (result.error && result.error.status !== undefined && result.error.status >= 500)
    return { error: "Inloggningen kunde inte slutföras. Försök igen senare." };
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
    if (error instanceof StaffApiError || error instanceof SupportAuthError) return { error: error.message };
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
  let auth, verified;
  try {
    auth = await createSupportAuthClient();
    verified = await auth.auth.getUser();
  } catch {
    return { error: "Lösenordet kunde inte uppdateras. Försök igen senare." };
  }
  if (verified.error && verified.error.status !== 401 && verified.error.status !== 403
    && verified.error.name !== "AuthSessionMissingError")
    return { error: "Lösenordet kunde inte uppdateras. Försök igen senare." };
  if (verified.error || !verified.data.user) redirect("/login");
  let result;
  try {
    result = await auth.auth.updateUser({
      password,
      data: {
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
      },
    });
  } catch {
    return { error: "Lösenordet kunde inte uppdateras. Försök igen senare." };
  }
  if (result.error)
    return { error: "Lösenordet kunde inte uppdateras. Försök igen." };
  redirect("/");
}
