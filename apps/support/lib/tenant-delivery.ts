import "server-only";
import {
  createHash,
  createPublicKey,
  randomUUID,
  sign,
  verify,
  type JsonWebKey,
} from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  readStaffApiConfig,
  STAFF_SUBJECT_UUID,
  type StaffApiConfig,
} from "../../../lib/staff-api/config";
import { SUPPORT_AUTH_URL } from "./auth-config";

export const SUPPORT_DELIVERY_URL =
  "https://support123.gridex.se/api/internal/staff/invitations/deliver";
type DeliveryPayload = {
  delivery_id: string;
  actor_user_id: string;
  company_id: string;
  api_client_id: string;
  provider_id: string;
  invitation_id: string;
  recipient_email: string;
  full_name: string | null;
  auth_issuer: string;
  callback_url: string;
  request_hash: string;
};
type ReceiptData = {
  request_hash: string;
  company_id: string;
  api_client_id: string;
  provider_id: string;
  invitation_id: string;
  delivery_id: string;
  local_auth_subject: string;
  auth_issuer: string;
  email: string;
  status: "sent";
};
export type TenantDeliveryConfig = {
  staff: StaffApiConfig;
  opsIssuer: string;
  opsKeyId: string;
  opsPublicJwk: JsonWebKey;
  apiClientId: string;
  providerId: string;
  serviceKey: string;
};
type Claim =
  | { outcome: "start"; claim_token: string }
  | { outcome: "complete"; receipt_data: ReceiptData }
  | { outcome: "indeterminate" };
