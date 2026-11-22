import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
import nodeCrypto, { webcrypto } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..');
function harness(file, boundaries = {}, globals = {}) {
  const states = [], refs = [], effects = []; let si = 0, ri = 0;
  const react = { useState(initial) { const i = si++; if (!(i in states)) states[i] = initial; return [states[i], value => states[i] = value]; }, useRef(initial) { const i = ri++; return refs[i] ??= {current: initial}; }, useEffect(fn) { effects.push(fn); }, useMemo(fn) { return fn(); } };
  const jsx = (type, props) => ({type, props});
  const mod = {exports:{}};
  const context = {module:mod,exports:mod.exports,require(name) { if(name==='react')return react; if(name==='react/jsx-runtime')return {jsx,jsxs:jsx}; if(name==='next/link')return {default:'a'}; if(name in boundaries)return boundaries[name]; throw Error('Unmocked boundary '+name); }, crypto:webcrypto,TextEncoder,window:{location:{search:'',origin:'https://example.invalid'}},console,...globals};
  const source = fs.readFileSync(root+'/'+file,'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,context,{filename:file});
  return {states,effects,render(props) {si=ri=0; return mod.exports.default(props);},exports:mod.exports};
}
function nodes(tree) { if(!tree||typeof tree!=='object')return []; return [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
function text(tree) { if(typeof tree==='string')return tree; if(!tree||typeof tree!=='object')return ''; return [tree.props?.children].flat(Infinity).map(text).join(' '); }
const event = {preventDefault(){}};
import { test } from 'node:test'
const policy=harness('lib/auth/passwordPolicy.ts').exports;
const safeRedirect=harness('lib/auth/safeRedirectPath.ts',{}, {URL}).exports;
const recoveryPath=harness('lib/auth/passwordRecoveryPath.ts',{'./safeRedirectPath':safeRedirect},{URLSearchParams}).exports;
const recoveryBoundaries={'@/lib/auth/passwordRecoveryPath':recoveryPath,'@/lib/auth/safeRedirectPath':safeRedirect};
const business=harness('lib/website/businessDate.ts').exports;
const customerDate=harness('packages/mobile-foundation/src/customerDate.ts').exports;
const display=harness('lib/customerPortal/display.ts',{'../../packages/mobile-foundation/src/customerDate':customerDate}).exports;
const writes=harness('lib/customerPortal/writeResponse.ts').exports;
const { NextResponse } = await import('next/server.js');
const httpSafety=harness('lib/ops/httpSafety.ts',{}, {AbortSignal}).exports;
const webBoundary=harness('lib/api/webBoundary.ts',{'next/server':{NextResponse},'../ops/httpSafety':httpSafety},{Headers,Response,TextDecoder,AbortSignal,URL}).exports;
const memory=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}};
const props={site:null,moveOutSites:[],userId:'test-user',latestUnreadNotificationId:'test-notification'};
const portal=(response,storage=memory())=>harness('components/customer/CustomerPortalSelfService.tsx',{
 'next/navigation':{useRouter:()=>({refresh(){}})},'@/lib/website/businessDate':business,
 '@/lib/customerPortal/writeResponse':writes, '@/lib/ops/httpSafety':httpSafety
},{sessionStorage:storage,fetch:async()=>response});
const ok=json=>({ok:true,json:async()=>json});
test('recovery hides only account existence, never delivery and rate-limit failures',async()=>{
 for(const error of [{status:500,code:'unexpected_failure',message:'Error sending recovery email to user'}, {status:429,code:'over_email_send_rate_limit',message:'Email rate limit exceeded for this user'},{status:404,code:'user_not_found',message:'User not found'}]){
 const h=harness('app/login/forgot-password/page.tsx',{...recoveryBoundaries,'@/lib/supabase/client':{createSupabaseBrowserClient:()=>({auth:{resetPasswordForEmail:async()=>({error})}})}});
 h.render();h.states[0]='test@example.invalid';await nodes(h.render()).find(n=>n.type==='form').props.onSubmit(event);
 assert.equal(h.states[1],error.code==='user_not_found');if(error.code!=='user_not_found')assert.ok(h.states[2]);
 }
});
test('support rejects excess input before RPC and preserves the complete allowed message',async()=>{
 let calls=0;
 const h=harness('app/api/support/public/route.ts',{'next/server':{NextResponse},'@/lib/api/webBoundary':webBoundary,'@/lib/supabase/service':{supabaseService:{rpc:async(_,args)=>{calls++;assert.equal(args.p_message.length,4000);return {data:'ticket',error:null}}}},'@/lib/security/rateLimit':{clientIpFromHeaders:()=>null,checkRateLimit:async()=>({allowed:true})},'@/lib/ops/client':{hashIp:()=>null},'node:crypto':nodeCrypto},{Headers});
 const payload={client_operation_id:webcrypto.randomUUID(),name:'Test',email:'test@example.invalid',subject:'Test',message:'A'.repeat(4001)};
 const request=()=>new Request('https://gridex.se/api/support/public',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://gridex.se'},body:JSON.stringify(payload)});
 assert.equal((await h.exports.POST(request())).status,400);assert.equal(calls,0);
 payload.message='A'.repeat(4000);assert.equal((await h.exports.POST(request())).status,200);assert.equal(calls,1);
});
test('support retries across remount with same ID and retains it for malformed success',async()=>{
 const storage=memory(),requests=[],payload={name:'Test',email:'test@example.invalid',subject:'Test',message:'Test'};
 for(let mount=0;mount<2;mount++){
 const h=harness('app/(public)/kundservice/KundserviceClient.tsx',{}, {sessionStorage:storage,FormData:class{get(k){return payload[k]}},fetch:async(_,r)=>{requests.push(JSON.parse(r.body));return ok({})}});
 await nodes(h.render({faqItems:[]})).find(n=>n.type==='form').props.onSubmit({...event,currentTarget:{reset(){throw Error('Must not reset')}}});
 assert.equal(h.states[0],'error');
 }
 assert.equal(requests[0].client_operation_id,requests[1].client_operation_id);assert.equal(storage.map.size,1);
});
test('facility form shows skipped, unchanged and updated results independently of overall sync success', async () => {
 for (const [facilityOutcome, expected] of [
  ['skipped', /ändringen hoppades över/],
  ['unchanged', /utan att någon ändring registrerades/],
  ['updated', /Anläggningsuppgifterna är uppdaterade/],
  [undefined, /Kunde inte bekräfta/],
 ]) {
  const h = portal(ok({ data: { ok: true, status: 'synced' }, queued: false, facilityOutcome }));
  const form = () => nodes(h.render(props)).find(node => node.type === 'form' && /Anläggningsuppgifter/.test(text(node)));
  await form().props.onSubmit(event);
  const result = nodes(form()).find(node => node.type?.name === 'Result');
  assert.match(text(result.type(result.props)), expected);
 }
});

test('a timed-out move report keeps its intent and ignores a late response', async () => {
 const storage = memory(), calls = [];
 const lateBody = Promise.withResolvers(), started = Promise.withResolvers();
 const controllers = [];
 let refreshes = 0;
 const h = harness('components/customer/CustomerPortalSelfService.tsx', {
  'next/navigation': { useRouter: () => ({ refresh() { refreshes++ } }) },
  '@/lib/website/businessDate': business, '@/lib/customerPortal/writeResponse': writes, '@/lib/ops/httpSafety': httpSafety,
 }, {
  sessionStorage: storage,
  AbortSignal: { timeout(ms) { assert.equal(ms, 20_000); const controller = new AbortController(); controllers.push(controller); return controller.signal; } },
  fetch: async (_path, options) => {
   calls.push(JSON.parse(options.body));
   assert.equal(options.signal, controllers.at(-1).signal);
   if (calls.length === 2) return ok({ ok: true, queued: false, moveOutReceipt: {
    completion_reference: 'move-receipt-1', status: 'submitted',
    facility_reference: 'wrong-site', requested_move_out_date: calls[1].move_out.move_out_date,
   } });
   if (calls.length > 2) return ok({ ok: true, queued: false, moveOutReceipt: {
    completion_reference: 'move-receipt-1', status: 'submitted',
    facility_reference: 'other-site', requested_move_out_date: calls[2].move_out.move_out_date,
   } });
   return { ok: true, json() { started.resolve(); return lateBody.promise; } };
  },
 });
 const site = { id: 'test-site', facilityId: 'test-facility', meteringPointId: null, gridAreaCode: null, priceAreaCode: null };
 const moveOutSites = [
  { reference: site.id, address: 'Testgatan 1', facilityId: site.facilityId },
  { reference: 'other-site', address: 'Andra gatan 2', facilityId: 'other-facility' },
 ];
 const render = () => h.render({ ...props, site, moveOutSites });
 const form = () => nodes(render()).find(n => n.type === 'form' && text(n).includes('flyttanmälan'));
 const select = nodes(form()).find(n => n.type === 'select');
 assert.equal(select.props.value, '');
 await form().props.onSubmit(event);
 assert.equal(calls.length, 0);
 select.props.onChange({ target: { value: 'other-site' } });
 assert.match(text(form()), /Andra gatan 2\s+· Anläggningsreferens\s+other-site/);
 const dateInput = () => nodes(form()).find(n => n.type === 'input' && n.props.type === 'date');
 const { min, max } = business.moveOutDateBounds();
 assert.equal(dateInput().props.min, min);
 assert.equal(dateInput().props.max, max);
 dateInput().props.onChange({ target: { value: '9999-01-01' } });
 await form().props.onSubmit(event);
 assert.equal(calls.length, 0);
 dateInput().props.onChange({ target: { value: min } });
 const first = form().props.onSubmit(event);
 await started.promise;
 assert.equal(calls[0].move_out.facility_reference, 'other-site');
 controllers[0].abort(new DOMException('Timeout', 'TimeoutError'));
 await first;
 const notice = () => { const node = nodes(form()).find(n => n.type?.name === 'Result'); return text(node.type(node.props)); };
 assert.match(notice(), /Försök igen med samma uppgifter/);
 assert.equal(nodes(form()).find(n => n.type === 'button' && n.props.type === 'submit').props.disabled, false);
 assert.equal(storage.map.size, 1);
 assert.equal(refreshes, 0);
 await form().props.onSubmit(event);
 assert.deepEqual(calls[1], calls[0]);
 assert.match(notice(), /Kvittot kunde inte bekräftas/);
 assert.equal(storage.map.size, 1);
 await form().props.onSubmit(event);
 assert.deepEqual(calls[2], calls[0]);
 lateBody.resolve({ ok: true, queued: false });
 await lateBody.promise;
 assert.equal(refreshes, 0);
 assert.equal(storage.map.size, 0);
 assert.match(notice(), /Flyttanmälan är skickad.*move-receipt-1.*other-site/);
});

test('invalid write responses keep retry identity and show error',async()=>{
 for(const response of [{ok:true,json:async()=>{throw SyntaxError()}},ok({}),ok({data:{status:'accepted'}})]){
 const storage=memory(),h=portal(response,storage);
 await nodes(h.render(props)).find(n=>n.type==='button'&&text(n).includes('Uppdatera Mina sidor')).props.onClick();
 assert.equal(h.states[1].kind,'error');assert.equal(storage.map.size,1);
 }
});
test('pending and rejected writes are never completed',async()=>{
 const pending=await writes.readCustomerWriteResponse(ok({data:{ok:false,status:'pending_review'},queued:false}));assert.equal(writes.pendingCustomerWrite(pending),true);
 await assert.rejects(writes.readCustomerWriteResponse(ok({data:{ok:false,status:'rejected'}})));
 assert.equal(writes.pendingCustomerWrite(await writes.readCustomerWriteResponse(ok({data:{ok:true,status:'accepted'}}))),false);
});
test('successful notification read removes unread banner',async()=>{
 const h=portal(ok({ok:true,queued:false}));await nodes(h.render(props)).find(n=>n.type==='button'&&text(n).includes('Markera som läst')).props.onClick();
 assert.equal(h.states[4].kind,'success');assert.equal(text(h.render(props)).includes('Senaste meddelandet är oläst.'),false);
});
test('recovery state expires on signout',async()=>{
 let callback;
 const h=harness('app/login/reset-password/page.tsx',{...recoveryBoundaries,'next/navigation':{useRouter:()=>({})},'@/lib/auth/passwordPolicy':policy,'@/lib/supabase/client':{createSupabaseBrowserClient:()=>({auth:{getSession:async()=>({data:{session:{user:{}}},error:null}),onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{unsubscribe(){}}}}}}})}}, {URLSearchParams});
 h.render();h.effects[0]();await Promise.resolve();assert.equal(h.states[0],'ready');callback('SIGNED_OUT',null);assert.equal(h.states[0],'expired');
});
test('profile password preserves input exactly',async()=>{
 let password;
 const h=harness('app/dashboard/profile/actions.ts',{'next/cache':{revalidatePath(){}},'next/navigation':{redirect:path=>{throw Error('REDIRECT '+path)}},'@/lib/supabase/server':{createSupabaseServerActionClient:async()=>({auth:{updateUser:async payload=>{password=payload.password;return {error:null}}}})},'@/lib/ops/client':{},'@/lib/customerPortal/service':{},'@/lib/customerPortal/apiErrors':{},'@/lib/supabase/service':{},'@/lib/auth/passwordPolicy':policy});
 await assert.rejects(h.exports.updateCustomerPasswordAction({get:()=> ' Abcdef12! '}),/REDIRECT/);assert.equal(password,' Abcdef12! ');
});
test('invoice detail preserves opaque references containing percent signs',async()=>{
 let forwarded;
 const h=harness('app/api/web/customer/invoices/[id]/route.ts',{'@/lib/api/webBoundary':{webErrorResponse:()=>({status:400})},'@/lib/customerPortal/resourceRoute':{customerResourceResponse:async(_,id)=>{forwarded=id;return {status:200}}}});
 for(const id of ['invoice%2Fpart','invoice%reference']){await h.exports.GET({}, {params:Promise.resolve({id})});assert.equal(forwarded,id)}
});
test('dates use Swedish time, preserve calendar days and tolerate malformed dates and currencies',()=>{
 assert.equal(display.formatCustomerDate('2026-10-07T22:30:00Z'),'2026-10-08');
 assert.equal(display.formatCustomerDate('2026-01-07T23:30:00Z'),'2026-01-08');
 assert.equal(display.formatCustomerDate('2026-10-07'),'2026-10-07');
 for(const invalid of ['invalid-date','2026-02-30',null])assert.equal(display.formatCustomerDate(invalid),'—');
 assert.ok(display.formatCustomerCurrency(123.45,'invalid').includes('valuta saknas'));
});
test('beacon rejection uses fetch fallback without interrupting click',()=>{
 let fallback=0,callback=0;
 const h=harness('components/customer/EventLink.tsx',{}, {navigator:{sendBeacon:()=>false},Blob,fetch:async()=>{fallback++}});
 h.render({eventType:'customer.opened_document',children:'Test',onClick:()=>callback++}).props.onClick({});assert.equal(fallback,1);assert.equal(callback,1);
});
test('dashboard repair retains intent and does not reset while pending',async()=>{
 let resets=0;const ids=[];
 const h=harness('app/dashboard/error.tsx',{'@/lib/customerPortal/writeResponse':writes},{fetch:async(_,r)=>{ids.push(JSON.parse(r.body).client_operation_id);return ok({data:{ok:false,status:'pending_review'}})}});
 for(let i=0;i<2;i++)await nodes(h.render({retry:()=>resets++})).find(n=>n.type==='button').props.onClick();
 assert.equal(h.states[0],'pending');assert.equal(resets,0);assert.equal(ids[0],ids[1]);
});
test('dashboard retry re-fetches without a write; only confirmed repair retries the data read',async()=>{
 let retries=0,requests=0;
 const h=harness('app/dashboard/error.tsx',{'@/lib/customerPortal/writeResponse':writes},{fetch:async()=>{requests++;return ok({data:{ok:true,status:'linked',synced:{access_granted:true}}})}});
 const props={retry:()=>retries++};
 nodes(h.render(props)).find(n=>n.type==='button'&&text(n)==='Försök igen').props.onClick();
 assert.equal(retries,1);assert.equal(requests,0);
 await nodes(h.render(props)).find(n=>n.type==='button'&&text(n)==='Uppdatera kopplingen').props.onClick();
 assert.equal(retries,2);assert.equal(requests,1);
});

