import test from 'node:test';import assert from 'node:assert/strict';
import {visibleCustomerRows,loadedSummary,calendarDate} from '../apps/mobile/src/listTools.ts';
const rows=[{reference:'one',number:'INV-123',status:'paid',title:'Faktura',description:null},{reference:'two',number:null,status:'open',title:'Fråga',description:'Elavtal'},{reference:'three',number:'INV-456',status:null}];
test('invoice search matches loaded invoice numbers and opaque references only',()=>{assert.equal(visibleCustomerRows('invoices',rows,'inv-123','all')[0].reference,'one');assert.equal(visibleCustomerRows('invoices',rows,'two','all').length,1);assert.equal(visibleCustomerRows('invoices',rows,'Elavtal','all').length,0);});
test('support search and status compose without changing source rows',()=>{const before=JSON.stringify(rows);assert.equal(visibleCustomerRows('support',rows,'elavtal','open').length,1);assert.equal(visibleCustomerRows('support',rows,'elavtal','paid').length,0);assert.equal(JSON.stringify(rows),before);});
test('overview counts only fetched records and preserves missing status',()=>{const summary=loadedSummary('invoices',rows);assert.equal(summary.count,3);assert.ok(summary.statuses.some(([label,n])=>label==='Uppgift saknas'&&n===1));assert.equal(loadedSummary('support',[]).count,0);});
test('contract calendar days preserve leap days and reject impossible dates',()=>{assert.ok(calendarDate('2028-02-29').includes('29'));for(const v of [null,'2026-02-30','2026-11-06T00:00:00Z','bad'])assert.equal(calendarDate(v),'Uppgift saknas');});

test('search finds contracts, facilities, documents and notifications by visible fields', () => {
 for (const [resource, field, value, query] of [
  ['contracts', 'name', 'Rörligt', 'ro\u0308rligt'],
  ['sites', 'address', 'Storgatan 1', 'storgatan'],
  ['documents', 'title', 'Avtalsvillkor', 'villkor'],
  ['notifications', 'message', 'Din faktura är klar', 'faktura'],
 ]) {
  const row = { reference: 'own-record', [field]: value };
  assert.deepEqual(visibleCustomerRows(resource, [row], query, 'all'), [row]);
 }
});

test('dated lists sort known dates while preserving missing dates and input order', () => {
 for (const [resource, field, order] of [
  ['invoices', 'dueDate', ['early', 'late', 'missing']],
  ['contracts', 'startDate', ['late', 'early', 'missing']],
  ['support', 'updatedAt', ['late', 'early', 'missing']],
 ]) {
  const rows = [{ reference: 'missing' }, { reference: 'late', [field]: '2026-11-20' }, { reference: 'early', [field]: '2026-11-10' }];
  assert.deepEqual(visibleCustomerRows(resource, rows, '', 'all').map(row => row.reference), order);
  assert.deepEqual(rows.map(row => row.reference), ['missing', 'late', 'early']);
 }
});