export type TenantDeliveryPorts = {
  claim: (command: {
    delivery_id: string;
    request_hash: string;
    request_fingerprint: string;
    receipt_base: Omit<ReceiptData, "local_auth_subject" | "status">;
  }) => Promise<Claim>;
  deliverAuth: (
    email: string,
    fullName: string | null,
    callback: string,
  ) => Promise<string>;
  complete: (command: {
    delivery_id: string;
    request_hash: string;
    claim_token: string;
    receipt_data: ReceiptData;
  }) => Promise<void>;
};
function fail(): never {
  throw new Error("support_delivery_unavailable");
}
export function readTenantDeliveryConfig(
  environment: NodeJS.ProcessEnv = process.env,
): TenantDeliveryConfig {
  const staff = readStaffApiConfig(environment);
  const value = (name: string) => environment[name]?.trim() ?? "";
  const opsIssuer = value("GRIDEX_SUPPORT_DELIVERY_OPS_ISSUER"),
    opsKeyId = value("GRIDEX_SUPPORT_DELIVERY_OPS_KID");
  const apiClientId = value("GRIDEX_SUPPORT_DELIVERY_API_CLIENT_ID"),
    providerId = value("GRIDEX_SUPPORT_DELIVERY_PROVIDER_ID");
  const serviceKey = value("GRIDEX_SUPPORT_SUPABASE_SERVICE_KEY");
  let opsPublicJwk: JsonWebKey;
  try {
    opsPublicJwk = JSON.parse(value("GRIDEX_SUPPORT_DELIVERY_OPS_PUBLIC_JWK"));
  } catch {
    return fail();
  }
  if (
    !/^https:\/\/[^\s?#]+$/.test(opsIssuer) ||
    !/^[A-Za-z0-9_.-]{1,128}$/.test(opsKeyId) ||
    !STAFF_SUBJECT_UUID.test(apiClientId) ||
    !STAFF_SUBJECT_UUID.test(providerId) ||
    !serviceKey ||
    /\s/.test(serviceKey) ||
    !opsPublicJwk ||
    opsPublicJwk.kty !== "RSA" ||
    opsPublicJwk.kid !== opsKeyId ||
    ["d", "p", "q", "dp", "dq", "qi", "oth"].some(
      (field) => field in opsPublicJwk,
    )
  )
    return fail();
  const key = createPublicKey({ key: opsPublicJwk, format: "jwk" });
  if (
    key.asymmetricKeyType !== "rsa" ||
    (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
  )
    return fail();
  if (!/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(serviceKey)) {
    try {
      const payload = JSON.parse(
        Buffer.from(serviceKey.split(".")[1], "base64url").toString("utf8"),
      );
      if (
        payload.role !== "service_role" ||
        payload.ref !== "ayiuxjlfazkjmmtlvhsl"
      )
        return fail();
    } catch {
      return fail();
    }
  }
  return {
    staff,
    opsIssuer,
    opsKeyId,
    opsPublicJwk,
    apiClientId,
    providerId,
    serviceKey,
  };
}
async function assertionBody(request: Request): Promise<string> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json" ||
    !request.body
  )
    return fail();
  const reader = request.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 32_768) {
        await reader.cancel();
        return fail();
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    assertion?: unknown;
  };
  if (
    !input ||
    Object.keys(input).join(",") !== "assertion" ||
    typeof input.assertion !== "string" ||
    input.assertion.length > 24_576
  )
    return fail();
  return input.assertion;
}
function checkedPayload(
  token: string,
  config: TenantDeliveryConfig,
  request: Request,
): DeliveryPayload {
  const parts = token.split(".");
  if (
    parts.length !== 3 ||
    parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
  )
    return fail();
  const header = JSON.parse(
    Buffer.from(parts[0], "base64url").toString("utf8"),
  );
  if (
    header.alg !== "RS256" ||
    header.typ !== "JWT" ||
    header.kid !== config.opsKeyId ||
    Object.keys(header).sort().join(",") !== "alg,kid,typ" ||
    !verify(
      "RSA-SHA256",
      Buffer.from(parts.slice(0, 2).join(".")),
      createPublicKey({ key: config.opsPublicJwk, format: "jwk" }),
      Buffer.from(parts[2], "base64url"),
    )
  )
    return fail();
  const claims = JSON.parse(
    Buffer.from(parts[1], "base64url").toString("utf8"),
  );
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== config.opsIssuer ||
    claims.aud !== SUPPORT_DELIVERY_URL ||
    claims.token_use !== "staff_invitation_delivery" ||
    !Number.isSafeInteger(claims.iat) ||
    !Number.isSafeInteger(claims.exp) ||
    claims.exp <= now ||
    claims.iat > now + 5 ||
    claims.iat < now - 65 ||
    claims.exp - claims.iat > 60 ||
    claims.exp <= claims.iat ||
    !STAFF_SUBJECT_UUID.test(claims.jti ?? "") ||
    claims.sub !== claims.invitation_id ||
    claims.company_id !== config.staff.companyId ||
    claims.api_client_id !== config.apiClientId ||
    claims.provider_id !== config.providerId ||
    claims.auth_issuer !== `${SUPPORT_AUTH_URL}/auth/v1` ||
    request.headers.get("idempotency-key") !== claims.delivery_id ||
    !/^[a-f0-9]{64}$/.test(claims.request_hash ?? "") ||
    ![claims.delivery_id, claims.actor_user_id, claims.invitation_id].every(
      (value) => typeof value === "string" && STAFF_SUBJECT_UUID.test(value),
    ) ||
    typeof claims.recipient_email !== "string" ||
    claims.recipient_email.length > 320 ||
    claims.recipient_email !== claims.recipient_email.trim().toLowerCase() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.recipient_email) ||
    (claims.full_name !== null &&
      (typeof claims.full_name !== "string" || claims.full_name.length > 300))
  )
    return fail();
  const allowed =
    "actor_user_id,api_client_id,aud,auth_issuer,callback_url,company_id,delivery_id,exp,full_name,iat,invitation_id,iss,jti,provider_id,recipient_email,request_hash,sub,token_use";
  if (Object.keys(claims).sort().join(",") !== allowed) return fail();
  const callback = new URL(claims.callback_url);
  if (
    callback.origin !== new URL(SUPPORT_DELIVERY_URL).origin ||
    callback.pathname !== "/auth/invitation" ||
    callback.hash ||
    [...callback.searchParams.keys()].join(",") !== "token" ||
    !STAFF_SUBJECT_UUID.test(callback.searchParams.get("token") ?? "")
  )
    return fail();
  return {
    delivery_id: claims.delivery_id,
    actor_user_id: claims.actor_user_id,
    company_id: claims.company_id,
    api_client_id: claims.api_client_id,
    provider_id: claims.provider_id,
    invitation_id: claims.invitation_id,
    recipient_email: claims.recipient_email,
    full_name: claims.full_name,
    auth_issuer: claims.auth_issuer,
    callback_url: claims.callback_url,
    request_hash: claims.request_hash,
  };
}
function receiptBase(
  payload: DeliveryPayload,
): Omit<ReceiptData, "local_auth_subject" | "status"> {
  return {
    request_hash: payload.request_hash,
    company_id: payload.company_id,
    api_client_id: payload.api_client_id,
    provider_id: payload.provider_id,
    invitation_id: payload.invitation_id,
    delivery_id: payload.delivery_id,
    auth_issuer: payload.auth_issuer,
    email: payload.recipient_email,
  };
}
function receiptProof(data: ReceiptData, config: TenantDeliveryConfig): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT", kid: config.staff.keyId }),
  ).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      ...data,
      iss: config.staff.issuer,
      aud: config.staff.audience,
      sub: data.local_auth_subject,
      token_use: "staff_invitation_delivery_receipt",
      iat: now,
      exp: now + 60,
      jti: randomUUID(),
    }),
  ).toString("base64url");
  const input = `${header}.${claims}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), config.staff.privateKey).toString("base64url")}`;
}
export function createTenantDeliveryHandler(
  configuration: () => TenantDeliveryConfig,
  makePorts: (config: TenantDeliveryConfig) => TenantDeliveryPorts,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST")
      return Response.json(
        { error: "method_not_allowed" },
        { status: 405, headers: { "Cache-Control": "no-store" } },
      );
    let indeterminate = false;
    try {
      const config = configuration();
      const payload = checkedPayload(
        await assertionBody(request),
        config,
        request,
      );
      const ports = makePorts(config);
      const base = receiptBase(payload);
      const claim = await ports.claim({
        delivery_id: payload.delivery_id,
        request_hash: payload.request_hash,
        request_fingerprint: createHash("sha256")
          .update(JSON.stringify(payload))
          .digest("hex"),
        receipt_base: base,
      });
      if (claim.outcome === "indeterminate") {
        return Response.json(
          { error: "delivery_indeterminate" },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      let data: ReceiptData;
      if (claim.outcome === "complete") {
        data = claim.receipt_data;
        const { local_auth_subject: subject, status, ...storedBase } = data;
        if (
          !STAFF_SUBJECT_UUID.test(subject) ||
          status !== "sent" ||
          Object.keys(storedBase).length !== Object.keys(base).length ||
          !Object.entries(base).every(
            ([field, value]) =>
              storedBase[field as keyof typeof storedBase] === value,
          )
        )
          return fail();
      } else {
        if (!STAFF_SUBJECT_UUID.test(claim.claim_token)) return fail();
        indeterminate = true;
        const localSubject = await ports.deliverAuth(
          payload.recipient_email,
          payload.full_name,
          payload.callback_url,
        );
        if (!STAFF_SUBJECT_UUID.test(localSubject)) return fail();
        data = { ...base, local_auth_subject: localSubject, status: "sent" };
        await ports.complete({
          delivery_id: payload.delivery_id,
          request_hash: payload.request_hash,
          claim_token: claim.claim_token,
          receipt_data: data,
        });
        indeterminate = false;
      }
      return Response.json(
        { receipt: receiptProof(data, config) },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return Response.json(
        {
          error: indeterminate
            ? "delivery_indeterminate"
            : "delivery_unavailable",
        },
        {
          status: indeterminate ? 409 : 403,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
  };
}
export function tenantDeliveryPorts(
  client: SupabaseClient,
): TenantDeliveryPorts {
  return {
    claim: async (command) => {
      const { data, error } = await client.rpc(
        "gridex_support_claim_staff_delivery_v1",
        { p_command: command },
      );
      if (
        error ||
        !data ||
        !["start", "complete", "indeterminate"].includes(data.outcome)
      )
        return fail();
      return data as Claim;
    },
    deliverAuth: async (email, fullName, callback) => {
      const existing = await client.rpc(
        "gridex_support_existing_invitation_subject_v1",
        { p_email: email },
      );
      if (existing.error) return fail();
      if (existing.data) {
        const checked = await client.auth.admin.getUserById(existing.data);
        if (
          checked.error ||
          checked.data.user?.id !== existing.data ||
          checked.data.user.email?.trim().toLowerCase() !== email
        )
          return fail();
        const otp = await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: callback, shouldCreateUser: false },
        });
        if (otp.error) return fail();
        return checked.data.user.id;
      }
      const invited = await client.auth.admin.inviteUserByEmail(email, {
        redirectTo: callback,
        data: { full_name: fullName },
      });
      if (
        invited.error ||
        !invited.data.user ||
        invited.data.user.email?.trim().toLowerCase() !== email
      )
        return fail();
      return invited.data.user.id;
    },
    complete: async (command) => {
      const { data, error } = await client.rpc(
        "gridex_support_complete_staff_delivery_v1",
        { p_command: command },
      );
      if (error || data !== true) return fail();
    },
  };
}
export const deliverTenantStaffInvitation = createTenantDeliveryHandler(
  readTenantDeliveryConfig,
  (config) =>
    tenantDeliveryPorts(
      createClient(SUPPORT_AUTH_URL, config.serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }),
    ),
);
