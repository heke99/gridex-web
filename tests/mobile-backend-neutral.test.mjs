import test from 'node:test';
import assert from 'node:assert/strict';
import {createCustomerBackend} from '../packages/customer-backend/handler.mjs';
import {createDemoBackend} from '../packages/customer-backend/demo.mjs';
import {customerEndpoint,contractWebUrl} from '../apps/mobile/src/customerEndpoint.ts';
const request=(path,options={})=>new Request(`https://buyer.test/customer/v1/${path}`,{...options,headers:{authorization:'Bearer own-customer-token-123',...options.headers}});
const identity={subject:'subject',tenantId:'tenant-a',customerReference:'customer-a'};
test('mobile endpoint supports buyer backend path and rejects cross-origin/path injection',()=>{
 assert.equal(customerEndpoint('https://buyer.test','profile',undefined,'/customer/v1'),'https://buyer.test/customer/v1/profile');
 assert.equal(customerEndpoint('https://gridex.se','support','cursor with /?'),'https://gridex.se/api/mobile/customer/support?cursor=cursor+with+%2F%3F');
 for(const [origin,path,prefix]of [['http://buyer.test','profile','/v1'],['https://buyer.test/path','profile','/v1'],['https://buyer.test','../foreign','/v1'],['https://buyer.test','profile','//evil.test'],['https://buyer.test','profile','/v1?customer=foreign']])assert.throws(()=>customerEndpoint(origin,path,undefined,prefix));
 assert.equal(contractWebUrl('https://gridex.se','signup'),'https://gridex.se/teckna');
 assert.equal(contractWebUrl('https://buyer.test','contracts'),'https://buyer.test/dashboard/contracts');
});
test('reference backend uses only verified tenant/customer binding without OPS calls',async()=>{
 let seen;const handle=createCustomerBackend({authenticate:async()=>({...identity,privateKey:'secret'}),provider:{read:async(binding,operation)=>{seen={binding,operation};return {items:[{reference:'own',name:null,status:null,startDate:null}]};}}});
 const res=await handle(request('contracts',{headers:{'x-gridex-customer-number':'foreign','x-tenant-id':'tenant-b'}}));assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'private, no-store');assert.deepEqual(seen.binding,identity);assert.ok(Object.isFrozen(seen.binding));assert.equal(seen.operation.kind,'contracts');
});
test('independent backend blocks identity overrides and invalid auth before provider',async()=>{
 let calls=0;const handle=createCustomerBackend({authenticate:async token=>token==='own-customer-token-123'?identity:null,provider:{read:async()=>{calls++;return {items:[]};}}});
 for(const path of ['profile?customerId=foreign','contracts?tenant=foreign','documents?cursor=x','support?cursor=a&cursor=b'])assert.equal((await handle(request(path))).status,400);
 assert.equal((await handle(request('profile',{headers:{authorization:'Bearer invalid-session-token'}}))).status,401);assert.equal(calls,0);
});
test('independent document endpoint checks exact reference and approved HTTPS origin',async()=>{
 let items=[{reference:'owned',url:'https://files.test/a',secret:'drop'}];const handle=createCustomerBackend({authenticate:async()=>identity,documentOrigins:['https://files.test'],provider:{read:async()=>({items})}});
 const res=await handle(request('documents/owned/open'));assert.equal(res.status,200);assert.ok(!(await res.text()).includes('secret'));
 for(const invalid of [[{reference:'foreign',url:'https://files.test/a'}],[{reference:'owned',url:'https://files.test.evil.test/a'}],[]]){items=invalid;assert.equal((await handle(request('documents/owned/open'))).status,503);}
});
test('support writes whitelist fields and preserve idempotency with verified ownership',async()=>{
 let seen;const handle=createCustomerBackend({authenticate:async()=>identity,provider:{read:async()=>({items:[]}),write:async(binding,op)=>{seen={binding,op};return {accepted:true};}}});
 const options=body=>({method:'POST',headers:{'content-type':'application/json','idempotency-key':'attempt-key-123'},body:JSON.stringify(body)});
 assert.equal((await handle(request('support',options({title:'Title',message:'Message',customerId:'foreign'})))).status,400);
 assert.equal((await handle(request('support',options({title:'Title',message:'Message'})))).status,201);assert.deepEqual(seen.binding,identity);assert.equal(seen.op.idempotencyKey,'attempt-key-123');assert.deepEqual(seen.op.input,{title:'Title',message:'Message'});
 assert.equal((await handle(request('support/foreign/messages',options({message:'Reply',visibility:'internal'})))).status,400);
});
test('unconfirmed writes and provider errors cannot reflect secrets or claim success',async()=>{
 const handle=createCustomerBackend({authenticate:async()=>identity,provider:{read:async()=>{throw Error('secret credential');},write:async()=>({accepted:false})}});
 const res=await handle(request('profile'));assert.equal(res.status,503);assert.ok(!(await res.text()).includes('secret'));
 assert.equal((await handle(request('support',{method:'POST',headers:{'content-type':'application/json','idempotency-key':'attempt-key-123'},body:JSON.stringify({title:'Title',message:'Message'})}))).status,503);
});
test('synthetic demo isolates two identities and is read-only',async()=>{
 const handle=createDemoBackend();const rows=[];for(const token of ['demo-customer-one-token','demo-customer-two-token']){const res=await handle(request('profile',{headers:{authorization:`Bearer ${token}`}}));assert.equal(res.status,200);rows.push((await res.json()).data.profile[0].reference);}
 assert.notEqual(rows[0],rows[1]);assert.equal((await handle(request('profile'))).status,401);
 assert.equal((await handle(request('support',{method:'POST',headers:{authorization:'Bearer demo-customer-one-token'}}))).status,405);
});
test('provider projection removes internal metadata and rejects nonpublic messages',async()=>{
 let kind='contracts';
 const handle=createCustomerBackend({authenticate:async()=>identity,provider:{read:async()=>({items:kind==='contracts'?[{reference:'own',name:null,status:null,startDate:null,secret:'must-not-leak'}]:[{reference:'case-own',title:'Case',description:null,status:'received',createdAt:null,updatedAt:null,moreMessages:false,messages:[{reference:'message',author:'staff',kind:'message',body:'private',createdAt:null,visibility:'internal'}]}]})}});
 const response=await handle(request('contracts'));assert.equal(response.status,200);assert.ok(!(await response.text()).includes('must-not-leak'));
 kind='supportDetail';assert.equal((await handle(request('support/case-own'))).status,503);
});
test('large or malformed support bodies never reach the write provider',async()=>{
 let writes=0;const handle=createCustomerBackend({authenticate:async()=>identity,provider:{read:async()=>({items:[]}),write:async()=>{writes++;return {accepted:true};}}});
 for(const body of ['{',JSON.stringify({title:'Title',message:'x'.repeat(40000)})]){const res=await handle(request('support',{method:'POST',headers:{'content-type':'application/json','idempotency-key':'attempt-key-123'},body}));assert.ok([400,413].includes(res.status));}assert.equal(writes,0);
});
test('provider ownership denial and idempotency conflicts retain safe HTTP statuses',async()=>{
 const {CustomerBackendError}=await import('../packages/customer-backend/handler.mjs');let status=403;
 const handle=createCustomerBackend({authenticate:async()=>identity,provider:{read:async()=>{throw new CustomerBackendError(status);}}});
 for(status of [403,404,409,429]){const response=await handle(request('support/foreign'));assert.equal(response.status,status);assert.ok(!(await response.text()).includes('foreign'));}
});
test('buyer backend supports phone and notification writes without OPS',async()=>{
 const calls=[];const handle=createCustomerBackend({authenticate:async()=>identity,provider:{read:async()=>({items:[]}),write:async(binding,operation)=>{calls.push({binding,operation});return {accepted:true,readAt:'2026-11-06T12:00:00Z'};}}});
 const options=body=>({method:'POST',headers:{'content-type':'application/json','idempotency-key':'account-attempt-123'},body:JSON.stringify(body)});
 assert.equal((await handle(request('profile',options({phone:'0701234567'})))).status,200);assert.equal(calls[0].operation.kind,'phone');assert.deepEqual(calls[0].binding,identity);
 const response=await handle(request('notifications/read',options({reference:'own-notification'})));assert.equal(response.status,200);assert.equal((await response.json()).data.readAt,'2026-11-06T12:00:00Z');assert.equal(calls[1].operation.reference,'own-notification');
 assert.equal((await handle(request('profile',options({phone:'0701234567',role:'admin'})))).status,400);
});
