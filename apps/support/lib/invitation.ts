import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GRIDEX_PROD_PROJECT_REF,
  readStaffApiConfig,
  STAFF_SUBJECT_UUID,
  validateStaffApiConfig,
  type StaffApiConfig,
} from "../../../lib/staff-api/config";
import { signStaffAssertion } from "../../../lib/staff-api/assertion";
import type { FormState } from "../components/ActionForm";
import { createSupportAuthClient } from "./session";

export type InvitationDependencies = {
  authClient: () => Promise<SupabaseClient>;
  config?: StaffApiConfig;
  fetchImpl?: typeof fetch;
};
const ONBOARDING_ENDPOINT =
  "https://app.gridex.se/api/v1/staff-onboarding/invitations/accept";
const ONBOARDING_VERSION = "2026-10-05.1";
const FAILURE =
  "Inbjudan kunde inte accepteras. Öppna din senaste inbjudningslänk eller kontakta bolagsadministratören.";

function verifiedUser(
  user: { id?: string; email?: string; email_confirmed_at?: string } | null,
): user is { id: string; email: string; email_confirmed_at: string } {
  return (
    !!user &&
    typeof user.id === "string" &&
    STAFF_SUBJECT_UUID.test(user.id) &&
    typeof user.email === "string" &&
    typeof user.email_confirmed_at === "string" &&
    Number.isFinite(Date.parse(user.email_confirmed_at))
  );
}
async function boundedJson(response: Response): Promise<unknown> {
  if (
    !response.body ||
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json") ||
    Number(response.headers.get("content-length") ?? "0") > 16_384
  )
    throw new Error("Invalid onboarding response");
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16_384) {
        await reader.cancel();
        throw new Error("Invalid onboarding response");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** All account and membership effects occur on explicit Server Action POST only. */
export async function submitSupportInvitation(
  data: FormData,
  dependencies: InvitationDependencies = {
    authClient: createSupportAuthClient,
  },
): Promise<FormState> {
  const value = (key: string) => String(data.get(key) ?? "");
  const token = value("invitation_token"),
    key = value("idempotency_key"),
    password = value("password");
  const code = value("code"),
    hash = value("token_hash"),
    type = value("type"),
    access = value("access_token"),
    refresh = value("refresh_token");
  if (
    !STAFF_SUBJECT_UUID.test(token) ||
    !/^[A-Za-z0-9._:+~-]{8,200}$/.test(key) ||
    password.length < 12 ||
    password.length > 1024 ||
    password !== value("confirm")
  )
    return { error: FAILURE };
  const modes = Number(!!code) + Number(!!hash) + Number(!!access || !!refresh);
  if (
    modes > 1 ||
    (code && !/^[A-Za-z0-9._~-]{1,512}$/.test(code)) ||
    (hash &&
      (!/^[A-Za-z0-9._~-]{8,16384}$/.test(hash) ||
        !["invite", "magiclink"].includes(type))) ||
    ((access || refresh) &&
      (!access ||
        !refresh ||
        /\s/.test(access + refresh) ||
        access.length > 16_384 ||
        refresh.length > 16_384))
  )
    return { error: FAILURE };
  try {
    // Configuration validation precedes even Auth/session/password effects.
    const config = validateStaffApiConfig(
      dependencies.config ?? readStaffApiConfig(),
    );
    const auth = await dependencies.authClient();
    if (access) {
      const checked = await auth.auth.getUser(access);
      if (checked.error || !verifiedUser(checked.data.user))
        return { error: FAILURE };
      const established = await auth.auth.setSession({
        access_token: access,
        refresh_token: refresh,
      });
      if (established.error) return { error: FAILURE };
    } else if (code) {
      if ((await auth.auth.exchangeCodeForSession(code)).error)
        return { error: FAILURE };
    } else if (hash) {
      if (
        (
          await auth.auth.verifyOtp({
            token_hash: hash,
            type: type as "invite" | "magiclink",
          })
        ).error
      )
        return { error: FAILURE };
    }
    // getSession supplies only the token transport; getUser verifies its identity.
    const session = await auth.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (session.error || !accessToken) return { error: FAILURE };
    const verified = await auth.auth.getUser(accessToken);
    if (verified.error || !verifiedUser(verified.data.user))
      return { error: FAILURE };
    // First-password completion precedes the canonical membership grant. This
    // writes only the authenticated person's account in the fixed Prod Auth.
    const updated = await auth.auth.updateUser({
      password,
      data: {
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
      },
    });
    if (updated.error) return { error: "Lösenordet kunde inte sparas. Försök igen." };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await (dependencies.fetchImpl ?? fetch)(
        ONBOARDING_ENDPOINT,
        {
          method: "POST",
          redirect: "error",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": key,
            "X-Gridex-Expected-Project-Ref": GRIDEX_PROD_PROJECT_REF,
            "X-Gridex-Staff-Assertion": signStaffAssertion(
              config,
              verified.data.user.id,
            ),
            "X-Gridex-Support-Auth-Token": accessToken,
          },
          body: JSON.stringify({ invitation_token: token }),
        },
      );
      if (
        response.status !== 200 ||
        response.headers.get("x-gridex-project-ref") !== GRIDEX_PROD_PROJECT_REF
      )
        return { error: FAILURE };
      const payload = (await boundedJson(response)) as {
        data?: { status?: unknown };
        request_id?: unknown;
        contract_schema_version?: unknown;
      };
      if (
        !payload ||
        typeof payload !== "object" ||
        Object.keys(payload).sort().join(",") !==
          "contract_schema_version,data,request_id" ||
        payload.contract_schema_version !== ONBOARDING_VERSION ||
        typeof payload.request_id !== "string" ||
        !payload.request_id ||
        !payload.data ||
        Object.keys(payload.data).join(",") !== "status" ||
        payload.data.status !== "accepted"
      )
        return { error: FAILURE };
    } finally {
      clearTimeout(timeout);
    }
    return { success: "Inbjudan har accepterats." };
  } catch {
    return { error: FAILURE };
  }
}
