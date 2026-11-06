import test from 'node:test';
import assert from 'node:assert/strict';
import {accountWriteHandler} from '../lib/mobile/accountWrites.ts';
const ref=`notification_${'a'.repeat(24)}`;
const request=(body,extra={})=>new Request('https://tenant.test/api/mobile/customer/profile',{method:'POST',headers:{authorization:'Bearer customer-token-123456','content-type':'application/json','idempotency-key':'account-attempt-123',...extra},body:JSON.stringify(body)});
test('account writes bind verified subject and whitelist exactly one editable field',async()=>{
 let calls=0;const handler=accountWriteHandler({enabled:()=>true,authenticate:async()=> 'own-user',submit:async(subject,token,input,key)=>{calls++;assert.equal(subject,'own-user');assert.equal(token,'customer-token-123456');assert.deepEqual(input,{phone:'070 123 45 67'});assert.equal(key,'account-attempt-123');return {accepted:true};}},'phone');
 assert.equal((await handler(request({phone:'070 123 45 67'}))).status,200);
 for(const input of [{phone:'0701234567',customerId:'foreign'},{email:'other@example.test'},{phone:''},{phone:'x'.repeat(30)},{phone:'1'.repeat(41)}])assert.equal((await handler(request(input))).status,400);
 assert.equal(calls,1);
});
test('notification writes require a canonical public reference and confirmed server result',async()=>{
 let accepted=true;const handler=accountWriteHandler({enabled:()=>true,authenticate:async()=> 'own',submit:async(_s,_t,input)=>{assert.deepEqual(input,{reference:ref});return {accepted};}},'notification');
 assert.equal((await handler(request({reference:ref}))).status,200);
 assert.equal((await handler(request({reference:'foreign-internal-id'}))).status,400);
 accepted=false;assert.equal((await handler(request({reference:ref}))).status,503);
});
test('disabled, unauthenticated, query override and oversized bodies never submit',async()=>{
 let calls=0;const deps={enabled:()=>true,authenticate:async()=> 'own',submit:async()=>{calls++;return {accepted:true};}};
 assert.equal((await accountWriteHandler({...deps,enabled:()=>false},'phone')(request({phone:'0701234567'}))).status,404);
 assert.equal((await accountWriteHandler(deps,'phone')(request({phone:'0701234567'},{authorization:''}))).status,401);
 const oversized=await accountWriteHandler(deps,'phone')(request({phone:'x'.repeat(5000)}));assert.equal(oversized.status,413);assert.equal(oversized.headers.get('cache-control'),'private, no-store');
 const query=new Request('https://tenant.test/api/mobile/customer/profile?customerId=foreign',{method:'POST'});assert.equal((await accountWriteHandler(deps,'phone')(query)).status,400);assert.equal(calls,0);
});
test('conflicts and provider failures never claim an accepted change or reflect credentials',async()=>{
 for(const status of [403,409,429,503]){const response=await accountWriteHandler({enabled:()=>true,authenticate:async()=> 'own',submit:async()=>{throw Object.assign(Error('secret-provider-token'),{status});}},'phone')(request({phone:'0701234567'}));assert.equal(response.status,status);assert.ok(!(await response.text()).includes('secret-provider-token'));}
});
