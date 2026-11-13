import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {requireLoopback,bounds} from '../scripts/consumption-integration/consumption-fixtures.mjs';

test('consumption fixtures require the exact disposable PostgreSQL endpoint',()=>{
 assert.equal(requireLoopback('postgresql://postgres:synthetic@127.0.0.1:54322/postgres'),'postgresql://postgres:synthetic@127.0.0.1:54322/postgres');
 for(const url of ['postgresql://postgres:test@remote.example:54322/postgres','postgresql://postgres:test@127.0.0.1:5432/postgres','postgresql://other:test@127.0.0.1:54322/postgres','postgresql://postgres:test@127.0.0.1:54322/other','postgresql://postgres:test@127.0.0.1:54322/postgres?host=remote.example','http://postgres:test@127.0.0.1:54322/postgres'])assert.throws(()=>requireLoopback(url));
});
test('only declared calendar periods can reach the independent SQL oracle',()=>{for(const value of [0,-1,1,32,'7;SELECT 1'])assert.throws(()=>bounds(value));});
test('targeted native qualification cannot trigger the old broad customer workflow',()=>{
 const path=new URL('../.github/workflows/mobile-customer-qualification.yml',import.meta.url),old=readFileSync(path,'utf8');
 assert.ok(old.includes("'scripts/mobile-integration/**'"));assert.ok(!old.includes('scripts/consumption-integration/'));
 const android=readFileSync(new URL('../scripts/consumption-integration/consumption-android.py',import.meta.url),'utf8');
 assert.ok(android.includes('source.split(marker)[0]'));assert.ok(!android.includes('android-core-qualify.py'));assert.ok(!android.includes('android-features.py'));
});
const directory=mkdtempSync(join(tmpdir(),'gridex-consumption-gateway-'));mkdirSync(join(directory,'mobile-fixtures'));
const secret='nonpublic-test-password',key='a'.repeat(64);
writeFileSync(join(directory,'mobile-fixtures/customers.json'),JSON.stringify({customers:[{label:'A',userId:'test-subject',login:{password:secret},consumption:{secondaryTitle:'synthetic-second',expected:{primary7:{display:'672 kWh i hämtade mätvärden'}}}}]}));
const child=fork(fileURLToPath(new URL('../scripts/consumption-integration/consumption-gateway.mjs',import.meta.url)),[],{env:{...process.env,RUNNER_TEMP:directory,GRIDEX_QUALIFICATION_CONTROL_KEY:key,GRIDEX_CONSUMPTION_GATEWAY_PORT:'0'},stdio:['ignore','ignore','ignore','ipc']});
let timeout;const ready=await Promise.race([once(child,'message'),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Gateway readiness deadline')),10000);})]);clearTimeout(timeout);
const origin='http://127.0.0.1:'+ready[0].port;
after(()=>{child.kill('SIGTERM');rmSync(directory,{recursive:true,force:true});});
test('gateway exposes no database, OPS, Auth admin, signup or customer writes',async()=>{
 for(const [path,method]of [['/rest/v1/customers','GET'],['/api/v1/customer/sites','GET'],['/auth/v1/admin/users','POST'],['/auth/v1/signup','POST'],['/api/mobile/customer/support','POST'],['/auth/v1/token','GET']]){const r=await fetch(origin+path,{method});assert.equal(r.status,404);assert.ok(!(await r.text()).includes(secret));}
});
test('synthetic fixture controls require the bounded private control key',async()=>{
 for(const value of ['',key.slice(1),'b'.repeat(64)])assert.equal((await fetch(origin+'/qualification-consumption',{method:'POST',headers:{'x-qualification-control':value},body:'{"action":"expectations"}'})).status,403);
 const r=await fetch(origin+'/qualification-consumption',{method:'POST',headers:{'x-qualification-control':key},body:'{"action":"expectations"}'});assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes(secret)&&!text.includes(key));
});
test('a phase cannot be approved without a fresh actual native HTTP response',async()=>{
 const call=body=>fetch(origin+'/qualification-consumption',{method:'POST',headers:{'x-qualification-control':key},body:JSON.stringify(body)});
 assert.equal((await call({action:'snapshot',phase:'ios:A:primary:7'})).status,200);
 assert.equal((await call({action:'assert',phase:'ios:A:primary:7',previous:0})).status,400);
 assert.equal((await call({action:'snapshot',phase:'ios:C:primary:7'})).status,400);
});
