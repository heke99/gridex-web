import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consumptionSelection,projectConsumption,createConsumptionHandler} from '../packages/customer-backend/consumption.mjs';
import {createCustomerBackend} from '../packages/customer-backend/handler.mjs';
const time=day=>`2026-11-${String(day).padStart(2,'0')}T00:00:00.000Z`;
const selection={facility:'facility_one',from:time(1),to:time(8)};
const row=(id,from,to,kwh=1)=>({reference:`reading_${id}`,facility:'facility_one',from:time(from),to:time(to),kwh,internal:'secret'});
const input=()=>({deliveryWindows:[{facility:'facility_one',from:time(3),to:time(6)}],items:[row('before',1,2),row('crossstart',2,4),row('valid',4,5,0),row('end',5,6,2),row('crossend',6,7)],complete:true});
test('projection excludes whole intervals outside verified facility delivery; no raw fields',()=>{
 const result=projectConsumption(input(),selection);assert.deepEqual(result.items.map(r=>r.reference),['reading_valid','reading_end']);assert.equal(result.totalKwh,2);assert.equal(result.complete,true);assert.ok(!JSON.stringify(result).includes('secret'));assert.ok(!('deliveryWindows'in result));
});
test('no inferred windows; gaps, duplicate revisions and foreign facility fail safely',()=>{
 for(const patch of [{deliveryWindows:[]},{deliveryWindows:null},{items:[row('x',3,5),row('y',4,6)]},{items:[row('x',3,4),row('x',4,5)]},{items:[{...row('x',3,4),facility:'foreign'}]},{items:[row('x',3,4,-1)]},{items:[row('x',3,4,NaN)]},{items:[{...row('x',3,4),reference:123}]}])assert.throws(()=>projectConsumption({...input(),...patch},selection));
 const result=projectConsumption({...input(),deliveryWindows:[{facility:'facility_one',from:time(1),to:time(2)},{facility:'facility_one',from:time(5),to:time(6)}]},selection);assert.deepEqual(result.items.map(r=>r.reference),['reading_before','reading_end']);
});
test('selection rejects identity overrides, impossible dates, duplicates, excessive periods',async()=>{
 for(const patch of [{facility:123},{customerId:'foreign'},{from:'2026-02-30T00:00:00.000Z'},{from:time(9)},{from:'2026-01-01T00:00:00.000Z'}])assert.throws(()=>consumptionSelection({...selection,...patch}));
 let calls=0;const handler=createConsumptionHandler({authenticate:async()=>{calls++;return true;},load:async()=>input()});
 for(const extra of ['&customerId=foreign','&facility=foreign'])assert.equal((await handler(new Request(`https://test/consumption?${new URLSearchParams(selection)}${extra}`))).status,400);
 assert.equal(calls,0);
});
test('provider-neutral HTTP contract binds two users and rejects foreign facility before returning values',async()=>{
 const backend=createCustomerBackend({authenticate:async token=>({subject:token,tenantId:'tenant',customerReference:token}),provider:{read:async(binding,s)=>{assert.equal(s.kind,'consumption');return {...input(),deliveryWindows:binding.subject==='customer-one-token'?input().deliveryWindows:[]};}}});
 for(const [token,status]of [['customer-one-token',200],['customer-two-token',503]]){
  const response=await backend(new Request(`https://test/customer/v1/consumption?${new URLSearchParams(selection)}`,{headers:{authorization:`Bearer ${token}`}}));assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'private, no-store');
 }
});
test('Gridex actual route fails closed before any upstream readings while delivery authority unavailable',async()=>{
 const old={...process.env};process.env.GRIDEX_MOBILE_API_ENABLED='true';process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-test';let reads=0;
 globalThis.__mobileReadFixture={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'subject',email_confirmed_at:time(1)}}})},from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{customer_number:'own'}})})}),resource:()=>{reads++;throw new Error('Must not read');}};
 try{const {GET}=await import('../app/api/mobile/customer/consumption/route.ts');const response=await GET(new Request(`https://test/api/mobile/customer/consumption?${new URLSearchParams(selection)}`,{headers:{authorization:'Bearer verified-customer-token'}}));assert.equal(response.status,503);assert.equal(reads,0);assert.ok(!JSON.stringify(await response.json()).includes('subject'));}
 finally{for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old);delete globalThis.__mobileReadFixture;}
});
test('consumption handler requires auth and hides upstream errors',async()=>{
 const handler=createConsumptionHandler({authenticate:async token=>token==='verified-customer-token'?{subject:'one'}:null,load:async()=>{throw new Error('private token database');}});
 const url=`https://test/consumption?${new URLSearchParams(selection)}`;
 assert.equal((await handler(new Request(url))).status,401);
 const response=await handler(new Request(url,{headers:{authorization:'Bearer verified-customer-token'}}));assert.equal(response.status,503);assert.ok(!JSON.stringify(await response.json()).includes('database'));
});
