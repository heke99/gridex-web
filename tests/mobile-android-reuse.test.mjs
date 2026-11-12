import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ANDROID_REFERENCE as ref,APPROVED_WORKFLOWS,canReuseAndroid,assertAndroidEvidence,assertReuseReport,assertAndroidTerminal,assertReferenceMetadata,verifyReferenceArchive} from '../scripts/mobile-integration/qualified-android.mjs';
const source='a'.repeat(40);
const ids=['SE1','SE2','SE3','SE4'].map(a=>'android:public-market-'+a).concat(['android:external-document-no-bearer','android:external-invoice-pdf-no-bearer'],['/login/forgot-password','/teckna','/dashboard/contracts','/dashboard/support'].map(p=>'android:web-handoff-'+p));
function evidence(){return {core:{webCommit:ref.source,opsCommit:ref.ops,results:Array.from({length:13},(_,i)=>({scenario:'core-'+i,status:'PASS'}))},expanded:{webCommit:ref.source,opsCommit:ref.ops,results:Array.from({length:64},(_,i)=>({scenario:'extra-'+i,status:'PASS'}))},credentials:{webCommit:ref.source,passed:true,privilegedCredentialEmbedded:false,privateKeyEmbedded:false},system:{webCommit:ref.source,opsCommit:ref.ops,checks:ids.map(id=>({id,result:'PASS'})).concat({id:'no-credential-forwarding-to-public-readers',result:'PASS'})}};}
function report(){return {status:'PASS_REUSED',currentSource:source,opsSource:ref.ops,reference:{...ref},workflowDigests:{...APPROVED_WORKFLOWS},nativeScenarios:77,sourceEquivalent:true,changedPaths:['scripts/mobile-integration/device-gateway.mjs'],normalizedGatewaySHA256:'b'.repeat(64),publicReadersCredentialFree:true,androidSystemChecks:ids.map(id=>({id,result:'PASS'}))};}

test('Android proof reuse requires unchanged product inputs and gateway outside iOS-only controls',()=>{
 const path='scripts/mobile-integration/device-gateway.mjs',old=execFileSync('git',['show',ref.source+':'+path],{encoding:'utf8'}),current=readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const workflow='.github/workflows/mobile-customer-qualification.yml',referenceWorkflow=execFileSync('git',['show',ref.source+':'+workflow],{encoding:'utf8'}),currentWorkflow=readFileSync(new URL('../'+workflow,import.meta.url),'utf8');
 const input={paths:[path,'scripts/mobile-integration/document-control.mjs'],referenceGateway:old,currentGateway:current,referenceWorkflow,currentWorkflow,ops:ref.ops};
 assert.equal(canReuseAndroid(input),true);
 for(const changed of ['apps/mobile/src/useCustomerAccount.ts','packages/mobile-foundation/src/brand.ts','lib/mobile/customerRuntime.ts','scripts/mobile-integration/android-features.py','package-lock.json'])assert.equal(canReuseAndroid({...input,paths:[changed]}),false);
 assert.equal(canReuseAndroid({...input,ops:'changed-ops'}),false);
 for(const changedWorkflow of [currentWorkflow.replace('api-level: 36','api-level: 35'),currentWorkflow.replace('arch: x86_64','arch: arm64-v8a'),currentWorkflow.replace("java-version: '17'","java-version: '21'"),currentWorkflow+'\n# unreviewed configuration change\n'])assert.equal(canReuseAndroid({...input,currentWorkflow:changedWorkflow}),false);
 assert.equal(canReuseAndroid({...input,currentGateway:current.replace('server.listen(','different.listen(')}),false);
 assert.equal(canReuseAndroid({...input,currentGateway:current+'\nimport "unreviewed-side-effect";\n'}),false);
});

test('Android proof reuse requires every passed scenario, source, scope and credential check',()=>{
 assert.equal(assertAndroidEvidence(evidence()).length,10);
 const mutations=[e=>e.core.results.pop(),e=>e.expanded.results[2].status='FAIL',e=>e.core.results[1].scenario=e.core.results[0].scenario,e=>e.expanded.webCommit='foreign',e=>e.system.opsCommit='foreign',e=>e.credentials.privateKeyEmbedded=true,e=>e.credentials.passed=false,e=>e.system.checks[0].result='FAIL',e=>e.system.checks.pop(),e=>e.system.checks[0].id='ios:public-market-SE1'];
 for(const change of mutations){const e=evidence();change(e);assert.throws(()=>assertAndroidEvidence(e));}
});

