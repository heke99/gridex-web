import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { invoicePayload, invoiceId, documentId, caseId, supportPayload, messagesPayload } from './mobile-detail-fixtures.mjs';
const env = ['GRIDEX_MOBILE_API_ENABLED','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','GRIDEX_MOBILE_DOCUMENT_ORIGINS'];
const old = env.map(k => process.env[k]);
after(() => { env.forEach((k,i) => old[i] === undefined ? delete process.env[k] : process.env[k] = old[i]); delete globalThis.__mobileReadFixture; });
const tokens = { 'mobile-session-one-123456': 'customer-one', 'mobile-session-two-123456': 'customer-two' };
let calls, documentUrl;
const users = token => tokens[token] ? { id: tokens[token], email_confirmed_at: '2026-01-01' } : null;
function assertIdentity(identity) { assert.ok(['customer-one','customer-two'].includes(identity.userId)); assert.equal(identity.customerNumber, `number-${identity.userId}`); }
globalThis.__mobileReadFixture = {
  createClient: (_url, _key, options) => ({
    auth: { getUser: async token => { calls.push('auth'); return { data: { user: users(token) }, error: null }; } },
    from: table => { assert.equal(table, 'customer_profiles'); return { select: () => ({ eq: (column, subject) => {
      assert.equal(column, 'user_id'); const bearer = options.global.headers.Authorization.slice(7);
      assert.equal(users(bearer)?.id, subject); calls.push(`profile:${subject}`);
      return { maybeSingle: async () => ({ data: { customer_number: `number-${subject}`, external_customer_id: `external-${subject}` }, error: null }) };
    } }) }; },
  }),
  resource: async (identity, resource, reference) => {
    assertIdentity(identity); calls.push(`ops:${identity.userId}:${resource}:${reference}`);
    if (resource !== 'invoices') { const ref = `ref-${identity.userId}`; const row = { customer_reference: ref, notification_reference: ref, document_reference: ref, power_of_attorney_reference: ref, acceptance_reference: ref, display_name: 'Own name', title: 'Own title', message: 'Own message', scope: ['read'], secure_url: documentUrl, portal_identity: 'must-not-leak' }; return { data: resource === 'me' ? row : [row] }; }
    if (identity.userId !== 'customer-one' || reference !== invoiceId) throw new Error('foreign or missing invoice');
    const p = invoicePayload(); p.data.documents[0].secure_url = documentUrl; return p;
  },
  cases: async identity => { assertIdentity(identity); calls.push(`cases:${identity.userId}`); return { data: [supportPayload(identity.userId === 'customer-one' ? caseId : `support_case_${'z'.repeat(24)}`).data] }; },
  caseDetail: async (identity, reference) => { assertIdentity(identity); calls.push(`case:${identity.userId}`); if (identity.userId !== 'customer-one' || reference !== caseId) throw new Error('foreign case'); return supportPayload(); },
  messages: async (identity, reference) => { assertIdentity(identity); calls.push(`messages:${identity.userId}`); if (identity.userId !== 'customer-one' || reference !== caseId) throw new Error('foreign case'); return messagesPayload(); },
};
const invoice = (await import('../app/api/mobile/customer/invoices/[id]/route.ts')).GET;
const document = (await import('../app/api/mobile/customer/invoices/[id]/documents/[documentRef]/route.ts')).GET;
const cases = (await import('../app/api/mobile/customer/support/route.ts')).GET;
const detail = (await import('../app/api/mobile/customer/support/[id]/route.ts')).GET;
beforeEach(() => { calls = []; documentUrl = 'https://files.example.test/invoice.pdf?signature=test-only'; process.env.GRIDEX_MOBILE_API_ENABLED = 'true'; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://tenant.supabase.co'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key'; process.env.GRIDEX_MOBILE_DOCUMENT_ORIGINS = 'https://files.example.test'; });
const request = (token = 'mobile-session-one-123456', query = '') => new Request(`https://tenant.test/api/mobile/customer/resource${query}`, { headers: { Authorization: `Bearer ${token}`, 'x-gridex-customer-number': 'foreign-customer', 'x-gridex-auth-user-id': 'foreign-user' } });
const context = (id = invoiceId, doc = documentId) => ({ params: Promise.resolve({ id, documentRef: doc }) });

test('actual invoice route uses verified subject and the correct detail envelope', async () => {
  const response = await invoice(request(), context()); assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const data = (await response.json()).data.invoiceDetail[0]; assert.equal(data.reference, invoiceId); assert.equal(data.lines[0].amountIncVat, 125);
  assert.ok(!JSON.stringify(data).includes('must-not-leak')); assert.ok(calls.includes('profile:customer-one'));
});
test('actual detail and document routes deny cross-customer access without reflecting invoice content', async () => {
  for (const route of [invoice, document]) {
    const response = await route(request('mobile-session-two-123456'), context()); assert.equal(response.status, 503);
    const body = await response.text(); assert.ok(!body.includes('10001')); assert.ok(!body.includes('signature'));
  }
});
test('document route rechecks Auth/OPS and only returns an attached approved link', async () => {
  const response = await document(request(), context()); assert.equal(response.status, 200);
  assert.equal((await response.json()).data.invoiceDocument[0].reference, documentId);
  assert.ok(calls.includes('auth')); assert.ok(calls.some(v => v.startsWith('ops:')));
  assert.equal((await document(request(), context(invoiceId, 'foreign-document'))).status, 503);
});
test('document route fails closed on expired/untrusted URLs and missing origin configuration', async () => {
  for (const value of [null, 'javascript:alert(1)', 'https://files.example.test.evil.test/a']) { documentUrl = value; assert.equal((await document(request(), context())).status, 503); }
  documentUrl = 'https://files.example.test/a'; delete process.env.GRIDEX_MOBILE_DOCUMENT_ORIGINS;
  assert.equal((await document(request(), context())).status, 503);
});
test('actual support list resolves different verified customers independently', async () => {
  const one = await (await cases(request())).json(); const two = await (await cases(request('mobile-session-two-123456'))).json();
  assert.notEqual(one.data.support[0].reference, two.data.support[0].reference);
  assert.ok(!JSON.stringify(one).includes('must-not-leak'));
});
test('actual support detail checks ownership for both case and public message reads', async () => {
  const response = await detail(request(), context(caseId)); assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.data.supportDetail[0].messages[0].author, 'staff');
  assert.ok(!JSON.stringify(body).includes('must-not-leak'));
  assert.equal((await detail(request('mobile-session-two-123456'), context(caseId))).status, 503);
});
test('all new routes reject bearer failures and customer query overrides before OPS', async () => {
  for (const [route, ctx] of [[invoice,context()], [document,context()], [cases,undefined], [detail,context(caseId)]]) {
    calls = []; assert.equal((await route(request('invalid-token-1234567'), ctx)).status, 401); assert.ok(!calls.some(v => v.startsWith('ops:')));
    calls = []; assert.equal((await route(request(undefined, '?customerId=foreign'), ctx)).status, 400); assert.equal(calls.length, 0);
  }
});
test('disabled mobile routes do not query providers', async () => {
  process.env.GRIDEX_MOBILE_API_ENABLED = 'false';
  assert.equal((await invoice(request(), context())).status, 404); assert.equal(calls.length, 0);
});

test('actual support POST binds verified subject and preserves retry key', async () => {
 const post = (await import('../app/api/mobile/customer/support/route.ts')).POST;
 globalThis.__mobileReadFixture.createCase = async (identity, input, key) => { assert.equal(identity.userId,'customer-one'); assert.deepEqual(input,{title:'Question',message:'Hello'}); assert.equal(key,'create-attempt-123'); return {data:{}}; };
 const req = new Request('https://tenant.test/support',{method:'POST',headers:{authorization:'Bearer mobile-session-one-123456','content-type':'application/json','idempotency-key':'create-attempt-123'},body:JSON.stringify({title:'Question',message:'Hello'})});
 assert.equal((await post(req)).status,201);
});
test('actual reply route delegates ownership to canonical OPS and never creates a foreign message', async () => {
 const post = (await import('../app/api/mobile/customer/support/[id]/messages/route.ts')).POST;
 globalThis.__mobileReadFixture.reply = async (identity, reference) => { assert.equal(reference,caseId); if(identity.userId !== 'customer-one')throw Object.assign(Error('foreign'),{status:403}); return {data:{}}; };
 for(const [token,status] of [['mobile-session-one-123456',201],['mobile-session-two-123456',403]]) {
  const req = new Request('https://tenant.test/support',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':'reply-attempt-123'},body:JSON.stringify({message:'Reply'})});
  assert.equal((await post(req,context(caseId))).status,status);
 }
});

for (const kind of ['profile','notifications','documents','powers','acceptances']) test(`actual ${kind} route isolates verified customers and rejects overrides`, async () => {
 const get = (await import(`../app/api/mobile/customer/${kind}/route.ts`)).GET;
 const first = await get(request()); assert.equal(first.status,200); assert.equal(first.headers.get('cache-control'),'private, no-store');
 const body = await first.json(); assert.equal(body.data[kind][0].reference,'ref-customer-one'); assert.ok(!JSON.stringify(body).includes('must-not-leak')); assert.ok(!JSON.stringify(body).includes('signature'));
 const second = await (await get(request('mobile-session-two-123456'))).json(); assert.equal(second.data[kind][0].reference,'ref-customer-two');
 assert.equal((await get(request(undefined,'?customerId=foreign'))).status,400);
 assert.equal((await get(request('invalid-token-1234567'))).status,401);
 process.env.GRIDEX_MOBILE_API_ENABLED='false'; assert.equal((await get(request())).status,404);
});
test('general document opening rechecks ownership and approved origins', async () => {
 const get = (await import('../app/api/mobile/customer/documents/[id]/open/route.ts')).GET;
 const ctx = {params:Promise.resolve({id:'ref-customer-one'})};
 assert.equal((await get(request(),ctx)).status,200);
 assert.equal((await get(request('mobile-session-two-123456'),ctx)).status,503);
 documentUrl='https://evil.test/a'; assert.equal((await get(request(),ctx)).status,503);
});

test('actual mobile phone update uses verified profile and requires accepted OPS completion',async()=>{
 const post=(await import('../app/api/mobile/customer/profile/route.ts')).POST;
 let status='accepted';globalThis.__mobileReadFixture.profileUpdate=async input=>{assert.equal(input.identity.userId,'customer-one');assert.deepEqual(input.profile,{phone:'0701234567'});assert.equal(input.idempotencyKey,'phone-update-123');return {status,data:{profile_updated:true}};};
 const req=()=>new Request('https://tenant.test/profile',{method:'POST',headers:{authorization:'Bearer mobile-session-one-123456','content-type':'application/json','idempotency-key':'phone-update-123'},body:JSON.stringify({phone:'0701234567'})});
 assert.equal((await post(req())).status,200);status='submitted';assert.equal((await post(req())).status,503);
});
test('actual notification read verifies ownership and read-back before native success',async()=>{
 const post=(await import('../app/api/mobile/customer/notifications/read/route.ts')).POST;const reference=`notification_${'a'.repeat(24)}`;let confirmed=true;
 globalThis.__mobileReadFixture.readNotification=async(identity,input)=>{if(identity.userId!=='customer-one')throw Object.assign(Error('foreign'),{status:404});assert.deepEqual(input.notificationIds,[reference]);};
 const previous=globalThis.__mobileReadFixture.resource;
 globalThis.__mobileReadFixture.resource=async(identity,resource)=>{assert.equal(identity.userId,'customer-one');assert.equal(resource,'notifications');return {data:[{notification_reference:reference,status:confirmed?'read':'unread',read_at:confirmed?'2026-11-06T12:00:00Z':null}]};};
 try{const req=(token='mobile-session-one-123456')=>new Request('https://tenant.test/notifications/read',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':'notification-read-123'},body:JSON.stringify({reference})});
 const response=await post(req());assert.equal(response.status,200);assert.equal((await response.json()).data.readAt,'2026-11-06T12:00:00Z');
 confirmed=false;assert.equal((await post(req())).status,503);assert.equal((await post(req('mobile-session-two-123456'))).status,404);
 }finally{globalThis.__mobileReadFixture.resource=previous;}
});
