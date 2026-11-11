import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {AuthRetryableFetchError, AuthApiError} from '@supabase/supabase-js';
import React from '../apps/mobile/node_modules/react/index.js';
import Renderer from '../apps/mobile/node_modules/react-test-renderer/index.js';
import { invoiceDetail, supportDetail } from '../lib/mobile/customerDetails.ts';
import { invoiceId, documentId, caseId, invoicePayload, supportPayload, messagesPayload } from './mobile-detail-fixtures.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; delete globalThis.__mobileFixture; });
const { act } = Renderer;
const listeners = new Set();
let authListener, current, session, refreshes, loginError, fetchCalls, handler;
const fixture = {
  appState: { currentState: 'active', addEventListener: (_name, fn) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } },
  client: { auth: {
    getSession: async () => ({ data: { session }, error: null }),
    refreshSession: async () => { refreshes++; return { data: { session }, error: null }; },
    signInWithPassword: async () => { if (loginError) return { error: Error('wrong password'), data: { session: null } }; session = { access_token: 'verified-token' }; return { data: { session } }; },
    signOut: async () => { session = null; authListener?.('SIGNED_OUT'); return {}; },
    onAuthStateChange: fn => { authListener = fn; return { data: { subscription: { unsubscribe() { authListener = null; } } } }; },
    startAutoRefresh() {}, stopAutoRefresh() {},
  } },
};
globalThis.__mobileFixture = fixture;
const { useCustomerAccount } = await import('../apps/mobile/src/useCustomerAccount.ts');
function Probe() { current = useCustomerAccount('test-brand'); return null; }
async function mount(saved = false) {
  session = saved ? { access_token: 'remembered-token' } : null;
  refreshes = 0; loginError = false; fetchCalls = 0;
  fixture.appState.currentState = 'active';
  handler = async () => Response.json({ data: { contracts: [{ reference: 'own-contract', name: null, status: null, startDate: null }] } });
  globalThis.fetch = async (...args) => { fetchCalls++; return handler(...args); };
  let view; await act(async () => { view = Renderer.create(React.createElement(Probe)); });
  return () => act(async () => view.unmount());
}
test('remembered sessions are refreshed before displaying customer data', async () => {
  const unmount = await mount(true);
  assert.equal(refreshes, 1); assert.equal(fetchCalls, 1); assert.equal(current.rows[0].reference, 'own-contract');
  await unmount();
});
test('bad passwords display an error even when local signout emits SIGNED_OUT', async () => {
  const unmount = await mount(); loginError = true;
  await act(async () => { await current.login('customer@example.test', 'wrong'); });
  assert.equal(current.authenticated, false); assert.ok(current.error); assert.equal(fetchCalls, 0);
  await unmount();
});
test('logout invalidates late customer responses and removes saved session', async () => {
  const unmount = await mount(); let resolve;
  handler = () => new Promise(r => { resolve = r; });
  let pending; await act(async () => { pending = current.login('c@example.test', 'password'); });
  await act(async () => current.logout()); assert.equal(current.rows, null);
  await act(async () => { resolve(Response.json({ data: { contracts: [{ reference: 'stale', name: null, status: null, startDate: null }] } })); await pending; });
  assert.equal(current.rows, null); assert.equal(current.authenticated, false); assert.equal(session, null);
  await unmount();
});
test('background clears customer rows and foreground revalidates saved session', async () => {
  const unmount = await mount(true);
  await act(async () => { fixture.appState.currentState = 'background'; for (const fn of listeners) fn('background'); });
  assert.equal(current.rows, null); assert.equal(current.active, false);
  await act(async () => { fixture.appState.currentState = 'active'; for (const fn of listeners) fn('active'); });
  assert.equal(refreshes, 2); assert.equal(current.rows[0].reference, 'own-contract');
  await unmount();
});
test('resource requests remain independent when invoices are unavailable', async () => {
  const unmount = await mount(true);
  handler = async () => new Response('', { status: 503 });
  await act(async () => { await current.select('invoices'); });
  assert.equal(current.authenticated, true); assert.equal(current.rows, null); assert.ok(current.error);
  handler = async () => Response.json({ data: { sites: [{ reference: 'own-site', address: null, postalCode: null, city: null, facilityId: null, priceArea: null, status: null }] } });
  await act(async () => { await current.select('sites'); });
  assert.equal(current.rows[0].reference, 'own-site'); assert.equal(current.error, '');
  await unmount();
});

