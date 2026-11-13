import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {oracle,sourceDigest,sql,quote} from './consumption-fixtures.mjs';
const f=JSON.parse(readFileSync(process.argv[2],'utf8')),out=process.argv[3],mode=process.argv[4]??'full';
const results=[];
async function token(user){const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'content-type':'application/json'},body:JSON.stringify(user.login),signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);return (await r.json()).access_token;}
async function call(user,query,bearer){
 const access=bearer===undefined&&user?await token(user):bearer;
 const r=await fetch('http://127.0.0.1:3100/api/mobile/customer/consumption?'+query,{headers:access?{authorization:'Bearer '+access}:{},redirect:'error',signal:AbortSignal.timeout(60000)});
 assert.equal(r.headers.get('cache-control'),'private, no-store');const text=await r.text();for(const secret of [...f.secrets,...f.customers.map(u=>u.login.password),...(access?[access]:[])])assert.ok(!text.includes(secret),'Credential leak');return {status:r.status,body:JSON.parse(text)};
}
async function scenario(id,fn){try{await fn();results.push({id,status:'PASS'});console.log('PASS '+id);}catch(error){results.push({id,status:'FAIL',errorType:error.name});console.error('FAIL '+id+' (payload suppressed)');}}
const selection=(u,kind,range)=>new URLSearchParams({facility:u.consumption[kind+'Reference'],from:range.from,to:range.to});
const deny=(response,statuses)=>{assert.ok(statuses.includes(response.status));assert.deepEqual(Object.keys(response.body),['error']);const text=JSON.stringify(response.body);for(const u of f.customers)assert.ok(!text.includes(u.number)&&!text.includes(u.references.sites));};
if(mode==='outage'){
 for(const u of f.customers)await scenario(u.label+':controlled-OPS-outage',async()=>deny(await call(u,selection(u,'primary',u.consumption.expected.primary7)),[503]));
}else{
 const order=mode==='recovery'?[f.customers[0],f.customers[1]]:[f.customers[0],f.customers[1],f.customers[0]];
 for(const [index,u]of order.entries())for(const days of mode==='recovery'?[7]:[7,30])for(const kind of mode==='recovery'?['primary']:['primary','secondary'])await scenario(`${index}:${u.label}:${kind}:${days}-days`,async()=>{
  const range=u.consumption.expected[kind+days],expected=oracle(f,u,u.consumption[kind],range.from,range.to);
  const before=Number(sql(`SELECT count(*) FROM public.integration_api_requests WHERE api_client_id=${quote(f.clientId)} AND status_code=200;`));
  const response=await call(u,selection(u,kind,range));assert.equal(response.status,200);const actual=response.body.data.consumption;
  assert.equal(actual.complete,true);assert.equal(actual.totalKwh,expected.totalKwh);assert.deepEqual(actual.items.map(v=>v.reference).sort(),expected.references);assert.ok(expected.count>100,'Must exercise multiple real OPS meter pages');
  const after=Number(sql(`SELECT count(*) FROM public.integration_api_requests WHERE api_client_id=${quote(f.clientId)} AND status_code=200;`));assert.ok(after>before,'Actual OPS read logs required');
  assert.ok(!JSON.stringify(response.body).includes(f.customers.find(x=>x!==u).number));
 });
 if(mode==='full'){
  for(const u of f.customers){
   const range=u.consumption.expected.primary7,other=f.customers.find(x=>x!==u);
   await scenario(u.label+':foreign-facility-denied',async()=>deny(await call(u,selection(other,'primary',range)),[403,404,503]));
   await scenario(u.label+':customer-override-denied',async()=>{const q=selection(u,'primary',range);q.set('customerId',other.number);deny(await call(u,q),[400]);});
   for(const [name,kind,from,to,hours]of [['spring-DST','secondary','2026-03-28T23:00:00.000Z','2026-03-29T22:00:00.000Z',23],['autumn-DST','primary','2026-10-24T22:00:00.000Z','2026-10-25T23:00:00.000Z',25]])await scenario(u.label+':'+name,async()=>{
    assert.equal((Date.parse(to)-Date.parse(from))/3600000,hours);const expected=oracle(f,u,u.consumption[kind],from,to);assert.ok(expected.count>0);const r=await call(u,selection(u,kind,{from,to}));assert.equal(r.status,200);assert.equal(r.body.data.consumption.totalKwh,expected.totalKwh);assert.deepEqual(r.body.data.consumption.items.map(x=>x.reference).sort(),expected.references);
   });
  }
  const q=selection(f.customers[0],'primary',f.customers[0].consumption.expected.primary7);
  await scenario('unlinked-account-denied',async()=>deny(await call(f.unlinked,q),[403,404,503]));
  await scenario('missing-session-denied',async()=>deny(await call(null,q,null),[401]));
  await scenario('invalid-session-denied',async()=>deny(await call(null,q,'invalid-session-token-1234567890'),[401]));
 }
}
assert.equal(sourceDigest(f),f.consumptionSourceDigest,'Read-only consumption data changed');
writeFileSync(out,JSON.stringify({opsCommit:process.env.GRIDEX_OPS_COMMIT,webCommit:process.env.GRIDEX_WEB_COMMIT,mode,results,readOnlySourceDigestMatches:true},null,2));
if(results.some(r=>r.status!=='PASS'))process.exitCode=1;
