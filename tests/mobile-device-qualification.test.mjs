import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync,fork} from 'node:child_process';
import {once} from 'node:events';
const cryptoScript=new URL('../scripts/mobile-integration/device-fixture.mjs',import.meta.url).pathname;
test('native compiler rejects inherited device credentials before starting Xcode',()=>{
 const directory=mkdtempSync(join(tmpdir(),'gridex-build-env-'));
 try{
  const result=spawnSync('bash',[new URL('../scripts/mobile-integration/ios-build.sh',import.meta.url).pathname],{env:{...process.env,RUNNER_TEMP:directory,LOGIN_A_PASSWORD:'SYNTHETIC_BUILD_SCOPE_TEST'},encoding:'utf8'});
  assert.equal(result.status,1);assert.ok(result.stderr.includes('public build configuration only'));assert.ok(!result.stderr.includes('SYNTHETIC_BUILD_SCOPE_TEST'));
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('sibling-job identities are source-bound and authenticated-encrypted; privileged credentials stay out',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gridex-device-crypto-'));
 try{
  const env={...process.env,RUNNER_TEMP:dir,QUALIFICATION_WEB_COMMIT:'source-sha',GRIDEX_WEB_COMMIT:'source-sha',GRIDEX_OPS_COMMIT:'ops-sha',GRIDEX_DEVICE_PUBLIC_ORIGIN:'https://synthetic-test.trycloudflare.com',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-anon-only',GRIDEX_DEVICE_PRIVATE_KEY:join(dir,'private.key')};
  const run=(...args)=>execFileSync(process.execPath,[cryptoScript,...args],{env,stdio:'ignore'});
  run('keypair',env.GRIDEX_DEVICE_PRIVATE_KEY,join(dir,'ios-public-key'));
  const fixture=join(dir,'fixture.json');
  writeFileSync(fixture,JSON.stringify({secrets:['PRIVILEGED_SERVICE_CREDENTIAL'],companyId:'internal-company',customers:[{label:'A',login:{email:'synthetic@example.invalid',password:'SYNTHETIC_TEST_ONLY'},display:{contracts:'contract-A'},number:'A',extra:{}}]}));
  run('encrypt',fixture,join(dir,'sealed'));
  const sealed=join(dir,'sealed/device-fixture.encrypted.json'),text=readFileSync(sealed,'utf8');
  assert.ok(!text.includes('SYNTHETIC_TEST_ONLY'));assert.ok(!text.includes('PRIVILEGED_SERVICE_CREDENTIAL'));
  run('decrypt',sealed,join(dir,'device.env'));
  const result=readFileSync(join(dir,'device.env'),'utf8');assert.ok(result.includes('SYNTHETIC_TEST_ONLY'));assert.ok(!result.includes('PRIVILEGED_SERVICE_CREDENTIAL'));assert.ok(!result.includes('internal-company'));
  const data=JSON.parse(text);data.ciphertext=Buffer.from('tampered').toString('base64');writeFileSync(sealed,JSON.stringify(data));
  const bad=spawnSync(process.execPath,[cryptoScript,'decrypt',sealed,join(dir,'bad.env')],{env,stdio:'ignore'});assert.notEqual(bad.status,0);assert.equal(existsSync(join(dir,'bad.env')),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('public synthetic gateway denies Auth admin, signup, raw database and OPS access',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'gridex-gateway-'));mkdirSync(join(directory,'mobile-fixtures'));
 const reference='document_'+'a'.repeat(32),invoiceReference='document_'+'b'.repeat(32);
 writeFileSync(join(directory,'mobile-fixtures/customers.json'),JSON.stringify({customers:[{label:'A',extra:{document:reference,invoiceDocument:invoiceReference}}]}));
 const child=fork(new URL('../scripts/mobile-integration/device-gateway.mjs',import.meta.url),[],{env:{...process.env,RUNNER_TEMP:directory,GRIDEX_QUALIFICATION_GATEWAY_PORT:'0'},stdio:['ignore','ignore','ignore','ipc']});
 try{
  const [{port}]=await Promise.race([once(child,'message'),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Gateway startup timeout')),5000);t.unref();})]);
  const origin='http://127.0.0.1:'+port;
  assert.equal((await fetch(origin+'/qualification-health')).status,200);
  for(const path of ['/auth/v1/admin/users','/auth/v1/signup','/rest/v1/customers','/api/v1/customer/contracts','/api/mobile/customer/../../rest/v1/customers'])assert.equal((await fetch(origin+path)).status,404);
  assert.equal((await fetch(origin+'/api/mobile/customer/profile',{method:'DELETE'})).status,404);
  assert.equal((await fetch(origin+'/qualification-control',{method:'POST',body:'{}'})).status,404);
  const pdf=await fetch(origin+'/qualification-document/'+reference);assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.ok((await pdf.text()).startsWith('%PDF-1.4'));
  const invoicePdf=await fetch(origin+'/qualification-document/'+invoiceReference);assert.equal(invoicePdf.status,200);assert.ok((await invoicePdf.text()).startsWith('%PDF-1.4'));
  assert.notEqual(pdf.headers.get('content-disposition'),invoicePdf.headers.get('content-disposition'));assert.ok(pdf.headers.get('content-disposition').includes(reference));assert.ok(invoicePdf.headers.get('content-disposition').includes(invoiceReference));
  assert.equal((await fetch(origin+'/qualification-document/'+reference,{headers:{authorization:'Bearer DUMMY-TEST-ONLY'}})).status,400);
 }finally{child.kill();await once(child,'exit');rmSync(directory,{recursive:true,force:true});}
});

test('uploaded evidence removes credential formats even when absent from the environment',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gridex-evidence-'));
 try{
  const input=join(dir,'raw.log'),output=join(dir,'safe.log');
  const samples=['postgresql://synthetic:password@127.0.0.1:54322/postgres','eyJtest.payload.signature','gdxp_synthetic.signature','Bearer synthetic-test-token','-----BEGIN PRIVATE KEY-----\nSYNTHETIC_KEY_BODY\n-----END PRIVATE KEY-----'];
  writeFileSync(input,samples.join('\n'));
  execFileSync(process.execPath,[new URL('../scripts/mobile-integration/sanitize-evidence.mjs',import.meta.url).pathname,'log',input,output],{env:{...process.env,RUNNER_TEMP:dir}});
  const result=readFileSync(output,'utf8');
  for(const sample of samples)assert.ok(!result.includes(sample));
  assert.ok(!result.includes('SYNTHETIC_KEY_BODY'));
  for(const kind of ['DATABASE_URL','JWT','API_KEY','PRIVATE_KEY'])assert.ok(result.includes('[REDACTED_'+kind+']'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

for(const scenario of ['pass','flow-failure','sanitizer-failure'])test('native UI runner preserves evidence, privacy and exit: '+scenario,()=>{
 const outcome=scenario==='pass'?0:7,privateValue='SYNTHETIC_PRIVATE_CONSOLE_SECRET';
 const dir=mkdtempSync(join(tmpdir(),'gridex-ui-exit-'));
 const bin=join(dir,'bin');mkdirSync(bin);
 const executable=(path,body)=>{writeFileSync(path,'#!/bin/bash\n'+body+'\n');chmodSync(path,0o700);};
 try{
  for(const name of ['curl','shasum','unzip','defaults','open'])executable(join(bin,name),'exit 0');
  executable(join(bin,'xcrun'),`case "$*" in
   'simctl list devicetypes -j') echo '{"devicetypes":[{"name":"iPhone 17","identifier":"mock-device"}]}' ;;
   'simctl list runtimes -j') echo '{"runtimes":[{"isAvailable":true,"identifier":"mock-iOS"}]}' ;;
   'simctl create '*) echo mock-simulator ;;
  esac`);
  mkdirSync(join(dir,'gridex-maestro/maestro/bin'),{recursive:true});
  mkdirSync(join(dir,'gridex-ios-artifacts'));
  writeFileSync(join(dir,'gridex-ios-app-path'),'/synthetic-only.app');
  executable(join(dir,'gridex-maestro/maestro/bin/maestro'),`test "\${10}" = '-e' || exit 98
  test "\${11}" = 'GRIDEX_NATIVE_UI_QUALIFICATION=1' || exit 99
  ${outcome===0?'printf \'<testsuite tests="1" failures="0"/>\' > "$7"':`printf '<testsuite tests="1" failures="1"><failure>No visible element: ${privateValue}</failure></testsuite>' > "$7"; printf 'Assertion failed ${privateValue}\\n::error::synthetic command-looking line\\n'`}
  exit ${outcome}`);
  if(scenario==='sanitizer-failure'){mkdirSync(join(dir,'mobile-fixtures'));writeFileSync(join(dir,'mobile-fixtures/customers.json'),privateValue+' INVALID_JSON');}
  const result=spawnSync('bash',[new URL('../scripts/mobile-integration/ios-smoke.sh',import.meta.url).pathname],{env:{...process.env,PATH:bin+':'+process.env.PATH,RUNNER_TEMP:dir,GRIDEX_IOS_CUSTOMER_FLOW:'false',LOGIN_A_PASSWORD:privateValue},encoding:'utf8'});
  assert.equal(result.status,outcome,result.stderr);
  assert.equal(existsSync(join(dir,'gridex-ios-artifacts/simulator-receipt.json')),outcome===0);
  if(outcome===0)assert.ok(existsSync(join(dir,'gridex-ios-artifacts/ui/results.xml')));
  assert.ok(!(result.stdout+result.stderr).includes(privateValue),'A console fallback must not expose private data or sanitizer errors');
  if(scenario==='flow-failure'){
   const summary=JSON.parse(result.stdout.trim().split('\n').find(line=>line.includes('gridex.ios-failure-summary.v1')));
   assert.ok(summary.junit.includes('No visible element: [REDACTED]'));assert.ok(summary.logTail.includes('Assertion failed [REDACTED]'));
   assert.ok(!result.stdout.split('\n').some(line=>line.startsWith('::')),'Diagnostic text must not execute workflow commands');
  }
  if(scenario==='sanitizer-failure')assert.ok(result.stdout.includes('iOS evidence sanitization failed; private diagnostics withheld.'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('public iOS console summary is bounded and excludes unknown hierarchy fields',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gridex-public-ios-summary-'));
 try{
  writeFileSync(join(dir,'results.xml'),'<failure>[REDACTED]'+('\\\n"'.repeat(20000))+'</failure>');
  writeFileSync(join(dir,'maestro.log'),'[REDACTED]'+('\\\n"'.repeat(20000))+'latest failure');
  writeFileSync(join(dir,'native-ui-state.json'),JSON.stringify({failureReported:true,privateHierarchy:'PRIVATE_HIERARCHY'}));
  const output=execFileSync(process.execPath,[new URL('../scripts/mobile-integration/ios-failure-summary.mjs',import.meta.url).pathname,dir],{encoding:'utf8'});
  assert.ok(Buffer.byteLength(output)<=8193);assert.equal(output.trim().split('\n').length,1);assert.ok(!output.includes('PRIVATE_HIERARCHY'));
  const summary=JSON.parse(output);assert.equal(summary.nativeState.failureReported,true);assert.ok(summary.logTail.endsWith('latest failure'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

for(const scenario of ['startup-then-pass','flow-failure','startup-with-report','startup-twice'])test('native bootstrap retry is bounded: '+scenario,()=>{
 const dir=mkdtempSync(join(tmpdir(),'gridex-ui-bootstrap-'));const bin=join(dir,'bin');mkdirSync(bin);
 const executable=(path,body)=>{writeFileSync(path,'#!/bin/bash\n'+body+'\n');chmodSync(path,0o700);};
 try{
  for(const name of ['curl','shasum','unzip','defaults','open'])executable(join(bin,name),'exit 0');
  executable(join(bin,'xcrun'),`case "$*" in
   'simctl list devicetypes -j') echo '{"devicetypes":[{"name":"iPhone 17","identifier":"mock-device"}]}' ;;
   'simctl list runtimes -j') echo '{"runtimes":[{"isAvailable":true,"identifier":"mock-iOS"}]}' ;;
   'simctl create '*) echo mock-simulator ;;
  esac`);
  mkdirSync(join(dir,'gridex-maestro/maestro/bin'),{recursive:true});mkdirSync(join(dir,'gridex-ios-artifacts'));
  writeFileSync(join(dir,'gridex-ios-app-path'),'/synthetic-only.app');
  executable(join(dir,'gridex-maestro/maestro/bin/maestro'),`test "$MAESTRO_DRIVER_STARTUP_TIMEOUT" = 300000 || exit 98
  count=0; test ! -f "$RUNNER_TEMP/attempt-count" || read count < "$RUNNER_TEMP/attempt-count"
  count=$((count+1)); echo "$count" > "$RUNNER_TEMP/attempt-count"
  if test '${scenario}' = startup-then-pass && test "$count" -eq 2; then
    printf '<testsuite tests="1" failures="0"/>' > "$7"; exit 0
  fi
  ${scenario==='startup-with-report'?`printf '<testsuite tests="1" failures="1"/>' > "$7"`:':'}
  ${scenario==='flow-failure'?`echo 'Assertion failed'`:`echo 'xcuitest.installer.LocalXCTestInstaller$IOSDriverTimeoutException'`}
  exit 7`);
  const result=spawnSync('bash',[new URL('../scripts/mobile-integration/ios-smoke.sh',import.meta.url).pathname],{env:{...process.env,PATH:bin+':'+process.env.PATH,RUNNER_TEMP:dir,GRIDEX_IOS_CUSTOMER_FLOW:'false'},encoding:'utf8'});
  assert.equal(result.status,scenario==='startup-then-pass'?0:7,result.stderr);
  assert.equal(Number(readFileSync(join(dir,'attempt-count'),'utf8')),['startup-then-pass','startup-twice'].includes(scenario)?2:1);
  assert.equal(existsSync(join(dir,'gridex-ios-artifacts/simulator-receipt.json')),scenario==='startup-then-pass');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('native failure diagnostics export fixed booleans without private hierarchy data',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gridex-native-markers-'));const source=join(dir,'private');const target=join(dir,'public');mkdirSync(source);
 const privateValue='SYNTHETIC_PRIVATE_MARKER_VALUE';const customer='SYNTHETIC_CUSTOMER_A';
 try{
  writeFileSync(join(source,'step-005-inputText-private.json'),JSON.stringify({attributes:{bounds:'[0,0][100,200]'},children:[{attributes:{accessibilityText:'Uppgifterna kunde inte hämtas. Kontrollera anslutningen och försök igen.'}},{attributes:{value:privateValue,accessibilityText:'Logga in på Mina sidor'}},{attributes:{text:'Faktura '+customer}},{attributes:{text:'Hämta igen'}}]}));
  writeFileSync(join(source,'commands.json'),JSON.stringify({password:privateValue}));
  writeFileSync(join(source,'driver-startup-attempt-1.log'),'Bootstrap timeout '+privateValue+' Bearer synthetic-startup-token');
  writeFileSync(join(source,'results.xml'),'<testsuites><testsuite failures="1"><failure>'+privateValue+'</failure></testsuite></testsuites>');
  writeFileSync(join(source,'step-005-inputText-private.png'),privateValue);
  writeFileSync(join(source,'profile-phone-target.png'),'SYNTHETIC_AUTHENTICATED_PHONE_TARGET');
  writeFileSync(join(source,'login-password-target.png'),privateValue);
  execFileSync(process.execPath,[new URL('../scripts/mobile-integration/sanitize-evidence.mjs',import.meta.url).pathname,'ios',source,target],{env:{...process.env,RUNNER_TEMP:dir,LOGIN_A_PASSWORD:privateValue,CUSTOMER_A:customer}});
  const raw=readFileSync(join(target,'native-ui-state.json'),'utf8');const flags=JSON.parse(raw);
  assert.ok(Object.values(flags).every(value=>typeof value==='boolean'));
  assert.equal(flags.failureReported,true);assert.equal(flags.hierarchyAvailable,true);assert.equal(flags.knownReadErrorTextPresent,true);assert.equal(flags.loginHeadingPresent,true);assert.equal(flags.customerAReferencePresent,true);assert.equal(flags.customerBReferencePresent,false);assert.equal(flags.visibilityEstablished,false);
  assert.ok(!raw.includes(privateValue)&&!raw.includes(customer));assert.ok(!readFileSync(join(target,'results.xml'),'utf8').includes(privateValue));
  assert.ok(readFileSync(join(target,'driver-startup-attempt-1.log'),'utf8').includes('Bootstrap timeout'));
  assert.ok(!readFileSync(join(target,'driver-startup-attempt-1.log'),'utf8').includes(privateValue));
  assert.ok(!readFileSync(join(target,'driver-startup-attempt-1.log'),'utf8').includes('synthetic-startup-token'));
  assert.ok(!existsSync(join(target,'commands.json')));assert.ok(!existsSync(join(target,'step-005-inputText-private.json')));assert.ok(!existsSync(join(target,'step-005-inputText-private.png')));
  assert.equal(readFileSync(join(target,'profile-phone-target.png'),'utf8'),'SYNTHETIC_AUTHENTICATED_PHONE_TARGET');
  assert.ok(!existsSync(join(target,'login-password-target.png')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('native state markers ignore assertion metadata and never establish visibility',async()=>{
 const {nativeStateMarkers}=await import('../scripts/mobile-integration/ios-state-markers.mjs');
 const expected='Uppgifterna kunde inte hämtas. Kontrollera anslutningen och försök igen.';
 const flags=nativeStateMarkers({attributes:{accessibilityText:'Hämtar kunduppgifter'},children:[],command:{assertVisible:expected}});
 assert.equal(flags.knownReadErrorTextPresent,false);assert.equal(flags.busyTextPresent,true);assert.equal(flags.visibilityEstablished,false);
 assert.equal(nativeStateMarkers({command:{attributes:{text:expected}}}).hierarchyAvailable,false);
});

test('native failure stage identifiers expose only finite public state booleans',async()=>{
 const {nativeStateMarkers}=await import('../scripts/mobile-integration/ios-state-markers.mjs');
 const secret='SYNTHETIC_PRIVATE_INPUT';
 const flags=nativeStateMarkers({attributes:{'resource-id':'customer-invoiceDetail-loading'},children:[{attributes:{'resource-id':'customer-'+secret+'-idle',text:secret}}]});
 assert.equal(flags.invoiceResourcePresent,true);assert.equal(flags.customerBusyStatePresent,true);
 assert.equal(flags.customerIdleStatePresent,false);assert.equal(flags.contractsResourcePresent,false);
 assert.equal(flags.visibilityEstablished,false);assert.ok(Object.values(flags).every(v=>typeof v==='boolean'));
 assert.ok(!JSON.stringify(flags).includes(secret));
});

test('control observations record only known action/outcome enums and numeric timing',async()=>{
 const {recordControlObservation}=await import('../scripts/mobile-integration/control-observations.mjs');
 const dir=mkdtempSync(join(tmpdir(),'gridex-control-observations-'));const file=join(dir,'mobile-control-observations.json');const privateValue='PRIVATE_CONTROL_BODY_OR_HEADER';
 try{
  recordControlObservation(privateValue,'started',dir);assert.equal(existsSync(file),false);
  recordControlObservation('snapshot','started',dir);
  const rows=JSON.parse(readFileSync(file,'utf8'));rows.push({action:'snapshot',outcome:'passed',timestamp:privateValue,password:privateValue});rows.push({action:privateValue,outcome:'failed'});writeFileSync(file,JSON.stringify(rows));
  recordControlObservation('assert-fresh','failed',dir);
  const raw=readFileSync(file,'utf8'),safe=JSON.parse(raw);assert.ok(!raw.includes(privateValue));assert.equal(safe.length,3);
  for(const row of safe){assert.deepEqual(Object.keys(row).sort(),['action','outcome','timestamp']);assert.ok(Number.isSafeInteger(row.timestamp));}
  assert.deepEqual(safe.map(row=>[row.action,row.outcome]),[['snapshot','started'],['snapshot','passed'],['assert-fresh','failed']]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

for(const stage of ['listing','download'])test('sibling artifact '+stage+' transient errors retry without publishing partial files',async()=>{
 const {awaitArtifact}=await import('../scripts/mobile-integration/await-artifact.mjs');
 const dir=mkdtempSync(join(tmpdir(),'gridex-artifact-retry-')),target=join(dir,'received');let clock=0,listings=0,downloads=0;
 try{
  await awaitArtifact('android-customer-terminal',target,{runId:'123',repository:'synthetic/repo',now:()=>clock,sleep:async ms=>{clock+=ms;},execute:(_cmd,args,options)=>{
   assert.ok(options.timeout>0&&options.timeout<=60000);
   if(args[0]==='api'){if(++listings===1&&stage==='listing')throw Error('PRIVATE_UPSTREAM_FAILURE');return JSON.stringify({artifacts:[{name:'android-customer-terminal',expired:false}]});}
   const output=args.at(-1);if(++downloads===1&&stage==='download'){writeFileSync(join(output,'partial.txt'),'PRIVATE_PARTIAL_DOWNLOAD');throw Error('PRIVATE_UPSTREAM_FAILURE');}
   writeFileSync(join(output,'result.json'),'{"status":"success"}');
  }});
  assert.equal(readFileSync(join(target,'result.json'),'utf8'),'{"status":"success"}');assert.ok(!existsSync(join(target,'partial.txt')));
  assert.equal(listings,stage==='listing'?2:1);assert.equal(downloads,stage==='download'?2:1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('sibling artifact repeated failures remain terminal and do not expose upstream output',async()=>{
 const {awaitArtifact}=await import('../scripts/mobile-integration/await-artifact.mjs');const dir=mkdtempSync(join(tmpdir(),'gridex-artifact-fail-'));let clock=0,calls=0;
 try{
  await assert.rejects(awaitArtifact('android-customer-terminal',join(dir,'received'),{runId:'123',repository:'synthetic/repo',now:()=>clock,sleep:async ms=>{clock+=ms;},execute:()=>{calls++;throw Error('PRIVATE_UPSTREAM_FAILURE');}}),error=>error.message==='Sibling artifact listing unavailable after bounded retries');assert.equal(calls,6);
  assert.ok(!existsSync(join(dir,'received/result.json')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('sibling artifact wait accepts late Android terminal but stops at its overall deadline',async()=>{
 const {awaitArtifact}=await import('../scripts/mobile-integration/await-artifact.mjs');const dir=mkdtempSync(join(tmpdir(),'gridex-artifact-deadline-'));let clock=0;
 try{
  await awaitArtifact('android-customer-terminal',join(dir,'late'),{runId:'123',repository:'synthetic/repo',now:()=>clock,sleep:async ms=>{clock+=ms;},execute:(_cmd,args)=>{
   if(args[0]==='api')return JSON.stringify({artifacts:clock>=26*60000?[{name:'android-customer-terminal'}]:[]});
   writeFileSync(join(args.at(-1),'result.json'),'{}');
  }});assert.ok(existsSync(join(dir,'late/result.json')));
  clock=0;await assert.rejects(awaitArtifact('android-customer-terminal',join(dir,'missing'),{runId:'123',repository:'synthetic/repo',now:()=>clock,sleep:async ms=>{clock+=ms;},execute:()=>'{"artifacts":[]}'}),/Timed out waiting/);assert.equal(clock,40*60000);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('missing iOS terminal fails after completed current-attempt producer grace, not an hour',async()=>{
 const {awaitArtifact}=await import('../scripts/mobile-integration/await-artifact.mjs');const dir=mkdtempSync(join(tmpdir(),'gridex-lost-ios-terminal-'));let clock=0;
 try{
  await assert.rejects(awaitArtifact('ios-customer-terminal',join(dir,'received'),{runId:'123',runAttempt:'2',repository:'synthetic/repo',now:()=>clock,sleep:async ms=>{clock+=ms;},execute:(_cmd,args)=>{
   if(args[1].endsWith('/artifacts'))return '{"artifacts":[]}';
   assert.ok(args[1].includes('/attempts/2/jobs'),'Never use an older completed producer');
   return '{"jobs":[{"name":"ios-customer","status":"completed","conclusion":"failure"}]}';
  }}),/iOS producer completed without its required terminal artifact/);
  assert.ok(clock>=60000&&clock<=75000,'Cleanup must start after the bounded delivery grace');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('iOS terminal delivery grace accepts a late artifact and ignores unavailable producer status',async()=>{
 const {awaitArtifact}=await import('../scripts/mobile-integration/await-artifact.mjs');const dir=mkdtempSync(join(tmpdir(),'gridex-ios-terminal-grace-'));let clock=0,checks=0;
 try{
  await awaitArtifact('ios-customer-terminal',join(dir,'received'),{runId:'123',runAttempt:'2',repository:'synthetic/repo',now:()=>clock,sleep:async ms=>{clock+=ms;},execute:(_cmd,args)=>{
   if(args[0]==='api'){
    if(args[1].endsWith('/artifacts'))return JSON.stringify({artifacts:clock>=45000?[{name:'ios-customer-terminal'}]:[]});
    if(++checks===1)throw Error('PRIVATE_STATUS_ERROR');
    return '{"jobs":[{"name":"ios-customer","status":"completed"}]}';
   }
   writeFileSync(join(args.at(-1),'result.json'),'{"status":"failure"}');
  }});
  assert.equal(clock,45000);assert.equal(readFileSync(join(dir,'received/result.json'),'utf8'),'{"status":"failure"}');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

for(const state of ['running','missing','unavailable'])test('iOS producer '+state+' never fabricates completion or success',async()=>{
 const {awaitArtifact}=await import('../scripts/mobile-integration/await-artifact.mjs');const dir=mkdtempSync(join(tmpdir(),'gridex-ios-producer-state-'));let clock=0;
 try{
  await assert.rejects(awaitArtifact('ios-customer-terminal',join(dir,'received'),{runId:'123',runAttempt:'2',repository:'synthetic/repo',now:()=>clock,sleep:async ms=>{clock+=ms;},execute:(_cmd,args)=>{
   if(args[1].endsWith('/artifacts'))return '{"artifacts":[]}';
   if(state==='unavailable')throw Error('PRIVATE_STATUS_BODY');
   return JSON.stringify({jobs:state==='missing'?[]:[{name:'ios-customer',status:'in_progress'}]});
  }}),/Timed out waiting for sibling-job artifact/);
  assert.equal(clock,60*60000);assert.ok(!existsSync(join(dir,'received/result.json')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('iOS upload retry gate requires actual success for both artifacts',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/mobile-customer-qualification.yml',import.meta.url),'utf8');
 const gate=workflow.match(/      - name: Require uploaded iOS evidence\n[\s\S]*?        run: \|\n((?:          [^\n]*\n)+)/)?.[1]?.replace(/^          /gm,'');
 assert.ok(gate,'The upload retries need a final failing gate');
 for(const [terminalFirst,terminalRetry,evidenceFirst,evidenceRetry,expected] of [
  ['success','skipped','success','skipped',0],['failure','success','success','skipped',0],['success','skipped','failure','success',0],
  ['failure','failure','success','skipped',1],['success','skipped','failure','failure',1],['skipped','skipped','skipped','skipped',1],
 ]){
  const result=spawnSync('bash',['-c',gate],{encoding:'utf8',env:{...process.env,TERMINAL_FIRST:terminalFirst,TERMINAL_RETRY:terminalRetry,EVIDENCE_FIRST:evidenceFirst,EVIDENCE_RETRY:evidenceRetry}});
  assert.equal(result.status,expected);
 }
});
for(const failure of ['persistent','empty'])test('sibling download '+failure+' never publishes incomplete evidence',async()=>{
 const {awaitArtifact}=await import('../scripts/mobile-integration/await-artifact.mjs');const dir=mkdtempSync(join(tmpdir(),'gridex-artifact-download-fail-'));let clock=0,downloads=0;
 try{
  await assert.rejects(awaitArtifact('ios-customer-terminal',join(dir,'received'),{runId:'123',repository:'synthetic/repo',now:()=>clock,sleep:async ms=>{clock+=ms;},execute:(_cmd,args)=>{
   if(args[0]==='api')return '{"artifacts":[{"name":"ios-customer-terminal"}]}';
   downloads++;if(failure==='persistent'){writeFileSync(join(args.at(-1),'partial.txt'),'PRIVATE_PARTIAL');throw Error('PRIVATE_UPSTREAM_FAILURE');}
  }}),failure==='persistent'?/download unavailable after bounded retries/:/Downloaded artifact is empty/);
  assert.equal(downloads,failure==='persistent'?6:1);assert.equal(existsSync(join(dir,'received/partial.txt')),false);
  assert.deepEqual((await import('node:fs')).readdirSync(dir),['received']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('isolated Auth observations distinguish exact synthetic credentials without exporting them',async()=>{
 const {syntheticCredentialIdentity,observeAuthRequest}=await import('../scripts/mobile-integration/auth-observations.mjs');const {EventEmitter}=await import('node:events');
 const directory=mkdtempSync(join(tmpdir(),'gridex-auth-observation-'));const email='PRIVATE_SYNTHETIC_EMAIL',password='PRIVATE_SYNTHETIC_PASSWORD',customers=[{label:'A',login:{email,password}}];
 try{
  assert.equal(syntheticCredentialIdentity(JSON.stringify({email,password}),customers),'A');assert.equal(syntheticCredentialIdentity(JSON.stringify({email,password:password.slice(1)}),customers),'none');
  for(const outcome of ['response','transport-error','upstream-timeout','client-disconnected']){
   const incoming=new EventEmitter(),outgoing=new EventEmitter();const finish=observeAuthRequest(incoming,outgoing,{platform:'ios',operation:'password',customers,directory});
   incoming.emit('data',Buffer.from(JSON.stringify({email,password,access_token:'PRIVATE_TOKEN'})));incoming.emit('end');
   if(outcome==='client-disconnected')outgoing.emit('close');else finish(outcome==='response'?200:0,outcome);
   finish(500,'transport-error');
  }
  const raw=readFileSync(join(directory,'mobile-auth-requests.json'),'utf8'),rows=JSON.parse(raw);assert.equal(rows.length,4);
  for(const privateValue of [email,password,'PRIVATE_TOKEN'])assert.ok(!raw.includes(privateValue));
  assert.deepEqual(rows.map(r=>r.outcome),['response','transport-error','upstream-timeout','client-disconnected']);assert.ok(rows.every(r=>r.identity==='A'));
  for(const row of rows)assert.deepEqual(Object.keys(row).sort(),['durationMs','identity','operation','outcome','platform','status','timestamp']);
  const incoming=new EventEmitter(),outgoing=new EventEmitter();const finish=observeAuthRequest(incoming,outgoing,{platform:'ios',operation:'password',customers,directory});incoming.emit('data',Buffer.alloc(9000,65));incoming.emit('end');finish(400,'response');assert.equal(JSON.parse(readFileSync(join(directory,'mobile-auth-requests.json'),'utf8')).at(-1).identity,'none');
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('Auth observation forwards original streamed bytes exactly once, including split UTF-8',async()=>{
 const {observeAuthRequest,recordAuthObservation}=await import('../scripts/mobile-integration/auth-observations.mjs');const {createServer,request}=await import('node:http');
 const directory=mkdtempSync(join(tmpdir(),'gridex-auth-forward-'));const email='private@example.invalid',password='åÖ🔐';const payload=Buffer.from(JSON.stringify({email,password}));let received=Buffer.alloc(0);
 const upstream=createServer(async(req,res)=>{const chunks=[];for await(const part of req)chunks.push(part);received=Buffer.concat(chunks);res.writeHead(200,{'content-type':'application/json'}).end('{"synthetic":true}');});
 await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 const proxy=createServer((incoming,outgoing)=>{
  const finish=observeAuthRequest(incoming,outgoing,{platform:'ios',operation:'password',customers:[{label:'A',login:{email,password}}],directory});
  const next=request({hostname:'127.0.0.1',port:upstream.address().port,method:'POST',headers:incoming.headers},response=>{outgoing.writeHead(response.statusCode,response.headers);response.once('end',()=>finish(response.statusCode,'response'));response.pipe(outgoing);});incoming.pipe(next);
 });await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
 try{
  await new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:proxy.address().port,method:'POST',headers:{'content-type':'application/json','content-length':payload.length}},res=>{res.resume();res.on('end',resolve);});req.on('error',reject);const at=payload.indexOf(Buffer.from('å'))+1;req.write(payload.subarray(0,at));setTimeout(()=>req.end(payload.subarray(at)),5);});
  assert.deepEqual(received,payload);const file=join(directory,'mobile-auth-requests.json');let rows=JSON.parse(readFileSync(file,'utf8'));assert.equal(rows.length,1);assert.equal(rows[0].identity,'A');assert.equal(rows[0].outcome,'response');
  rows[0].password=password;rows.push({platform:'unknown',password});writeFileSync(file,JSON.stringify(rows));recordAuthObservation({platform:'ios',operation:'user',identity:'not-applicable',status:200,outcome:'response',durationMs:1},directory);
  const raw=readFileSync(file,'utf8');assert.ok(!raw.includes(password)&&!raw.includes(email)&&!raw.includes('unknown'));assert.equal(JSON.parse(raw).length,2);
 }finally{await new Promise(resolve=>proxy.close(resolve));await new Promise(resolve=>upstream.close(resolve));rmSync(directory,{recursive:true,force:true});}
});

test('external browser observation accepts the measured 22.7-second cold start within a bounded minute',async()=>{
 const {awaitBrowserObservation,invoicePdfMatcher}=await import('../scripts/mobile-integration/browser-observations.mjs');const reference='document_'+'a'.repeat(32);let clock=0;
 const read=()=>clock>=22678?[{reference,platform:'ios',authorizationPresent:false}]:[];
 const options={now:()=>clock,sleep:async ms=>{clock+=ms;}};
 assert.equal(await awaitBrowserObservation(read,invoicePdfMatcher(reference),{...options,timeoutMs:20000}),false);assert.equal(clock,20000);
 clock=0;assert.equal(await awaitBrowserObservation(read,invoicePdfMatcher(reference),options),true);assert.equal(clock,23000);
});
test('external browser observation rejects missing, foreign, wrong-platform and credential-bearing requests',async()=>{
 const {awaitBrowserObservation,invoicePdfMatcher,handoffMatcher}=await import('../scripts/mobile-integration/browser-observations.mjs');const reference='document_'+'a'.repeat(32);let clock=0;
 const rows=[{reference:'document_'+'b'.repeat(32),platform:'ios',authorizationPresent:false},{reference,platform:'android',authorizationPresent:false},{reference,platform:'ios',authorizationPresent:true},{reference,platform:'ios'}];
 assert.equal(await awaitBrowserObservation(()=>rows,invoicePdfMatcher(reference),{now:()=>clock,sleep:async ms=>{clock+=ms;}}),false);assert.equal(clock,60000);
 const match=handoffMatcher('/dashboard/support');assert.equal(match({path:'/dashboard/contracts',platform:'ios',credentialPresent:false}),false);assert.equal(match({path:'/dashboard/support',platform:'android',credentialPresent:false}),false);assert.equal(match({path:'/dashboard/support',platform:'ios',credentialPresent:true}),false);assert.equal(match({path:'/dashboard/support',platform:'ios',credentialPresent:false}),true);
 assert.throws(()=>invoicePdfMatcher(undefined));assert.throws(()=>handoffMatcher('/unknown'));
});

test('repeated external handoff requires a new matching browser request after the snapshot',async()=>{
 const {awaitBrowserObservation,handoffMatcher}=await import('../scripts/mobile-integration/browser-observations.mjs');const matches=handoffMatcher('/dashboard/support');const row={path:'/dashboard/support',platform:'ios',credentialPresent:false};let clock=0;
 const options={afterCount:1,now:()=>clock,sleep:async ms=>{clock+=ms;}};
 assert.equal(await awaitBrowserObservation(()=>[row],matches,options),false);assert.equal(clock,60000);
 clock=0;assert.equal(await awaitBrowserObservation(()=>clock>=1500?[row,row]:[row],matches,options),true);assert.equal(clock,1500);
 clock=0;assert.equal(await awaitBrowserObservation(()=>[row,{...row,credentialPresent:true},{...row,path:'/dashboard/contracts'}],matches,options),false);assert.equal(clock,60000);
});
test('Maestro control script binds the browser baseline to its handoff kind',()=>{
 const vmScript=readFileSync(new URL('../scripts/mobile-integration/ios-control.js',import.meta.url),'utf8');
 const run=new Function('ACTION','output','http','CUSTOMER_ORIGIN','CONTROL_KEY','json',vmScript);const output={};const calls=[];
 const http={post:(_url,options)=>{calls.push(JSON.parse(options.body));return {status:200,body:JSON.stringify({passed:true,count:10,handoffCount:1})};}};
 run('snapshot-handoff-support',output,http,'https://synthetic.invalid','SYNTHETIC_CONTROL',JSON.parse);
 assert.throws(()=>run('assert-handoff-contracts',output,http,'https://synthetic.invalid','SYNTHETIC_CONTROL',JSON.parse),/Missing matching handoff baseline/);assert.equal(calls.length,1);
 run('assert-handoff-support',output,http,'https://synthetic.invalid','SYNTHETIC_CONTROL',JSON.parse);assert.deepEqual(calls.at(-1),{action:'assert-handoff-support',previous:1});
});

test('stale document journey reveals the cached action before disabling its upstream link',()=>{
 const source=readFileSync(new URL('../scripts/mobile-integration/ios-customer.yaml',import.meta.url),'utf8');
 const section=source.slice(source.indexOf('- takeScreenshot: "notification-read"'),source.indexOf('- takeScreenshot: "document-stale-link-denied"'));
 let actionVisible=false,disabled=false,denialVisible=false,attempts=0;
 for(const command of section.split(/\n(?=- )/)){
  if(command.startsWith('- scrollUntilVisible:')&&command.includes('element: "Öppna dokument i extern läsare"'))actionVisible=true;
  if(command.includes('ACTION: disable-document-b')){
   assert.ok(actionVisible,'The cached document action must be visible before upstream mutation');disabled=true;
  }
  if(/^- tapOn:(?: \"Öppna dokument i extern läsare\"|\n    text: \"Öppna dokument i extern läsare\")/.test(command)){
   assert.ok(actionVisible,'A row title in view does not make its action visible');assert.ok(disabled);attempts++;denialVisible=true;
  }
  if(command.includes('element: "Dokumentet kunde inte öppnas.*"'))assert.ok(denialVisible);
 }
 assert.equal(attempts,1);assert.ok(denialVisible);
});

test('restored document can be reached after refresh collapses or retains the scroll offset',()=>{
 const source=readFileSync(new URL('../scripts/mobile-integration/ios-customer.yaml',import.meta.url),'utf8');
 const section=source.slice(source.indexOf('      ACTION: restore-document-b'),source.indexOf('- extendedWaitUntil:\n    visible: ".*Synthetic Gridex document B.*"'));
 // run() clears rows before fetching. The old content can disappear and clamp
 // the native scroll offset to the top, then return below the current viewport.
 for(const initialOffset of [0,700,1500]){
  let offset=initialOffset,opened=false;
  const positions=new Map([['Mina sidor',0],['${DOCUMENT_B}',1300],['Öppna dokument i extern läsare',1500]]);
  function execute(text){
   for(const command of text.split(/\n(?=- )/)){
    if(command.startsWith('- runFlow:')&&command.includes('ios-customer-after-refresh.yaml')){
     const helper=readFileSync(new URL('../scripts/mobile-integration/ios-customer-after-refresh.yaml',import.meta.url),'utf8');
     execute(helper.slice(helper.indexOf('\n---\n')+5).replaceAll('${CUSTOMER_RESOURCE}','documents').replaceAll('${CUSTOMER_TARGET}','${DOCUMENT_B}'));
    }
    if(command.startsWith('- scrollUntilVisible:')){
     const target=/element: ["']?([^\n]+?)["']?\n/.exec(command+'\n')?.[1];
     if(!positions.has(target))continue;
     const y=positions.get(target),direction=/direction: (UP|DOWN)/.exec(command)?.[1];
     const visible=y>=offset&&y<offset+700;
     assert.ok(visible||(direction==='UP'?y<offset:y>=offset+700),`Cannot seek ${target} ${direction} from offset ${offset}`);
     offset=Math.max(0,y-100);
    }
    if(/^- tapOn:(?: \"Öppna dokument i extern läsare\"|\n    text: \"Öppna dokument i extern läsare\")/.test(command)){
     assert.ok(1500>=offset&&1500<offset+700,'The restored action must be reachable without replaying refresh');opened=true;
    }
   }
  }
  execute(section);assert.ok(opened);
 }
});

test('customer resource selection maps only known label/resource pairs',()=>{
 const source=readFileSync(new URL('../scripts/mobile-integration/ios-customer-resource.js',import.meta.url),'utf8');
 const run=new Function('CUSTOMER_RESOURCE','output',source);
 const labels={contracts:'Avtal',sites:'Anläggningar',invoices:'Fakturor',profile:'Profil',notifications:'Meddelanden',documents:'Dokument',powers:'Fullmakter',acceptances:'Godkännanden',support:'Support'};
 for(const [resource,label] of Object.entries(labels)){
  const output={previousOpsCount:42};run(resource,output);
  assert.equal(output.customerResourceLabel,label);assert.equal(output.customerResourceIdle,'customer-'+resource+'-idle');assert.equal(output.previousOpsCount,42);
 }
 for(const resource of ['__proto__','constructor','supportDetail','PRIVATE_CUSTOMER_ID',''])assert.throws(()=>run(resource,{}),/Unknown customer resource selection/);
});