test('invoice detail retry and foreground restoration preserve the selected invoice', async () => {
  const unmount = await mount(true); const paths = [];
  handler = async url => { paths.push(new URL(url).pathname); return Response.json({ data: { invoiceDetail: [invoiceDetail(invoicePayload(), invoiceId, [])] } }); };
  await act(async () => { await current.select('invoiceDetail', invoiceId); });
  assert.equal(current.invoice.reference, invoiceId);
  await act(async () => { await current.retry(); });
  await act(async () => { fixture.appState.currentState = 'background'; for (const fn of listeners) fn('background'); });
  assert.equal(current.invoice, null);
  await act(async () => { fixture.appState.currentState = 'active'; for (const fn of listeners) fn('active'); });
  assert.equal(current.invoice.reference, invoiceId);
  assert.ok(paths.every(p => p.endsWith(`/invoices/${invoiceId}`)));
  await unmount();
});
test('support detail retry preserves case and late messages cannot reappear after logout', async () => {
  const unmount = await mount(true);
  handler = async () => Response.json({ data: { supportDetail: [supportDetail(supportPayload(), messagesPayload(), caseId)] } });
  await act(async () => { await current.select('supportDetail', caseId); });
  assert.equal(current.support.reference, caseId);
  let resolve; handler = () => new Promise(r => { resolve = r; });
  let pending; await act(async () => { pending = current.retry(); });
  await act(async () => current.logout());
  await act(async () => { resolve(Response.json({ data: { supportDetail: [supportDetail(supportPayload(), messagesPayload(), caseId)] } })); await pending; });
  assert.equal(current.support, null); assert.equal(current.authenticated, false);
  await unmount();
});
test('document click fetches a new verified URL and sends no bearer to external opener', async () => {
  const unmount = await mount(true); let opened;
  handler = async (url, init) => {
    assert.ok(url.endsWith(`/invoices/${invoiceId}/documents/${documentId}`));
    assert.ok(init.headers.Authorization.startsWith('Bearer '));
    return Response.json({ data: { invoiceDocument: [{ reference: documentId, url: 'https://files.example.test/a?signature=test' }] } });
  };
  await act(async () => { await current.openDocument(invoiceId, documentId, (...args) => { assert.equal(args.length, 1); opened = args[0]; }); });
  assert.equal(opened, 'https://files.example.test/a?signature=test');
  await unmount();
});
test('logout while document request is pending suppresses external navigation', async () => {
  const unmount = await mount(true); let resolve, opened = false;
  handler = () => new Promise(r => { resolve = r; });
  let pending; await act(async () => { pending = current.openDocument(invoiceId, documentId, () => { opened = true; }); });
  await act(async () => current.logout());
  await act(async () => { resolve(Response.json({ data: { invoiceDocument: [{ reference: documentId, url: 'https://files.example.test/a' }] } })); await pending; });
  assert.equal(opened, false); assert.equal(current.authenticated, false);
  await unmount();
});
test('an unsafe document link is never opened and leaves a retryable error', async () => {
  const unmount = await mount(true); let opened = false;
  handler = async () => Response.json({ data: { invoiceDocument: [{ reference: documentId, url: 'javascript:alert(1)' }] } });
  await act(async () => { await current.openDocument(invoiceId, documentId, () => { opened = true; }); });
  assert.equal(opened, false); assert.ok(current.error);
  await unmount();
});

