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
  for(const name of ['curl','shasum','unzip','defaults'])executable(join(bin,name),'exit 0');
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

for(const extra of [{LOGIN_A_PASSWORD:'SYNTHETIC_DIAGNOSTIC_SECRET'},{GRIDEX_IOS_CUSTOMER_FLOW:'true'}])test('keyboard diagnostics reject private or authenticated flow inputs '+Object.keys(extra)[0],()=>{
 const directory=mkdtempSync(join(tmpdir(),'gridex-diag-scope-'));
 try{
  const result=spawnSync('bash',[new URL('../scripts/mobile-integration/ios-smoke.sh',import.meta.url).pathname],{env:{...process.env,RUNNER_TEMP:directory,GRIDEX_IOS_DIAGNOSTIC:'true',...extra},encoding:'utf8'});
  assert.equal(result.status,1);assert.ok(result.stderr.includes('Keyboard diagnostics'));assert.ok(!result.stderr.includes('SYNTHETIC_DIAGNOSTIC_SECRET'));
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('raw UI evidence is limited to guarded invalid-form diagnostics',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gridex-diag-evidence-'));
 try{
  const input=join(dir,'input');mkdirSync(input);writeFileSync(join(input,'failure.png'),'INVALID_FORM_IMAGE');writeFileSync(join(input,'commands.json'),'[]');
  const run=(target,extra)=>spawnSync(process.execPath,[new URL('../scripts/mobile-integration/sanitize-evidence.mjs',import.meta.url).pathname,'ios',input,join(dir,target)],{env:{...process.env,RUNNER_TEMP:dir,...extra},encoding:'utf8'});
  assert.equal(run('ordinary',{GRIDEX_IOS_DIAGNOSTIC:'false'}).status,0);assert.equal(existsSync(join(dir,'ordinary/failure.png')),false);
  assert.equal(run('invalid-only',{GRIDEX_IOS_DIAGNOSTIC:'true'}).status,0);assert.ok(existsSync(join(dir,'invalid-only/failure.png')));assert.ok(existsSync(join(dir,'invalid-only/commands.json')));
  const blocked=run('private',{GRIDEX_IOS_DIAGNOSTIC:'true',LOGIN_A_PASSWORD:'SYNTHETIC_DO_NOT_EXPORT'});assert.notEqual(blocked.status,0);assert.equal(existsSync(join(dir,'private/failure.png')),false);assert.ok(!blocked.stderr.includes('SYNTHETIC_DO_NOT_EXPORT'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
