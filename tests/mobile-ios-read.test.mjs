import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CASES,partitionMatrix,buildSuite,inspectSuiteJUnit,verifySuiteJUnit,normalizedCustomerSmoke,SUITE_CUSTOMER_DIAGNOSTIC} from '../scripts/mobile-integration/ios-customer-suite.mjs';
import {execFileSync} from 'node:child_process';
import yaml from 'js-yaml';
import {ANDROID_REFERENCE as ref} from '../scripts/mobile-integration/qualified-android.mjs';
import {IOS_PRODUCTION_REFERENCE as iosRef,canReuseIosProduction,assertIosProductionMetadata} from '../scripts/mobile-integration/production-ios-reuse.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const commands=text=>{const docs=[];yaml.loadAll(text,value=>docs.push(value));return docs[1];};

test('iOS read refresh preserves every original action, positive readback and isolation assertion',()=>{
 const path='scripts/mobile-integration/ios-customer.yaml',old=commands(execFileSync('git',['show',ref.source+':'+path],{encoding:'utf8'})),current=commands(read(path));
 function normalize(input){const out=[];for(let i=0;i<input.length;i++){
  const c=input[i];if(typeof c!=='object'||c===null){out.push(c);continue;}
  if(c.extendedWaitUntil?.visible?.id==='customer-contracts-idle'&&input[i+1]?.scrollUntilVisible?.element==='E-post'){assert.equal(c.extendedWaitUntil.timeout,60000);continue;}
  if(c.scrollUntilVisible?.element==='Lösenord'){
   assert.equal(c.scrollUntilVisible.centerElement,true);assert.equal(c.scrollUntilVisible.timeout,60000);assert.deepEqual(input[i+1],{waitForAnimationToEnd:{timeout:5000}});assert.deepEqual(input[i+2],{tapOn:{text:'Lösenord',retryTapIfNoChange:false}});out.push({tapOn:'Lösenord'});i+=2;continue;
  }
  if(c.extendedWaitUntil?.visible?.text==='Logga in'){assert.deepEqual(c.extendedWaitUntil,{visible:{text:'Logga in',enabled:true},timeout:30000});assert.equal(input[i+1]?.tapOn?.text,'Logga in');continue;}
  if(c.extendedWaitUntil?.visible?.id?.startsWith('customer-(')&&input[i+1]?.assertNotVisible==='Försök logga ut igen'&&input[i+2]==='stopApp'){assert.equal(c.extendedWaitUntil.timeout,60000);i++;continue;}
  if(['Skicka svar','Skapa ärende'].includes(c.extendedWaitUntil?.visible?.text)){assert.equal(c.extendedWaitUntil.visible.enabled,true);assert.equal(c.extendedWaitUntil.timeout,30000);assert.equal(input[i+1]?.tapOn?.text,c.extendedWaitUntil.visible.text);continue;}
  if(['${SUPPORT_B}','${SUPPORT_LAST_B}','Synthetic iOS new B'].includes(c.assertVisible))continue;
  if(c.assertVisible?.text==='Synthetic iOS new B'){assert.equal(c.assertVisible.below,'Nytt ärende');continue;}
  if(['customer-resource-target'].includes(c.takeScreenshot))continue;
  if(c.scrollUntilVisible?.element==='Rensa sökning och filter'&&c.scrollUntilVisible.direction==='DOWN'&&input[i+3]?.scrollUntilVisible?.element==='Mina sidor'&&input[i+4]?.scrollUntilVisible?.element==='Sök bland hämtade ärenden'){assert.equal(input[i+2]?.tapOn?.text,'Rensa sökning och filter');i+=2;continue;}
  if(c.extendedWaitUntil?.visible==='Elpriserna kunde inte hämtas. Försök igen.'){out.push({requiredVisible:c.extendedWaitUntil.visible});continue;}
  if(c.assertNotVisible==='Hämtar kunduppgifter'&&input[i-1]?.scrollUntilVisible?.element==='52 hämtade ärenden')continue;
  if(c.launchApp?.appId==='com.apple.mobilesafari'){assert.deepEqual(c.launchApp,{appId:'com.apple.mobilesafari',stopApp:false});assert.equal(input[i-1]?.tapOn?.text,'Öppna dokument i extern läsare');assert.equal(input[i+2]?.takeScreenshot,'document-external-pdf');assert.equal(input[i+3]?.extendedWaitUntil?.visible,'.*Synthetic Gridex document B.*');continue;}
  if(c.takeScreenshot==='document-external-pdf')continue;
  if(c.runFlow==='ios-resume-app.yaml'||JSON.stringify(c.launchApp)==='{"stopApp":false}'){out.push({activation:'foreground'});continue;}
  if(c.scrollUntilVisible?.element==='Hämta igen'){
   assert.ok(input[i+1].waitForAnimationToEnd);assert.equal(input[i+2].tapOn.text,'Hämta igen');out.push({read:'refresh'});i+=2;continue;
  }
  if(c.runFlow?.file==='ios-customer-refresh.yaml'){out.push({read:'refresh'});continue;}
  if(c.waitForAnimationToEnd)continue;
  if(c.scrollUntilVisible){
   const e=c.scrollUntilVisible.element;
   if(['Mina sidor','Spotpriser','52 hämtade ärenden'].includes(e))continue;
   if(e?.text==='Synthetic iOS new B'&&e.below==='Visar [0-9]+ av [0-9]+ hämtade poster')continue;
   if(['${SUPPORT_B}','${SUPPORT_LAST_B}'].includes(e?.text)){assert.equal(e.below,'Visar 1 av 52 hämtade poster');out.push({requiredVisible:e.text});continue;}
   out.push({requiredVisible:e});continue;
  }
  out.push(c);
 }return out;}
 assert.deepEqual(normalize(current),normalize(old));
 assert.equal(current.filter(c=>c?.extendedWaitUntil?.visible?.id==='customer-contracts-idle').length,2);assert.equal(current.filter(c=>c?.extendedWaitUntil?.visible?.text==='Logga in').length,2);assert.equal(current.filter(c=>c?.scrollUntilVisible?.element==='Lösenord').length,2);
 assert.deepEqual(current.filter(c=>c?.runFlow?.file==='ios-customer-refresh.yaml').map(c=>c.runFlow.env.CUSTOMER_RESOURCE),['invoiceDetail','invoiceDetail','profile','notifications','documents','supportDetail','support']);
});