test('background while document request is pending suppresses external navigation', async () => {
  const unmount = await mount(true); let resolve, opened = false;
  handler = () => new Promise(r => { resolve = r; });
  let pending; await act(async () => { pending = current.openDocument(invoiceId, documentId, () => { opened = true; }); });
  await act(async () => { fixture.appState.currentState = 'background'; for (const fn of listeners) fn('background'); });
  await act(async () => { resolve(Response.json({ data: { invoiceDocument: [{ reference: documentId, url: 'https://files.example.test/a' }] } })); await pending; });
  assert.equal(opened, false); assert.equal(current.invoice, null);
  await unmount();
});

test('uncertain support submission retries the same key and confirmed new intent gets a new key', async () => {
 const unmount = await mount(true);session.user={id:'own-user'};const keys=[];let fail=true;
 handler=async (_url,init)=>{keys.push(init.headers['Idempotency-Key']);return fail?new Response('',{status:503}):Response.json({data:{accepted:true}},{status:201});};
 await act(async()=>{assert.equal(await current.submitSupport('Question','Hello'),false);});
 fail=false;await act(async()=>{assert.equal(await current.submitSupport('Question','Hello'),true);});
 assert.equal(keys[0],keys[1]);
 await act(async()=>{assert.equal(await current.submitSupport('Question','Hello'),true);});assert.notEqual(keys[1],keys[2]);
 await unmount();
});
test('late support-write confirmation after logout never reports success to the new screen', async () => {
 const unmount=await mount(true);session.user={id:'own-user'};let resolve;
 handler=()=>new Promise(r=>{resolve=r;});let pending;
 await act(async()=>{pending=current.submitSupport('Question','Hello');});
 await act(async()=>current.logout());
 await act(async()=>{resolve(Response.json({data:{accepted:true}},{status:201}));assert.equal(await pending,false);});
 assert.equal(current.authenticated,false);await unmount();
});

test('support continuation appends and deduplicates pages without changing identity',async()=>{
 const unmount=await mount(true);let page=0;
 const row=reference=>({reference,title:'Question',description:null,status:'received',createdAt:null,updatedAt:null});
 handler=async url=>{page++;if(page===2)assert.ok(url.endsWith('?cursor=opaque%2B%2F%3D'));return Response.json({data:{support:page===1?[row('one')]:[row('one'),row('two')]},page:{hasMore:page===1,nextCursor:page===1?'opaque+/=':null}});};
 await act(async()=>{await current.select('support');});assert.equal(current.nextCursor,'opaque+/=');
 await act(async()=>{await current.loadMore();});assert.deepEqual(current.rows.map(r=>r.reference),['one','two']);assert.equal(current.nextCursor,null);
 await unmount();
});

test('all five extra views use the authenticated loader and clear on logout', async () => {
 const {extraRows}=await import('../lib/mobile/customerExtras.ts');
 const keys={profile:'customer_reference',notifications:'notification_reference',documents:'document_reference',powers:'power_of_attorney_reference',acceptances:'acceptance_reference'};
 const unmount=await mount(true);
 for(const [kind,key] of Object.entries(keys)) {
  handler=async (url,options)=>{assert.ok(url.endsWith(`/customer/${kind}`));assert.ok(options.headers.Authorization);return Response.json({data:{[kind]:extraRows(kind,{data:kind==='profile'?{[key]:'own'}:[{[key]:'own'}]})}});};
  await act(async()=>current.select(kind)); assert.equal(current.rows[0].reference,'own');
 }
 await act(async()=>current.logout());assert.equal(current.rows,null);await unmount();
});
test('general document opening uses the scoped endpoint and a URL-only external handoff', async () => {
 const unmount=await mount(true);let opened;
 handler=async(url)=>{assert.ok(url.endsWith('/customer/documents/owned-doc/open'));return Response.json({data:{customerDocument:[{reference:'owned-doc',url:'https://files.test/a'}]}});};
 await act(async()=>current.openDocument(null,'owned-doc',(...args)=>{opened=args;}));
 assert.deepEqual(opened,['https://files.test/a']);await unmount();
});

