import assert from "node:assert/strict";
import test from "node:test";
import {
  createPublicInquiryReader,
  publicInquiries,
  PUBLIC_INQUIRY_SOURCE,
  readPublicInquiryServiceKey,
} from "../apps/support/lib/public-inquiries.ts";
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const centralActor = "99999999-9999-4999-8999-999999999999";
const session = {
  userId: centralActor,
  localAuthUserId: other,
  email: "staff@example.invalid",
  api: {},
};
function row(changes = {}) {
  return {
    id,
    user_id: null,
    subject: "Fråga",
    description: "Inkommande text <script>test</script>",
    category: "general",
    status: "open",
    created_at: "2026-10-05T12:00:00.000Z",
    updated_at: "2026-10-05T12:00:00.000Z",
    metadata: {
      source: PUBLIC_INQUIRY_SOURCE,
      customer_name: "Inkommande namn",
      customer_email: "contact@example.invalid",
      customer_phone: "000",
      ip_hash: "private",
      user_agent: "private",
      client_request_id: "private",
    },
    ...changes,
  };
}
function service(rows = [], fail = false) {
  const calls = [];
  const client = {
    from(table) {
      assert.equal(table, "customer_support_tickets");
      calls.push(["from", table]);
      const filters = [];
      let from = 0,
        to = 24;
      const selected = () =>
        rows.filter((r) =>
          filters.every(
            ([field, value]) =>
              (field === "metadata->>source" ? r.metadata.source : r[field]) ===
              value,
          ),
        );
      const result = () => ({
        data: selected().slice(from, to + 1),
        count: selected().length,
        error: fail ? { message: "private database error" } : null,
      });
      const query = {
        select(columns, options) {
          calls.push(["select", columns, options]);
          return query;
        },
        is(field, value) {
          calls.push(["is", field, value]);
          filters.push([field, value]);
          return query;
        },
        eq(field, value) {
          calls.push(["eq", field, value]);
          filters.push([field, value]);
          return query;
        },
        order(field, options) {
          calls.push(["order", field, options]);
          return query;
        },
        range(start, end) {
          calls.push(["range", start, end]);
          from = start;
          to = end;
          return query;
        },
        maybeSingle() {
          const r = result();
          return Promise.resolve({ ...r, data: r.data[0] ?? null });
        },
        then(yes, no) {
          return Promise.resolve(result()).then(yes, no);
        },
      };
      return query;
    },
  };
  return { client, calls };
}
function reader(s, requireSession = async () => session) {
  return createPublicInquiryReader({ requireSession, service: () => s.client });
}
test("permission denial and unavailable Auth stop before service construction or any local query", async () => {
  for (const reason of ["cases.read denied", "Auth unavailable"]) {
    let constructed = 0;
    const denied = createPublicInquiryReader({
      requireSession: async () => {
        throw Error(reason);
      },
      service: () => {
        constructed++;
        throw Error("should not construct");
      },
    });
    await assert.rejects(() => denied.list(), { message: reason });
    await assert.rejects(() => denied.detail(id), { message: reason });
    assert.equal(constructed, 0);
  }
});
test("queue excludes authenticated and foreign-source tickets using both exact predicates at query time", async () => {
  const s = service([
    row(),
    row({ id: other, user_id: other }),
    row({ id: centralActor, metadata: { source: "foreign" } }),
  ]);
  const result = await reader(s).list();
  assert.deepEqual(
    result.items.map((x) => x.id),
    [id],
  );
  assert.equal(result.total, 1);
  assert.ok(
    s.calls.some((c) => c[0] === "is" && c[1] === "user_id" && c[2] === null),
  );
  assert.ok(
    s.calls.some(
      (c) =>
        c[0] === "eq" &&
        c[1] === "metadata->>source" &&
        c[2] === PUBLIC_INQUIRY_SOURCE,
    ),
  );
});
test("detail never reveals a foreign source, authenticated ticket or unknown id", async () => {
  for (const rows of [
    [row({ metadata: { source: "foreign" } })],
    [row({ user_id: other })],
    [],
  ]) {
    const s = service(rows);
    assert.equal(await reader(s).detail(id), null);
    assert.ok(
      s.calls.some(
        (c) =>
          c[0] === "eq" &&
          c[1] === "metadata->>source" &&
          c[2] === PUBLIC_INQUIRY_SOURCE,
      ),
    );
    assert.ok(
      s.calls.some((c) => c[0] === "is" && c[1] === "user_id" && c[2] === null),
    );
  }
});
test("public DTO exposes only incoming contact and inquiry fields, never audit or private metadata", async () => {
  const s = service([row()]);
  const item = await reader(s).detail(id);
  assert.deepEqual(item.contact, {
    name: "Inkommande namn",
    email: "contact@example.invalid",
    phone: "000",
  });
  assert.equal(item.description, row().description);
  assert.deepEqual(
    Object.keys(item).sort(),
    [
      "category",
      "contact",
      "createdAt",
      "description",
      "id",
      "status",
      "subject",
      "updatedAt",
    ].sort(),
  );
  assert.equal(JSON.stringify(item).includes("private"), false);
  assert.equal("customer_reference" in item, false);
});
test("fresh canonical session gate runs on every list/detail read without cached permission or local-role fallback", async () => {
  const s = service([row()]);
  let checks = 0;
  const r = reader(s, async () => {
    checks++;
    if (checks === 3) throw Error("permission revoked");
    return session;
  });
  await r.list();
  await r.detail(id);
  const count = s.calls.length;
  await assert.rejects(() => r.detail(id), { message: "permission revoked" });
  assert.equal(checks, 3);
  assert.equal(s.calls.length, count);
});
test("invalid ids/status/page stop before queries and cannot supply arbitrary source or tenant", async () => {
  const s = service([row()]);
  for (const input of [
    { page: 0 },
    { page: 10001 },
    { page: 1.5 },
    { status: "cancelled" },
    { status: "open.or.status.closed" },
  ])
    await assert.rejects(() => reader(s).list(input), {
      code: "public_inquiry_invalid",
    });
  for (const bad of ["bad", `${id}.or.user_id.not.is.null`])
    await assert.rejects(() => reader(s).detail(bad), {
      code: "public_inquiry_invalid",
    });
  assert.deepEqual(s.calls, []);
});
test("status filtering and bounded paging retain the closed source/nulluser scope", async () => {
  const s = service([row(), row({ id: other, status: "closed" })]);
  const result = await reader(s).list({ page: 1, status: "closed" });
  assert.deepEqual(
    result.items.map((x) => x.id),
    [other],
  );
  assert.equal(result.total, 1);
  assert.ok(s.calls.some((c) => c[0] === "range" && c[1] === 0 && c[2] === 24));
});
test("own-project service configuration rejects browser, missing and foreign-project credentials", () => {
  const fakeKey = (role, ref) =>
    [
      Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
      Buffer.from(JSON.stringify({ role, ref })).toString("base64url"),
      "unsigned-test-fixture",
    ].join(".");
  assert.equal(
    readPublicInquiryServiceKey({
      GRIDEX_SUPPORT_SUPABASE_SERVICE_KEY: fakeKey(
        "service_role",
        "ayiuxjlfazkjmmtlvhsl",
      ),
    }),
    fakeKey("service_role", "ayiuxjlfazkjmmtlvhsl"),
  );
  for (const key of [
    "",
    fakeKey("anon", "ayiuxjlfazkjmmtlvhsl"),
    fakeKey("service_role", "piidsfebjqjmnepdpnas"),
  ])
    assert.throws(
      () =>
        readPublicInquiryServiceKey({
          GRIDEX_SUPPORT_SUPABASE_SERVICE_KEY: key,
        }),
      { code: "public_inquiry_unavailable" },
    );
});
test("default adapter constructs only the fixed local tenant client after authoritative session and uses explicit service ENV", async () => {
  const s = service([row()]);
  const prior = process.env.GRIDEX_SUPPORT_SUPABASE_SERVICE_KEY;
  const key = [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(
      JSON.stringify({ role: "service_role", ref: "ayiuxjlfazkjmmtlvhsl" }),
    ).toString("base64url"),
    "unsigned-test-fixture",
  ].join(".");
  process.env.GRIDEX_SUPPORT_SUPABASE_SERVICE_KEY = key;
  const order = [];
  globalThis.__publicInquirySession = async () => {
    order.push("fresh canonical session");
    return session;
  };
  globalThis.__publicInquiryClient = (url, credential, options) => {
    order.push("local service");
    assert.equal(url, "https://ayiuxjlfazkjmmtlvhsl.supabase.co");
    assert.equal(credential, key);
    assert.deepEqual(options.auth, {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
    return s.client;
  };
  try {
    await publicInquiries.detail(id);
    assert.deepEqual(order, ["fresh canonical session", "local service"]);
  } finally {
    if (prior === undefined)
      delete process.env.GRIDEX_SUPPORT_SUPABASE_SERVICE_KEY;
    else process.env.GRIDEX_SUPPORT_SUPABASE_SERVICE_KEY = prior;
    delete globalThis.__publicInquirySession;
    delete globalThis.__publicInquiryClient;
  }
});
test("database errors and unexpected out-of-scope returned rows are redacted", async () => {
  const broken = service([row()], true);
  await assert.rejects(() => reader(broken).detail(id), {
    code: "public_inquiry_unavailable",
  });
  const s = service([row({ status: "foreign" })]);
  await assert.rejects(() => reader(s).detail(id), {
    code: "public_inquiry_unavailable",
  });
});
