import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInvoiceDetail, parseSupportDetail, parseDocumentLink, customerViewPath } from '../apps/mobile/src/detailData.ts';
import { invoiceDetail, supportDetail } from '../lib/mobile/customerDetails.ts';
import { invoiceId, documentId, caseId, invoicePayload, supportPayload, messagesPayload } from './mobile-detail-fixtures.mjs';
test('native invoice parser accepts normalized totals and lines and rejects foreign details', () => {
  const value = invoiceDetail(invoicePayload(), invoiceId, ['https://files.example.test']);
  const body = { data: { invoiceDetail: [value] } };
  assert.deepEqual(parseInvoiceDetail(body, invoiceId), value);
  assert.throws(() => parseInvoiceDetail(body, 'foreign'));
  value.lines[0].quantity = '100'; assert.throws(() => parseInvoiceDetail(body, invoiceId));
});
test('native support parser validates public authors, kinds and case reference', () => {
  const value = supportDetail(supportPayload(), messagesPayload(), caseId);
  const body = { data: { supportDetail: [value] } };
  assert.deepEqual(parseSupportDetail(body, caseId), value);
  assert.throws(() => parseSupportDetail(body, 'foreign'));
  value.messages[0].kind = 'internal_note'; assert.throws(() => parseSupportDetail(body, caseId));
});
test('native document parser rejects mismatches and unsafe schemes before external opening', () => {
  const body = { data: { invoiceDocument: [{ reference: documentId, url: 'https://files.example.test/a?signature=test' }] } };
  assert.ok(parseDocumentLink(body, documentId).startsWith('https://files.example.test/'));
  assert.throws(() => parseDocumentLink(body, 'foreign'));
  for (const url of ['file:///private/a', 'javascript:alert(1)', 'https://user:pass@files.example.test/a']) {
    body.data.invoiceDocument[0].url = url; assert.throws(() => parseDocumentLink(body, documentId));
  }
});
test('detail navigation cannot introduce path/query/origin injection', () => {
  assert.equal(customerViewPath('invoiceDetail', invoiceId), `invoices/${invoiceId}`);
  assert.equal(customerViewPath('supportDetail', caseId), `support/${caseId}`);
  for (const ref of [undefined, '', '../foreign', 'invoice?customerId=other', 'https://evil.test/a']) assert.throws(() => customerViewPath('invoiceDetail', ref));
});
