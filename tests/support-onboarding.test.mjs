import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, verify } from "node:crypto";
import { submitSupportInvitation } from "../apps/support/lib/invitation.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const token = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const opsProject = "piidsfebjqjmnepdpnas";
const tenantProject = "ayiuxjlfazkjmmtlvhsl";
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const config = {
  apiKey: "synthetic-onboarding-api-key-123456",
  companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  issuer: "https://support123.gridex.se",
  audience: "staff-audience",
  keyId: "staff-key",
  privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  timeoutMs: 1000,
  opsProjectRef: opsProject,
};
const user = {
  id: userId,
  email: "staff@example.invalid",
  email_confirmed_at: "2026-10-01T00:00:00Z",
};
function form(extra = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    invitation_token: token,
    idempotency_key: "accept-stable-1",
    password: "FixtureSecurePassword!234",
    confirm: "FixtureSecurePassword!234",
    ...extra,
  }))
    data.set(key, value);
  return data;
}
function boundary(changes = {}) {
  const calls = [],
    requests = [];
  const auth = {
    getUser: async (access) => {
      calls.push(["verified_prod_auth", access]);
      return { data: { user }, error: null };
    },
    getSession: async () => {
      calls.push(["session_token_only"]);
      return {
        data: { session: { access_token: "synthetic-verified-access-token" } },
        error: null,
      };
    },
    verifyOtp: async (input) => {
      calls.push(["explicit_verify_otp", input]);
      return { error: null };
    },
    exchangeCodeForSession: async (code) => {
      calls.push(["explicit_pkce", code]);
      return { error: null };
    },
    setSession: async (session) => {
      calls.push(["store_own_session", session]);
      return { error: null };
    },
    updateUser: async (input) => {
      calls.push(["own_password", input]);
      return { error: null };
    },
    ...changes.auth,
  };
  return {
    calls,
    requests,
    dependencies: {
      authClient: async () => ({ auth }),
      config,
      fetchImpl: async (url, init) => {
        calls.push(["canonical_accept_api"]);
        requests.push([url, init]);
        return new Response(
          JSON.stringify({
            data: { status: "accepted" },
            request_id: "request-1",
            contract_schema_version: "2026-10-05.2",
          }),
          {
            headers: {
              "content-type": "application/json",
              "x-gridex-project-ref": opsProject,
            },
          },
        );
      },
      ...changes.dependencies,
    },
  };
}

