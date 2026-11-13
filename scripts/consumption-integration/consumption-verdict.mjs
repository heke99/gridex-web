import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {sourceDigest} from './consumption-fixtures.mjs';
const root=process.env.RUNNER_TEMP;
const reports=['consumption-http.json','consumption-outage.json','consumption-recovery.json'].map(n=>JSON.parse(readFileSync(root+'/'+n,'utf8')));
for(const report of reports){assert.equal(report.opsCommit,process.env.GRIDEX_OPS_COMMIT);assert.equal(report.webCommit,process.env.GRIDEX_WEB_COMMIT);assert.ok(report.results.length>0&&report.results.every(r=>r.status==='PASS'));}
const observations=JSON.parse(readFileSync(root+'/consumption-native-observations.json','utf8'));
const phases=[];
for(const platform of ['android','ios'])for(const label of ['A','B'])for(const [kind,days]of [['primary',7],['primary',30],['secondary',30],['secondary',7]]){
 const phase=`${platform}:${label}:${kind}:${days}`;assert.ok(observations.observations.some(r=>r.phase===phase&&r.platform===platform&&r.customer===label&&r.status===200&&r.correct),'Missing fresh system observation '+phase);phases.push({id:phase,status:'PASS'});
}
const fixture=JSON.parse(readFileSync(root+'/mobile-fixtures/customers.json','utf8'));assert.equal(sourceDigest(fixture),fixture.consumptionSourceDigest);
writeFileSync(root+'/consumption-system-result.json',JSON.stringify({opsCommit:process.env.GRIDEX_OPS_COMMIT,webCommit:process.env.GRIDEX_WEB_COMMIT,backendHTTP:'PASS',nativePositivePhases:phases,readOnlySourceUnchanged:true,unrelatedApprovedSuitesRerun:false},null,2));
