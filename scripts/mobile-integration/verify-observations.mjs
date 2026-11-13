import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {assertReuseReport} from './qualified-android.mjs';
const root=process.env.RUNNER_TEMP;
const read=name=>existsSync(join(root,name))?JSON.parse(readFileSync(join(root,name),'utf8')):[];
const docs=read('mobile-document-requests.json'),market=read('mobile-market-requests.json'),handoffs=read('mobile-handoff-requests.json');
const f=JSON.parse(readFileSync(join(root,'mobile-fixtures/customers.json'),'utf8')),checks=[];
const reusePath=join(root,'mobile-android-reuse.json');
const reused=existsSync(reusePath)?assertReuseReport(JSON.parse(readFileSync(reusePath,'utf8')),process.env.QUALIFICATION_WEB_COMMIT,process.env.GRIDEX_OPS_COMMIT):null;
for(const platform of ['android','ios']){
 if(platform==='android'&&reused){checks.push(...reused.androidSystemChecks.map(c=>({...c,evidence:'reused',referenceRun:reused.reference.run,referenceSource:reused.reference.source})));continue;}
 for(const area of ['SE1','SE2','SE3','SE4'])checks.push({id:platform+':public-market-'+area,result:market.some(r=>r.platform===platform&&r.area===area&&!r.authorizationPresent)?'PASS':'FAIL'});
 checks.push({id:platform+':external-document-no-bearer',result:docs.some(r=>r.platform===platform&&r.reference===f.customers[1].extra.document&&!r.authorizationPresent)?'PASS':'FAIL'});
 checks.push({id:platform+':external-invoice-pdf-no-bearer',result:docs.some(r=>r.platform===platform&&r.reference===f.customers[1].extra.invoiceDocument&&!r.authorizationPresent)?'PASS':'FAIL'});
 for(const path of ['/login/forgot-password','/teckna','/dashboard/contracts','/dashboard/support'])checks.push({id:platform+':web-handoff-'+path,result:handoffs.some(r=>r.platform===platform&&r.path===path&&!r.credentialPresent)?'PASS':'FAIL'});
}
checks.push({id:'no-credential-forwarding-to-public-readers',result:(!reused||reused.publicReadersCredentialFree)&&docs.every(r=>!r.authorizationPresent)&&market.every(r=>!r.authorizationPresent)&&handoffs.every(r=>!r.credentialPresent)?'PASS':'FAIL'});
writeFileSync(join(root,'mobile-system-observations.json'),JSON.stringify({webCommit:process.env.QUALIFICATION_WEB_COMMIT,opsCommit:process.env.GRIDEX_OPS_COMMIT,androidEvidence:reused?{kind:'reused',reference:reused.reference}:{kind:'current-run'},checks},null,2)+'\n');
for(const c of checks)console.log(c.result+' '+c.id);
if(checks.some(c=>c.result==='FAIL'))process.exitCode=1;