test('iOS read refresh retries only a bounded idempotent read after viewport relocation',()=>{
 const [retry]=commands(read('scripts/mobile-integration/ios-customer-refresh.yaml'));assert.equal(retry.retry.maxRetries,2);
 const steps=retry.retry.commands;assert.deepEqual(steps.map(c=>Object.keys(c)[0]),['runFlow','scrollUntilVisible','takeScreenshot','scrollUntilVisible','extendedWaitUntil','takeScreenshot','tapOn']);
 assert.equal(steps[0].runFlow.when.true,"${CUSTOMER_RESOURCE !== 'support' && CUSTOMER_RESOURCE !== 'supportDetail'}");assert.equal(steps[0].runFlow.commands[0].extendedWaitUntil.visible.id,'customer-${CUSTOMER_RESOURCE}-idle');assert.equal(steps[0].runFlow.commands[0].extendedWaitUntil.timeout,30000);assert.equal(steps[1].scrollUntilVisible.element,'Mina sidor');assert.equal(steps[1].scrollUntilVisible.direction,'UP');assert.equal(steps[3].scrollUntilVisible.element,'Hämta igen');assert.equal(steps[3].scrollUntilVisible.centerElement,false);assert.equal(steps[3].scrollUntilVisible.timeout,60000);assert.equal(steps[3].scrollUntilVisible.waitToSettleTimeoutMs,500);assert.deepEqual(steps[4].extendedWaitUntil,{visible:{text:'Hämta igen',enabled:true},timeout:30000});assert.deepEqual(steps[6].tapOn,{text:'Hämta igen',retryTapIfNoChange:false});
 function simulate(shifts){let attempts=0,reads=0;
  for(let attempt=0;attempt<=retry.retry.maxRetries;attempt++){
   attempts++;let offset=0;
   try{
    for(const c of steps){
     if(c.scrollUntilVisible?.element==='Mina sidor')offset=0;
     if(c.scrollUntilVisible?.element==='Hämta igen')offset=800;
     if(c.tapOn){if(shifts===Infinity||attempt<shifts)offset=0;assert.ok(1000>=offset&&1000<offset+500,'Read target moved outside the viewport');reads++;}
    }
    return {attempts,reads};
   }catch{if(attempt===retry.retry.maxRetries)throw Error('Bounded read activation failed');}
  }
 }
 assert.deepEqual(simulate(0),{attempts:1,reads:1});assert.deepEqual(simulate(1),{attempts:2,reads:1});assert.throws(()=>simulate(Infinity),/Bounded read activation failed/);
});

