// Reuse only the reviewed, immutable Android proof. A changed product/Android
// input requires a fresh Android run; an unavailable proof fails without one.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,appendFileSync,mkdtempSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export const ANDROID_REFERENCE={source:'b270ddf792f889dc0a05e4a83bc73954b5e12fef',ops:'6819d12d35a8d8ce560889b29c91f330a2655724',run:43317701063,artifact:13993066937,digest:'6623f87fe67f50123798eebaea409a7e65b447be6a83d8394e95c5b48dbefb01'};
export const APPROVED_WORKFLOWS={reference:'11b5a9ded609fb15a0af3529d073eb84d0cb9d9e025b9158a70a7e98821c23b1',reuse:'085e9e349581a2af5e76e345634e4ce887e5d8e54fcadad3b468190cd2d607cc'};
const allowed=new Set(['.github/workflows/mobile-customer-qualification.yml','.github/workflows/mobile-ios-qualification.yml','quality/mobile-cross-platform/plan.md','scripts/mobile-integration/device-gateway.mjs','scripts/mobile-integration/document-control.mjs','scripts/mobile-integration/qualified-android.mjs','scripts/mobile-integration/production-ios-reuse.mjs','scripts/mobile-integration/verify-observations.mjs','scripts/mobile-integration/ios-customer.yaml','scripts/mobile-integration/ios-customer-refresh.yaml','scripts/mobile-integration/ios-customer-resource.yaml','scripts/mobile-integration/ios-customer-after-refresh.yaml','scripts/mobile-integration/ios-smoke.sh','scripts/mobile-integration/ios-customer-suite.mjs','scripts/mobile-integration/ios-case-reuse.mjs','tests/mobile-ios-case-reuse.test.mjs','scripts/mobile-integration/ios-failure-summary.mjs','scripts/mobile-integration/await-artifact.mjs','tests/mobile-device-qualification.test.mjs','tests/mobile-android-reuse.test.mjs','tests/mobile-ios-read.test.mjs']);
const sha=value=>createHash('sha256').update(value).digest('hex');
const gatewayPath='scripts/mobile-integration/device-gateway.mjs';
export function normalizedGateway(source){
 const start="   else if(['disable-document-b','restore-document-b'].includes(input.action)){",end="   }else if(input.action==='disconnect')";
 if(source.split(start).length!==2||source.split(end).length!==2)throw Error('Ambiguous document control boundary');
 const first=source.indexOf(start),last=source.indexOf(end,first);if(last<first)throw Error('Invalid document control boundary');
 return (source.slice(0,first)+source.slice(last)).replace("import {documentSnapshot} from './document-control.mjs';\n",'').replaceAll('disabledDocumentState','disabledDocumentCount');
}
export function canReuseAndroid({paths,referenceGateway,currentGateway,referenceWorkflow,currentWorkflow,ops}){
 if(ops!==ANDROID_REFERENCE.ops||!Array.isArray(paths)||paths.some(p=>!allowed.has(p)))return false;
 if(typeof referenceWorkflow!=='string'||typeof currentWorkflow!=='string'||sha(referenceWorkflow)!==APPROVED_WORKFLOWS.reference||sha(currentWorkflow)!==APPROVED_WORKFLOWS.reuse)return false;
 try{return normalizedGateway(referenceGateway)===normalizedGateway(currentGateway);}catch{return false;}
}
const systemIds=['SE1','SE2','SE3','SE4'].map(a=>'android:public-market-'+a).concat(['android:external-document-no-bearer','android:external-invoice-pdf-no-bearer'],['/login/forgot-password','/teckna','/dashboard/contracts','/dashboard/support'].map(p=>'android:web-handoff-'+p));
export function assertAndroidEvidence({core,expanded,credentials,system}){
 for(const [receipt,count]of [[core,13],[expanded,64]]){
  assert.equal(receipt?.webCommit,ANDROID_REFERENCE.source);assert.equal(receipt?.opsCommit,ANDROID_REFERENCE.ops);
  assert.equal(receipt?.results?.length,count);assert.equal(new Set(receipt.results.map(x=>x.scenario)).size,count);
  assert.ok(receipt.results.every(x=>typeof x.scenario==='string'&&x.scenario&&x.status==='PASS'));
 }
 assert.equal(credentials?.webCommit,ANDROID_REFERENCE.source);assert.equal(credentials?.passed,true);assert.equal(credentials?.privilegedCredentialEmbedded,false);assert.equal(credentials?.privateKeyEmbedded,false);
 assert.equal(system?.webCommit,ANDROID_REFERENCE.source);assert.equal(system?.opsCommit,ANDROID_REFERENCE.ops);
 const checks=system.checks.filter(c=>c.id.startsWith('android:'));
 assert.equal(checks.length,systemIds.length);assert.deepEqual(checks.map(c=>c.id).sort(),[...systemIds].sort());assert.ok(checks.every(c=>c.result==='PASS'));
 const global=system.checks.filter(c=>c.id==='no-credential-forwarding-to-public-readers');assert.equal(global.length,1);assert.equal(global[0].result,'PASS');
 return checks;
}
export function assertReuseReport(report,currentSource,ops=ANDROID_REFERENCE.ops){
 assert.equal(report?.status,'PASS_REUSED');assert.equal(report.currentSource,currentSource);assert.equal(report.opsSource,ops);
 assert.deepEqual(report.reference,ANDROID_REFERENCE);assert.deepEqual(report.workflowDigests,APPROVED_WORKFLOWS);assert.equal(report.nativeScenarios,77);assert.equal(report.sourceEquivalent,true);
 assert.ok(Array.isArray(report.changedPaths)&&report.changedPaths.every(p=>allowed.has(p)));assert.match(report.normalizedGatewaySHA256,/^[a-f0-9]{64}$/);
 assert.equal(report.publicReadersCredentialFree,true);assert.deepEqual(report.androidSystemChecks.map(c=>c.id).sort(),[...systemIds].sort());assert.ok(report.androidSystemChecks.every(c=>c.result==='PASS'));
 return report;
}
export function verifyReferenceArchive(bytes){assert.equal(sha(bytes),ANDROID_REFERENCE.digest,'Qualified Android archive digest mismatch');}
export function assertReferenceMetadata(metadata){
 assert.equal(metadata?.id,ANDROID_REFERENCE.artifact);assert.equal(metadata.name,'expanded-mobile-customer-evidence');assert.equal(metadata.expired,false);assert.equal(metadata.workflow_run?.id,ANDROID_REFERENCE.run);assert.equal(metadata.workflow_run.head_sha,ANDROID_REFERENCE.source);assert.equal(metadata.digest,'sha256:'+ANDROID_REFERENCE.digest);
}
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const command=(args,options={})=>execFileSync('gh',args,{stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:64*1024*1024,...options});
export async function referenceRead(args,options){
 for(let attempt=0;attempt<3;attempt++){try{return command(args,options);}catch{if(attempt===2)throw Error('Qualified reference transport unavailable');await new Promise(resolve=>setTimeout(resolve,1000));}}
}
export function qualifiedSourceInputs(){
 const current=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(current,process.env.QUALIFICATION_WEB_COMMIT);assert.match(current,/^[a-f0-9]{40}$/);
 const paths=execFileSync('git',['diff','--name-only',ANDROID_REFERENCE.source,current],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
 const referenceGateway=execFileSync('git',['show',ANDROID_REFERENCE.source+':'+gatewayPath],{encoding:'utf8'}),currentGateway=readFileSync(gatewayPath,'utf8');
 const workflow='.github/workflows/mobile-customer-qualification.yml',referenceWorkflow=execFileSync('git',['show',ANDROID_REFERENCE.source+':'+workflow],{encoding:'utf8'}),currentWorkflow=readFileSync(workflow,'utf8');
 const smoke='scripts/mobile-integration/ios-smoke.sh',referenceIosSmoke=execFileSync('git',['show',ANDROID_REFERENCE.source+':'+smoke],{encoding:'utf8'}),currentIosSmoke=readFileSync(smoke,'utf8');
 return {source:current,paths,referenceGateway,currentGateway,referenceWorkflow,currentWorkflow,referenceIosSmoke,currentIosSmoke,ops:process.env.GRIDEX_OPS_COMMIT};
}
async function prepare(reportPath){
 const inputs=qualifiedSourceInputs(),{source:current,paths,referenceGateway,currentGateway,referenceWorkflow,currentWorkflow}=inputs;
 if(!canReuseAndroid({paths,referenceGateway,currentGateway,referenceWorkflow,currentWorkflow,ops:process.env.GRIDEX_OPS_COMMIT})){
  rmSync(reportPath,{force:true});appendFileSync(process.env.GITHUB_OUTPUT,'approved=false\n');console.log('Android inputs changed; fresh Android qualification is required.');return;
 }
 try{
  assert.equal(process.env.GITHUB_REPOSITORY,'heke99/gridex-web');
  const metadata=JSON.parse(await referenceRead(['api','repos/heke99/gridex-web/actions/artifacts/'+ANDROID_REFERENCE.artifact],{encoding:'utf8',timeout:20000}));
  assertReferenceMetadata(metadata);
  const bytes=await referenceRead(['api','repos/heke99/gridex-web/actions/artifacts/'+ANDROID_REFERENCE.artifact+'/zip']);verifyReferenceArchive(bytes);
  const directory=mkdtempSync(join(process.env.RUNNER_TEMP,'qualified-android-')),archive=join(directory,'reference.zip'),data=join(directory,'data');writeFileSync(archive,bytes,{mode:0o600});
  const entries=execFileSync('unzip',['-Z1',archive],{encoding:'utf8'}).trim().split('\n');assert.ok(entries.every(p=>!p.startsWith('/')&&!p.split('/').includes('..')&&!p.includes('\\')));
  execFileSync('unzip',['-q',archive,'-d',data],{stdio:['ignore','pipe','pipe']});
  const android=join(data,'mobile-android'),checks=assertAndroidEvidence({core:read(join(android,'acceptance.json')),expanded:read(join(android,'expanded-acceptance.json')),credentials:read(join(android,'credential-isolation.json')),system:read(join(data,'mobile-system-observations.json'))});
  const report={status:'PASS_REUSED',currentSource:current,opsSource:process.env.GRIDEX_OPS_COMMIT,reference:ANDROID_REFERENCE,workflowDigests:APPROVED_WORKFLOWS,nativeScenarios:77,sourceEquivalent:true,changedPaths:paths,normalizedGatewaySHA256:sha(normalizedGateway(currentGateway)),publicReadersCredentialFree:true,androidSystemChecks:checks};
  assertReuseReport(report,current,process.env.GRIDEX_OPS_COMMIT);writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{mode:0o600});rmSync(directory,{recursive:true,force:true});
  appendFileSync(process.env.GITHUB_OUTPUT,'approved=true\n');console.log('Reusing 77 passed Android checks from run '+ANDROID_REFERENCE.run+'; no Android emulator or build is started.');
 }catch{throw Error('Qualified Android proof unavailable or invalid; no duplicate Android run was started');}
}
function terminal(reportPath,target){
 const source=process.env.QUALIFICATION_WEB_COMMIT,ops=process.env.GRIDEX_OPS_COMMIT;let receipt;
 if(existsSync(reportPath)){const report=assertReuseReport(read(reportPath),source,ops);receipt={status:'reused',source,ops,reference:report.reference,nativeScenarios:77};}
 else receipt={status:process.env.ANDROID_RESULT,source,ops};
 writeFileSync(target,JSON.stringify(receipt)+'\n');
}
export function assertAndroidTerminal(receipt,source){
 assert.equal(receipt?.source,source);assert.equal(receipt.ops,ANDROID_REFERENCE.ops);
 if(receipt.status==='reused'){assert.deepEqual(receipt.reference,ANDROID_REFERENCE);assert.equal(receipt.nativeScenarios,77);}
 else assert.equal(receipt.status,'success');
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const [action,...args]=process.argv.slice(2);
 if(action==='prepare')await prepare(args[0]);
 else if(action==='terminal')terminal(args[0],args[1]);
 else if(action==='verify-terminal')assertAndroidTerminal(read(args[0]),process.env.QUALIFICATION_WEB_COMMIT);
 else throw Error('Unknown qualified Android operation');
}
