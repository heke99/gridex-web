import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, randomUUID, sign, verify } from "node:crypto";
import {
  createTenantDeliveryHandler,
  readTenantDeliveryConfig,
  tenantDeliveryPorts,
  SUPPORT_DELIVERY_URL,
} from "../apps/support/lib/tenant-delivery.ts";

const tenant = generateKeyPairSync("rsa", { modulusLength: 2048 }),
  ops = generateKeyPairSync("rsa", { modulusLength: 2048 });
const company = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  client = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  provider = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const invitation = "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  delivery = "55555555-5555-4555-8555-555555555555";
const actor = "99999999-9999-4999-8999-999999999999",
  local = "11111111-1111-4111-8111-111111111111";
const config = {
  staff: {
    apiKey: "synthetic-staff-api-key-12345",
    companyId: company,
    issuer: "https://support123.gridex.se",
    audience: "tenant-staff",
    keyId: "tenant-key",
    privateKey: tenant.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString(),
    timeoutMs: 1000,
    opsProjectRef: "piidsfebjqjmnepdpnas",
  },
  opsIssuer: "https://app.gridex.se",
  opsKeyId: "ops-key",
  opsPublicJwk: { ...ops.publicKey.export({ format: "jwk" }), kid: "ops-key" },
  apiClientId: client,
  providerId: provider,
  serviceKey: "synthetic-only",
};
const payload = {
  delivery_id: delivery,
  actor_user_id: actor,
  company_id: company,
  api_client_id: client,
  provider_id: provider,
  invitation_id: invitation,
  recipient_email: "staff@example.invalid",
  full_name: "Staff",
  auth_issuer: "https://ayiuxjlfazkjmmtlvhsl.supabase.co/auth/v1",
  callback_url:
    "https://support123.gridex.se/auth/invitation?token=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  request_hash: "a".repeat(64),
};
function request(changes = {}, signer = ops.privateKey, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    ...payload,
    iss: config.opsIssuer,
    aud: SUPPORT_DELIVERY_URL,
    sub: invitation,
    token_use: "staff_invitation_delivery",
    iat: now,
    exp: now + 60,
    jti: randomUUID(),
    ...changes,
  };
  const parts = [
    Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT", kid: "ops-key" }),
    ).toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
  ];
  const token = [
    ...parts,
    sign("RSA-SHA256", Buffer.from(parts.join(".")), signer).toString(
      "base64url",
    ),
  ].join(".");
  return new Request(SUPPORT_DELIVERY_URL, {
    method: options.method ?? "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": delivery,
      ...options.headers,
    },
    ...(options.method === "GET"
      ? {}
      : { body: JSON.stringify({ assertion: token, ...options.body }) }),
  });
}
function boundary(overrides = {}) {
  const ledger = new Map(),
    calls = [];
  const ports = {
    claim: async (command) => {
      calls.push("claim");
      const previous = ledger.get(command.delivery_id);
      if (previous) {
        if (JSON.stringify(previous.command) !== JSON.stringify(command))
          throw Error("conflict");
        return previous.receipt
          ? { outcome: "complete", receipt_data: previous.receipt }
          : { outcome: "indeterminate" };
      }
      const claim = randomUUID();
      ledger.set(command.delivery_id, { command, claim });
      return { outcome: "start", claim_token: claim };
    },
    deliverAuth: async (email, fullName, callback) => {
      calls.push(["tenant_auth_email", email, fullName, callback]);
      return local;
    },
    complete: async (command) => {
      calls.push("complete");
      ledger.get(command.delivery_id).receipt = command.receipt_data;
    },
    ...overrides,
  };
  let created = 0;
  const handler = createTenantDeliveryHandler(
    () => config,
    () => {
      created++;
      return ports;
    },
  );
  return { handler, calls, ledger, created: () => created };
}
test("server registration requires the exact OPS public JWK kid before local service construction", () => {
  const environment = {
    GRIDEX_STAFF_API_KEY: config.staff.apiKey,
    GRIDEX_STAFF_COMPANY_ID: company,
    GRIDEX_STAFF_API_PROJECT_REF: config.staff.opsProjectRef,
    GRIDEX_STAFF_ASSERTION_ISSUER: config.staff.issuer,
    GRIDEX_STAFF_ASSERTION_AUDIENCE: config.staff.audience,
    GRIDEX_STAFF_ASSERTION_KID: config.staff.keyId,
    GRIDEX_STAFF_ASSERTION_PRIVATE_KEY: config.staff.privateKey,
    GRIDEX_SUPPORT_DELIVERY_OPS_ISSUER: config.opsIssuer,
    GRIDEX_SUPPORT_DELIVERY_OPS_KID: config.opsKeyId,
    GRIDEX_SUPPORT_DELIVERY_OPS_PUBLIC_JWK: JSON.stringify(config.opsPublicJwk),
    GRIDEX_SUPPORT_DELIVERY_API_CLIENT_ID: client,
    GRIDEX_SUPPORT_DELIVERY_PROVIDER_ID: provider,
    GRIDEX_SUPPORT_SUPABASE_SERVICE_KEY: [
      Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
        "base64url",
      ),
      Buffer.from(
        JSON.stringify({ role: "service_role", ref: "ayiuxjlfazkjmmtlvhsl" }),
      ).toString("base64url"),
      "unsigned-test-fixture",
    ].join("."),
  };
  assert.deepEqual(
    readTenantDeliveryConfig(environment).opsPublicJwk,
    config.opsPublicJwk,
  );
  for (const kid of [undefined, "foreign-key"]) {
    assert.throws(
      () =>
        readTenantDeliveryConfig({
          ...environment,
          GRIDEX_SUPPORT_DELIVERY_OPS_PUBLIC_JWK: JSON.stringify({
            ...config.opsPublicJwk,
            kid,
          }),
        }),
      { message: "support_delivery_unavailable" },
    );
  }
});
test("registered OPS signature delivers only tenant Auth and returns actual signed tenant receipt bound to distinct actor/local IDs", async () => {
  const { handler, calls } = boundary();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    "claim",
    [
      "tenant_auth_email",
      payload.recipient_email,
      payload.full_name,
      payload.callback_url,
    ],
    "complete",
  ]);
  const jwt = (await response.json()).receipt.split(".");
  assert.equal(
    verify(
      "RSA-SHA256",
      Buffer.from(jwt.slice(0, 2).join(".")),
      tenant.publicKey,
      Buffer.from(jwt[2], "base64url"),
    ),
    true,
  );
  const claims = JSON.parse(Buffer.from(jwt[1], "base64url"));
  assert.equal(claims.sub, local);
  assert.equal(claims.local_auth_subject, local);
  assert.notEqual(claims.sub, actor);
  assert.equal(claims.request_hash, payload.request_hash);
  assert.equal(claims.token_use, "staff_invitation_delivery_receipt");
  assert.equal(claims.status, "sent");
  assert.equal(claims.exp - claims.iat, 60);
  assert.equal("actor_user_id" in claims, false);
  assert.equal("callback_url" in claims, false);
});
test("durable completed retry returns fresh signed receipt without another account/email, independent of jsonb key order", async () => {
  const { handler, calls, ledger } = boundary();
  const first = await (await handler(request())).json();
  const stored = ledger.get(delivery);
  stored.receipt = Object.fromEntries(Object.entries(stored.receipt).reverse());
  const second = await (await handler(request())).json();
  assert.notEqual(first.receipt, second.receipt);
  assert.equal(calls.filter((call) => Array.isArray(call)).length, 1);
  assert.equal(calls.filter((call) => call === "complete").length, 1);
});
test("forged/foreign/expired/purpose-mismatched proofs, browser callback and extra fields stop before database/Auth construction", async () => {
  const wrongKey = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).privateKey;
  for (const [changes, signer, options] of [
    [{}, wrongKey, {}],
    [{ company_id: randomUUID() }, ops.privateKey, {}],
    [{ api_client_id: randomUUID() }, ops.privateKey, {}],
    [{ provider_id: randomUUID() }, ops.privateKey, {}],
    [
      { auth_issuer: "https://foreign.supabase.co/auth/v1" },
      ops.privateKey,
      {},
    ],
    [{ iss: "https://foreign.invalid" }, ops.privateKey, {}],
    [{ aud: "foreign" }, ops.privateKey, {}],
    [{ token_use: "staff_identity_resolution" }, ops.privateKey, {}],
    [{ exp: 1 }, ops.privateKey, {}],
    [{ exp: Math.floor(Date.now() / 1000) + 600 }, ops.privateKey, {}],
    [
      {
        callback_url:
          "https://app.gridex.se/auth/invitation?token=" + invitation,
      },
      ops.privateKey,
      {},
    ],
    [{ role_key: "super_admin" }, ops.privateKey, {}],
    [{}, ops.privateKey, { headers: { "idempotency-key": randomUUID() } }],
    [{}, ops.privateKey, { body: { user_id: actor } }],
  ]) {
    const { handler, calls, created } = boundary();
    assert.equal(
      (await handler(request(changes, signer, options))).status,
      403,
    );
    assert.equal(created(), 0);
    assert.deepEqual(calls, []);
  }
  const b = boundary();
  assert.equal(
    (await b.handler(request({}, ops.privateKey, { method: "GET" }))).status,
    405,
  );
  assert.equal(b.created(), 0);
});
test("same durable delivery with changed callback/name fingerprint refuses reuse before a second email", async () => {
  const { handler, calls } = boundary();
  assert.equal((await handler(request())).status, 200);
  assert.equal((await handler(request({ full_name: "Changed" }))).status, 403);
  assert.equal(calls.filter((call) => Array.isArray(call)).length, 1);
});
test("provider or completion failure leaves indeterminate delivery and never automatically resends", async () => {
  for (const overrides of [
    {
      deliverAuth: async () => {
        throw Error("provider unknown");
      },
    },
    {
      complete: async () => {
        throw Error("database unknown");
      },
    },
  ]) {
    let attempts = 0;
    const b = boundary({
      ...overrides,
      deliverAuth: async (...args) => {
        attempts++;
        if (overrides.deliverAuth) return overrides.deliverAuth(...args);
        return local;
      },
    });
    assert.equal((await b.handler(request())).status, 409);
    assert.equal((await b.handler(request())).status, 409);
    assert.equal(attempts, 1);
  }
});
test("concurrent calls own one durable claim and perform one provider send", async () => {
  const { handler, calls } = boundary();
  const statuses = await Promise.all([handler(request()), handler(request())]);
  assert.deepEqual(statuses.map((x) => x.status).sort(), [200, 409]);
  assert.equal(calls.filter((call) => Array.isArray(call)).length, 1);
});
test("real local Auth ports create only local invite or OTP, preserve shouldCreateUser false, and never rotate another password", async () => {
  for (const existing of [null, local]) {
    const calls = [];
    const client = {
      rpc: async (name, args) => {
        calls.push([name, args]);
        return { data: existing, error: null };
      },
      auth: {
        admin: {
          getUserById: async (id) => ({
            data: { user: { id, email: payload.recipient_email } },
            error: null,
          }),
          inviteUserByEmail: async (email, options) => {
            calls.push(["invite", email, options]);
            return { data: { user: { id: local, email } }, error: null };
          },
        },
        signInWithOtp: async (input) => {
          calls.push(["otp", input]);
          return { error: null };
        },
      },
    };
    assert.equal(
      await tenantDeliveryPorts(client).deliverAuth(
        payload.recipient_email,
        payload.full_name,
        payload.callback_url,
      ),
      local,
    );
    if (existing)
      assert.deepEqual(calls[1], [
        "otp",
        {
          email: payload.recipient_email,
          options: {
            emailRedirectTo: payload.callback_url,
            shouldCreateUser: false,
          },
        },
      ]);
    else
      assert.deepEqual(calls[1], [
        "invite",
        payload.recipient_email,
        {
          redirectTo: payload.callback_url,
          data: { full_name: payload.full_name },
        },
      ]);
  }
});