test('iOS production reuse requires unchanged runtime and the exact reviewed production recipe',()=>{
 const gateway='scripts/mobile-integration/device-gateway.mjs',workflow='.github/workflows/mobile-customer-qualification.yml';
 const input={paths:['scripts/mobile-integration/ios-customer.yaml','scripts/mobile-integration/ios-customer-refresh.yaml','.github/workflows/mobile-ios-qualification.yml'],referenceGateway:execFileSync('git',['show',ref.source+':'+gateway],{encoding:'utf8'}),currentGateway:read(gateway),referenceWorkflow:execFileSync('git',['show',ref.source+':'+workflow],{encoding:'utf8'}),currentWorkflow:read(workflow),referenceIosSmoke:execFileSync('git',['show',ref.source+':scripts/mobile-integration/ios-smoke.sh'],{encoding:'utf8'}),currentIosSmoke:read('scripts/mobile-integration/ios-smoke.sh'),ops:ref.ops};
 const production=read('.github/workflows/mobile-ios-qualification.yml');assert.equal(canReuseIosProduction(input,production),true);
 for(const path of ['apps/mobile/App.tsx','scripts/mobile-integration/ios-build.sh','scripts/mobile-integration/ios-smoke.yaml'])assert.equal(canReuseIosProduction({...input,paths:[path]},production),false);
 assert.equal(canReuseIosProduction(input,production.replace('https://gridex.se','https://unapproved.invalid')),false);
});

test('iOS production reuse rejects failed, expired, foreign and substituted reference metadata',()=>{
 const run={id:iosRef.run,head_sha:iosRef.source,status:'completed',conclusion:'success'},artifact={id:iosRef.artifact,name:'gridex-ios-simulator',expired:false,workflow_run:{id:iosRef.run,head_sha:iosRef.source},digest:'sha256:'+iosRef.digest};assertIosProductionMetadata(run,artifact);
 for(const change of [x=>x.conclusion='failure',x=>x.head_sha='foreign',x=>x.status='in_progress']){const copy={...run};change(copy);assert.throws(()=>assertIosProductionMetadata(copy,artifact));}
 for(const change of [x=>x.expired=true,x=>x.digest='sha256:foreign',x=>x.workflow_run.head_sha='foreign',x=>x.id++]){const copy=structuredClone(artifact);change(copy);assert.throws(()=>assertIosProductionMetadata(run,copy));}
});


