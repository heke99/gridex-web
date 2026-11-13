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
  if(c.runFlow==='ios-resume-app.yaml'||JSON.stringify(c.launchApp)==='{"stopApp":false}'){out.push({activation:'foreground'});continue;}
  if(c.scrollUntilVisible?.element==='Hämta igen'){
   assert.ok(input[i+1].waitForAnimationToEnd);assert.equal(input[i+2].tapOn.text,'Hämta igen');out.push({read:'refresh'});i+=2;continue;
  }
  if(c.runFlow?.file==='ios-customer-refresh.yaml'){out.push({read:'refresh'});continue;}
  out.push(c);
 }return out;}
 assert.deepEqual(normalize(current),normalize(old));
 assert.equal(current.filter(c=>c?.extendedWaitUntil?.visible?.id==='customer-contracts-idle').length,2);assert.equal(current.filter(c=>c?.extendedWaitUntil?.visible?.text==='Logga in').length,2);assert.equal(current.filter(c=>c?.scrollUntilVisible?.element==='Lösenord').length,2);
 assert.deepEqual(current.filter(c=>c?.runFlow?.file==='ios-customer-refresh.yaml').map(c=>c.runFlow.env.CUSTOMER_RESOURCE),['invoiceDetail','invoiceDetail','profile','notifications','documents','supportDetail','support']);
});

test('iOS read refresh retries only a bounded idempotent read after viewport relocation',()=>{
 const [retry]=commands(read('scripts/mobile-integration/ios-customer-refresh.yaml'));assert.equal(retry.retry.maxRetries,2);
 const steps=retry.retry.commands;assert.deepEqual(steps.map(c=>Object.keys(c)[0]),['extendedWaitUntil','scrollUntilVisible','takeScreenshot','scrollUntilVisible','takeScreenshot','tapOn']);
 assert.equal(steps[0].extendedWaitUntil.visible.id,'customer-${CUSTOMER_RESOURCE}-idle');assert.equal(steps[1].scrollUntilVisible.element,'Mina sidor');assert.equal(steps[1].scrollUntilVisible.direction,'UP');assert.equal(steps[3].scrollUntilVisible.element,'Hämta igen');assert.equal(steps[3].scrollUntilVisible.centerElement,false);assert.equal(steps[3].scrollUntilVisible.timeout,60000);assert.equal(steps[3].scrollUntilVisible.waitToSettleTimeoutMs,500);assert.deepEqual(steps[5].tapOn,{text:'Hämta igen',retryTapIfNoChange:false});
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
