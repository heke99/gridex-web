import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
  if(c.takeScreenshot==='customer-resource-target')continue;
  if(c.assertNotVisible==='Hämtar kunduppgifter'&&input[i-1]?.scrollUntilVisible?.element==='52 hämtade ärenden')continue;
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
 const input={paths:['scripts/mobile-integration/ios-customer.yaml','scripts/mobile-integration/ios-customer-refresh.yaml','.github/workflows/mobile-ios-qualification.yml'],referenceGateway:execFileSync('git',['show',ref.source+':'+gateway],{encoding:'utf8'}),currentGateway:read(gateway),referenceWorkflow:execFileSync('git',['show',ref.source+':'+workflow],{encoding:'utf8'}),currentWorkflow:read(workflow),ops:ref.ops};
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
  for(const i of edits){const expected=flow[i-2]?.tapOn?.text==='Ärendets rubrik'?{text:value,below:'Nytt ärende'}:value;assert.deepEqual(flow[i+1],{assertVisible:expected});assert.deepEqual(flow[i+2],{takeScreenshot:'customer-resource-target'});}
 }
 for(const label of ['Sök bland hämtade ärenden','Ärendets rubrik','Meddelande till kundservice'])for(const [i,c]of flow.entries())if(c?.tapOn?.text===label)assert.deepEqual(flow[i+1],{waitForAnimationToEnd:{timeout:5000}});
 for(const title of ['${SUPPORT_LAST_B}','${SUPPORT_B}'])assert.equal(flow.filter(c=>c?.scrollUntilVisible?.element?.text===title&&c.scrollUntilVisible.element.below==='Visar 1 av 52 hämtade poster').length,1);
 assert.equal(flow.filter(c=>c?.scrollUntilVisible?.element?.text==='Synthetic iOS new B'&&c.scrollUntilVisible.element.below==='Visar [0-9]+ av [0-9]+ hämtade poster').length,1);
 for(const label of ['Skapa ärende','Skicka svar']){const i=flow.findIndex(c=>c?.tapOn?.text===label);assert.deepEqual(flow[i-1],{extendedWaitUntil:{visible:{text:label,enabled:true},timeout:30000}});}
 const prices=flow.flatMap((c,i)=>typeof c?.scrollUntilVisible?.element==='string'&&c.scrollUntilVisible.element.startsWith('${output.market')?[i]:[]);assert.equal(prices.length,7);for(const i of prices)assert.deepEqual(flow[i-1],{scrollUntilVisible:{element:'Spotpriser',direction:'UP',timeout:60000}});
 const revoked=flow.findIndex(c=>c?.takeScreenshot==='invalidated-session-foreground');const state=flow[revoked+1].extendedWaitUntil;assert.equal(state.timeout,60000);const pattern=new RegExp('^'+state.visible.id+'$');for(const r of ['contracts','support','supportDetail','invoiceDetail','consumption']){assert.equal(pattern.test('customer-'+r+'-idle'),true);assert.equal(pattern.test('customer-'+r+'-loading'),false);}assert.equal(pattern.test('customer-foreign-idle'),false);assert.deepEqual(flow[revoked+2],{assertNotVisible:'Försök logga ut igen'});assert.equal(flow[revoked+3],'stopApp');
});