test('iOS read refresh uses positive support content without changing any other resource readiness',()=>{
 const path='scripts/mobile-integration/ios-customer-resource.yaml',old=commands(execFileSync('git',['show',ref.source+':'+path],{encoding:'utf8'})),current=commands(read(path));
 assert.deepEqual(current.slice(0,6),old.slice(0,6));
 assert.deepEqual(current[6],{waitForAnimationToEnd:{timeout:5000}});assert.deepEqual(current[7],{takeScreenshot:'customer-resource-target'});
 assert.equal(current[8].runFlow.when.true,"${CUSTOMER_RESOURCE === 'support'}");
 assert.deepEqual(current[8].runFlow.commands,[{scrollUntilVisible:{element:'Sök bland hämtade ärenden',direction:'DOWN',timeout:60000}},{assertNotVisible:'Hämtar kunduppgifter'}]);
 assert.equal(current[9].runFlow.when.true,"${CUSTOMER_RESOURCE !== 'support'}");assert.deepEqual(current[9].runFlow.commands,[old[6]]);
 const after='scripts/mobile-integration/ios-customer-after-refresh.yaml',previous=commands(execFileSync('git',['show',ref.source+':'+after],{encoding:'utf8'})),next=commands(read(after));
 assert.equal(next[0].runFlow.when.true,"${CUSTOMER_RESOURCE !== 'support' && CUSTOMER_RESOURCE !== 'supportDetail'}");assert.deepEqual(next[0].runFlow.commands,[previous[0]]);assert.deepEqual(next.slice(1,3),previous.slice(1));assert.deepEqual(next[3],{assertNotVisible:'Hämtar kunduppgifter'});
});


test('iOS read refresh remainder requires settled exact inputs, real list rows and completed cleanup',()=>{
 const flow=commands(read('scripts/mobile-integration/ios-customer.yaml'));
 const more=flow.findIndex(c=>c?.tapOn?.text==='Visa fler ärenden');assert.deepEqual(flow[more+1],{scrollUntilVisible:{element:'52 hämtade ärenden',direction:'UP',timeout:60000}});assert.deepEqual(flow[more+2],{assertNotVisible:'Hämtar kunduppgifter'});
 for(const value of ['${SUPPORT_B}','${SUPPORT_LAST_B}','Synthetic iOS new B']){
  const edits=flow.flatMap((c,i)=>c?.inputText===value?[i]:[]);assert.equal(edits.length,value==='${SUPPORT_LAST_B}'?1:2);
  for(const i of edits){if(value==='${SUPPORT_LAST_B}'){assert.deepEqual(flow[i+1],{takeScreenshot:'customer-resource-target'});assert.deepEqual(flow[i+2],{runFlow:'ios-dismiss-keyboard.yaml'});continue;}const expected=flow[i-2]?.tapOn?.text==='Ärendets rubrik'?{text:value,below:'Nytt ärende'}:value;assert.deepEqual(flow[i+1],{assertVisible:expected});assert.deepEqual(flow[i+2],{takeScreenshot:'customer-resource-target'});}
 }
 for(const label of ['Sök bland hämtade ärenden','Ärendets rubrik','Meddelande till kundservice'])for(const [i,c]of flow.entries())if(c?.tapOn?.text===label)assert.deepEqual(flow[i+1],{waitForAnimationToEnd:{timeout:5000}});
 for(const title of ['${SUPPORT_LAST_B}','${SUPPORT_B}'])assert.equal(flow.filter(c=>c?.scrollUntilVisible?.element?.text===title&&c.scrollUntilVisible.element.below==='Visar 1 av 52 hämtade poster').length,1);
 assert.equal(flow.filter(c=>c?.scrollUntilVisible?.element?.text==='Synthetic iOS new B'&&c.scrollUntilVisible.element.below==='Visar [0-9]+ av [0-9]+ hämtade poster').length,1);
 for(const label of ['Skapa ärende','Skicka svar']){const i=flow.findIndex(c=>c?.tapOn?.text===label);assert.deepEqual(flow[i-1],{extendedWaitUntil:{visible:{text:label,enabled:true},timeout:30000}});}
 const prices=flow.flatMap((c,i)=>typeof c?.scrollUntilVisible?.element==='string'&&c.scrollUntilVisible.element.startsWith('${output.market')?[i]:[]);assert.equal(prices.length,7);for(const i of prices)assert.deepEqual(flow[i-1],{scrollUntilVisible:{element:'Spotpriser',direction:'UP',timeout:60000}});
 const revoked=flow.findIndex(c=>c?.takeScreenshot==='invalidated-session-foreground');const state=flow[revoked+1].extendedWaitUntil;assert.equal(state.timeout,60000);const pattern=new RegExp('^'+state.visible.id+'$');for(const r of ['contracts','support','supportDetail','invoiceDetail','consumption']){assert.equal(pattern.test('customer-'+r+'-idle'),true);assert.equal(pattern.test('customer-'+r+'-loading'),false);}assert.equal(pattern.test('customer-foreign-idle'),false);assert.deepEqual(flow[revoked+2],{assertNotVisible:'Försök logga ut igen'});assert.equal(flow[revoked+3],'stopApp');
});