test('signup starts catalogue, checkout and Auth reads together and isolates their failures', async () => {
  const file = 'app/(public)/teckna-avtal/page.tsx'
  const source = fs.readFileSync(resolve(root, file), 'utf8')
  const boundaries = Object.fromEntries([...source.matchAll(/from "([^"]+)"/g)].map(([, name]) => [name, {}]))
  const reads = Object.fromEntries(['catalogue', 'checkout', 'auth'].map(key => [key, Promise.withResolvers()]))
  const started = []
  const start = key => {
    started.push(key)
    return reads[key].promise
  }
  const SignupFlow = () => null
  Object.assign(boundaries, {
    '@/components/signup/SignupFlowClient': { default: SignupFlow },
    '@/lib/ops/client': { getOpsClientStatus: () => ({ configured: true, liveSignupEnabled: true }) },
    '@/lib/website/publicContractFeed': {
      loadWebsitePublicContractFeed: () => start('catalogue'),
      logWebsitePublicContractFeedError: () => {},
    },
    '@/lib/website/checkoutContextStore': { readWebsiteCheckoutContext: () => start('checkout') },
    '@/lib/supabase/server': { createSupabaseServerActionClient: async () => ({ auth: { getUser: () => start('auth') } }) },
    '@/lib/content/faq': { checkoutFaqItems: [] },
  })
  const h = harness(file, boundaries, { console: { error() {} } })
  const page = h.render({ searchParams: Promise.resolve({ checkout: 'synthetic-link' }) })
  await new Promise(resolve => setImmediate(resolve))
  try {
    assert.deepEqual(started, ['catalogue', 'checkout', 'auth'])
  } finally {
    for (const read of Object.values(reads)) read.reject(new Error('Synthetic unavailable dependency'))
  }
  const tree = await page
  assert.match(text(tree), /Vi kunde inte hämta aktuella elavtal/)
  assert.match(text(tree), /Checkout-länken kunde inte återställas/)
  const signup = nodes(tree).find(node => node.type === SignupFlow || node.type?.default === SignupFlow)
  assert.equal(signup.props.authenticationRequired, true)
  assert.equal(signup.props.canSubmit, false)
})

const cronAuth = harness('lib/integrations/auth.ts', { 'node:crypto': nodeCrypto }, {
  Buffer, process: { env: { CRON_SECRET: 'synthetic-cron-secret' } },
}).exports

test('scheduled job routes accept Vercel bearer with or without an independent manual secret', async () => {
  const paths = [
    ['customer-portal/onboarding/process', 'CUSTOMER_PORTAL_ONBOARDING_CRON_SECRET'],
    ['customer-portal/outbox/process', 'CUSTOMER_PORTAL_OUTBOX_CRON_SECRET'],
    ['customer-portal/notifications/reconcile', 'CUSTOMER_PORTAL_OUTBOX_CRON_SECRET'],
    ['webhooks/retry', 'WEBHOOK_RETRY_CRON_SECRET'],
  ]
  for (const [path, secretName] of paths) {
    for (const manual of [undefined, 'synthetic-manual-secret']) {
      const env = { CRON_SECRET: 'synthetic-cron-secret', [secretName]: manual,
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key' }
      const process = { env }
      const auth = harness('lib/integrations/auth.ts', { 'node:crypto': nodeCrypto }, { Buffer, process }).exports
      let calls = 0
      const work = async () => { calls++; return {} }
      const route = harness(`app/api/internal/${path}/route.ts`, {
        'next/server': { NextResponse },
        '@/lib/integrations/auth': auth,
        '@/lib/customerPortal/onboarding': { processPortalOnboardingJobs: work },
        '@/lib/customerPortal/authProfileSync': { processAuthProfileSyncJobs: work },
        '@/lib/website/submissionStore': { processWebsiteSubmissionReconciliationJobs: work },
        '@/lib/customerPortal/outbox': { processPortalWriteOutbox: work },
        '@/lib/webhooks/retry': { processOpsWebhookRetries: work },
        '@supabase/supabase-js': { createClient: () => ({ from() {
          return { select() { return this }, is() { return this }, eq() { return this }, or() { return this },
            order() { return this }, async limit() { calls++; return { data: [], error: null } } }
        } }) },
      }, { process, AbortSignal, console: { error() {} } }).exports
      const request = headers => new Request(`https://example.invalid/api/internal/${path}`, { headers })
      assert.equal((await route.GET(request({}))).status, 401)
      assert.equal((await route.GET(request({ authorization: 'Bearer wrong' }))).status, 401)
      assert.equal(calls, 0)
      assert.equal((await route.GET(request({ authorization: 'Bearer synthetic-cron-secret' }))).status, 200)
      assert.ok(calls > 0)
      if (manual) assert.equal((await route.GET(request({ 'x-cron-secret': manual }))).status, 200)
    }
  }
})

test('webhook retry RPC errors back off, eventually dead-letter and leave later rows runnable', async () => {
  let now = Date.parse('2026-11-22T12:00:00Z')
  const row = (id, offset) => ({
    id, event_id: id, event_type: 'invoice.issued', delivery_id: 'delivery-' + id,
    organization_reference: 'org', occurred_at: new Date(now).toISOString(), payload_hash: 'hash',
    payload: { event_id: id, event_type: 'invoice.issued' }, status: 'retryable_failure',
    attempt_count: 1, max_attempts: 3, next_attempt_at: new Date(now + offset).toISOString(),
  })
  const rows = [row('failing', -2), row('healthy', -1)]
  const calls = []
  let persistenceError = false
  const db = {
    async rpc(name, params) {
      assert.equal(name, 'apply_ops_domain_event_v2')
      calls.push(params.p_event_id)
      if (params.p_event_id === 'failing') return { error: new Error('synthetic RPC error') }
      rows[1].status = 'applied'
      return { data: [{ result: 'applied' }] }
    },
    from(table) {
      assert.equal(table, 'ops_webhook_events')
      const predicates = []
      let patch
      return {
        select() { return this },
        update(value) { patch = value; return this },
        eq(key, value) { predicates.push(row => row[key] === value); return this },
        lte(key, value) { predicates.push(row => row[key] !== null && row[key] <= value); return this },
        order() { return this },
        async limit(limit) { return { data: rows.filter(row => predicates.every(test => test(row))).slice(0, limit).map(row => ({ ...row })) } },
        async maybeSingle() {
          if (persistenceError) return { error: new Error('synthetic write failure') }
          const row = rows.find(row => predicates.every(test => test(row)))
          return { data: row ? Object.assign(row, patch) : null }
        },
      }
    },
  }
  const worker = harness('lib/webhooks/retry.ts', {
    '@/lib/supabase/service': { supabaseService: db },
    '@/lib/webhooks/opsWebhook': {
      parseOpsWebhookEnvelope: value => value,
      isSupportedOpsWebhookEventType: () => true,
      customerNotificationForEvent: () => null,
    },
  }, { Date: class extends Date { static now() { return now } constructor(value = now) { super(value) } }, console: { error() {} } }).exports
  const { processOpsWebhookRetries: process } = worker
  const first = await process({ limit: 1 })
  assert.equal(first.retryable_failures, 1)
  assert.equal(rows[0].attempt_count, 2)
  assert.ok(Date.parse(rows[0].next_attempt_at) > now)
  assert.equal((await process({ limit: 1 })).applied, 1)
  assert.deepEqual(calls, ['failing', 'healthy'])
  now = Date.parse(rows[0].next_attempt_at)
  persistenceError = true
  const route = harness('app/api/internal/webhooks/retry/route.ts', {
    'next/server': { NextResponse }, '@/lib/integrations/auth': cronAuth, '@/lib/webhooks/retry': worker,
  }, { process: { env: {} }, console: { error() {} } }).exports
  const request = () => new Request('https://example.invalid/api/internal/webhooks/retry', {
    headers: { authorization: 'Bearer synthetic-cron-secret' },
  })
  assert.equal((await route.GET(request())).status, 500)
  persistenceError = false
  const response = await route.GET(request())
  assert.equal(response.status, 200)
  assert.equal((await response.json()).permanent_failures, 1)
  assert.equal(rows[0].attempt_count, 3)
  assert.equal(rows[0].status, 'permanent_failure')
  assert.equal(rows[0].next_attempt_at, null)
  assert.equal((await process()).selected, 0)
})

test('checkout writes one row, rejects expired links and schedules protected cleanup', async () => {
  const instant = '2026-11-22T12:00:00.000Z'
  class FixedDate extends Date {
    constructor(value = instant) { super(value) }
    static now() { return Date.parse(instant) }
  }
  const calls = []
  let cleanupError = null
  const store = harness('lib/website/checkoutContextStore.ts', {
    'node:crypto': nodeCrypto,
    '@supabase/supabase-js': {
      createClient: () => ({
        from(table) {
          assert.equal(table, 'website_checkout_contexts')
          return {
            insert: async row => { calls.push(['insert', row]); return { error: null } },
            delete: () => ({
              lte: async (field, value) => { calls.push(['delete', field, value]); return { error: cleanupError } },
            }),
            select: () => ({
              eq: () => ({
                gt: (field, value) => ({
                  async maybeSingle() {
                    calls.push(['read', field, value])
                    const row = { public_context: { selectedOffer: 'expired' }, expires_at: instant }
                    return { data: row.expires_at > value ? row : null, error: null }
                  },
                }),
              }),
            }),
          }
        },
      }),
    },
  }, { Date: FixedDate, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic' } } }).exports
  const verification = { pricingSnapshotReference: 'snapshot_fixture', quoteReference: 'quote_fixture', status: 'valid', validatedAt: instant }
  const token = await store.createWebsiteCheckoutContext({ selectedOffer: 'offer_fixture' }, verification)
  assert.deepEqual(calls[0][1].public_context.verification, verification)
  assert.deepEqual(calls.map(([operation]) => operation), ['insert'])
  assert.equal(calls[0][1].expires_at, '2026-11-23T12:00:00.000Z')
  assert.equal(await store.readWebsiteCheckoutContext(token), null)
  assert.deepEqual(calls[1], ['read', 'expires_at', instant])

  const path = '/api/internal/checkout/contexts/cleanup'
  const route = harness(`app${path}/route.ts`, {
    '@/lib/integrations/auth': cronAuth,
    '@/lib/api/webBoundary': webBoundary,
    '@/lib/website/checkoutContextStore': store,
  }, { Buffer, process: { env: { CRON_SECRET: 'synthetic-cron-secret' } }, console: { error() {} } }).exports
  assert.equal((await route.GET(new Request(`https://example.invalid${path}`))).status, 401)
  assert.equal(calls.length, 2)
  const authorized = () => new Request(`https://example.invalid${path}`, { headers: { authorization: 'Bearer synthetic-cron-secret' } })
  const response = await route.GET(authorized())
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual(calls[2], ['delete', 'expires_at', instant])
  cleanupError = { message: 'Synthetic database failure' }
  assert.equal((await route.GET(authorized())).status, 503)

  const config = JSON.parse(fs.readFileSync(resolve(root, 'vercel.json'), 'utf8'))
  assert.equal(config.crons.find(job => job.path === path).schedule, '*/10 * * * *')
})

test('checkout handoff retries an OPS-verified quote without a separate snapshot write', async () => {
  const quote = {
    version: 5,
    quote_attempt_id: '33333333-3333-4333-8333-333333333333',
    pricing_snapshot_reference: 'snapshot_fixture',
    ops_quote_reference: 'quote_fixture',
    resolution_id: 'resolution_fixture',
    price_area_code: 'SE3',
    requested_start_mode: 'earliest_possible',
    contract: { offer_reference: 'offer_fixture' },
    price_option_reference: 'option_fixture',
    area_price_reference: null,
    valid_until: '2026-11-22T12:00:00.000Z',
    selected_component_references: [],
  }
  const area = {
    resolution_id: quote.resolution_id,
    price_area_code: 'SE3',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    quote_ready: true,
    price_area_assurance: {},
  }
  const renewedArea = { ...area, resolution_id: 'resolution_renewed', grid_area_code: 'renewed-grid' }
  let areaReads = 0
  let areaWrites = 0
  let checks = 0
  let snapshotWrites = 0
  const entirePricingToken = 'signed.' + 'x'.repeat(17_000)
  let opsValid = true
  let writeFailed = true
  const stored = []
  const boundaries = {
    'next/server': { NextResponse },
    '@/lib/api/webBoundary': webBoundary,
    '@/lib/website/checkoutAddress': harness('lib/website/checkoutAddress.ts').exports,
    '@/lib/security/rateLimit': { checkRateLimit: async () => ({ allowed: true }), clientIpFromHeaders: () => '192.0.2.1' },
    '@/lib/ops/client': {
      fetchOpsPublicContractsSnapshot: async () => ({ contracts: [{ offer_reference: 'offer_fixture' }] }),
      fetchOpsWebsiteEnergyArea: async () => {
        areaReads++
        return {
          ...renewedArea, status: 'verified', valid_until: renewedArea.expires_at,
          capabilities: { pricing_ready: true, quote_ready: true },
          price_area_assurance: { price_area: 'SE3', unique_price_area_count: 1, status: 'verified' },
        }
      },
      validateOpsWebsiteQuote: async (input, signal) => {
        checks++
        assert.equal(input.quote_reference, quote.ops_quote_reference)
        assert.equal(input.resolution_id, quote.resolution_id)
        assert.ok(signal instanceof AbortSignal)
        return {
          valid: opsValid,
          price_option_reference: quote.price_option_reference,
          area_price_reference: quote.area_price_reference,
          valid_until: quote.valid_until,
        }
      },
    },
    '@/lib/website/customerType': {
      contractSupportsCustomerType: () => true,
      parseWebsiteCustomerType: () => 'private',
    },
    '@/lib/website/publicContractDisplay': { buildPublicContractDisplay: () => ({ onlineReady: true }) },
    '@/lib/website/checkoutPolicy': { matchesGridexWebsiteCheckoutPolicy: () => true },
    '@/lib/website/energyAreaToken': {
      verifyWebsiteEnergyAreaToken: ({ token }) => ({ ok: true, payload: token === 'renewed-area' ? renewedArea : area }),
      issueWebsiteEnergyAreaToken: () => ({ token: 'renewed-area' }),
    },
    '@/lib/website/energyAreaStore': { persistOpsEnergyAreaResolution: async () => { areaWrites++ } },
    '@/lib/website/pricingQuote': {
      MAX_WEBSITE_PRICING_TOKEN_LENGTH: 24_000,
      verifyWebsitePricingQuote: token => { assert.equal(token, entirePricingToken); return { ok: true } },
      validateWebsitePricingQuote: tokenInput => {
        assert.equal(tokenInput.token, entirePricingToken)
        return { ok: true, quote }
      },
      quoteToWebsitePricingPreview: () => ({}),
    },
    '@/lib/website/pricingSnapshotStore': {
      markWebsitePricingSnapshotValidated: async () => { snapshotWrites++; throw Error('Synthetic audit store outage') },
    },
    '@/lib/website/checkoutContextStore': {
      createWebsiteCheckoutContext: async (context, receipt) => {
        if (writeFailed) throw Error('Synthetic context store outage')
        stored.push({ context, receipt })
        return 'synthetic-checkout'
      },
    },
    '@/lib/website/requestedStart': {
      parseRequestedStartSelection: () => ({ ok: true, value: { mode: 'earliest_possible' } }),
    },
    '@/lib/website/consumptionEstimator': {
      normalizeWebsiteConsumptionProfile: value => value,
      consumptionProfileMatchesMonthlyKwh: () => true,
    },
  }
  boundaries['@/lib/website/canonicalQuoteValidation'] = harness('lib/website/canonicalQuoteValidation.ts', boundaries).exports
  const route = harness('app/api/checkout/context/route.ts', boundaries, { Headers, console: { error() {} } }).exports
  boundaries['@/lib/observability/apiPerformance'] = { observeApiOperation: (_name, operation) => operation() }
  boundaries['@/lib/ops/errors'] = { opsRetryAfterHeaders: () => ({}) }
  const validation = harness('app/api/checkout/quote/validate/route.ts', {
    ...boundaries,
    '@/lib/website/canonicalQuoteValidation': {
      validateCanonicalWebsiteQuote: async input => {
        assert.equal(input.pricingToken, entirePricingToken)
        assert.equal(input.location.address, 'a'.repeat(180))
        return { ok: true, value: { quote, area: { resolutionId: 'resolution_fixture' }, opsValidation: { valid_until: quote.valid_until } } }
      },
    },
  }, { Headers }).exports
  const submit = (pricingToken = entirePricingToken, handler = route, address = ` ${'a'.repeat(180)} `) => handler.POST(new Request('https://example.invalid/api/checkout/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://example.invalid' },
    body: JSON.stringify({
      offer_reference: 'offer_fixture', pricing_token: pricingToken, resolution_token: 'synthetic-area',
      pricing_snapshot_reference: quote.pricing_snapshot_reference, quote_attempt_id: quote.quote_attempt_id,
      postal_code: '11122', city: 'Stockholm', address,
      estimated_monthly_kwh: 100, annual_consumption_kwh: 1200, consumption_profile: { annual_kwh: 1200 },
    }),
  }))
  assert.equal((await submit()).status, 503)
  assert.equal(stored.length, 0)
  writeFailed = false
  const response = await submit()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { checkout_token: 'synthetic-checkout' })
  assert.equal(stored[0].context.quoteContext.address, 'a'.repeat(180))
  assert.equal(stored[0].receipt.pricingSnapshotReference, quote.pricing_snapshot_reference)
  assert.equal(stored[0].receipt.quoteReference, quote.ops_quote_reference)
  assert.equal(stored[0].receipt.status, 'valid')
  assert.ok(Number.isFinite(Date.parse(stored[0].receipt.validatedAt)))
  opsValid = false
  assert.equal((await submit()).status, 409)
  assert.equal(stored.length, 1)
  opsValid = true
  assert.equal((await submit(entirePricingToken, validation)).status, 200)
  for (const handler of [route, validation]) {
    const longAddress = await submit(entirePricingToken, handler, 'a'.repeat(181))
    assert.equal(longAddress.status, 400)
    assert.equal((await longAddress.json()).error.field, 'address')
    const oversize = await submit('x'.repeat(24_001), handler)
    assert.equal(oversize.status, 400)
    assert.equal((await oversize.json()).error.code, 'pricing_token_too_long')
  }
  assert.equal(checks, 3)
  assert.equal(snapshotWrites, 0)

  area.expires_at = new Date(Date.now() - 60_000).toISOString()
  assert.equal((await submit()).status, 200)
  const { quoteContext } = stored[1].context
  assert.equal(quoteContext.resolution_token, 'synthetic-area')
  assert.equal(quoteContext.current_resolution_token, 'renewed-area')
  assert.equal(quoteContext.resolution_id, quote.resolution_id)
  const validate = currentResolutionToken => boundaries['@/lib/website/canonicalQuoteValidation'].validateCanonicalWebsiteQuote({
    resolutionToken: quoteContext.resolution_token,
    currentResolutionToken,
    pricingToken: entirePricingToken,
    requestedStartMode: 'earliest_possible',
    location: { postalCode: quoteContext.postal_code, city: quoteContext.city, address: quoteContext.address },
  }, { signal: new AbortController().signal, audit: 'checkout-context' })
  const final = await validate(quoteContext.current_resolution_token)
  assert.equal(final.ok, true)
  assert.equal(final.value.area.resolutionId, quote.resolution_id)
  assert.equal(final.value.area.gridAreaCode, 'renewed-grid')
  assert.equal(areaReads, 1)
  assert.equal(areaWrites, 1)
  renewedArea.price_area_code = 'SE4'
  assert.deepEqual(JSON.stringify(await validate(quoteContext.current_resolution_token)), JSON.stringify({ ok: false, reason: 'area_changed' }))
  assert.equal(areaReads, 1)
})

test('submission preparation and atomic lock use three operations and preserve accepted retries', async () => {
  let row = null
  const operations = []
  const table = {
    select: columns => query('read', null, columns),
    insert: async value => { operations.push(['insert']); row = { ...value }; return { error: null } },
    update: patch => query('update', patch),
  }
  function query(operation, patch, selectColumns) {
    const filters = []
    const api = {
      eq: (field, value) => { filters.push(record => record[field] === value); return api },
      is: (field, value) => {
        filters.push(record => (record[field] ?? null) === value)
        return api
      },
      neq: (field, value) => { filters.push(record => record[field] !== value); return api },
      select: columns => { selectColumns = columns; return api },
      async maybeSingle() {
        operations.push([operation, selectColumns, patch])
        if (!row || !filters.every(matches => matches(row))) return { data: null, error: null }
        if (patch) Object.assign(row, patch)
        const data = Object.fromEntries(selectColumns.split(',').map(key => [key, row[key]]))
        return { data, error: null }
      },
    }
    return api
  }
  const store = harness('lib/website/submissionStore.ts', {
    'node:crypto': nodeCrypto,
    '@supabase/supabase-js': { createClient: () => ({ from: () => table }) },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic' } } }).exports
  const prepared = {
    submissionAttemptId: 'attempt_fixture', idempotencyKey: 'idempotency_fixture',
    externalApplicationId: 'application_fixture', externalCustomerId: 'customer_fixture',
    offerReference: 'offer_fixture', payloadHash: 'prepared_fixture',
    requestContext: {}, pricingQuoteSnapshot: {}, contractDisplaySnapshot: {}, legalEvidenceSnapshot: {},
  }
  const exact = { submissionAttemptId: prepared.submissionAttemptId, opsPayloadHash: 'ops_fixture' }
  const first = await store.prepareWebsiteSubmission(prepared)
  await store.lockWebsiteSubmissionOpsPayload(exact)
  assert.deepEqual(operations.map(([operation]) => operation), ['read', 'insert', 'update'])
  assert.equal(operations[0][1].includes('snapshot'), false)
  assert.equal(row.status, 'submitting')
  assert.equal(row.ops_payload_hash, exact.opsPayloadHash)
  assert.equal(row.attempt_count, 1)

  row.status = 'failed'
  row.attempt_count = 2
  await store.lockWebsiteSubmissionOpsPayload(exact)
  assert.equal(row.attempt_count, 2)
  assert.equal(row.status, 'submitting')
  row.status = 'accepted'
  await store.lockWebsiteSubmissionOpsPayload(exact)
  assert.equal(row.status, 'accepted')
  assert.equal(row.attempt_count, 2)
  await assert.rejects(store.lockWebsiteSubmissionOpsPayload({ ...exact, opsPayloadHash: 'changed' }), /payload changed/)
  assert.equal(row.ops_payload_hash, exact.opsPayloadHash)
  assert.equal(row.status, 'accepted')
  const replay = await store.prepareWebsiteSubmission(prepared)
  assert.equal(replay.acceptedAt, first.acceptedAt)

  row.status = 'prepared'
  row.ops_payload_hash = null
  const [winner, conflict] = await Promise.allSettled([
    store.lockWebsiteSubmissionOpsPayload(exact),
    store.lockWebsiteSubmissionOpsPayload({ ...exact, opsPayloadHash: 'concurrent_change' }),
  ])
  assert.equal(winner.status, 'fulfilled')
  assert.equal(conflict.status, 'rejected')
  assert.match(conflict.reason.message, /payload changed/)
  assert.equal(row.ops_payload_hash, exact.opsPayloadHash)
})

test('onboarding cron reports each outcome after the independent queue branches settle', async () => {
  const pending = Promise.withResolvers()
  const calls = []
  const budgets = []
  const route = harness('app/api/internal/customer-portal/onboarding/process/route.ts', {
    '@/lib/integrations/auth': cronAuth,
    'next/server': { NextResponse },
    '@/lib/customerPortal/onboarding': {
      processPortalOnboardingJobs: async (_, signal) => {
        calls.push('onboarding')
        signal.throwIfAborted()
        return pending.promise
      },
    },
    '@/lib/customerPortal/authProfileSync': {
      processAuthProfileSyncJobs: async (_, signal) => {
        calls.push('profiles')
        signal.throwIfAborted()
        throw new Error('Synthetic profile queue failure')
      },
    },
    '@/lib/website/submissionStore': {
      processWebsiteSubmissionReconciliationJobs: async (_, signal) => {
        calls.push('submissions')
        signal.throwIfAborted()
      },
    },
  }, {
    process: { env: { CRON_SECRET: 'synthetic-cron-secret' } },
    AbortSignal: {
      timeout(milliseconds) {
        budgets.push(milliseconds)
        return budgets.length === 3 ? AbortSignal.abort(new DOMException('Expired', 'TimeoutError')) : new AbortController().signal
      },
    },
    console: { error() {} },
  }).exports
  const url = 'https://example.invalid/api/internal/customer-portal/onboarding/process'
  assert.equal((await route.GET(new Request(url))).status, 401)
  assert.deepEqual(calls, [])
  const result = route.GET(new Request(url, { headers: { authorization: 'Bearer synthetic-cron-secret' } }))
  const marker = Symbol('pending')
  try {
    assert.equal(await Promise.race([result, Promise.resolve(marker)]), marker)
    assert.deepEqual(calls, ['onboarding', 'profiles', 'submissions'])
    assert.deepEqual(budgets, [45_000, 45_000, 45_000])
  } finally {
    pending.resolve({ processed: 1, completed: 1, pending: 0, failed: 0 })
  }
  const response = await result
  assert.equal(response.status, 500)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual(await response.json(), {
    ok: false,
    onboarding: { processed: 1, completed: 1, pending: 0, failed: 0 },
    profiles: { error: 'branch_failed' },
    submissions: { error: 'branch_timeout' },
  })
})

test('rate-limit cleanup is an independent protected cron with its own result', async () => {
  const cutoff = new Date('2026-11-15T12:00:00Z').toISOString()
  const filters = []
  let error = null
  const routePath = '/api/internal/rate-limits/cleanup'
  const route = harness(`app${routePath}/route.ts`, {
    '@/lib/integrations/auth': cronAuth,
    '@/lib/api/webBoundary': webBoundary,
    '@/lib/supabase/service': { supabaseService: {
      from(table) {
        assert.equal(table, 'distributed_rate_limits')
        return { delete: options => {
          assert.equal(options.count, 'exact')
          return { lt: (column, value) => {
            filters.push([column, value])
            return { abortSignal: async signal => {
              assert.ok(signal instanceof AbortSignal)
              return { count: error ? null : 2, error }
            } }
          } }
        } }
      },
    } },
  }, {
    Date: class extends Date { static now() { return Date.parse('2026-11-22T12:00:00Z') } },
    AbortSignal, console: { info() {}, error() {} },
  }).exports
  const url = `https://example.invalid${routePath}`
  assert.equal((await route.GET(new Request(url))).status, 401)
  assert.deepEqual(filters, [])
  const authorized = () => new Request(url, { headers: { authorization: 'Bearer synthetic-cron-secret' } })
  const success = await route.GET(authorized())
  assert.equal(success.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual(await success.json(), { ok: true, deleted: 2 })
  assert.deepEqual(filters, [['reset_at', cutoff]])
  error = { message: 'Synthetic database error' }
  assert.equal((await route.GET(authorized())).status, 503)
  const config = JSON.parse(fs.readFileSync(resolve(root, 'vercel.json'), 'utf8'))
  assert.equal(config.crons.find(job => job.path === routePath).schedule, '50 * * * *')
})

test('support receipt cron preserves four-item claims and reports oldest waiting age independently', async () => {
  const now = Date.parse('2026-11-22T12:00:00Z')
  const operations = Array.from({ length: 5 }, (_, index) => ({
    operation_id: `receipt_${index}`, recipient: 'synthetic@example.invalid', body: 'Synthetic receipt',
    claim_token: `claim_${index}`, attempt_count: 1, status: 'pending', first_attempt_at: new Date(now).toISOString(),
    created_at: new Date(now - 600_000 + index * 1000).toISOString(),
  }))
  const sends = []
  let ageError = false
  let writeFailure
  const providerErrors = new Map()
  const db = {
    rpc: async (name, params) => {
      assert.equal(name, 'gridex_claim_public_receipts_v1')
      assert.equal(params.p_limit, 4)
      const batch = operations.filter(row => row.status === 'pending').slice(0, params.p_limit)
      for (const row of batch) row.status = 'processing'
      return { data: batch, error: null }
    },
    from(name) {
      assert.equal(name, 'public_support_receipts')
      return {
        update(patch) {
          const filters = {}
          const query = {
            eq(key, value) { filters[key] = value; return this },
            select() { return this },
            async maybeSingle() {
              const row = operations.find(candidate => Object.entries(filters).every(([key, value]) => candidate[key] === value))
              assert.ok(row, 'the original claim token must still own the receipt')
              assert.equal(filters.status, 'processing')
              assert.ok(filters.claim_token)
              if (row.operation_id === writeFailure) return { data: null, error: { message: 'Synthetic isolated write failure' } }
              Object.assign(row, patch)
              return { data: { operation_id: row.operation_id }, error: null }
            },
          }
          return query
        },
        select(column) {
          assert.equal(column, 'created_at')
          return {
            in(field, statuses) { assert.equal(field, 'status'); assert.deepEqual([...statuses], ['pending', 'failed']); return this },
            order(field) { assert.equal(field, 'created_at'); return this },
            limit(value) { assert.equal(value, 1); return this },
            abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return this },
            async maybeSingle() {
              return ageError
                ? { data: null, error: { message: 'Synthetic metric failure' } }
                : { data: operations.find(row => row.status === 'pending') ?? null, error: null }
            },
          }
        },
      }
    },
  }
  const receipts = harness('lib/customerPortal/publicSupportReceipts.ts', { '@/lib/supabase/service': { supabaseService: db } }, {
    process: { env: { GRIDEX_SUPPORT_RECEIPT_RESEND_KEY: 'synthetic-key', GRIDEX_SUPPORT_RECEIPT_FROM: 'synthetic@example.invalid' } },
    Date: class extends Date { static now() { return now } },
    AbortSignal,
    console: { error() {} },
    fetch: async (_url, init) => {
      sends.push(init.headers['Idempotency-Key'])
      const name = providerErrors.get(init.headers['Idempotency-Key'])
      return name ? Response.json({ name }, { status: 409 }) : Response.json({ id: 'synthetic-provider-id' })
    },
  }).exports
  const routePath = '/api/internal/support/receipts/process'
  const route = harness(`app${routePath}/route.ts`, {
    '@/lib/api/webBoundary': webBoundary,
    '@/lib/integrations/auth': cronAuth,
    '@/lib/customerPortal/publicSupportReceipts': receipts,
  }, { console: { error() {}, info() {} } }).exports
  const request = () => new Request(`https://example.invalid${routePath}`, { headers: { authorization: 'Bearer synthetic-cron-secret' } })
  const first = await route.GET(request())
  assert.equal(first.status, 200)
  assert.deepEqual(await first.json(), { ok: true, processed: 4, sent: 4, failed: 0, oldestWaitingAgeMs: 596_000 })
  ageError = true
  const second = await route.GET(request())
  assert.equal(second.status, 200)
  assert.deepEqual(await second.json(), { ok: true, processed: 1, sent: 1, failed: 0, oldestWaitingAgeMs: null })
  assert.deepEqual(sends, operations.map(row => `public-support-receipt:${row.operation_id}`))
  for (const row of operations.slice(0, 4)) {
    row.status = 'pending'
    row.claim_token = `new-${row.operation_id}`
  }
  writeFailure = operations[0].operation_id
  providerErrors.set('public-support-receipt:receipt_2', 'concurrent_idempotent_requests')
  providerErrors.set('public-support-receipt:receipt_3', 'invalid_idempotent_request')
  assert.equal((await route.GET(request())).status, 503)
  assert.equal(operations[0].status, 'processing')
  assert.equal(operations[1].status, 'sent')
  assert.equal(operations[2].status, 'failed')
  assert.equal(operations[2].last_error_code, 'concurrent_idempotent_requests')
  assert.ok(Date.parse(operations[2].next_attempt_at) > now)
  assert.equal(operations[3].status, 'manual_review')
  assert.deepEqual(sends.slice(5), operations.slice(0, 4).map(row => `public-support-receipt:${row.operation_id}`))

  // Model a reclaimed lock and a retry becoming due in the next batch.
  for (const index of [0, 2]) {
    operations[index].status = 'pending'
    operations[index].claim_token = `retry-${index}`
  }
  writeFailure = undefined
  providerErrors.clear()
  assert.equal((await route.GET(request())).status, 200)
  assert.deepEqual(sends.slice(-2), ['public-support-receipt:receipt_0', 'public-support-receipt:receipt_2'])
  assert.equal(operations[0].status, 'sent')
  assert.equal(operations[2].status, 'sent')
  assert.equal(operations[3].status, 'manual_review')
  const config = JSON.parse(fs.readFileSync(resolve(root, 'vercel.json'), 'utf8'))
  assert.equal(config.crons.find(job => job.path === routePath).schedule, '*/2 * * * *')
})

test('password recovery carries the safe invoice destination from login through password update', async () => {
 const origin = 'https://gridex.example.test';
 const login = harness('app/login/page.tsx', {...recoveryBoundaries, './actions': {loginWithPassword(){}}});
 const verify = harness('app/auth/confirm/route.ts', {
  ...recoveryBoundaries, 'next/server': {NextResponse},
  '@/lib/supabase/server': {createSupabaseServerActionClient: async () => ({auth:{verifyOtp: async () => ({data:{session:{user:{id:'customer'}}},error:null})}})},
  '@/lib/customerPortal/authProfileSync': {}, '@/lib/customerPortal/onboardingResume': {},
 }, {URL});
 for (const [input, expected] of [['/dashboard/invoices?year=2026#latest','/dashboard/invoices?year=2026#latest'], ['//external.example','/mina-sidor']]) {
  const initial = await login.render({searchParams:Promise.resolve({next:input})});
  const forgotHref = nodes(initial).find(node => node.props?.href?.startsWith('/login/forgot-password?')).props.href;
  let redirectTo;
  const forgot = harness('app/login/forgot-password/page.tsx', {
   ...recoveryBoundaries,
   '@/lib/supabase/client': {createSupabaseBrowserClient: () => ({auth:{resetPasswordForEmail:async (_email, options) => {
    redirectTo=options.redirectTo;
    return {error:null};
   }}})},
  }, {URLSearchParams, window:{location:new URL(forgotHref, origin)}});
  forgot.render();
  forgot.effects[0]();
  forgot.states[0]='customer@example.test';
  await nodes(forgot.render()).find(node=>node.type==='form').props.onSubmit(event);
  const callback=new URL(redirectTo);
  callback.searchParams.set('token_hash','synthetic');
  callback.searchParams.set('type','recovery');
  const verified=await verify.exports.GET(new Request(callback));
  const resetUrl=new URL(verified.headers.get('location'));
  assert.equal(resetUrl.pathname,'/login/reset-password');
  assert.equal(resetUrl.searchParams.get('next'),expected);

  let destination;
  const reset=harness('app/login/reset-password/page.tsx', {
   ...recoveryBoundaries, '@/lib/auth/passwordPolicy':policy,
   'next/navigation':{useRouter:()=>({push:value=>{destination=value}})},
   '@/lib/supabase/client':{createSupabaseBrowserClient:()=>({auth:{
    getSession:async()=>({data:{session:{user:{id:'customer'}}},error:null}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
    updateUser:async()=>({error:null}),
   }})},
  }, {URLSearchParams, window:{location:resetUrl,setTimeout:fn=>fn()}});
  reset.render();
  reset.effects[0]();
  await Promise.resolve();
  reset.states[1]=reset.states[2]='Synthetic-Password1';
  await nodes(reset.render()).find(node=>node.type==='form').props.onSubmit(event);
  const nextLogin=new URL(destination,origin);
  assert.equal(nextLogin.pathname,'/login');
  assert.equal(nextLogin.searchParams.get('status'),'password-updated');
  const form=await login.render({searchParams:Promise.resolve(Object.fromEntries(nextLogin.searchParams))});
  assert.equal(nodes(form).find(node=>node.props?.name==='next').props.value,expected);
 }
})

test('login preserves invoice and document targets across temporary session verification failures', async () => {
 const destinations = ['/dashboard/invoices?year=2026', '/dashboard/documents#signed'];
 let verified = false;
 let signOuts = 0;
 const calls = [];
 const user = {id:'synthetic-user',email:'person@example.test'};
 const supabase = {
  auth:{
   signInWithPassword:async()=>({error:null}),
   getUser:async()=>verified ? {data:{user},error:null} : {data:{user:null},error:{status:503}},
   signOut:async()=>{signOuts++;return {error:null};},
  },
  rpc:async name=>{calls.push(name);return {data:[],error:null};},
  from:()=>({select(){return this;},eq(){return this;},returns:async()=>({data:[],error:null})}),
 };
 const login = harness('app/login/actions.ts', {
  ...recoveryBoundaries,
  'next/navigation':{redirect:path=>{throw Object.assign(new Error(path),{path});}},
  '@/lib/supabase/server':{createSupabaseServerActionClient:async()=>supabase},
  '@/lib/customerPortal/onboardingResume':{resumePortalOnboardingForConfirmedUserSafely:async input=>{
   assert.equal(input.userId,user.id);
   calls.push('onboarding');
   return {blocked:0};
  }},
 });
 for (const next of destinations) {
  const form = new FormData();
  form.set('email',user.email);
  form.set('password','synthetic-password');
  form.set('next',next);
  verified=false;
  calls.length=0;
  await assert.rejects(login.exports.loginWithPassword(form), error=>{
   const target=new URL(error.path,'https://gridex.example.test');
   assert.equal(target.pathname,'/login');
   assert.equal(target.searchParams.get('next'),next);
   assert.match(target.searchParams.get('error'),/verifiera sessionen.*försök/i);
   return true;
  });
  assert.deepEqual(calls,[]);
  verified=true;
  await assert.rejects(login.exports.loginWithPassword(form), {path:next});
  assert.ok(calls.includes('onboarding'));
 }
 assert.equal(signOuts,2);
});

test('login distinguishes temporary Auth errors and keeps the same message for invalid credentials', async () => {
 let authError;
 const login=harness('app/login/actions.ts', {
  ...recoveryBoundaries,
  'next/navigation':{redirect:path=>{throw Object.assign(new Error(path),{path});}},
  '@/lib/supabase/server':{createSupabaseServerActionClient:async()=>({auth:{
   signInWithPassword:async()=>({error:authError}),
   getUser:async()=>{throw Error('No user verification after a rejected password');},
  }})},
  '@/lib/customerPortal/onboardingResume':{},
 });
 for (const [status,code,temporary] of [[503,'unexpected_failure',true],[429,'over_request_rate_limit',true],[0,'network',true],[400,'invalid_credentials',false],[404,'user_not_found',false]]) {
  authError={status,code};
  const form=new FormData();
  form.set('email','person@example.test');
  form.set('password','synthetic-password');
  form.set('next','/dashboard/invoices');
  await assert.rejects(login.exports.loginWithPassword(form), error=>{
   const target=new URL(error.path,'https://gridex.example.test');
   assert.equal(target.searchParams.get('next'),'/dashboard/invoices');
   assert.equal(target.searchParams.get('error'),temporary
    ? 'Inloggningen är tillfälligt otillgänglig. Försök igen om en stund.'
    : 'Fel e-post eller lösenord');
   return true;
  });
 }
});

test('login checks privileges only for admin destinations and starts portal work before audit finishes', async () => {
 const operations = [];
 let admin = false;
 let releaseAudit;
 const observeErrors = [];
 const user = {id:'verified-user',email:'person@example.test'};
 const supabase = {
  auth: {
   signInWithPassword:async()=>({error:null}),
   getUser:async()=>({data:{user},error:null}),
   signOut:async()=>({error:null}),
  },
  rpc:async name=>{
   operations.push(name);
   if (name==='gridex_my_permissions_v1') return {data:admin ? ['admin.access'] : [],error:null};
   if (releaseAudit) await releaseAudit;
   return {error:Error('synthetic audit outage')};
  },
  from:table=>{
   operations.push(table);
   return {select(){return this;},eq(_key,id){assert.equal(id,user.id);return this;},returns:async()=>({data:[],error:null})};
  },
 };
 let resumed;
 const portalStarted = new Promise(resolve => {resumed=resolve;});
 const login=harness('app/login/actions.ts', {
  ...recoveryBoundaries,
  'next/navigation':{redirect:path=>{throw Object.assign(new Error(path),{path});}},
  '@/lib/supabase/server':{createSupabaseServerActionClient:async()=>supabase},
  '@/lib/customerPortal/onboardingResume':{resumePortalOnboardingForConfirmedUserSafely:async ({userId})=>{
   assert.equal(userId,user.id);
   operations.push('portal');
   resumed();
   return {blocked:0};
  }},
 }, {console:{error:(...args)=>observeErrors.push(args)}});
 const submit=next=>{
  const form=new FormData();
  form.set('email',user.email);
  form.set('password','synthetic-password');
  form.set('next',next);
  return login.exports.loginWithPassword(form);
 };
 let unblock;
 releaseAudit=new Promise(resolve=>{unblock=resolve;});
 const customer=submit('/mina-sidor');
 await portalStarted;
 assert.deepEqual(operations,['gridex_my_log_login_v1','portal']);
 assert.equal(observeErrors.length,0);
 unblock();
 await assert.rejects(customer,{path:'/mina-sidor'});
 assert.equal(observeErrors.length,1);
 releaseAudit=null;
 admin=true;
 for (const [target,expected] of [['/dashboard','/admin'], ['/admin/agreements','/admin/agreements'], ['/dashboard/invoices','/dashboard/invoices']]) {
  operations.length=0;
  await assert.rejects(submit(target),{path:expected});
  const adminChecks=target!=='/dashboard/invoices';
  assert.equal(operations.includes('gridex_my_permissions_v1'),adminChecks);
  assert.equal(operations.includes('user_roles'),adminChecks);
 }
 admin=false;
 await assert.rejects(submit('/admin/agreements'),{path:'/login?reason=forbidden'});
});