test('native customer loader operates against an independent backend without OPS',async()=>{
 const {createCustomerBackend}=await import('../packages/customer-backend/handler.mjs');
 const previous=process.env.EXPO_PUBLIC_CUSTOMER_API_PATH;
 const unmount=await mount(true);
 try{
  process.env.EXPO_PUBLIC_CUSTOMER_API_PATH='/customer/v1';
  const backend=createCustomerBackend({authenticate:async token=>{assert.equal(token,'remembered-token');return {subject:'independent-user',tenantId:'buyer',customerReference:'independent-customer'};},provider:{read:async(binding,{kind})=>{assert.equal(binding.tenantId,'buyer');assert.equal(kind,'profile');return {items:[{reference:binding.customerReference,name:'Own backend',email:null,phone:null,customerNumber:null,customerType:null,status:null}]};}}});
  handler=async(url,options)=>{assert.ok(url.includes('/customer/v1/profile'));return backend(new Request(url,options));};
  await act(async()=>current.select('profile'));assert.equal(current.rows[0].name,'Own backend');assert.equal(current.error,'');
  await act(async()=>current.logout());assert.equal(current.rows,null);
 }finally{if(previous===undefined)delete process.env.EXPO_PUBLIC_CUSTOMER_API_PATH;else process.env.EXPO_PUBLIC_CUSTOMER_API_PATH=previous;await unmount();}
});

test('phone change retains its retry key until confirmed and logout invalidates pending changes',async()=>{
 const unmount=await mount(true);session.user={id:'own-user'};const keys=[];let confirmed=false;
 handler=async(url,options)=>{assert.ok(url.endsWith('/customer/profile'));assert.deepEqual(JSON.parse(options.body),{phone:'0701234567'});keys.push(options.headers['Idempotency-Key']);return confirmed?Response.json({data:{accepted:true}}):new Response('',{status:503});};
 await act(async()=>{assert.equal(await current.updatePhone('0701234567'),false);});confirmed=true;
 await act(async()=>{assert.equal(await current.updatePhone('0701234567'),true);});assert.equal(keys[0],keys[1]);
 let resolve;handler=()=>new Promise(r=>resolve=r);let pending;
 await act(async()=>{pending=current.updatePhone('0707654321');});await act(async()=>current.logout());
 await act(async()=>{resolve(Response.json({data:{accepted:true}}));assert.equal(await pending,false);});assert.equal(current.rows,null);await unmount();
});
test('notification read changes its row only after a confirmed server timestamp',async()=>{
 const unmount=await mount(true);session.user={id:'own-user'};const reference='notification-own';
 handler=async()=>Response.json({data:{notifications:[{reference,title:'Title',message:'Message',severity:null,status:'unread',readAt:null,createdAt:null}]}});
 await act(async()=>current.select('notifications'));
 handler=async()=>Response.json({data:{accepted:true}});await act(async()=>{assert.equal(await current.markNotificationRead(reference),false);});assert.equal(current.rows[0].status,'unread');
 handler=async()=>Response.json({data:{accepted:true,readAt:'2026-11-06T12:00:00Z'}});await act(async()=>{assert.equal(await current.markNotificationRead(reference),true);});assert.equal(current.rows[0].status,'read');assert.equal(current.rows[0].readAt,'2026-11-06T12:00:00Z');await unmount();
});
test('notification read keeps retry identity when success lacks a trustworthy timestamp',async()=>{
 const unmount=await mount(true);session.user={id:'own-user'};const keys=[];let stamp=false;
 handler=async(_url,options)=>{keys.push(options.headers['Idempotency-Key']);return Response.json({data:{accepted:true,...(stamp?{readAt:'2026-11-06T12:00:00Z'}:{})}});};
 await act(async()=>{assert.equal(await current.markNotificationRead('notification-own'),false);});stamp=true;
 await act(async()=>{assert.equal(await current.markNotificationRead('notification-own'),true);});assert.equal(keys[0],keys[1]);await unmount();
});

