import { test, after } from 'node:test';
import assert from 'node:assert/strict';
const names = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_CUSTOMER_API_URL'];
const previous = names.map(key => process.env[key]);
after(() => { names.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; }); delete globalThis.__mobileAdapterFixture; });
let count, captures;
function configure(key = 'sb_publishable_test') {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
  process.env.EXPO_PUBLIC_CUSTOMER_API_URL = 'https://tenant.test';
  count = 0; captures = [];
  const data = new Map();
  globalThis.__mobileAdapterFixture = {
    createClient: (...args) => { count++; captures.push(args); return { instance: count }; },
    get: async (k, options) => { assert.equal(options.keychainAccessible, 1); return data.get(k) ?? null; },
    set: async (k, v, options) => { assert.equal(options.keychainAccessible, 1); data.set(k, v); },
    remove: async k => { data.delete(k); },
  };
}
test('repeated mounts share one SDK client and encrypted storage, brands stay separate', async () => {
  configure(); const { createAccountClient } = await import('../apps/mobile/src/accountClient.ts?adapter=one');
  assert.equal(createAccountClient('brand'), createAccountClient('brand')); assert.equal(count, 1);
  assert.notEqual(createAccountClient('brand'), createAccountClient('other')); assert.equal(count, 2);
  const first = captures[0][2].auth, second = captures[1][2].auth;
  assert.equal(first.persistSession, true); assert.equal(first.autoRefreshToken, true); assert.equal(first.detectSessionInUrl, false);
  await first.storage.setItem('session', 'secret-session'.repeat(300));
  assert.equal(await second.storage.getItem('session'), null);
  await first.storage.removeItem('session'); assert.equal(await first.storage.getItem('session'), null);
});
test('secret keys and legacy service-role keys never initialize a client', async () => {
  for (const [i, key] of ['sb_secret_private', `a.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.c`].entries()) {
    configure(key); const { createAccountClient } = await import(`../apps/mobile/src/accountClient.ts?invalid=${i}`);
    assert.equal(createAccountClient('brand'), null); assert.equal(count, 0);
  }
});

test('the configured Auth transport bounds a stalled SDK login and does not install a late session', async t => {
  configure();const {createAccountClient}=await import('../apps/mobile/src/accountClient.ts?adapter=deadline');
  createAccountClient('deadline');const transport=captures[0][2].global.fetch;
  const {createClient,isAuthRetryableFetchError}=await import('../apps/mobile/node_modules/@supabase/supabase-js/dist/index.mjs');
  const originalFetch=globalThis.fetch;
  let settle,signal;
  try {
    globalThis.fetch=(_input,init)=>{signal=init.signal;return new Promise(resolve=>{settle=resolve;});};
    t.mock.timers.enable({apis:['setTimeout']});
    const client=createClient('https://project.supabase.co','sb_publishable_test',{global:{fetch:transport},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const request=client.auth.signInWithPassword({email:'synthetic@example.test',password:'synthetic'});
    await new Promise(resolve=>setImmediate(resolve));
    assert.ok(signal);assert.equal(signal.aborted,false);
    t.mock.timers.tick(10000);
    const result=await request;
    assert.equal(signal.aborted,true);assert.equal(isAuthRetryableFetchError(result.error),true);
    assert.equal(result.data.session,null);
    settle(Response.json({access_token:'late',refresh_token:'late',user:{id:'late'}}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal((await client.auth.getSession()).data.session,null);
  } finally {globalThis.fetch=originalFetch;t.mock.timers.reset();}
});

test('Auth transport keeps caller cancellation and discards transport results arriving after it', async () => {
  const {accountFetch}=await import('../apps/mobile/src/accountFetch.ts');
  const originalFetch=globalThis.fetch;const controller=new AbortController();let settle,signal;
  try {
    globalThis.fetch=(_input,init)=>{signal=init.signal;return new Promise(resolve=>{settle=resolve;});};
    const pending=accountFetch('https://project.supabase.co/auth/v1/token',{signal:controller.signal});
    const rejected=assert.rejects(pending,/Cancelled/);
    controller.abort();await rejected;assert.equal(signal.aborted,true);
    settle(Response.json({ignored:true}));
  } finally {globalThis.fetch=originalFetch;}
});

test('successful Auth transport preserves the response and clears its deadline', async t => {
  const {accountFetch}=await import('../apps/mobile/src/accountFetch.ts');const originalFetch=globalThis.fetch;
  let signal;
  try {
    t.mock.timers.enable({apis:['setTimeout']});
    const expected=Response.json({ok:true});globalThis.fetch=async(_input,init)=>{signal=init.signal;assert.equal(init.headers.test,'preserved');return expected;};
    const actual=await accountFetch('https://project.supabase.co/auth/v1/token',{headers:{test:'preserved'}});assert.equal(actual.status,expected.status);assert.deepEqual(await actual.json(),{ok:true});
    t.mock.timers.tick(20000);assert.equal(signal.aborted,false);
  } finally {globalThis.fetch=originalFetch;t.mock.timers.reset();}
});

for(const phase of ['response','body'])test(`cancelling a configured client aborts Auth through a delayed ${phase}`,async()=>{
 configure();const {createAccountClient,cancelAccountAuth}=await import(`../apps/mobile/src/accountClient.ts?cancel=${phase}`);
 const client=createAccountClient('cancel');const transport=captures[0][2].global.fetch;
 const originalFetch=globalThis.fetch;let settle,signal;
 try{
  globalThis.fetch=async(_url,init)=>{signal=init.signal;return phase==='response'?new Promise(resolve=>{settle=resolve;}):{status:200,statusText:'OK',headers:{'content-type':'application/json'},text:()=>new Promise(resolve=>{settle=resolve;})};};
  const pending=transport('https://project.supabase.co/auth/v1/token');const rejected=assert.rejects(pending,/Cancelled/);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(typeof settle,'function');
  cancelAccountAuth(client);await rejected;assert.equal(signal.aborted,true);
  settle(phase==='response'?Response.json({ignored:true}):'');
 }finally{globalThis.fetch=originalFetch;}
});

test('an already cancelled Auth call never sends credentials',async()=>{
 const {accountFetch}=await import('../apps/mobile/src/accountFetch.ts');const originalFetch=globalThis.fetch;
 const controller=new AbortController();controller.abort();let calls=0;
 try{globalThis.fetch=async()=>{calls++;return Response.json({});};await assert.rejects(accountFetch('https://project.supabase.co/auth/v1/token',{signal:controller.signal}),/Cancelled/);assert.equal(calls,0);}
 finally{globalThis.fetch=originalFetch;}
});

test('the native fetch Response preserves UTF-8 Auth user metadata through the bounded transport',async()=>{
 const {Response:NativeResponse}=await import('../apps/mobile/node_modules/whatwg-fetch/dist/fetch.umd.js');
 const {accountFetch}=await import('../apps/mobile/src/accountFetch.ts');
 const originalFetch=globalThis.fetch,OriginalResponse=globalThis.Response;
 const metadata={full_name:'Åsa Öberg 😀'};
 try{
  globalThis.Response=NativeResponse;
  globalThis.fetch=async()=>new OriginalResponse(JSON.stringify({user_metadata:metadata}),{headers:{'content-type':'application/json'}});
  const response=await accountFetch('https://project.supabase.co/auth/v1/user');
  assert.deepEqual((await response.json()).user_metadata,metadata);
 }finally{globalThis.fetch=originalFetch;globalThis.Response=OriginalResponse;}
});
