import { test } from 'node:test';import assert from 'node:assert/strict';
import { supportWriteHandler } from '../lib/mobile/supportWrites.ts';
const request=(body, key='attempt-123456')=>new Request('https://tenant.test/support',{method:'POST',headers:{authorization:'Bearer verified-token-123456','content-type':'application/json','idempotency-key':key},body:JSON.stringify(body)});
test('only authenticated customer content is forwarded with unchanged retry identity',async()=>{
 let calls=0;const keys=[];const handler=supportWriteHandler({enabled:()=>true,authenticate:async()=> 'own-subject',submit:async(subject,token,input,key)=>{assert.equal(subject,'own-subject');assert.deepEqual(input,{title:'Question',message:'Hello'});keys.push(key);calls++;return{accepted:true};}},true);
 for(let i=0;i<2;i++)assert.equal((await handler(request({title:'Question',message:'Hello'}))).status,201);
 assert.deepEqual(keys,['attempt-123456','attempt-123456']);assert.equal(calls,2);
});
test('identity/staff visibility overrides and missing retry keys are rejected',async()=>{
 let calls=0;const handler=supportWriteHandler({enabled:()=>true,authenticate:async()=> 'own',submit:async()=>{calls++;}},true);
 for(const body of [{title:'Q',message:'Hi',customerId:'foreign'},{title:'Q',message:'Hi',author:'staff'},{title:'Q',message:'Hi',visibility:'internal'},{title:'Q',message:''}])assert.equal((await handler(request(body))).status,400);
 assert.equal((await handler(request({title:'Q',message:'Hi'},''))).status,400);assert.equal(calls,0);
});
test('unverified identity cannot write and provider errors are opaque',async()=>{
 const handler=supportWriteHandler({enabled:()=>true,authenticate:async()=>null,submit:async()=>{throw Error('unexpected');}});
 assert.equal((await handler(request({message:'Hi'}))).status,401);
 const failing=supportWriteHandler({enabled:()=>true,authenticate:async()=> 'own',submit:async()=>{throw Object.assign(Error('secret'),{status:409});}});
 const response=await failing(request({message:'Hi'}));assert.equal(response.status,409);assert.ok(!(await response.text()).includes('secret'));
});

test('request bodies are bounded while streaming, before any write',async()=>{
 let writes=0;const handler=supportWriteHandler({enabled:()=>true,authenticate:async()=> 'own',submit:async()=>{writes++;}});
 const response=await handler(request({message:'x'.repeat(41000)}));assert.equal(response.status,413);assert.equal(writes,0);
});
