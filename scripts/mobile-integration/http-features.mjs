import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const f=JSON.parse(readFileSync(process.argv[2],'utf8'));
const origin='http://127.0.0.1:3100/api/mobile/customer';
const results=[];
async function token(u){
 const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'content-type':'application/json'},body:JSON.stringify(u.login),signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,200,'Verified Auth login');const s=await r.json();u.accessToken=s.access_token;return s.access_token;
}
async function call(u,path,body,key){
 const bearer=await token(u);
 const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+bearer,...(body?{'content-type':'application/json','idempotency-key':key??randomUUID()}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(65000),redirect:'error'});
 assert.equal(r.headers.get('cache-control'),'private, no-store');const text=await r.text();
 for(const secret of [...f.secrets,bearer,...f.customers.map(c=>c.login.password)])assert.ok(!text.includes(secret),'Credential leak');
 return {status:r.status,body:JSON.parse(text)};
}
async function scenario(id,run){try{await run();results.push({id,result:'PASS'});console.log('PASS '+id);}catch{results.push({id,result:'FAIL'});console.error('FAIL '+id+' (payload suppressed)');}}
for(const [i,u]of f.customers.entries()){
 const other=f.customers[1-i];
 for(const [resource,key]of [['profile',null],['notifications','notification'],['documents','document'],['powers','power_of_attorney'],['acceptances','acceptance']])await scenario(u.label+':'+resource,async()=>{
  const r=await call(u,'/'+resource);assert.equal(r.status,200);const rows=r.body.data[resource];assert.equal(rows.length,1);
  if(key)assert.equal(rows[0].reference,u.extra[key]);else assert.equal(rows[0].customerNumber,u.number);
  assert.ok(!JSON.stringify(rows).includes(other.number));
 });
 await scenario(u.label+':phone-write-readback-and-replay',async()=>{
  const key=randomUUID(),phone=i===0?'+46711111111':'+46722222222';
  for(let n=0;n<2;n++){const r=await call(u,'/profile',{phone},key);assert.equal(r.status,200);assert.equal(r.body.data.accepted,true);}
  const r=await call(u,'/profile');assert.equal(r.body.data.profile[0].phone,phone);
  const foreign=await call(other,'/profile');assert.notEqual(foreign.body.data.profile[0].phone,phone);
 });
 await scenario(u.label+':notification-read-and-foreign-denial',async()=>{
  const r=await call(u,'/notifications/read',{reference:u.extra.notification});assert.equal(r.status,200);assert.equal(r.body.data.accepted,true);assert.ok(Number.isFinite(Date.parse(r.body.data.readAt)));
  const read=await call(u,'/notifications');assert.ok(read.body.data.notifications[0].readAt);
  const before=(await call(other,'/notifications')).body.data.notifications[0];
  const denied=await call(u,'/notifications/read',{reference:other.extra.notification});assert.ok([403,404,503].includes(denied.status));assert.deepEqual(Object.keys(denied.body),['error']);
  const after=(await call(other,'/notifications')).body.data.notifications[0];assert.equal(after.readAt,before.readAt);assert.equal(after.status,before.status);
 });
 await scenario(u.label+':support-create-replay-reply-readback-isolation',async()=>{
  const title=u.number+'-SUPPORT',message=u.number+'-FIRST',key=randomUUID();
  for(let n=0;n<2;n++){const r=await call(u,'/support',{title,message},key);assert.equal(r.status,200);assert.equal(r.body.data.accepted,true);}
  const list=await call(u,'/support');assert.equal(list.status,200);const matches=list.body.data.support.filter(c=>c.title===title);assert.equal(matches.length,1);const reference=matches[0].reference;
  u.extra.support=reference;u.extra.supportTitle=title;
  const reply=u.number+'-REPLY',replyKey=randomUUID();
  for(let n=0;n<2;n++){const r=await call(u,'/support/'+reference+'/messages',{message:reply},replyKey);assert.equal(r.status,200);}
  const detail=await call(u,'/support/'+reference);assert.equal(detail.status,200);const content=JSON.stringify(detail.body);assert.ok(content.includes(reply));assert.ok(!content.includes(other.number));
  const denied=await call(other,'/support/'+reference);assert.ok([403,404,503].includes(denied.status));assert.deepEqual(Object.keys(denied.body),['error']);
  const foreignMessage='FOREIGN-WRITE-'+randomUUID();const forbidden=await call(other,'/support/'+reference+'/messages',{message:foreignMessage});assert.ok([403,404,503].includes(forbidden.status));assert.deepEqual(Object.keys(forbidden.body),['error']);
  assert.ok(!JSON.stringify((await call(u,'/support/'+reference)).body).includes(foreignMessage));
 });
 await scenario(u.label+':unapproved-document-link-fails-closed',async()=>{
  const r=await call(u,'/documents/'+u.extra.document+'/open');assert.ok([403,404,503].includes(r.status));assert.deepEqual(Object.keys(r.body),['error']);
 });
}
writeFileSync(process.argv[2],JSON.stringify(f),{mode:0o600});
const db=new URL(process.env.DB_URL);assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'54322');
assert.match(f.companyId,/^[a-f0-9-]{36}$/);
execFileSync('psql',[process.env.DB_URL,'-X','-q','-v','ON_ERROR_STOP=1'],{input:`UPDATE public.customer_notifications SET status='unread',read_at=NULL WHERE company_id='${f.companyId}';`,stdio:['pipe','ignore','pipe']});
writeFileSync(process.argv[3],JSON.stringify({opsCommit:process.env.GRIDEX_OPS_COMMIT,webCommit:process.env.GRIDEX_WEB_COMMIT,results},null,2)+'\n');
if(results.some(r=>r.result==='FAIL'))process.exitCode=1;
