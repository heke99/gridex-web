import { test, after } from 'node:test';
import assert from 'node:assert/strict';
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