test('consumption request uses verified session and rejects late data after logout', async () => {
  const unmount=await mount(true);let resolve;
  handler=(url,init)=>{assert.equal(new URL(url).pathname,'/api/mobile/customer/consumption');assert.equal(init.headers.Authorization,'Bearer remembered-token');assert.equal(new URL(url).searchParams.get('facility'),'own-site');return new Promise(r=>{resolve=r;});};
  const controller=new AbortController();let pending;
  await act(async()=>{pending=current.readConsumption('consumption',{facility:'own-site'},controller.signal);});
  const rejected=assert.rejects(pending,/Cancelled/);
  await act(async()=>current.logout());
  await act(async()=>{resolve(Response.json({private:'late'}));await rejected;});
  assert.equal(current.authenticated,false);await unmount();
});
test('consumption expired auth clears private account state',async()=>{
  const unmount=await mount(true);handler=async()=>new Response('',{status:401});
  await act(async()=>{await assert.rejects(current.readConsumption('sites',{},new AbortController().signal),/Login required/);});
  assert.equal(current.authenticated,false);assert.equal(current.rows,null);assert.equal(session,null);await unmount();
});

for (const operation of ['document', 'phone', 'support', 'notification']) {
  for (const interruption of ['logout', 'background', 'unmount']) {
    test(`${operation} does not dispatch after ${interruption} during session lookup`, async () => {
      const unmount = await mount(true);
      const original = fixture.client.auth.getSession;
      const captured = { ...session, user: { id: 'own-user' } };
      let resolveSession;
      fixture.client.auth.getSession = () => new Promise(resolve => { resolveSession = resolve; });
      const before = fetchCalls;
      let pending;
      try {
        await act(async () => {
          pending = operation === 'document' ? current.openDocument(null, 'owned-doc', () => assert.fail('cancelled document opened'))
            : operation === 'phone' ? current.updatePhone('0701234567')
            : operation === 'support' ? current.submitSupport('Question', 'Hello')
            : current.markNotificationRead('owned-notification');
        });
        if (interruption === 'logout') await act(async () => current.logout());
        else if (interruption === 'unmount') await unmount();
        else await act(async () => {
          fixture.appState.currentState = 'background';
          for (const listener of listeners) listener('background');
        });
        await act(async () => { resolveSession({ data: { session: captured }, error: null }); await pending; });
        assert.equal(fetchCalls, before, 'cancelled operation must never reach the API');
      } finally {
        fixture.client.auth.getSession = original;
        if (interruption !== 'unmount') await unmount();
      }
    });
  }
}

test('inactive screens cannot initiate customer reads, document opens or writes', async () => {
  const unmount = await mount(true);
  await act(async () => {
    fixture.appState.currentState = 'background';
    for (const listener of listeners) listener('background');
  });
  const before = fetchCalls;
  await act(async () => {
    await current.select('profile');
    await current.openDocument(null, 'owned-doc', () => assert.fail('inactive document opened'));
    assert.equal(await current.updatePhone('0701234567'), false);
    assert.equal(await current.submitSupport('Question', 'Hello'), false);
    assert.equal(await current.markNotificationRead('owned-notification'), false);
  });
  assert.equal(fetchCalls, before);
  await unmount();
});

