import {spawnSync,execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const checks=[
 ['customer-routes',['--experimental-strip-types','--experimental-loader','./tests/mobile-read-loader.mjs','--test','tests/mobile-detail-routes.test.mjs','tests/mobile-extras.test.mjs']],
 ['account-and-provider',['--experimental-strip-types','--experimental-loader','./tests/mobile-read-loader.mjs','--test','tests/mobile-account-writes.test.mjs','tests/mobile-backend-neutral.test.mjs','tests/mobile-market-prices.test.mjs','tests/mobile-app-export.test.mjs','tests/mobile-secure-storage.test.mjs','tests/mobile-readiness.test.mjs','tests/openapi-release-revisions.test.mjs']],
 ['native-lifecycle',['--experimental-strip-types','--experimental-loader','./tests/mobile-account-loader.mjs','--test','tests/mobile-account-lifecycle.test.mjs','tests/mobile-account-adapter.test.mjs','tests/mobile-contract-actions.test.mjs','tests/mobile-market-ui.test.mjs','tests/mobile-phone-editor.test.mjs']],
];
const results=[];
for(const [name,args]of checks){const started=Date.now();const run=spawnSync(process.execPath,args,{encoding:'utf8'});results.push({name,passed:run.status===0,exitCode:run.status,durationMs:Date.now()-started});if(run.status!==0)process.stderr.write((run.stdout??'')+(run.stderr??''));console.log(`${run.status===0?'PASS':'FAIL'} ${name}`);}
for(const [name,args]of [['native-types',['--prefix','apps/mobile','run','typecheck']],['web-types',['run','typecheck']],['lint',['run','lint']]]){const run=spawnSync('npm',args,{encoding:'utf8'});results.push({name,passed:run.status===0,exitCode:run.status});if(run.status!==0)process.stderr.write((run.stdout??'')+(run.stderr??''));console.log(`${run.status===0?'PASS':'FAIL'} ${name}`);}
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),checkedAt:new Date().toISOString(),results,automatedPassed:results.every(r=>r.passed),realCustomerVerified:false,signedDeviceBuildVerified:false,productionActivated:false};
const output=process.argv[2]??'/tmp/gridex-mobile-verification.json';writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(`Report: ${output}`);if(!report.automatedPassed)process.exitCode=1;
