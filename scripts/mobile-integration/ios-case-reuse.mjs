// Compose immutable passed cases with only the remaining newly executed case. Never synthesize JUnit.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSuite,inspectSuiteJUnit,partitionMatrix,normalizedCustomerSmoke} from './ios-customer-suite.mjs';
import {referenceRead,ANDROID_REFERENCE} from './qualified-android.mjs';
export const REFERENCE={source:'e79715861a0a702191471ab8873242630d30371a',run:43370134751,ops:ANDROID_REFERENCE.ops,native:{id:14013194323,name:'gridex-ios-customer-evidence',digest:'69562a55c4ea951a2b5c3088210078a05c521cc360672f130a89abdd9541dd0f'},server:{id:14013443552,name:'expanded-mobile-customer-evidence',digest:'89ea8b99c8425361fa6cc56a8b11a7b2ad0b9fd7bed1d15dbf1142a5518ee8a5'}};
export const MARKET_REFERENCE={source:'168ebe978f5180befd3493a990ae3d9ed7a7f6a3',run:43381680230,ops:ANDROID_REFERENCE.ops,native:{id:14018141256,name:'gridex-ios-customer-evidence',digest:'e6eb89c3491f16efb16436a62a6bf0e66e3bb075779a05fc3ca95e6a83b9ecd3'},server:{id:14018141289,name:'expanded-mobile-customer-evidence',digest:'7f21ffab186954e969e7b98c11faab9fbcd0c09582977fc8731feec0d7b5402c'}};
export const FRESH=['support'],REUSED=['core','session'];
const MARKET_IDS=['SE1','SE2','SE3','SE4'].map(a=>'ios:public-market-'+a);
const sha=x=>createHash('sha256').update(x).digest('hex');
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const allowed=new Set(['.github/workflows/mobile-customer-qualification.yml','quality/mobile-cross-platform/plan.md','scripts/mobile-integration/ios-customer.yaml','scripts/mobile-integration/ios-customer-suite.mjs','scripts/mobile-integration/ios-case-reuse.mjs','scripts/mobile-integration/ios-smoke.sh','scripts/mobile-integration/qualified-android.mjs','scripts/mobile-integration/verify-observations.mjs','tests/mobile-ios-case-reuse.test.mjs','tests/mobile-ios-read.test.mjs','tests/mobile-android-reuse.test.mjs']);
export function assertMetadata(meta,spec,reference=REFERENCE){
 assert.equal(meta.id,spec.id);assert.equal(meta.name,spec.name);assert.equal(meta.expired,false);assert.equal(meta.workflow_run.id,reference.run);assert.equal(meta.workflow_run.head_sha,reference.source);assert.equal(meta.digest,'sha256:'+spec.digest);
}
export function verifyArchive(bytes,spec){assert.equal(sha(bytes),spec.digest,'Qualified iOS case archive digest mismatch');}
export function assertReferenceReport(report,proof){
 assert.equal(report.status,'PASS_REUSED');assert.deepEqual(report.reference,REFERENCE);assert.equal(report.currentSource,proof.source);assert.equal(report.sourceEquivalent,true);assert.equal(report.publicReadersCredentialFree,true);assert.deepEqual(report.phaseSHA256,proof.phaseSHA256);assert.equal(report.generatorKernelSHA256,proof.generatorKernelSHA256);
 assert.deepEqual(report.results.map(x=>x.case),REUSED);assert.ok(report.results.every(x=>x.status==='PASS'&&x.evidence==='reused'&&x.source===REFERENCE.source&&x.run===REFERENCE.run&&x.artifact===REFERENCE.native.id));
 const ids=['ios:external-document-no-bearer','ios:external-invoice-pdf-no-bearer',...['/login/forgot-password','/teckna','/dashboard/contracts','/dashboard/support'].map(p=>'ios:web-handoff-'+p)];assert.deepEqual(report.systemChecks.map(x=>x.id).sort(),ids.sort());assert.ok(report.systemChecks.every(x=>x.result==='PASS'&&x.evidence==='reused'&&x.referenceSource===REFERENCE.source&&x.referenceRun===REFERENCE.run&&x.referenceArtifact===REFERENCE.server.id));
 if(report.marketEvidence)assertMarketEvidence(report.marketEvidence,proof.phaseSHA256.market);
 return report;
}
// Expo CLI 58.1.19 updatePkgScripts deterministically rewrites both launch commands.
// Dependencies, versions, other scripts and all other package fields must match HEAD.
export function assertPrebuildPackage(reference,current){
 const expected=structuredClone(reference);assert.equal(expected.scripts.android,'expo start --android');assert.equal(expected.scripts.ios,'expo start --ios');
 expected.scripts.android='expo run:android';expected.scripts.ios='expo run:ios';assert.deepEqual(current,expected,'Unreviewed package change after Expo prebuild');
}
export function sourceProof(root=process.cwd()){
  const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trimEnd();
 const source=git(['rev-parse','HEAD']);assert.equal(source,process.env.QUALIFICATION_WEB_COMMIT,'Current checkout source does not match qualification');
 const dirty=git(['diff','--name-only','HEAD']).split('\n').filter(Boolean);
 assert.ok(dirty.every(p=>p==='apps/mobile/package.json'),'Tracked source changed outside derived Expo launch scripts');
 if(dirty.length)assertPrebuildPackage(JSON.parse(git(['show','HEAD:apps/mobile/package.json'])),json(join(root,'apps/mobile/package.json')));
 // Expo generates this untracked Xcode project from the unchanged tracked inputs.
 const untracked=git(['ls-files','--others','--exclude-standard']).split('\n').filter(Boolean);
 assert.ok(untracked.every(p=>p.startsWith('apps/mobile/ios/')),'Untracked source outside the generated Xcode project invalidates reuse');
 const paths=git(['diff','--name-only',REFERENCE.source,'HEAD']).split('\n').filter(Boolean);assert.ok(paths.every(p=>allowed.has(p)),'Changed product, fixture or helper invalidates cached cases');
 const old=p=>execFileSync('git',['-C',root,'show',REFERENCE.source+':'+p],{encoding:'utf8'}),now=p=>readFileSync(join(root,p),'utf8');
 const path='scripts/mobile-integration/ios-customer.yaml',before=old(path),after=now(path),a=partitionMatrix(before),b=partitionMatrix(after);
 for(const i of [0,3])assert.equal(a[i],b[i],'Approved canonical case changed');
 const marketCanonical=execFileSync('git',['-C',root,'show',MARKET_REFERENCE.source+':'+path],{encoding:'utf8'});assert.equal(partitionMatrix(marketCanonical)[2],b[2],'Approved Market phase changed');assert.equal(partitionMatrix(marketCanonical)[0],b[0],'Approved Market login setup changed');
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
 const preflight='      - name: Verify immutable passed iOS cases before compiling\n        env:\n          GH_TOKEN: ${{ github.token }}\n        run: node scripts/mobile-integration/ios-customer-suite.mjs prepare\n';
 assert.equal(current.split(preflight).length,2);current=current.replace(preflight,'');
 const postbuild='          source "$RUNNER_TEMP/ios-device.env"\n          node scripts/mobile-integration/ios-customer-suite.mjs prepare\n          GRIDEX_IOS_CUSTOMER_FLOW=true bash scripts/mobile-integration/ios-smoke.sh\n';
 assert.equal(current.split(postbuild).length,2);current=current.replace(postbuild,postbuild.replace('          node scripts/mobile-integration/ios-customer-suite.mjs prepare\n',''));
 assert.equal(current,old(wf),'Unreviewed workflow changes invalidate cached cases');
 return {source,changedPaths:paths,phaseSHA256:{core:sha(a[0]),session:sha(a[3]),market:sha(b[2])},generatorKernelSHA256:sha(kernel(now(generator))),referenceCanonical:before,marketCanonical};
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
export function assertMarketEvidence(report,phase){
 assert.deepEqual(report.reference,MARKET_REFERENCE);assert.equal(report.sourceEquivalent,true);assert.equal(report.phaseSHA256,phase);assert.match(phase??'',/^[a-f0-9]{64}$/);assert.equal(report.publicReadersCredentialFree,true);
 const row=report.result;assert.equal(row.case,'market');assert.equal(row.status,'PASS');assert.equal(row.evidence,'reused');assert.equal(row.source,MARKET_REFERENCE.source);assert.equal(row.run,MARKET_REFERENCE.run);assert.equal(row.artifact,MARKET_REFERENCE.native.id);
 assert.deepEqual(report.systemChecks.map(x=>x.id).sort(),[...MARKET_IDS].sort());assert.ok(report.systemChecks.every(x=>x.result==='PASS'&&x.evidence==='reused'&&x.referenceSource===MARKET_REFERENCE.source&&x.referenceRun===MARKET_REFERENCE.run&&x.referenceArtifact===MARKET_REFERENCE.server.id));return report;
}
export function validateMarketEvidence(native,server,proof,root){
 const build=json(join(native,'build-receipt.json'));assert.equal(build.source,MARKET_REFERENCE.source);assert.equal(build.passed,true);assert.equal(build.environment,'isolated-real-auth-web-ops');
 const suite=buildSuite(proof.marketCanonical,{root,webCommit:MARKET_REFERENCE.source});const raw=inspectSuiteJUnit(readFileSync(join(native,'ui/results.xml'),'utf8'),suite.plan,MARKET_REFERENCE.source);
 assert.equal(raw.planValid,true);assert.equal(raw.reportedCases,2);const previous=['support','market'].map(name=>raw.results.find(r=>r.case===name));assert.ok(previous.every(r=>r.status!=='NOT_RUN'&&Number.isFinite(Date.parse(r.startedAt))));assert.ok(Date.parse(previous[1].startedAt)>=Date.parse(previous[0].startedAt));const row=raw.results.find(x=>x.case==='market');assert.equal(row.status,'PASS');
 const old=json(join(native,'customer-suite-result.json'));assert.equal(old.schema,'gridex.ios-composed-cases.v1');assert.equal(old.webCommit,MARKET_REFERENCE.source);assert.equal(old.expectedOpsSource,MARKET_REFERENCE.ops);assert.equal(old.freshJUnitCases,2);assert.equal(old.freshExecutionOrderVerified,true);assert.equal(old.sourceEquivalent,true);assert.deepEqual(old.reference,REFERENCE);assert.deepEqual(old.results.find(x=>x.case==='market'),{...row,evidence:'current-run',source:MARKET_REFERENCE.source});
 for(const name of ['market-network-error.png','market-retry-recovery.png','market-future-day.png'])assert.ok(existsSync(join(native,'ui',name)));
 const system=json(join(server,'mobile-system-observations.json'));assert.equal(system.webCommit,MARKET_REFERENCE.source);assert.equal(system.opsCommit,MARKET_REFERENCE.ops);
 const requests=json(join(server,'mobile-market-requests.json'));assert.ok(requests.every(r=>r.authorizationPresent===false));
 const checks=MARKET_IDS.map(id=>{const matches=system.checks.filter(c=>c.id===id);assert.equal(matches.length,1);assert.equal(matches[0].result,'PASS');assert.notEqual(matches[0].evidence,'reused');assert.ok(requests.some(r=>r.platform==='ios'&&r.area===id.slice(-3)&&r.authorizationPresent===false));return {...matches[0],evidence:'reused',referenceSource:MARKET_REFERENCE.source,referenceRun:MARKET_REFERENCE.run,referenceArtifact:MARKET_REFERENCE.server.id};});
 assert.equal(system.checks.find(x=>x.id==='no-credential-forwarding-to-public-readers')?.result,'PASS');
 return assertMarketEvidence({reference:MARKET_REFERENCE,sourceEquivalent:true,phaseSHA256:proof.phaseSHA256.market,publicReadersCredentialFree:true,result:{...row,evidence:'reused',source:MARKET_REFERENCE.source,run:MARKET_REFERENCE.run,artifact:MARKET_REFERENCE.native.id},systemChecks:checks},proof.phaseSHA256.market);
}
async function downloadReference(reference,directory){
 const run=JSON.parse(await referenceRead(['api','repos/heke99/gridex-web/actions/runs/'+reference.run],{encoding:'utf8'}));assert.equal(run.id,reference.run);assert.equal(run.head_sha,reference.source);assert.equal(run.status,'completed');assert.equal(run.conclusion,'failure');
 return Promise.all(['native','server'].map(async kind=>{
  const spec=reference[kind],meta=JSON.parse(await referenceRead(['api','repos/heke99/gridex-web/actions/artifacts/'+spec.id],{encoding:'utf8'}));assertMetadata(meta,spec,reference);
  const bytes=await referenceRead(['api','repos/heke99/gridex-web/actions/artifacts/'+spec.id+'/zip']);verifyArchive(bytes,spec);
  const zip=join(directory,String(spec.id)+'.zip'),data=join(directory,String(spec.id));writeFileSync(zip,bytes,{mode:0o600});
  const entries=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');assert.ok(entries.every(p=>!p.startsWith('/')&&!p.split('/').includes('..')&&!p.includes('\\')));execFileSync('unzip',['-q',zip,'-d',data],{stdio:'pipe'});return data;
 }));
}
export async function prepare(root=process.cwd()){
 const proof=sourceProof(root),path=join(process.env.RUNNER_TEMP,'ios-case-reuse.json');
 if(existsSync(path)){const report=assertReferenceReport(json(path),proof);assertMarketEvidence(report.marketEvidence,proof.phaseSHA256.market);return report;}
 assert.equal(process.env.GITHUB_REPOSITORY,'heke99/gridex-web');const directory=mkdtempSync(join(process.env.RUNNER_TEMP,'ios-case-reference-'));
 try{
  const [base,market]=await Promise.all([downloadReference(REFERENCE,directory),downloadReference(MARKET_REFERENCE,directory)]);
  const report=validateEvidence(...base,proof,resolve(root,'scripts/mobile-integration'));report.marketEvidence=validateMarketEvidence(...market,proof,resolve(root,'scripts/mobile-integration'));assertReferenceReport(report,proof);assertMarketEvidence(report.marketEvidence,proof.phaseSHA256.market);writeFileSync(path,JSON.stringify(report,null,2)+'\n',{mode:0o600});return report;
 }finally{rmSync(directory,{recursive:true,force:true});}
}
export function compose(xml,plan,source,reference){
 assertReferenceReport(reference,{source,phaseSHA256:reference.phaseSHA256,generatorKernelSHA256:reference.generatorKernelSHA256});assertMarketEvidence(reference.marketEvidence,reference.phaseSHA256.market);
 const inspected=inspectSuiteJUnit(xml,plan,source),fresh=inspected.results.filter(x=>FRESH.includes(x.case));
 const timestamps=fresh.map(x=>Date.parse(x.startedAt));
 const inOrder=timestamps.every((t,i)=>Number.isFinite(t)&&(i===0||t>=timestamps[i-1]));
 const passed=inspected.planValid&&inspected.reportedCases===1&&fresh.length===1&&fresh.every(x=>x.status==='PASS')&&inOrder&&!/<(?:failure|error|skipped)\b/i.test(xml)&&![...xml.matchAll(/<testsuite\b([^>]*)>/g)].some(m=>[...m[1].matchAll(/\b(?:failures|errors)\s*=\s*["']([^"']*)/g)].some(x=>Number(x[1])!==0));
 assert.deepEqual(reference.results.map(x=>x.case),REUSED);assert.ok(reference.results.every(x=>x.status==='PASS'&&x.source===REFERENCE.source&&x.run===REFERENCE.run&&x.artifact===REFERENCE.native.id));
 return {schema:'gridex.ios-composed-cases.v1',webCommit:source,expectedOpsSource:REFERENCE.ops,status:passed?'PASS':'FAIL',independentCases:true,unbrokenSingleJourney:false,freshJUnitCases:inspected.reportedCases,freshExecutionOrderVerified:inOrder,globalFourCaseExecutionOrderClaimed:false,sourceEquivalent:reference.sourceEquivalent,phaseSHA256:reference.phaseSHA256,generatorKernelSHA256:reference.generatorKernelSHA256,reference:REFERENCE,marketReference:MARKET_REFERENCE,canonicalSHA256:plan.canonicalSHA256,currentPhaseSHA256:plan.phaseSHA256,results:[...reference.results,reference.marketEvidence.result,...fresh.map(x=>({...x,evidence:'current-run',source}))]};
}
export async function createScoped(directory){
 const root=resolve(fileURLToPath(new URL('.',import.meta.url)),'../..');await prepare(root);
 const config='flows:\n'+FRESH.map(n=>'  - "'+n+'.yaml"\n').join('')+'executionOrder:\n  continueOnFailure: true\n  flowsOrder:\n'+FRESH.map(n=>'    - '+n+'\n').join('');
 for(const name of [...REUSED,'market'])rmSync(join(directory,name+'.yaml'));writeFileSync(join(directory,'config.yaml'),config,{mode:0o600});
}
