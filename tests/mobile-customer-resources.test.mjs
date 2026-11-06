import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResource } from '../lib/mobile/customerResources.ts';
import { createContractsHandler } from '../lib/mobile/contractsHandler.ts';
test('site projection excludes internal data and preserves missing address', () => {
  const [site] = normalizeResource('sites', { data: [{ facility_reference: 'site-1', address: { street: 'Testgatan', private: 'hidden' }, secret: 'hidden' }] });
  assert.equal(site.address, 'Testgatan'); assert.equal(site.city, null); assert.ok(!JSON.stringify(site).includes('hidden'));
});
test('invoice projection preserves zero/credit amounts and never invents missing amounts', () => {
  for (const amount of [0, -100, 143.25, null, undefined, NaN, '100']) {
    const [invoice] = normalizeResource('invoices', { data: { invoices: [{ invoice_reference: 'inv-1', amount_inc_vat: amount }] } });
    assert.equal(invoice.amount, typeof amount === 'number' && Number.isFinite(amount) ? amount : null);
  }
});
test('resource envelope and reference omissions fail closed', () => {
  for (const resource of ['contracts', 'sites', 'invoices']) {
    assert.throws(() => normalizeResource(resource, { data: null }));
    assert.throws(() => normalizeResource(resource, { data: [{}] }));
  }
});
for (const resource of ['sites', 'invoices']) {
  test(`${resource} shares verified-subject authorization and denies identity overrides`, async () => {
    const handler = createContractsHandler({ enabled: () => true, authenticate: async () => 'verified-customer',
      contracts: async subject => { assert.equal(subject, 'verified-customer'); return []; } }, resource);
    const request = suffix => new Request(`https://tenant.test/api/mobile/customer/${resource}${suffix}`, { headers: { authorization: 'Bearer valid-token-12345678' } });
    assert.equal((await handler(request('?customerId=foreign'))).status, 400);
    const response = await handler(request('')); assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data[resource], []);
  });
}
