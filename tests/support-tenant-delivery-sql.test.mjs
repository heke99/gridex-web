import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { PGlite } = require("@electric-sql/pglite");
const migration = new URL(
  "../supabase/migrations/20261005125326_support_staff_invitation_delivery_private.sql",
  import.meta.url,
);

test("actual tenant migration enforces private ACL, durable single ownership, identity FK, idempotency and no automatic resend", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,deleted_at timestamptz,banned_until timestamptz);",
    );
    await db.exec(await readFile(migration, "utf8"));
    const local = "11111111-1111-4111-8111-111111111111",
      id = "55555555-5555-4555-8555-555555555555";
    await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
      local,
      "staff@example.invalid",
    ]);
    const base = {
      delivery_id: id,
      request_hash: "a".repeat(64),
      company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      api_client_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      provider_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      invitation_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      auth_issuer: "https://ayiuxjlfazkjmmtlvhsl.supabase.co/auth/v1",
      email: "staff@example.invalid",
    };
    const command = {
      delivery_id: id,
      request_hash: base.request_hash,
      request_fingerprint: "b".repeat(64),
      receipt_base: base,
    };
    const call = async (name, arg) =>
      (
        await db.query(`SELECT public.${name}($1::jsonb) AS value`, [
          JSON.stringify(arg),
        ])
      ).rows[0].value;
    const claimed = await call(
      "gridex_support_claim_staff_delivery_v1",
      command,
    );
    assert.equal(claimed.outcome, "start");
    assert.deepEqual(
      await call("gridex_support_claim_staff_delivery_v1", command),
      { outcome: "indeterminate" },
    );
    await assert.rejects(
      call("gridex_support_claim_staff_delivery_v1", {
        ...command,
        request_fingerprint: "c".repeat(64),
      }),
      /idempotency_conflict/,
    );
    const receipt = { ...base, local_auth_subject: local, status: "sent" };
    const complete = {
      delivery_id: id,
      request_hash: base.request_hash,
      claim_token: claimed.claim_token,
      receipt_data: receipt,
    };
    await assert.rejects(
      call("gridex_support_complete_staff_delivery_v1", {
        ...complete,
        claim_token: id,
      }),
      /completion_invalid/,
    );
    await assert.rejects(
      call("gridex_support_complete_staff_delivery_v1", {
        ...complete,
        receipt_data: { ...receipt, local_auth_subject: id },
      }),
      /completion_invalid/,
    );
    await assert.rejects(
      call("gridex_support_complete_staff_delivery_v1", {
        ...complete,
        receipt_data: { ...receipt, role_key: "super_admin" },
      }),
      /completion_invalid/,
    );
    assert.equal(
      await call("gridex_support_complete_staff_delivery_v1", complete),
      true,
    );
    assert.equal(
      await call("gridex_support_complete_staff_delivery_v1", complete),
      true,
    );
    assert.deepEqual(
      await call("gridex_support_claim_staff_delivery_v1", command),
      { outcome: "complete", receipt_data: receipt },
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM support_private.staff_invitation_deliveries",
        )
      ).rows[0].count,
      1,
    );
    for (const name of [
      "gridex_support_claim_staff_delivery_v1(jsonb)",
      "gridex_support_complete_staff_delivery_v1(jsonb)",
      "gridex_support_existing_invitation_subject_v1(text)",
    ]) {
      const acl = (
        await db.query(
          "SELECT has_function_privilege('anon',$1,'EXECUTE') AS anon,has_function_privilege('authenticated',$1,'EXECUTE') AS authenticated,has_function_privilege('service_role',$1,'EXECUTE') AS service",
          [`public.${name}`],
        )
      ).rows[0];
      assert.deepEqual(acl, {
        anon: false,
        authenticated: false,
        service: true,
      });
    }
    assert.equal(
      (
        await db.query(
          "SELECT has_table_privilege('service_role','support_private.staff_invitation_deliveries','SELECT') AS value",
        )
      ).rows[0].value,
      false,
    );
    await db.query(
      "UPDATE auth.users SET banned_until=now()+interval'1 hour' WHERE id=$1",
      [local],
    );
    assert.deepEqual(
      await call("gridex_support_claim_staff_delivery_v1", command),
      { outcome: "indeterminate" },
    );
    assert.equal(
      (
        await db.query(
          "SELECT public.gridex_support_existing_invitation_subject_v1($1) AS value",
          ["staff@example.invalid"],
        )
      ).rows[0].value,
      null,
    );
    await db.query("DELETE FROM auth.users WHERE id=$1", [local]);
    assert.equal(
      (
        await db.query(
          "SELECT local_auth_subject FROM support_private.staff_invitation_deliveries",
        )
      ).rows[0].local_auth_subject,
      null,
    );
  } finally {
    await db.close();
  }
});
