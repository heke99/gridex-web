import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {sourceDigest} from './consumption-fixtures.mjs';
const root=process.env.RUNNER_TEMP;
const reports=['consumption-http.json','consumption-outage.json','consumption-recovery.json'].map(n=>JSON.parse(readFileSync(root+'/'+n,'utf8')));
for(const report of reports){assert.equal(report.opsCommit,process.env.GRIDEX_OPS_COMMIT);assert.equal(report.webCommit,process.env.GRIDEX_WEB_COMMIT);assert.ok(report.results.length>0&&report.results.every(r=>r.status==='PASS'));}
const reuse=existsSync(root+'/consumption-android-reuse.json')?JSON.parse(readFileSync(root+'/consumption-android-reuse.json','utf8')):null;
if(reuse){assert.equal(reuse.status,'PASS');assert.equal(reuse.productSourceIdentical,true);assert.equal(reuse.applicableWebCommit,process.env.GRIDEX_WEB_COMMIT);assert.equal(reuse.opsCommit,process.env.GRIDEX_OPS_COMMIT);}
const nativeGate=(kind,directory)=>JSON.parse(execFileSync('python3',[new URL('./consumption-native-evidence.py',import.meta.url).pathname,kind,directory,'--ops',process.env.GRIDEX_OPS_COMMIT,'--web',kind==='android'&&reuse?reuse.originalWebCommit:process.env.GRIDEX_WEB_COMMIT],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const android=nativeGate('android',root+'/mobile-android');
const ios=nativeGate('ios',root+'/consumption-ios-evidence/consumption-ios');
const terminal=JSON.parse(readFileSync(root+'/consumption-ios-terminal/result.json','utf8'));
assert.equal(terminal.status,'success');assert.equal(terminal.webCommit,process.env.GRIDEX_WEB_COMMIT);assert.equal(terminal.opsCommit,process.env.GRIDEX_OPS_COMMIT);assert.equal(terminal.cleanupVerified,true);
const cleanup=JSON.parse(readFileSync(root+'/consumption-ios-evidence/consumption-ios/cleanup.json','utf8'));assert.equal(cleanup.ownedSimulatorDeleted,true);assert.equal(cleanup.readbackVerified,true);
const build=JSON.parse(readFileSync(root+'/consumption-ios-evidence/gridex-ios-artifacts/build-receipt.json','utf8'));assert.equal(build.source,process.env.GRIDEX_WEB_COMMIT);assert.equal(build.passed,true);
const observations=JSON.parse(readFileSync(root+'/consumption-native-observations.json','utf8'));
const phases=[];
const historical=reuse?JSON.parse(readFileSync(root+'/consumption-android-reused-observations.json','utf8')):null;
if(historical){assert.equal(historical.opsCommit,reuse.opsCommit);assert.equal(historical.webCommit,reuse.originalWebCommit);}
for(const platform of ['android','ios'])for(const label of ['A','B'])for(const [kind,days]of [['primary',7],['primary',30],['secondary',30],['secondary',7]]){
 const phase=`${platform}:${label}:${kind}:${days}`;assert.ok((platform==='android'&&reuse?historical:observations).observations.some(r=>r.phase===phase&&r.platform===platform&&r.customer===label&&r.status===200&&r.correct),'Missing fresh system observation '+phase);phases.push({id:phase,status:'PASS',reused:platform==='android'&&!!reuse});
}
const fixture=JSON.parse(readFileSync(root+'/mobile-fixtures/customers.json','utf8'));assert.equal(sourceDigest(fixture),fixture.consumptionSourceDigest);
writeFileSync(root+'/consumption-system-result.json',JSON.stringify({opsCommit:process.env.GRIDEX_OPS_COMMIT,webCommit:process.env.GRIDEX_WEB_COMMIT,backendHTTP:'PASS',androidReuse:reuse,actualAndroidProof:android,actualIOSProof:ios,nativePositivePhases:phases,readOnlySourceUnchanged:true,unrelatedApprovedSuitesRerun:false},null,2));
