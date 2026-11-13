import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const api=path=>JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}));
const ops=process.env.GRIDEX_OPS_COMMIT,web=process.env.QUALIFICATION_WEB_COMMIT;
assert.match(ops,/^[a-f0-9]{40}$/);assert.match(web,/^[a-f0-9]{40}$/);
const deadline=Date.now()+60*60*1000;let errors=0;
while(Date.now()<deadline){
 let a,b;try{a=api(`repos/heke99/gridex-ops-platform/commits/${ops}/check-runs?per_page=100`).check_runs;b=api(`repos/heke99/gridex-web/commits/${web}/check-runs?per_page=100`).check_runs;errors=0;}catch{if(++errors>2)throw Error('Pinned source gates could not be read');await new Promise(r=>setTimeout(r,10000));continue;}
 const requiredOps=['verify','quality-release-gates','clean-migration-replay'],requiredWeb=['verify','contract','native-shell','portable-native-export','standalone-export'];
 const checks=[...a,...b.filter(c=>requiredWeb.includes(c.name))];
 if(checks.some(c=>['failure','timed_out','cancelled','action_required'].includes(c.conclusion)))throw Error('Pinned source has a failed required gate; diagnose before provisioning');
 if(requiredOps.every(name=>a.some(c=>c.name===name&&c.conclusion==='success'))&&requiredWeb.every(name=>b.some(c=>c.name===name&&c.conclusion==='success'))&&a.every(c=>c.status==='completed')){
  writeFileSync(process.env.RUNNER_TEMP+'/consumption-source-gates.json',JSON.stringify({opsCommit:ops,webCommit:web,checks:checks.map(c=>({name:c.name,status:c.status,conclusion:c.conclusion,url:c.html_url})),qualifiedScope:'Required consumption code gates; conditional native skips do not create market acceptance.'},null,2));break;
 }
 console.log('Waiting for terminal checks on the exact paired sources');await new Promise(r=>setTimeout(r,30000));
}
if(Date.now()>=deadline)throw Error('Pinned source gates did not complete within the bounded wait');
