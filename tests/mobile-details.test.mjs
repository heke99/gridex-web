import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceDetail, invoiceDocument, approvedDocumentUrl, supportCases, supportDetail } from '../lib/mobile/customerDetails.ts';
import { invoiceId, documentId, caseId, invoicePayload, supportPayload, messagesPayload } from './mobile-detail-fixtures.mjs';
const origins = ['https://files.example.test'];
test('invoice detail reads the actual invoice/lines/documents envelope and strips internal fields and links', () => {
  const detail = invoiceDetail(invoicePayload(), invoiceId, origins);
  assert.equal(detail.reference, invoiceId); assert.equal(detail.amount, 125);
  assert.equal(detail.lines[0].amountIncVat, 125); assert.equal(detail.documents[0].available, true);
  assert.ok(!JSON.stringify(detail).includes('must-not-leak')); assert.ok(!JSON.stringify(detail).includes('signature'));
});
test('invoice detail rejects mismatched references and the old flattened envelope', () => {
  assert.throws(() => invoiceDetail(invoicePayload('another-invoice'), invoiceId, origins));
  assert.throws(() => invoiceDetail({ data: invoicePayload().data.invoice }, invoiceId, origins));
});
test('line items preserve zero, credits and unknown values without recalculating totals', () => {
  const payload = invoicePayload(); payload.data.lines[0].quantity = 0; payload.data.lines[0].amount_inc_vat = -25; payload.data.lines[0].unit_price = null;
  const detail = invoiceDetail(payload, invoiceId, origins);
  assert.equal(detail.lines[0].quantity, 0); assert.equal(detail.lines[0].amountIncVat, -25); assert.equal(detail.lines[0].unitPrice, null); assert.equal(detail.amount, 125);
  payload.data.lines[0].amount_inc_vat = '125'; assert.throws(() => invoiceDetail(payload, invoiceId, origins));
});
test('missing line/doc arrays fail closed instead of appearing as a complete invoice', () => {
  const payload = invoicePayload(); delete payload.data.lines;
  assert.throws(() => invoiceDetail(payload, invoiceId, origins));
});
test('document URLs require an exact configured HTTPS origin', () => {
  for (const url of ['http://files.example.test/a', 'javascript:alert(1)', 'https://user:password@files.example.test/a', 'https://files.example.test.evil.test/a', 'https://evil.test/files.example.test', 'https://files.example.test/a#fragment']) assert.equal(approvedDocumentUrl(url, origins), null);
  assert.equal(approvedDocumentUrl('https://files.example.test/a', []), null);
  assert.equal(approvedDocumentUrl('https://files.example.test/a', ['https://files.example.test/path']), null);
});
test('document opening requires a fresh matching invoice and attached document reference', () => {
  assert.equal(invoiceDocument(invoicePayload(), invoiceId, documentId, origins).reference, documentId);
  assert.throws(() => invoiceDocument(invoicePayload(), invoiceId, 'foreign-doc', origins));
  assert.throws(() => invoiceDocument(invoicePayload('foreign'), invoiceId, documentId, origins));
  assert.throws(() => invoiceDocument(invoicePayload(), invoiceId, documentId, []));
  const payload = invoicePayload(); payload.data.documents.push(payload.data.documents[0]);
  assert.throws(() => invoiceDocument(payload, invoiceId, documentId, origins));
});
test('support list strips internal fields and preserves public status', () => {
  const rows = supportCases({ data: [supportPayload().data] });
  assert.equal(rows[0].title, 'Fråga om min faktura'); assert.ok(!JSON.stringify(rows).includes('must-not-leak'));
});
test('support detail binds messages to the requested case and strips staff identity', () => {
  const result = supportDetail(supportPayload(), messagesPayload(), caseId);
  assert.equal(result.messages[0].author, 'staff'); assert.equal(result.moreMessages, false);
  assert.ok(!JSON.stringify(result).includes('must-not-leak'));
  assert.throws(() => supportDetail(supportPayload('foreign'), messagesPayload(), caseId));
});
test('internal note kinds and unexpected authors never reach mobile support', () => {
  const payload = messagesPayload(); payload.data[0].kind = 'internal_note';
  assert.throws(() => supportDetail(supportPayload(), payload, caseId));
  payload.data[0].kind = 'message'; payload.data[0].author_type = 'system';
  assert.throws(() => supportDetail(supportPayload(), payload, caseId));
});
