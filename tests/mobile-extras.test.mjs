import test from 'node:test';
import assert from 'node:assert/strict';
import { extraRows, customerDocumentLink } from '../lib/mobile/customerExtras.ts';
import { parseCustomerRows } from '../apps/mobile/src/customerData.ts';
const refs={profile:'customer_reference',notifications:'notification_reference',documents:'document_reference',powers:'power_of_attorney_reference',acceptances:'acceptance_reference'};
for(const [kind,key] of Object.entries(refs)) test(`${kind} normalizes canonical OPS data for the native parser`,()=>{
 const row={[key]:'owned-reference',display_name:'Own name',message:'Actual notification',scope:['read','switch'],secure_url:'https://files.test/a',portal_identity:'secret',metadata:'secret'};
 const rows=extraRows(kind,{data:kind==='profile'?row:[row]},['https://files.test']);
 assert.equal(parseCustomerRows(kind,{data:{[kind]:rows}})[0].reference,'owned-reference');
 assert.ok(!JSON.stringify(rows).includes('secret')); assert.ok(!JSON.stringify(rows).includes('https:'));
 if(kind==='notifications')assert.equal(rows[0].message,'Actual notification');
 if(kind==='powers')assert.equal(rows[0].scope,'read, switch');
 assert.throws(()=>extraRows(kind,{data:kind==='profile'?{}:[{}]}));
});
test('customer documents require a unique owned reference and exact approved origin',()=>{
 const row={document_reference:'owned',secure_url:'https://files.test/a'};
 assert.equal(customerDocumentLink({data:[row]},'owned',['https://files.test']).reference,'owned');
 for(const rows of [[],[row,row],[{...row,secure_url:'https://files.test.evil.test/a'}]])assert.throws(()=>customerDocumentLink({data:rows},'owned',['https://files.test']));
 assert.throws(()=>customerDocumentLink({data:[row]},'foreign',['https://files.test']));
});
