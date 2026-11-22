import assert from 'node:assert/strict'
import {test} from 'node:test'
import {importExternalInvoice} from '../lib/integrations/invoices.ts'
import {POST} from '../app/api/integrations/invoices/route.ts'

function fixture(){
 const mutations=[]
 const client = {
  async rpc(name, args) {
   assert.equal(name, 'gridex_import_invoice')
   mutations.push({ table: 'customer_invoices', value: JSON.parse(JSON.stringify(args.p_fields)) })
   return { data: { invoiceId: '22222222-2222-4222-8222-222222222222', status: 'issued' }, error: null }
  },
 }

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

test('the import transaction preserves ownership and only changes explicitly supplied invoice fields', async () => {
  const { PGlite } = await import('@electric-sql/pglite')
  const { readFile } = await import('node:fs/promises')
  const db = new PGlite()
  try {
    const originalSchema = await readFile(new URL('../supabase/migrations/20260306_customer_portal_enterprise.sql', import.meta.url), 'utf8')
    const migration = await readFile(new URL('../supabase/migrations/20261119195601_atomic_invoice_import.sql', import.meta.url), 'utf8')
    const ddl = table => originalSchema.match(new RegExp(`create table if not exists public\\.${table} \\(\\n[\\s\\S]+?\\n\\);`))[0]
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key);
      create table public.external_system_connections (id uuid primary key);
      create table public.customer_contract_portal_links (
        id uuid primary key, user_id uuid, billing_contract_ref text, contract_external_ref text,
        created_at timestamptz default now()
      );
      create type public.gridex_sync_status as enum ('queued', 'success', 'dead_letter');
      ${ddl('customer_profiles')}
      ${ddl('integration_sync_jobs')}
      ${ddl('customer_invoices')}
      ${migration}
    `)
    const userA = payload.customer.userId
    const userB = '22222222-2222-4222-8222-222222222222'
    await db.query('insert into auth.users values ($1), ($2)', [userA, userB])
    await db.query(`
      insert into public.customer_profiles (user_id, billing_customer_ref, first_name)
      values ($1, 'test-a', 'Initial'), ($2, 'test-b', 'Other')
    `, [userA, userB])
    const permissions = await db.query(`
      select has_function_privilege('anon', 'public.gridex_import_invoice(text,text,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE') as anon,
             has_function_privilege('authenticated', 'public.gridex_import_invoice(text,text,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE') as authenticated,
             has_function_privilege('service_role', 'public.gridex_import_invoice(text,text,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE') as service
    `)
    assert.deepEqual(permissions.rows[0], { anon: false, authenticated: false, service: true })
    const client = {
      async rpc(_name, args) {
        const { rows } = await db.query(
          'select public.gridex_import_invoice($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb) as result',
          [args.p_provider, args.p_reference, args.p_customer, args.p_contract, args.p_fields, args.p_payload],
        )
        return { data: rows[0].result, error: null }
      },
    }
    const partial = { ...payload, totalAmount: undefined }
    await assert.rejects(importExternalInvoice(client, partial), { code: 'P0400' })

    const original = await importExternalInvoice(client, {
      ...payload, status: 'paid', paidAt: '2026-11-18', pdfStoragePath: 'test.pdf', lineItems: [{ description: 'synthetic' }],
    })
    const changedPayload = { ...partial, invoiceNumber: 'NEW' }
    const [updated, repeated] = await Promise.all([
      importExternalInvoice(client, changedPayload),
      importExternalInvoice(client, changedPayload),
    ])
    assert.deepEqual(repeated, updated)
    assert.equal((await db.query('select count(*)::int as count from public.integration_sync_jobs')).rows[0].count, 2)
    assert.equal(updated.invoiceId, original.invoiceId)
    const saved = async () => (await db.query(`
      select user_id, status, pdf_storage_path, paid_at, line_items, invoice_number
      from public.customer_invoices
    `)).rows[0]
    const before = await saved()
    assert.equal(before.user_id, userA)
    assert.equal(before.status, 'paid')
    assert.equal(before.pdf_storage_path, 'test.pdf')
    assert.equal(before.paid_at.toISOString().slice(0, 10), '2026-11-18')
    assert.deepEqual(before.line_items, [{ description: 'synthetic' }])
    assert.equal(before.invoice_number, 'NEW')

    await assert.rejects(importExternalInvoice(client, { ...partial, customer: { userId: userB } }), { code: 'P0409' })
    await assert.rejects(importExternalInvoice(client, {
      ...partial, customer: { userId: userA, billingCustomerRef: 'test-b' },
    }), { code: 'P0409' })
    assert.deepEqual(await saved(), before)

    await db.exec(`alter table public.integration_sync_jobs add constraint synthetic_sync_failure check (payload->>'invoiceNumber' <> 'fail')`)
    await assert.rejects(importExternalInvoice(client, {
      ...partial, invoiceNumber: 'fail', customer: { userId: userA, firstName: 'Changed' },
    }), { code: '23514' })
    assert.deepEqual(await saved(), before)
    const profile = await db.query('select first_name from public.customer_profiles where user_id = $1', [userA])
    assert.equal(profile.rows[0].first_name, 'Initial')

    await importExternalInvoice(client, { ...partial, pdfStoragePath: null })
    assert.equal((await saved()).pdf_storage_path, null)
  } finally {
    await db.close()
  }
})