test("pre-membership acceptance uses actual verified Prod Auth and fresh signed proof; first password precedes canonical API acceptance", async () => {
  const { calls, requests, dependencies } = boundary();
  assert.deepEqual(await submitSupportInvitation(form(), dependencies), {
    success: "Inbjudan har accepterats.",
  });
  assert.deepEqual(
    calls.map((call) => call[0]),
    [
      "session_token_only",
      "verified_prod_auth",
      "own_password",
      "canonical_accept_api",
    ],
  );
  const [url, init] = requests[0];
  assert.equal(
    url,
    "https://app.gridex.se/api/v1/staff-onboarding/invitations/accept",
  );
  assert.equal(init.method, "POST");
  assert.equal(init.redirect, "error");
  assert.equal(init.cache, "no-store");
  const headers = new Headers(init.headers);
  assert.equal(headers.get("authorization"), "Bearer " + config.apiKey);
  assert.equal(headers.get("x-gridex-expected-project-ref"), opsProject);
  assert.equal(
    headers.get("x-gridex-support-auth-token"),
    "synthetic-verified-access-token",
  );
  assert.equal(headers.get("idempotency-key"), "accept-stable-1");
  const jwt = headers.get("x-gridex-staff-assertion").split(".");
  assert.equal(
    verify(
      "RSA-SHA256",
      Buffer.from(jwt.slice(0, 2).join(".")),
      publicKey,
      Buffer.from(jwt[2], "base64url"),
    ),
    true,
  );
  const claims = JSON.parse(Buffer.from(jwt[1], "base64url"));
  assert.equal(claims.sub, userId);
  assert.equal(claims.token_use, "staff_invitation_acceptance");
  assert.notEqual(headers.get("x-gridex-expected-project-ref"), tenantProject);
  assert.equal(claims.company_id, config.companyId);
  assert.equal(claims.exp - claims.iat, 60);
  assert.deepEqual(JSON.parse(init.body), { invitation_token: token });
});
test("default Auth fragment credentials are verified before storing this portal session on explicit submit", async () => {
  const { calls, dependencies } = boundary();
  assert.ok(
    (
      await submitSupportInvitation(
        form({
          access_token: "verified-fragment-token",
          refresh_token: "synthetic-refresh-token",
        }),
        dependencies,
      )
    ).success,
  );
  assert.deepEqual(calls.slice(0, 2), [
    ["verified_prod_auth", "verified-fragment-token"],
    [
      "store_own_session",
      {
        access_token: "verified-fragment-token",
        refresh_token: "synthetic-refresh-token",
      },
    ],
  ]);
});
test("PKCE and token-hash Auth links are exchanged only on explicit submission", async () => {
  for (const [extra, expected] of [
    [{ code: "synthetic-pkce-code" }, "explicit_pkce"],
    [
      { token_hash: "synthetic-token-hash", type: "invite" },
      "explicit_verify_otp",
    ],
    [
      { token_hash: "synthetic-token-hash", type: "magiclink" },
      "explicit_verify_otp",
    ],
  ]) {
    const { calls, dependencies } = boundary();
    assert.ok(
      (await submitSupportInvitation(form(extra), dependencies)).success,
    );
    assert.equal(calls[0][0], expected);
  }
});
test("invalid token/key/password or contradictory Auth link mode stops before Auth/API writes", async () => {
  for (const extra of [
    { invitation_token: "invalid" },
    { idempotency_key: "x" },
    { password: "short", confirm: "short" },
    { confirm: "wrong-password" },
    { code: "code", token_hash: "hash", type: "invite" },
    { token_hash: "hash", type: "recovery" },
    { access_token: "token" },
  ]) {
    const { calls, dependencies } = boundary();
    assert.ok((await submitSupportInvitation(form(extra), dependencies)).error);
    assert.deepEqual(calls, []);
  }
});
test("unconfirmed, missing or invalid Auth subject cannot sign a request or update a password", async () => {
  for (const authUser of [
    null,
    { ...user, id: "browser-invented" },
    { ...user, email_confirmed_at: null },
  ]) {
    const { calls, dependencies } = boundary({
      auth: {
        getUser: async () => ({ data: { user: authUser }, error: null }),
      },
    });
    assert.ok((await submitSupportInvitation(form(), dependencies)).error);
    assert.equal(
      calls.some((call) =>
        ["canonical_accept_api", "own_password"].includes(call[0]),
      ),
      false,
    );
  }
});
test("denied canonical acceptance, redirects, invalid response, wrong target or network error is redacted and never retried", async () => {
  for (const fetchImpl of [
    async () =>
      new Response(JSON.stringify({ error: { message: config.privateKey } }), {
        status: 403,
      }),
    async () => new Response(null, { status: 307 }),
    async () =>
      new Response(
        JSON.stringify({
          data: { status: "accepted" },
          request_id: "request-1",
          contract_schema_version: "2026-10-05.2",
        }),
        {
          headers: {
            "content-type": "application/json",
            "x-gridex-project-ref": tenantProject,
          },
        },
      ),
    async () =>
      new Response(
        JSON.stringify({
          data: { status: "accepted", role_key: "super_admin" },
          request_id: "request-1",
          contract_schema_version: "2026-10-05.2",
        }),
        {
          headers: {
            "content-type": "application/json",
            "x-gridex-project-ref": opsProject,
          },
        },
      ),
    async () => {
      throw new Error(config.privateKey);
    },
  ]) {
    let attempts = 0;
    const { calls, dependencies } = boundary({
      dependencies: {
        fetchImpl: async (...args) => {
          attempts++;
          return fetchImpl(...args);
        },
      },
    });
    const result = await submitSupportInvitation(form(), dependencies);
    assert.ok(result.error);
    assert.equal(result.error.includes("PRIVATE KEY"), false);
    assert.equal(attempts, 1);
    assert.equal(
      calls.some((call) => call[0] === "own_password"),
      true,
    );
  }
});
test("retry after acceptance failure keeps canonical idempotency stable and creates fresh single-use proofs", async () => {
  const { requests, dependencies } = boundary({
    dependencies: {
      fetchImpl: async (...args) => {
        requests.push(args);
        return new Response(null, { status: 503 });
      },
    },
  });
  assert.ok((await submitSupportInvitation(form(), dependencies)).error);
  assert.ok((await submitSupportInvitation(form(), dependencies)).error);
  assert.equal(requests.length, 2);
  const headers = requests.map(([, init]) => new Headers(init.headers));
  assert.equal(
    headers[0].get("idempotency-key"),
    headers[1].get("idempotency-key"),
  );
  assert.notEqual(
    headers[0].get("x-gridex-staff-assertion"),
    headers[1].get("x-gridex-staff-assertion"),
  );
});

test("failed first-password completion creates no tenant membership through the onboarding API", async () => {
  const { requests, dependencies } = boundary({
    auth: {
      updateUser: async () => ({
        error: { message: "synthetic rejected password" },
      }),
    },
  });
  assert.ok((await submitSupportInvitation(form(), dependencies)).error);
  assert.equal(requests.length, 0);
});
