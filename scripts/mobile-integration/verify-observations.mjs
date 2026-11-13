import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepare} from './ios-case-reuse.mjs';
import {assertReuseReport} from './qualified-android.mjs';
const root=process.env.RUNNER_TEMP;
const read=name=>existsSync(join(root,name))?JSON.parse(readFileSync(join(root,name),'utf8')):[];
const docs=read('mobile-document-requests.json'),market=read('mobile-market-requests.json'),handoffs=read('mobile-handoff-requests.json');
const f=JSON.parse(readFileSync(join(root,'mobile-fixtures/customers.json'),'utf8')),checks=[];
const reusePath=join(root,'mobile-android-reuse.json');
const reused=existsSync(reusePath)?assertReuseReport(JSON.parse(readFileSync(reusePath,'utf8')),process.env.QUALIFICATION_WEB_COMMIT,process.env.GRIDEX_OPS_COMMIT):null;
const iosReuse=process.env.GRIDEX_IOS_CASE_REUSE==='true'?await prepare(resolve(fileURLToPath(new URL('.',import.meta.url)),'../..')):null;
for(const platform of ['android','ios']){
 if(platform==='android'&&reused){checks.push(...reused.androidSystemChecks.map(c=>({...c,evidence:'reused',referenceRun:reused.reference.run,referenceSource:reused.reference.source})));continue;}
 const saved=platform==='ios'?iosReuse:null;
 const record=(id,actual)=>{const old=saved?[...saved.systemChecks,...saved.marketEvidence.systemChecks].find(c=>c.id===id):null;checks.push(old&&!id.endsWith('/dashboard/support')?old:{id,result:actual?'PASS':'FAIL',evidence:'current-run'});};
 for(const area of ['SE1','SE2','SE3','SE4'])record(platform+':public-market-'+area,market.some(r=>r.platform===platform&&r.area===area&&!r.authorizationPresent));
 record(platform+':external-document-no-bearer',docs.some(r=>r.platform===platform&&r.reference===f.customers[1].extra.document&&!r.authorizationPresent));
 record(platform+':external-invoice-pdf-no-bearer',docs.some(r=>r.platform===platform&&r.reference===f.customers[1].extra.invoiceDocument&&!r.authorizationPresent));
 for(const path of ['/login/forgot-password','/teckna','/dashboard/contracts','/dashboard/support'])record(platform+':web-handoff-'+path,handoffs.some(r=>r.platform===platform&&r.path===path&&!r.credentialPresent));
}
checks.push({id:'no-credential-forwarding-to-public-readers',result:(!reused||reused.publicReadersCredentialFree)&&(!iosReuse||iosReuse.publicReadersCredentialFree)&&docs.every(r=>!r.authorizationPresent)&&market.every(r=>!r.authorizationPresent)&&handoffs.every(r=>!r.credentialPresent)?'PASS':'FAIL'});
writeFileSync(join(root,'mobile-system-observations.json'),JSON.stringify({webCommit:process.env.QUALIFICATION_WEB_COMMIT,opsCommit:process.env.GRIDEX_OPS_COMMIT,iosEvidence:iosReuse?{kind:'composed',reference:iosReuse.reference,freshCases:['support'],reusedCases:['core','session','market'],marketReference:iosReuse.marketEvidence.reference}:{kind:'current-run'},androidEvidence:reused?{kind:'reused',reference:reused.reference}:{kind:'current-run'},checks},null,2)+'\n');
for(const c of checks)console.log(c.result+' '+c.id);
if(checks.some(c=>c.result==='FAIL'))process.exitCode=1;
