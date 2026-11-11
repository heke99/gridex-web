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

for(const outcome of [0,7])test('native UI runner requires evidence and preserves exit '+outcome,()=>{
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
  ${outcome===0?'printf \'<testsuite tests="1" failures="0"/>\' > "$7"':'true'}
  exit ${outcome}`);
  const result=spawnSync('bash',[new URL('../scripts/mobile-integration/ios-smoke.sh',import.meta.url).pathname],{env:{...process.env,PATH:bin+':'+process.env.PATH,RUNNER_TEMP:dir,GRIDEX_IOS_CUSTOMER_FLOW:'false'},encoding:'utf8'});
  assert.equal(result.status,outcome,result.stderr);
  assert.equal(existsSync(join(dir,'gridex-ios-artifacts/simulator-receipt.json')),outcome===0);
  if(outcome===0)assert.ok(existsSync(join(dir,'gridex-ios-artifacts/ui/results.xml')));
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
  execFileSync(process.execPath,[new URL('../scripts/mobile-integration/sanitize-evidence.mjs',import.meta.url).pathname,'ios',source,target],{env:{...process.env,RUNNER_TEMP:dir,LOGIN_A_PASSWORD:privateValue,CUSTOMER_A:customer}});
  const raw=readFileSync(join(target,'native-ui-state.json'),'utf8');const flags=JSON.parse(raw);
  assert.ok(Object.values(flags).every(value=>typeof value==='boolean'));
  assert.equal(flags.failureReported,true);assert.equal(flags.hierarchyAvailable,true);assert.equal(flags.knownReadErrorTextPresent,true);assert.equal(flags.loginHeadingPresent,true);assert.equal(flags.customerAReferencePresent,true);assert.equal(flags.customerBReferencePresent,false);assert.equal(flags.visibilityEstablished,false);
  assert.ok(!raw.includes(privateValue)&&!raw.includes(customer));assert.ok(!readFileSync(join(target,'results.xml'),'utf8').includes(privateValue));
  assert.ok(readFileSync(join(target,'driver-startup-attempt-1.log'),'utf8').includes('Bootstrap timeout'));
  assert.ok(!readFileSync(join(target,'driver-startup-attempt-1.log'),'utf8').includes(privateValue));
  assert.ok(!readFileSync(join(target,'driver-startup-attempt-1.log'),'utf8').includes('synthetic-startup-token'));
  assert.ok(!existsSync(join(target,'commands.json')));assert.ok(!existsSync(join(target,'step-005-inputText-private.json')));assert.ok(!existsSync(join(target,'step-005-inputText-private.png')));
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
