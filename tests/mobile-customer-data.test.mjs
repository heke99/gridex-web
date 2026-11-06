import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCustomerRows, recoveryUrl } from '../apps/mobile/src/customerData.ts';
test('password recovery uses fixed path and never forwards query tokens', () => {
  assert.equal(recoveryUrl('https://tenant.test/path?token=secret'), 'https://tenant.test/login/forgot-password');
  for (const url of ['http://tenant.test', 'javascript:alert(1)', 'https://user:pass@tenant.test']) assert.throws(() => recoveryUrl(url));
});
test('client rejects malformed customer data and strips unexpected fields', () => {
  const body = { data: { sites: [{ reference: 'site', address: null, postalCode: null, city: null, facilityId: null, priceArea: null, status: null, hidden: 'secret' }] } };
  assert.ok(!JSON.stringify(parseCustomerRows('sites', body)).includes('secret'));
  assert.throws(() => parseCustomerRows('sites', { data: { sites: [{}] } }));
  assert.throws(() => parseCustomerRows('invoices', { data: { invoices: [{ reference: 'i', number: null, status: null, currency: null, dueDate: null, paidAt: null, amount: '100' }] } }));
});
