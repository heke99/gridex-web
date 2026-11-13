import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {REFERENCE,MARKET_REFERENCE,FRESH,REUSED,compose,assertMetadata,verifyArchive,assertReferenceReport,assertPrebuildPackage,assertMarketEvidence} from '../scripts/mobile-integration/ios-case-reuse.mjs';
import {buildSuite} from '../scripts/mobile-integration/ios-customer-suite.mjs';
const source='a'.repeat(40),root=fileURLToPath(new URL('../scripts/mobile-integration/',import.meta.url));
const plan=buildSuite(readFileSync(root+'ios-customer.yaml','utf8'),{root,webCommit:source}).plan;
const ids=['ios:external-document-no-bearer','ios:external-invoice-pdf-no-bearer',...['/login/forgot-password','/teckna','/dashboard/contracts','/dashboard/support'].map(p=>'ios:web-handoff-'+p)];
const proof={source,phaseSHA256:{core:'b'.repeat(64),session:'c'.repeat(64),market:'e'.repeat(64)},generatorKernelSHA256:'d'.repeat(64)};
const marketEvidence=()=>({reference:MARKET_REFERENCE,sourceEquivalent:true,phaseSHA256:proof.phaseSHA256.market,publicReadersCredentialFree:true,result:{case:'market',status:'PASS',evidence:'reused',source:MARKET_REFERENCE.source,run:MARKET_REFERENCE.run,artifact:MARKET_REFERENCE.native.id},systemChecks:['SE1','SE2','SE3','SE4'].map(a=>({id:'ios:public-market-'+a,result:'PASS',evidence:'reused',referenceSource:MARKET_REFERENCE.source,referenceRun:MARKET_REFERENCE.run,referenceArtifact:MARKET_REFERENCE.server.id}))});
const reference=()=>({marketEvidence:marketEvidence(),status:'PASS_REUSED',currentSource:source,reference:REFERENCE,sourceEquivalent:true,publicReadersCredentialFree:true,phaseSHA256:proof.phaseSHA256,generatorKernelSHA256:proof.generatorKernelSHA256,results:REUSED.map(name=>({case:name,status:'PASS',evidence:'reused',source:REFERENCE.source,run:REFERENCE.run,artifact:REFERENCE.native.id})),systemChecks:ids.map(id=>({id,result:'PASS',evidence:'reused',referenceSource:REFERENCE.source,referenceRun:REFERENCE.run,referenceArtifact:REFERENCE.server.id}))});
const junit=(names=FRESH)=>'<testsuites><testsuite tests="1" failures="0">'+names.map((name,i)=>`<testcase id="${name}" name="${name}" status="SUCCESS" timestamp="2026-11-13T10:0${i}:00"/>`).join('')+'</testsuite></testsuites>';
test('iOS composition requires exactly one fresh successful case and preserves old provenance separately from JUnit',()=>{
 const xml=junit(),report=compose(xml,plan,source,reference());assert.equal(report.status,'PASS');assert.equal(report.freshJUnitCases,1);assert.equal(report.globalFourCaseExecutionOrderClaimed,false);assert.equal(report.unbrokenSingleJourney,false);assert.equal(report.results.filter(x=>x.evidence==='reused').length,3);assert.equal(report.results.filter(x=>x.evidence==='current-run').length,1);assert.equal(xml.includes('core'),false);
 for(const changed of [junit([]),junit(['market']),junit(['support','support']),junit(['core','session']),junit(['market','support']),junit(['support','market','unexpected']),xml.replace('status="SUCCESS"','status="ERROR"'),xml.replace('failures="0"','errors="1"'),xml.replace('/>','><skipped/></testcase>'),xml.replace('10:00:00','invalid-time')])assert.equal(compose(changed,plan,source,reference()).status,'FAIL');
 assert.equal(compose(xml,plan,'b'.repeat(40),{...reference(),currentSource:'b'.repeat(40)}).status,'FAIL');
});
test('iOS reference accepts only exact passed case identities and case-owned source-bound system evidence',()=>{
 assertReferenceReport(reference(),proof);
 for(const change of [r=>r.sourceEquivalent=false,r=>r.publicReadersCredentialFree=false,r=>r.results[0].status='FAIL',r=>r.results[0].case='market',r=>r.results[0].run++,r=>r.systemChecks.pop(),r=>r.systemChecks[0].referenceSource='foreign',r=>r.systemChecks[0].result='FAIL',r=>r.reference={...REFERENCE,run:1}]){const r=reference();change(r);assert.throws(()=>assertReferenceReport(r,proof));}
});
test('iOS case reference transport rejects expired, substituted or foreign archives',()=>{
 for(const owner of [REFERENCE,MARKET_REFERENCE])for(const spec of [owner.native,owner.server]){const metadata={id:spec.id,name:spec.name,expired:false,digest:'sha256:'+spec.digest,workflow_run:{id:owner.run,head_sha:owner.source}};assertMetadata(metadata,spec,owner);for(const change of [m=>m.id++,m=>m.expired=true,m=>m.workflow_run.id++,m=>m.workflow_run.head_sha='foreign',m=>m.digest='sha256:foreign']){const m=structuredClone(metadata);change(m);assert.throws(()=>assertMetadata(m,spec,owner));}assert.throws(()=>verifyArchive(Buffer.from('substituted'),spec),/digest mismatch/);}
});

test('actual reuse CLI resolves its adapter and rejects a foreign checkout without an unsettled module cycle',async()=>{
 const {spawnSync}=await import('node:child_process'),{mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const directory=mkdtempSync(join(tmpdir(),'gridex-case-cli-'));
 try{const result=spawnSync(process.execPath,['scripts/mobile-integration/ios-customer-suite.mjs','create',join(directory,'suite')],{env:{...process.env,QUALIFICATION_WEB_COMMIT:source,GRIDEX_IOS_CASE_REUSE:'true',RUNNER_TEMP:directory},encoding:'utf8',timeout:10000});assert.equal(result.status,1);assert.match(result.stderr,/Current checkout source does not match qualification/);assert.doesNotMatch(result.stderr,/unsettled top-level await/i);}
 finally{rmSync(directory,{recursive:true,force:true});}
});


test('Expo derived launch scripts preserve every product and dependency field',()=>{
 const before=JSON.parse(readFileSync(root+'../../apps/mobile/package.json','utf8')),after=structuredClone(before);after.scripts.android='expo run:android';after.scripts.ios='expo run:ios';assertPrebuildPackage(before,after);
 for(const change of [p=>p.version='9.0.0',p=>p.dependencies.react='changed',p=>p.scripts.start='unreviewed',p=>p.scripts.ios='unreviewed',p=>p.newField=true]){const p=structuredClone(after);change(p);assert.throws(()=>assertPrebuildPackage(before,p));}
});


test('Market reuse has its own source and archive custody and cannot become fresh or inherit Core provenance',()=>{
 assertMarketEvidence(marketEvidence(),proof.phaseSHA256.market);
 for(const change of [m=>m.result.status='FAIL',m=>m.result.source=REFERENCE.source,m=>m.result.run=REFERENCE.run,m=>m.systemChecks.pop(),m=>m.systemChecks[0].referenceSource=REFERENCE.source,m=>m.publicReadersCredentialFree=false,m=>m.phaseSHA256='f'.repeat(64)]){const m=marketEvidence();change(m);assert.throws(()=>assertMarketEvidence(m,proof.phaseSHA256.market));}
 const r=reference();delete r.marketEvidence;assert.throws(()=>compose(junit(),plan,source,r));
});
