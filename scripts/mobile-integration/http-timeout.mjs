import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {connect} from 'node:net';
const f=JSON.parse(readFileSync(process.argv[2],'utf8')),results=[];
for(let attempt=0;;attempt++){
 try{await new Promise((resolve,reject)=>{const s=connect(3443,'127.0.0.1');s.once('connect',()=>{s.destroy();resolve();});s.once('error',reject);});break;}
 catch(error){if(attempt===20)throw error;await new Promise(resolve=>setTimeout(resolve,100));}
}
for(const [index,u]of f.customers.entries()){
 const started=Date.now();
 const r=await fetch('http://127.0.0.1:3100/api/mobile/customer/contracts',{headers:{authorization:'Bearer '+u.accessToken},signal:AbortSignal.timeout(65000)});
 assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'private, no-store');
 const body=await r.json();assert.deepEqual(Object.keys(body),['error']);
 for(const value of [...f.secrets,...f.customers.map(c=>c.number),...f.customers.flatMap(c=>Object.values(c.references))])assert.ok(!JSON.stringify(body).includes(value));
 if(index===0)assert.ok(Date.now()-started>=1000,'Must exercise accepted stalled request, not refused connection');
 results.push({id:u.label+':accepted-OPS-connection-timeout',result:'PASS'});
}
writeFileSync(process.argv[3],JSON.stringify({opsCommit:process.env.GRIDEX_OPS_COMMIT,webCommit:process.env.GRIDEX_WEB_COMMIT,results},null,2)+'\n');
console.log('PASS controlled accepted-connection OPS timeout, no customer/credential leakage');