const suiteRoot=fileURLToPath(new URL('../scripts/mobile-integration/',import.meta.url));
const testSource='a'.repeat(40);
const suite=()=>buildSuite(read('scripts/mobile-integration/ios-customer.yaml'),{root:suiteRoot,webCommit:testSource});
const junit=(entries=CASES.map((name,i)=>({name,status:'SUCCESS',time:`2026-11-13T10:0${i}:00`,body:''})))=>'<testsuites><testsuite tests="4" failures="0">'+entries.map(x=>`<testcase id="${x.name}" name="${x.name}" status="${x.status}" timestamp="${x.time}">${x.body??''}</testcase>`).join('')+'</testsuite></testsuites>';

test('iOS read refresh suite partitions every canonical command exactly once and runs all four cases in order',()=>{
 const source=read('scripts/mobile-integration/ios-customer.yaml'),built=suite();assert.equal(partitionMatrix(source).join(''),source.slice(source.indexOf('---\n')+4));
 assert.equal(built.plan.canonicalPartitionLossless,true);assert.equal(built.plan.originalCrossPhaseSessionCarryoverRetained,false);
 const config=yaml.load(built.files['config.yaml']);assert.deepEqual(config.flows,CASES.map(n=>n+'.yaml'));assert.deepEqual(config.executionOrder,{continueOnFailure:true,flowsOrder:CASES});
 for(const name of CASES){const docs=[];yaml.loadAll(built.files[name+'.yaml'],x=>docs.push(x));assert.equal(docs[0].appId,'se.gridex.el.dev');assert.equal(docs[0].name,name);assert.ok(docs[1].length>0);assert.match(built.plan.generatedSHA256[name],/^[a-f0-9]{64}$/);}
 assert.ok(!built.setup.includes('a-contract'));assert.ok(!built.setup.includes('${LOGIN_A_EMAIL}'));assert.ok(!built.setup.includes('${LOGIN_A_PASSWORD}'));assert.ok(!built.setup.includes('${CONTRACT_A}'));assert.ok(!built.setup.includes('${CUSTOMER_B}'));
 for(const marker of ['${LOGIN_B_EMAIL}','${LOGIN_B_PASSWORD}','${CONTRACT_B}','${CUSTOMER_A}'])assert.ok(built.setup.includes(marker));assert.ok(built.setup.startsWith('- stopApp\n- clearKeychain\n'));assert.ok(built.setup.includes('ACTION: reconnect\n'));assert.ok(built.setup.includes('ACTION: reconnect-market\n'));
 for(const name of ['support','market','session'])assert.ok(!/disable-document-b|restore-document-b|CUSTOMER_RESOURCE: documents/.test(built.parts[CASES.indexOf(name)]));
 assert.throws(()=>partitionMatrix(source+source.slice(source.indexOf('- tapOn: "Förbrukning"'))),/Ambiguous/);
});

