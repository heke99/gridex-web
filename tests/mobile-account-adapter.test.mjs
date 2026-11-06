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
