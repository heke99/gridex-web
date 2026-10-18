import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormState } from "../components/ActionForm";

type RecoveryAuth = Pick<SupabaseClient["auth"],
  "resetPasswordForEmail" | "exchangeCodeForSession" | "getUser" | "signOut">;
type RecoveryDependencies = {
  authClient: () => Promise<{ auth: RecoveryAuth }>;
  redirect: (path: string) => never;
};

// This callback is already allowed in the dedicated project's Auth settings.
const callback = "https://support123.gridex.se/auth/invitation?flow=password-recovery";
const sent = { success: "Om kontot finns får du en länk via e-post. Öppna länken i samma webbläsare." };
const unavailable = { error: "Länken kunde inte skickas. Försök igen senare." };
const invalid = { error: "Länken är ogiltig eller har gått ut. Begär en ny länk i samma webbläsare." };

export async function requestSupportPasswordRecovery(
  data: FormData,
  deps: Pick<RecoveryDependencies, "authClient">,
): Promise<FormState> {
  const value = data.get("email");
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Ange en giltig e-postadress." };
  try {
    const client = await deps.authClient();
    const result = await client.auth.resetPasswordForEmail(email, { redirectTo: callback });
    if (result.error?.status === 429)
      return { error: "För många försök. Vänta en stund innan du begär en ny länk." };
    if (result.error && !(result.error.status && result.error.status >= 400 && result.error.status < 500))
      return unavailable;
    // Avoid revealing whether an address belongs to a staff account.
    return sent;
  } catch {
    return unavailable;
  }
}

export async function acceptSupportPasswordRecovery(
  data: FormData,
  deps: RecoveryDependencies,
): Promise<FormState> {
  const value = data.get("code");
  if (typeof value !== "string" || !value.trim() || value.length > 16_384 || /\s/.test(value))
    return invalid;
  let client: { auth: RecoveryAuth } | undefined;
  let verified = false;
  try {
    client = await deps.authClient();
    const exchanged = await client.auth.exchangeCodeForSession(value);
    if (!exchanged.error && exchanged.data.session && exchanged.data.user
      && "redirectType" in exchanged.data && exchanged.data.redirectType === "PASSWORD_RECOVERY"
      && exchanged.data.session.user.id === exchanged.data.user.id) {
      const current = await client.auth.getUser();
      verified = !current.error && current.data.user?.id === exchanged.data.user.id;
    }
  } catch {
    // Provider errors and token material are never returned to the browser.
  }
  if (!verified) {
    if (client) {
      try { await client.auth.signOut({ scope: "local" }); } catch { /* Remain denied. */ }
    }
    return invalid;
  }
  deps.redirect("/login/update-password");
}
