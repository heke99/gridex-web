import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCustomerPortalOperationRequest } from '../lib/ops/validators/openapi.ts';
const headers = new Headers({ 'x-gridex-customer-portal-user-id': '11111111-1111-4111-8111-111111111111', 'x-gridex-auth-user-id': '11111111-1111-4111-8111-111111111111' });
test('invoice detail accepts the opaque reference returned by OPS lists', () => {
  assert.doesNotThrow(() => assertCustomerPortalOperationRequest('/api/v1/customer/invoices/invoice_' + 'A'.repeat(32), 'get', undefined, headers));
});
test('invoice detail does not expose internal UUIDs or accept malformed references', () => {
  for (const value of ['11111111-1111-4111-8111-111111111111', 'invoice_short', 'invoice_' + 'A'.repeat(33)]) {
    assert.throws(() => assertCustomerPortalOperationRequest('/api/v1/customer/invoices/' + value, 'get', undefined, headers));
  }
});