test('iOS read refresh suite acceptance requires all four actual successful cases and ordered revocation',()=>{
 const {plan}=suite(),xml=junit();assert.equal(verifySuiteJUnit(xml,plan,testSource).status,'PASS');
 const base=CASES.map((name,i)=>({name,status:'SUCCESS',time:`2026-11-13T10:0${i}:00`}));
 const mutations=[base.slice(0,3),[...base,base[0]],base.map((x,i)=>i?x:{...x,status:'ERROR',body:'<failure>synthetic</failure>'}),base.map((x,i)=>i?x:{...x,body:'<skipped/>'}),base.map(x=>x.name==='session'?{...x,time:'2026-11-13T09:00:00'}:x),base.map((x,i)=>i?x:{...x,name:'unexpected'})];
 for(const changed of mutations){const report=inspectSuiteJUnit(junit(changed),plan,testSource);assert.equal(report.status,'FAIL');assert.throws(()=>verifySuiteJUnit(junit(changed),plan,testSource));}
 assert.equal(inspectSuiteJUnit(xml.replace('failures="0"','failures="1"'),plan,testSource).status,'FAIL');assert.equal(inspectSuiteJUnit(xml,plan,'b'.repeat(40)).status,'FAIL');
 const partial=inspectSuiteJUnit(junit(mutations[2]),plan,testSource);assert.equal(partial.results.find(r=>r.case==='core').status,'FAIL');assert.equal(partial.results.find(r=>r.case==='support').status,'PASS');assert.equal(partial.status,'FAIL');
});

test('iOS read refresh suite preserves the complete production guest recipe and Android waiter branches',()=>{
 const reference=execFileSync('git',['show',ref.source+':scripts/mobile-integration/ios-smoke.sh'],{encoding:'utf8'}),current=read('scripts/mobile-integration/ios-smoke.sh');assert.equal(normalizedCustomerSmoke(current),reference);assert.throws(()=>normalizedCustomerSmoke(current.replace(SUITE_CUSTOMER_DIAGNOSTIC,'')));
 const oldWaiter=execFileSync('git',['show',ref.source+':scripts/mobile-integration/await-artifact.mjs'],{encoding:'utf8'});assert.equal(read('scripts/mobile-integration/await-artifact.mjs'),oldWaiter.replace("name==='ios-customer-terminal'?60:","name==='ios-customer-terminal'?90:"));
 const workflow='.github/workflows/mobile-customer-qualification.yml',gateway='scripts/mobile-integration/device-gateway.mjs';const jobConfig=yaml.load(read(workflow)).jobs;assert.equal(jobConfig['ios-customer']['timeout-minutes'],90);assert.equal(jobConfig['customer-stack']['timeout-minutes'],105);const input={paths:['scripts/mobile-integration/ios-smoke.sh','scripts/mobile-integration/ios-customer-suite.mjs','scripts/mobile-integration/await-artifact.mjs'],ops:ref.ops,referenceGateway:execFileSync('git',['show',ref.source+':'+gateway],{encoding:'utf8'}),currentGateway:read(gateway),referenceWorkflow:execFileSync('git',['show',ref.source+':'+workflow],{encoding:'utf8'}),currentWorkflow:read(workflow),referenceIosSmoke:reference,currentIosSmoke:current};const prod=read('.github/workflows/mobile-ios-qualification.yml');assert.equal(canReuseIosProduction(input,prod),true);
 assert.equal(canReuseIosProduction({...input,currentIosSmoke:current.replace('--format junit','--format broken')},prod),false);
});

test('iOS read refresh suite writes explicit NOT_RUN diagnostics for missing JUnit without a PASS receipt',()=>{
 const directory=mkdtempSync(join(tmpdir(),'gridex-suite-regression-'));try{
  const {plan}=suite();writeFileSync(join(directory,'plan.json'),JSON.stringify(plan));let failed=false;
  try{execFileSync(process.execPath,['scripts/mobile-integration/ios-customer-suite.mjs','report',join(directory,'missing.xml'),join(directory,'plan.json'),join(directory,'result.json')],{env:{...process.env,GRIDEX_IOS_CASE_REUSE:'false',QUALIFICATION_WEB_COMMIT:testSource},stdio:'pipe'});}catch(error){assert.equal(error.status,1);failed=true;}
  assert.equal(failed,true);const report=JSON.parse(readFileSync(join(directory,'result.json'),'utf8'));assert.equal(report.status,'FAIL');assert.equal(report.reportedCases,0);assert.equal(report.results.length,4);assert.ok(report.results.every(r=>r.status==='NOT_RUN'));assert.match(report.uiFailureMarkersScope,/union/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
