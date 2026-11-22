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

test('invoice detail accepts only a single canonical attachment reference as projection', () => {
  const path = '/api/v1/customer/invoices/invoice_' + 'A'.repeat(32);
  const reference = 'document_' + 'B'.repeat(32);
  assert.doesNotThrow(() => assertCustomerPortalOperationRequest(path + '?document_reference=' + reference, 'get', undefined, headers));
  for (const query of ['document_reference=raw-id', 'customer_number=other', 'document_reference=' + reference + '&document_reference=' + reference]) {
    assert.throws(() => assertCustomerPortalOperationRequest(path + '?' + query, 'get', undefined, headers));
  }
});

test('the documents lookup accepts one public reference without customer overrides', () => {
  const path = '/api/v1/customer/documents?document_reference=document_' + 'B'.repeat(32);
  assert.doesNotThrow(() => assertCustomerPortalOperationRequest(path, 'get', undefined, headers));
  assert.throws(() => assertCustomerPortalOperationRequest(path + '&customer_number=other', 'get', undefined, headers));
});
