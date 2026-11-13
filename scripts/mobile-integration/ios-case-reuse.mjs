// Compose immutable passed cases with two newly executed cases. Never synthesize JUnit.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSuite,inspectSuiteJUnit,partitionMatrix,normalizedCustomerSmoke} from './ios-customer-suite.mjs';
import {referenceRead,ANDROID_REFERENCE} from './qualified-android.mjs';
export const REFERENCE={source:'e79715861a0a702191471ab8873242630d30371a',run:43370134751,ops:ANDROID_REFERENCE.ops,native:{id:14013194323,name:'gridex-ios-customer-evidence',digest:'69562a55c4ea951a2b5c3088210078a05c521cc360672f130a89abdd9541dd0f'},server:{id:14013443552,name:'expanded-mobile-customer-evidence',digest:'89ea8b99c8425361fa6cc56a8b11a7b2ad0b9fd7bed1d15dbf1142a5518ee8a5'}};
export const FRESH=['support','market'],REUSED=['core','session'];
const sha=x=>createHash('sha256').update(x).digest('hex');
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const allowed=new Set(['.github/workflows/mobile-customer-qualification.yml','quality/mobile-cross-platform/plan.md','scripts/mobile-integration/ios-customer.yaml','scripts/mobile-integration/ios-customer-suite.mjs','scripts/mobile-integration/ios-case-reuse.mjs','scripts/mobile-integration/ios-smoke.sh','scripts/mobile-integration/qualified-android.mjs','scripts/mobile-integration/verify-observations.mjs','tests/mobile-ios-case-reuse.test.mjs','tests/mobile-ios-read.test.mjs','tests/mobile-android-reuse.test.mjs']);
export function assertMetadata(meta,spec){
 assert.equal(meta.id,spec.id);assert.equal(meta.name,spec.name);assert.equal(meta.expired,false);assert.equal(meta.workflow_run.id,REFERENCE.run);assert.equal(meta.workflow_run.head_sha,REFERENCE.source);assert.equal(meta.digest,'sha256:'+spec.digest);
}
export function verifyArchive(bytes,spec){assert.equal(sha(bytes),spec.digest,'Qualified iOS case archive digest mismatch');}
export function assertReferenceReport(report,proof){
 assert.equal(report.status,'PASS_REUSED');assert.deepEqual(report.reference,REFERENCE);assert.equal(report.currentSource,proof.source);assert.equal(report.sourceEquivalent,true);assert.equal(report.publicReadersCredentialFree,true);assert.deepEqual(report.phaseSHA256,proof.phaseSHA256);assert.equal(report.generatorKernelSHA256,proof.generatorKernelSHA256);
 assert.deepEqual(report.results.map(x=>x.case),REUSED);assert.ok(report.results.every(x=>x.status==='PASS'&&x.evidence==='reused'&&x.source===REFERENCE.source&&x.run===REFERENCE.run&&x.artifact===REFERENCE.native.id));
 const ids=['ios:external-document-no-bearer','ios:external-invoice-pdf-no-bearer',...['/login/forgot-password','/teckna','/dashboard/contracts','/dashboard/support'].map(p=>'ios:web-handoff-'+p)];assert.deepEqual(report.systemChecks.map(x=>x.id).sort(),ids.sort());assert.ok(report.systemChecks.every(x=>x.result==='PASS'&&x.evidence==='reused'&&x.referenceSource===REFERENCE.source&&x.referenceRun===REFERENCE.run&&x.referenceArtifact===REFERENCE.server.id));
 return report;
}
export function sourceProof(root=process.cwd()){
  const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trimEnd();
 const source=git(['rev-parse','HEAD']);assert.equal(source,process.env.QUALIFICATION_WEB_COMMIT,'Current checkout source does not match qualification');
 execFileSync('git',['-C',root,'diff','--quiet','HEAD'],{stdio:'pipe'});
 // Expo generates this untracked Xcode project from the unchanged tracked inputs.
 const untracked=git(['ls-files','--others','--exclude-standard']).split('\n').filter(Boolean);
 assert.ok(untracked.every(p=>p.startsWith('apps/mobile/ios/')),'Untracked source outside the generated Xcode project invalidates reuse');
 const paths=git(['diff','--name-only',REFERENCE.source,'HEAD']).split('\n').filter(Boolean);assert.ok(paths.every(p=>allowed.has(p)),'Changed product, fixture or helper invalidates cached cases');
 const old=p=>execFileSync('git',['-C',root,'show',REFERENCE.source+':'+p],{encoding:'utf8'}),now=p=>readFileSync(join(root,p),'utf8');
 const path='scripts/mobile-integration/ios-customer.yaml',before=old(path),after=now(path),a=partitionMatrix(before),b=partitionMatrix(after);
 for(const i of [0,3])assert.equal(a[i],b[i],'Approved canonical case changed');
 const smoke='scripts/mobile-integration/ios-smoke.sh';assert.equal(normalizedCustomerSmoke(now(smoke)),normalizedCustomerSmoke(old(smoke)),'Changed shared driver invalidates reuse');
 const generator='scripts/mobile-integration/ios-customer-suite.mjs';
 const kernel=s=>s.slice(s.indexOf('function uniqueIndex('),s.indexOf('if(process.argv[1]'));
 assert.equal(kernel(old(generator)),kernel(now(generator)),'Case generator or validator changed');
 const wf='.github/workflows/mobile-customer-qualification.yml';let current=now(wf);
 const reuseEnv="      GRIDEX_IOS_CASE_REUSE: 'true'\n";assert.equal(current.split(reuseEnv).length,3);current=current.replaceAll(reuseEnv,'');
 const checkout='          ref: ${{ env.QUALIFICATION_WEB_COMMIT }}\n          fetch-depth: 0\n';assert.equal(current.split(checkout).length,2);current=current.replace(checkout,'          ref: ${{ env.QUALIFICATION_WEB_COMMIT }}\n');
 const token='          GH_TOKEN: ${{ github.token }}\n';
 const observation='      - name: Verify actual native public requests and external browser handoffs\n        if: always()\n        env:\n'+token;
 assert.equal(current.split(observation).length,2);current=current.replace(observation,'      - name: Verify actual native public requests and external browser handoffs\n        if: always()\n');
 assert.equal(current,old(wf),'Unreviewed workflow changes invalidate cached cases');
 return {source,changedPaths:paths,phaseSHA256:{core:sha(a[0]),session:sha(a[3])},generatorKernelSHA256:sha(kernel(now(generator))),referenceCanonical:before};
}
export function validateEvidence(native,server,proof,root){
 const build=json(join(native,'build-receipt.json'));assert.equal(build.source,REFERENCE.source);assert.equal(build.passed,true);assert.equal(build.environment,'isolated-real-auth-web-ops');
 const oldReport=json(join(native,'customer-suite-result.json'));
 const suite=buildSuite(proof.referenceCanonical,{root,webCommit:REFERENCE.source});
 const result=inspectSuiteJUnit(readFileSync(join(native,'ui/results.xml'),'utf8'),suite.plan,REFERENCE.source);
 assert.equal(result.planValid,true);assert.equal(result.reportedCases,4);assert.equal(result.executionOrderVerified,true);assert.deepEqual(result,oldReport);
 const rows=REUSED.map(name=>{const r=result.results.find(x=>x.case===name);assert.equal(r.status,'PASS');return {...r,evidence:'reused',source:REFERENCE.source,run:REFERENCE.run,artifact:REFERENCE.native.id};});
 const system=json(join(server,'mobile-system-observations.json'));assert.equal(system.webCommit,REFERENCE.source);assert.equal(system.opsCommit,REFERENCE.ops);
 const ids=['ios:external-document-no-bearer','ios:external-invoice-pdf-no-bearer',...['/login/forgot-password','/teckna','/dashboard/contracts','/dashboard/support'].map(p=>'ios:web-handoff-'+p)];
 const checks=ids.map(id=>{const matches=system.checks.filter(c=>c.id===id);assert.equal(matches.length,1);assert.equal(matches[0].result,'PASS');return {...matches[0],evidence:'reused',referenceSource:REFERENCE.source,referenceRun:REFERENCE.run,referenceArtifact:REFERENCE.server.id};});
 for(const [name,flag]of [['mobile-document-requests.json','authorizationPresent'],['mobile-market-requests.json','authorizationPresent'],['mobile-handoff-requests.json','credentialPresent']]){const requests=json(join(server,name));assert.ok(requests.length>0);assert.ok(requests.every(r=>r[flag]===false));}
 assert.equal(system.checks.find(x=>x.id==='no-credential-forwarding-to-public-readers')?.result,'PASS');
 return {status:'PASS_REUSED',currentSource:proof.source,reference:REFERENCE,sourceEquivalent:true,phaseSHA256:proof.phaseSHA256,generatorKernelSHA256:proof.generatorKernelSHA256,results:rows,systemChecks:checks,publicReadersCredentialFree:true};
}
export async function prepare(root=process.cwd()){
 const proof=sourceProof(root),path=join(process.env.RUNNER_TEMP,'ios-case-reuse.json');
 if(existsSync(path)){return assertReferenceReport(json(path),proof);}
 assert.equal(process.env.GITHUB_REPOSITORY,'heke99/gridex-web');
 const run=JSON.parse(await referenceRead(['api','repos/heke99/gridex-web/actions/runs/'+REFERENCE.run],{encoding:'utf8'}));assert.equal(run.id,REFERENCE.run);assert.equal(run.head_sha,REFERENCE.source);assert.equal(run.status,'completed');assert.equal(run.conclusion,'failure');
 const directory=mkdtempSync(join(process.env.RUNNER_TEMP,'ios-case-reference-'));
 try{
  const extracted=await Promise.all(['native','server'].map(async kind=>{
   const spec=REFERENCE[kind],meta=JSON.parse(await referenceRead(['api','repos/heke99/gridex-web/actions/artifacts/'+spec.id],{encoding:'utf8'}));
   assertMetadata(meta,spec);
   const bytes=await referenceRead(['api','repos/heke99/gridex-web/actions/artifacts/'+spec.id+'/zip']);verifyArchive(bytes,spec);
   const zip=join(directory,kind+'.zip'),data=join(directory,kind);writeFileSync(zip,bytes,{mode:0o600});
   const entries=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');assert.ok(entries.every(p=>!p.startsWith('/')&&!p.split('/').includes('..')&&!p.includes('\\')));
   execFileSync('unzip',['-q',zip,'-d',data],{stdio:'pipe'});return data;
  }));
  const report=assertReferenceReport(validateEvidence(...extracted,proof,resolve(root,'scripts/mobile-integration')),proof);writeFileSync(path,JSON.stringify(report,null,2)+'\n',{mode:0o600});return report;
 }finally{rmSync(directory,{recursive:true,force:true});}
}
export function compose(xml,plan,source,reference){
 assertReferenceReport(reference,{source,phaseSHA256:reference.phaseSHA256,generatorKernelSHA256:reference.generatorKernelSHA256});
 const inspected=inspectSuiteJUnit(xml,plan,source),fresh=inspected.results.filter(x=>FRESH.includes(x.case));
 const timestamps=fresh.map(x=>Date.parse(x.startedAt));
 const passed=inspected.planValid&&inspected.reportedCases===2&&fresh.length===2&&fresh.every(x=>x.status==='PASS')&&timestamps[1]>=timestamps[0]&&!/<(?:failure|error|skipped)\b/i.test(xml)&&![...xml.matchAll(/<testsuite\b([^>]*)>/g)].some(m=>[...m[1].matchAll(/\b(?:failures|errors)\s*=\s*["']([^"']*)/g)].some(x=>Number(x[1])!==0));
 assert.deepEqual(reference.results.map(x=>x.case),REUSED);assert.ok(reference.results.every(x=>x.status==='PASS'&&x.source===REFERENCE.source&&x.run===REFERENCE.run&&x.artifact===REFERENCE.native.id));
 return {schema:'gridex.ios-composed-cases.v1',webCommit:source,expectedOpsSource:REFERENCE.ops,status:passed?'PASS':'FAIL',independentCases:true,unbrokenSingleJourney:false,freshJUnitCases:inspected.reportedCases,freshExecutionOrderVerified:timestamps[1]>=timestamps[0],globalFourCaseExecutionOrderClaimed:false,sourceEquivalent:reference.sourceEquivalent,phaseSHA256:reference.phaseSHA256,generatorKernelSHA256:reference.generatorKernelSHA256,reference:REFERENCE,results:[...reference.results,...fresh.map(x=>({...x,evidence:'current-run',source}))]};
}
export async function createScoped(directory){
 const root=resolve(fileURLToPath(new URL('.',import.meta.url)),'../..');await prepare(root);
 const config='flows:\n'+FRESH.map(n=>'  - "'+n+'.yaml"\n').join('')+'executionOrder:\n  continueOnFailure: true\n  flowsOrder:\n'+FRESH.map(n=>'    - '+n+'\n').join('');
 for(const name of REUSED)rmSync(join(directory,name+'.yaml'));writeFileSync(join(directory,'config.yaml'),config,{mode:0o600});
}
