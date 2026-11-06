import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secureSessionStorage } from '../apps/mobile/src/secureSessionStorage.ts';
const fixture = () => { const data = new Map(); return { data, provider: {
  getItemAsync: async k => data.get(k) ?? null,
  setItemAsync: async (k, v) => { assert.ok(Buffer.byteLength(v) <= 2000); data.set(k, v); },
  deleteItemAsync: async k => { data.delete(k); },
} }; };
test('large unicode sessions survive reconstruction without insecure fallback', async () => {
  const f = fixture(); const s = secureSessionStorage(f.provider, 'brand-one');
  const value = ('x'.repeat(299) + '😀å').repeat(20); await s.setItem('session', value);
  assert.equal(await secureSessionStorage(f.provider, 'brand-one').getItem('session'), value);
  assert.equal(await secureSessionStorage(f.provider, 'brand-two').getItem('session'), null);
  await s.removeItem('session'); assert.equal(f.data.size, 0);
});
test('a failed rotation preserves previous complete session', async () => {
  const f = fixture(); const s = secureSessionStorage(f.provider, 'brand'); await s.setItem('session', 'previous');
  const failing = { ...f.provider, setItemAsync: async () => { throw Error('keychain unavailable'); } };
  await assert.rejects(secureSessionStorage(failing, 'brand').setItem('session', 'new'));
  assert.equal(await s.getItem('session'), 'previous');
});
test('concurrent save/logout finishes without a stored session', async () => {
  const f = fixture(); const s = secureSessionStorage(f.provider, 'brand');
  await Promise.all([s.setItem('session', 's'.repeat(900)), s.removeItem('session')]);
  assert.equal(await s.getItem('session'), null); assert.equal(f.data.size, 0);
});
test('incomplete sessions fail closed and remove their manifest', async () => {
  const f = fixture(); const s = secureSessionStorage(f.provider, 'brand'); await s.setItem('session', 's'.repeat(700));
  const chunk = [...f.data.keys()].find(k => k.endsWith('.1')); f.data.delete(chunk);
  assert.equal(await s.getItem('session'), null);
});
test('oversized sessions and malformed namespaces are rejected', async () => {
  const f = fixture(); assert.throws(() => secureSessionStorage(f.provider, 'bad/key'));
  await assert.rejects(secureSessionStorage(f.provider, 'brand').setItem('session', 'x'.repeat(80000)));
  assert.equal(f.data.size, 0);
});

test('corrupt manifests cannot resurrect credentials or block a fresh login', async () => {
  const f = fixture(); const s = secureSessionStorage(f.provider, 'brand');
  f.data.set('brand.session', '{invalid-json');
  assert.equal(await s.getItem('session'), null);
  await s.setItem('session', 'new-session'); assert.equal(await s.getItem('session'), 'new-session');
});
