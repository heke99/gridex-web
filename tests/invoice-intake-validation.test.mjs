import assert from 'node:assert/strict'
import {test} from 'node:test'
import {importExternalInvoice} from '../lib/integrations/invoices.ts'
import {POST} from '../app/api/integrations/invoices/route.ts'

function fixture(){
 const mutations=[]
 const client={from(table){const q={select(){return q},eq(){return q},order(){return q},limit(){return q},
  update(value){mutations.push({table,operation:'update',value});return q},
  insert(value){mutations.push({table,operation:'insert',value});return q},
  upsert(value){mutations.push({table,operation:'upsert',value});return q},
  maybeSingle:async()=>({data:table==='customer_profiles'?{user_id:'11111111-1111-4111-8111-111111111111',email:'test@example.invalid'}:null,error:null}),
  single:async()=>({data:{id:'22222222-2222-4222-8222-222222222222',status:'issued'},error:null}),
  then(yes,no){return Promise.resolve({data:null,error:null}).then(yes,no)}};return q}}
 return {client,mutations}
}
const payload={providerKey:'synthetic',externalInvoiceRef:'test-only',customer:{userId:'11111111-1111-4111-8111-111111111111'},totalAmount:123.45}
test('invalid invoice dates cannot partially update the customer before rejecting the invoice',async()=>{
 for(const field of ['issuedAt','dueAt','invoicePeriodStart','invoicePeriodEnd','paidAt'])for(const value of ['not-a-date','2026-02-30','2026-02-30T10:00:00Z',42,{},[]]){
  const f=fixture();await assert.rejects(importExternalInvoice(f.client,{...payload,[field]:value}),e=>e.status===400)
  assert.deepEqual(f.mutations,[],field+' must be validated before all writes')
 }
})
test('non-finite or malformed supplied amounts cannot become zero-valued invoices',async()=>{
 for(const field of ['totalAmount','vatAmount'])for(const value of ['not-money',Number.NaN,Number.POSITIVE_INFINITY,{},[]]){
  const f=fixture();await assert.rejects(importExternalInvoice(f.client,{...payload,[field]:value}),e=>e.status===400)
  assert.deepEqual(f.mutations,[])
 }
})
test('null, array and malformed nested invoice objects fail before any mutation',async()=>{
 for(const value of [null,[],{...payload,customer:'wrong'},{...payload,contract:[]}]){
  const f=fixture();await assert.rejects(importExternalInvoice(f.client,value),e=>e.status===400)
  assert.deepEqual(f.mutations,[])
 }
})
test('valid zero, credit values and existing localized amounts retain their financial meaning',async()=>{
 for(const [value,expected] of [[0,0],[-123.45,-123.45],['1 234,56',1234.56]]){
  const f=fixture();const result=await importExternalInvoice(f.client,{...payload,totalAmount:value})
  assert.equal(result.status,'issued');assert.equal(f.mutations.find(x=>x.table==='customer_invoices').value.total_amount,expected)
 }
})
test('valid leap days and invoice calendar dates remain canonical',async()=>{
 const f=fixture();await importExternalInvoice(f.client,{...payload,issuedAt:'2028-02-29',invoicePeriodStart:'2026-10-20'})
 const stored=f.mutations.find(x=>x.table==='customer_invoices').value
 assert.equal(stored.issued_at,'2028-02-29T00:00:00.000Z');assert.equal(stored.invoice_period_start,'2026-10-20')
})
test('actual invoice route authenticates first and bounds malformed or oversized input before persistence',async()=>{
 const original=process.env.GRIDEX_INTEGRATION_API_KEY;process.env.GRIDEX_INTEGRATION_API_KEY='synthetic-regression-only'
 const f=fixture();globalThis.__invoiceRoute=f
 const request=(value,headers={})=>new Request('https://gridex.se/api/integrations/invoices',{method:'POST',headers:{Authorization:'Bearer synthetic-regression-only','Content-Type':'application/json',...headers},body:typeof value==='string'?value:JSON.stringify(value)})
 try{
  assert.equal((await POST(request({}, {Authorization:''}))).status,401)
  assert.equal((await POST(request('{'))).status,400)
  assert.equal((await POST(request(null))).status,400)
  assert.equal((await POST(request(payload,{'Content-Type':'text/plain'}))).status,415)
  assert.equal((await POST(request(payload,{'Content-Length':String(256*1024+1)}))).status,413)
  assert.equal((await POST(request({...payload,issuedAt:'2026-02-30'}))).status,400)
  assert.deepEqual(f.mutations,[])
  const accepted=await POST(request({...payload,totalAmount:0}))
  assert.equal(accepted.status,200);assert.equal((await accepted.json()).ok,true)
  assert.equal(f.mutations.find(x=>x.table==='customer_invoices').value.total_amount,0)
 }finally{if(original===undefined)delete process.env.GRIDEX_INTEGRATION_API_KEY;else process.env.GRIDEX_INTEGRATION_API_KEY=original;delete globalThis.__invoiceRoute}
})