test('foreground restore waits for signout and failed signout stays blocked until retried', async () => {
  const unmount = await mount(true);
  const original = fixture.client.auth.signOut;
  let settle;
  let signOutCalls = 0;
  const setAppState = async state => act(async () => {
    fixture.appState.currentState = state;
    for (const listener of listeners) listener(state);
  });
  fixture.client.auth.signOut = () => {
    signOutCalls++;
    return new Promise(resolve => { settle = resolve; });
  };
  try {
    await act(async () => current.logout());
    await setAppState('background');
    await setAppState('active');
    assert.equal(refreshes, 1);
    assert.equal(fetchCalls, 1);
    await act(async () => settle({ error: new Error('offline') }));
    assert.equal(current.logoutFailed, true);
    await setAppState('background');
    await setAppState('active');
    await act(async () => current.login('customer@example.test', 'password'));
    assert.equal(fetchCalls, 1);
    assert.equal(current.rows, null);
    assert.equal(current.authenticated, false);
    assert.equal(signOutCalls, 1);
    fixture.client.auth.signOut = original;
    await act(async () => current.logout());
    assert.equal(current.logoutFailed, false);
    assert.equal(session, null);
  } finally {
    fixture.client.auth.signOut = original;
    await unmount();
  }
});


test('temporary Auth refresh failure keeps the saved session private and recoverable', async () => {
  const unmount = await mount(true);
  const originalRefresh = fixture.client.auth.refreshSession;
  const originalSignOut = fixture.client.auth.signOut;
  const changeState = async state => act(async () => {
    fixture.appState.currentState = state;
    for (const listener of listeners) listener(state);
  });
  let signOutCalls = 0;
  try {
    fixture.client.auth.signOut = async () => { signOutCalls++; return originalSignOut(); };
    fixture.client.auth.refreshSession = async () => ({ data: { session: null }, error: new AuthRetryableFetchError('Temporarily offline', 503) });
    const before = fetchCalls;
    await changeState('background'); await changeState('active');
    assert.equal(current.rows, null, 'Stale customer rows must remain hidden');
    assert.equal(fetchCalls, before, 'No customer fetch before successful session recovery');
    assert.equal(signOutCalls, 0, 'A temporary network failure must not sign out');
    assert.equal(session?.access_token, 'remembered-token', 'Persisted session remains available for retry');
    assert.equal(current.authenticated, true);
    assert.match(current.error, /Uppgifterna kunde inte hämtas/);
    fixture.client.auth.refreshSession = originalRefresh;
    await changeState('background'); await changeState('active');
    assert.equal(current.rows[0].reference, 'own-contract');
    assert.ok(fetchCalls > before, 'Reconnect must read customer data again');
    assert.equal(current.error, '');
  } finally {
    fixture.client.auth.refreshSession = originalRefresh;
    fixture.client.auth.signOut = originalSignOut;
    await unmount();
  }
});

test('definitively revoked Auth refresh clears the saved session and cannot restore customer data', async () => {
  const unmount = await mount(true);
  const originalRefresh = fixture.client.auth.refreshSession;
  const originalSignOut = fixture.client.auth.signOut;
  let signOutCalls = 0;
  try {
    fixture.client.auth.signOut = async () => { signOutCalls++; return originalSignOut(); };
    fixture.client.auth.refreshSession = async () => ({ data: { session: null }, error: new AuthApiError('Refresh revoked', 400, 'refresh_token_not_found') });
    const before = fetchCalls;
    await act(async () => { fixture.appState.currentState = 'background'; for (const listener of listeners) listener('background'); });
    await act(async () => { fixture.appState.currentState = 'active'; for (const listener of listeners) listener('active'); });
    assert.equal(current.authenticated, false); assert.equal(current.rows, null);
    assert.equal(session, null); assert.equal(signOutCalls, 1);
    fixture.client.auth.refreshSession = originalRefresh;
    await act(async () => current.retry());
    assert.equal(current.rows, null); assert.equal(current.authenticated, false);
    assert.equal(fetchCalls, before);
  } finally {
    fixture.client.auth.refreshSession = originalRefresh;
    fixture.client.auth.signOut = originalSignOut;
    await unmount();
  }
});
