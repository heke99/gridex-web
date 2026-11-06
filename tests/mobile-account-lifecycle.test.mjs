import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import React from '../apps/mobile/node_modules/react/index.js';
import Renderer from '../apps/mobile/node_modules/react-test-renderer/index.js';
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
