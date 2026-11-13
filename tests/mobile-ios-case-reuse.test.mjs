import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {REFERENCE,FRESH,REUSED,compose,assertMetadata,verifyArchive,assertReferenceReport} from '../scripts/mobile-integration/ios-case-reuse.mjs';
import {buildSuite} from '../scripts/mobile-integration/ios-customer-suite.mjs';
const source='a'.repeat(40),root=fileURLToPath(new URL('../scripts/mobile-integration/',import.meta.url));
const plan=buildSuite(readFileSync(root+'ios-customer.yaml','utf8'),{root,webCommit:source}).plan;
const ids=['ios:external-document-no-bearer','ios:external-invoice-pdf-no-bearer',...['/login/forgot-password','/teckna','/dashboard/contracts','/dashboard/support'].map(p=>'ios:web-handoff-'+p)];
const proof={source,phaseSHA256:{core:'b'.repeat(64),session:'c'.repeat(64)},generatorKernelSHA256:'d'.repeat(64)};
const reference=()=>({status:'PASS_REUSED',currentSource:source,reference:REFERENCE,sourceEquivalent:true,publicReadersCredentialFree:true,phaseSHA256:proof.phaseSHA256,generatorKernelSHA256:proof.generatorKernelSHA256,results:REUSED.map(name=>({case:name,status:'PASS',evidence:'reused',source:REFERENCE.source,run:REFERENCE.run,artifact:REFERENCE.native.id})),systemChecks:ids.map(id=>({id,result:'PASS',evidence:'reused',referenceSource:REFERENCE.source,referenceRun:REFERENCE.run,referenceArtifact:REFERENCE.server.id}))});
const junit=(names=FRESH)=>'<testsuites><testsuite tests="2" failures="0">'+names.map((name,i)=>`<testcase id="${name}" name="${name}" status="SUCCESS" timestamp="2026-11-13T10:0${i}:00"/>`).join('')+'</testsuite></testsuites>';
test('iOS composition requires exactly two fresh successful cases and preserves old provenance separately from JUnit',()=>{
 const xml=junit(),report=compose(xml,plan,source,reference());assert.equal(report.status,'PASS');assert.equal(report.freshJUnitCases,2);assert.equal(report.globalFourCaseExecutionOrderClaimed,false);assert.equal(report.unbrokenSingleJourney,false);assert.equal(report.results.filter(x=>x.evidence==='reused').length,2);assert.equal(report.results.filter(x=>x.evidence==='current-run').length,2);assert.equal(xml.includes('core'),false);
 for(const changed of [junit(['support']),junit(['support','support']),junit(['core','session']),junit(['market','support']),junit(['support','market','unexpected']),xml.replace('status="SUCCESS"','status="ERROR"'),xml.replace('failures="0"','errors="1"'),xml.replace('/>','><skipped/></testcase>'),xml.replace('10:01:00','09:59:00')])assert.equal(compose(changed,plan,source,reference()).status,'FAIL');
 assert.equal(compose(xml,plan,'b'.repeat(40),{...reference(),currentSource:'b'.repeat(40)}).status,'FAIL');
});
test('iOS reference accepts only exact passed case identities and case-owned source-bound system evidence',()=>{
 assertReferenceReport(reference(),proof);
 for(const change of [r=>r.sourceEquivalent=false,r=>r.publicReadersCredentialFree=false,r=>r.results[0].status='FAIL',r=>r.results[0].case='market',r=>r.results[0].run++,r=>r.systemChecks.pop(),r=>r.systemChecks[0].referenceSource='foreign',r=>r.systemChecks[0].result='FAIL',r=>r.reference={...REFERENCE,run:1}]){const r=reference();change(r);assert.throws(()=>assertReferenceReport(r,proof));}
});
test('iOS case reference transport rejects expired, substituted or foreign archives',()=>{
 for(const spec of [REFERENCE.native,REFERENCE.server]){const metadata={id:spec.id,name:spec.name,expired:false,digest:'sha256:'+spec.digest,workflow_run:{id:REFERENCE.run,head_sha:REFERENCE.source}};assertMetadata(metadata,spec);for(const change of [m=>m.id++,m=>m.expired=true,m=>m.workflow_run.id++,m=>m.workflow_run.head_sha='foreign',m=>m.digest='sha256:foreign']){const m=structuredClone(metadata);change(m);assert.throws(()=>assertMetadata(m,spec));}assert.throws(()=>verifyArchive(Buffer.from('substituted'),spec),/digest mismatch/);}
});

test('actual reuse CLI resolves its adapter and rejects a foreign checkout without an unsettled module cycle',async()=>{
 const {spawnSync}=await import('node:child_process'),{mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const directory=mkdtempSync(join(tmpdir(),'gridex-case-cli-'));
 try{const result=spawnSync(process.execPath,['scripts/mobile-integration/ios-customer-suite.mjs','create',join(directory,'suite')],{env:{...process.env,QUALIFICATION_WEB_COMMIT:source,GRIDEX_IOS_CASE_REUSE:'true',RUNNER_TEMP:directory},encoding:'utf8',timeout:10000});assert.equal(result.status,1);assert.match(result.stderr,/Current checkout source does not match qualification/);assert.doesNotMatch(result.stderr,/unsettled top-level await/i);}
 finally{rmSync(directory,{recursive:true,force:true});}
});