test('Android proof reuse rejects expired or substituted immutable artifacts and bytes',()=>{
 const m={id:ref.artifact,name:'expanded-mobile-customer-evidence',expired:false,workflow_run:{id:ref.run,head_sha:ref.source},digest:'sha256:'+ref.digest};assertReferenceMetadata(m);
 for(const change of [x=>x.id++,x=>x.expired=true,x=>x.workflow_run.id++,x=>x.workflow_run.head_sha='foreign',x=>x.digest='sha256:foreign']){const copy=structuredClone(m);change(copy);assert.throws(()=>assertReferenceMetadata(copy));}
 assert.throws(()=>verifyReferenceArchive(Buffer.from('substituted archive')),/digest mismatch/);
});

test('Android proof reuse receipts identify their old source and reject unverified or foreign terminals',()=>{
 assertReuseReport(report(),source,ref.ops);assert.throws(()=>assertReuseReport(report(),'different',ref.ops));
 for(const change of [x=>x.status='success',x=>x.nativeScenarios=76,x=>x.sourceEquivalent=false,x=>x.publicReadersCredentialFree=false,x=>x.androidSystemChecks[0].result='FAIL',x=>x.changedPaths=['apps/mobile/App.tsx']]){const r=report();change(r);assert.throws(()=>assertReuseReport(r,source,ref.ops));}
 assertAndroidTerminal({status:'reused',source,ops:ref.ops,reference:{...ref},nativeScenarios:77},source);
 assertAndroidTerminal({status:'success',source,ops:ref.ops},source);
 for(const r of [{status:'skipped',source,ops:ref.ops},{status:'reused',source,ops:ref.ops,nativeScenarios:77},{status:'success',source:'foreign',ops:ref.ops}])assert.throws(()=>assertAndroidTerminal(r,source));
});

test('Android proof reuse cannot replace fresh iOS browser and public request observations',()=>{
 const directory=mkdtempSync(join(tmpdir(),'gridex-reuse-observations-'));const document='document_'+'d'.repeat(32),invoice='document_'+'e'.repeat(32);
 try{
  const fsPath=join(directory,'mobile-fixtures');execFileSync('mkdir',['-p',fsPath]);
  writeFileSync(join(fsPath,'customers.json'),JSON.stringify({customers:[{extra:{}},{extra:{document,invoiceDocument:invoice}}]}));
  writeFileSync(join(directory,'mobile-android-reuse.json'),JSON.stringify(report()));
  const script=new URL('../scripts/mobile-integration/verify-observations.mjs',import.meta.url).pathname;
  const run=()=>spawnSync(process.execPath,[script],{env:{...process.env,RUNNER_TEMP:directory,QUALIFICATION_WEB_COMMIT:source,GRIDEX_OPS_COMMIT:ref.ops},encoding:'utf8'});
  assert.equal(run().status,1,'Cached Android alone must not qualify iOS');
  writeFileSync(join(directory,'mobile-market-requests.json'),JSON.stringify(['SE1','SE2','SE3','SE4'].map(area=>({platform:'ios',area,authorizationPresent:false}))));
  writeFileSync(join(directory,'mobile-document-requests.json'),JSON.stringify([document,invoice].map(reference=>({platform:'ios',reference,authorizationPresent:false}))));
  writeFileSync(join(directory,'mobile-handoff-requests.json'),JSON.stringify(['/login/forgot-password','/teckna','/dashboard/contracts','/dashboard/support'].map(path=>({platform:'ios',path,credentialPresent:false}))));
  assert.equal(run().status,0);const result=JSON.parse(readFileSync(join(directory,'mobile-system-observations.json'),'utf8'));assert.equal(result.androidEvidence.kind,'reused');assert.equal(result.androidEvidence.reference.source,ref.source);assert.equal(result.checks.filter(c=>c.evidence==='reused').length,10);
  writeFileSync(join(directory,'mobile-market-requests.json'),JSON.stringify([{platform:'other',area:'SE1',authorizationPresent:true}]));assert.equal(run().status,1);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
