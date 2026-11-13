// Split the canonical matrix without dropping a command. This module uses only
// Node built-ins: the customer runner does not install the Web dependency tree.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {ANDROID_REFERENCE} from './qualified-android.mjs';

export const CASES=['core','support','market','session'];
const header='appId: se.gridex.el.dev\n---\n';
const supportStart='- runFlow:\n    file: ios-customer-resource.yaml\n    env:\n      CUSTOMER_RESOURCE: support\n';
const marketStart='- tapOn: "Förbrukning"\n';
const sessionStart='- tapOn: "Mer"\n- pressKey: Home\n- runScript:\n    file: ios-control.js\n    env:\n      ACTION: revoke-b\n';
const firstLoginEnd='- takeScreenshot: "a-contract"\n';
const sha=value=>createHash('sha256').update(value).digest('hex');

// Only these customer-only additions may differ in the production guest runner.
export const ORIGINAL_CUSTOMER_SETUP='  flow=scripts/mobile-integration/ios-customer.yaml\n';
export const SUITE_CUSTOMER_SETUP='  flow="$RUNNER_TEMP/gridex-ios-customer-suite"\n  test "$(cat "$RUNNER_TEMP/gridex-ios-simulator-id")" = "$simulator"\n  node scripts/mobile-integration/ios-customer-suite.mjs create "$flow"\n  environment+=(--config "$flow/config.yaml")\n';
export const SUITE_CUSTOMER_VERIFY='if test "${GRIDEX_IOS_CUSTOMER_FLOW:-false}" = true; then\n  node scripts/mobile-integration/ios-customer-suite.mjs report "$private_ui/results.xml" "$flow/suite-plan.json" "$out/customer-suite-result.json"\nfi\n';
export const SUITE_CUSTOMER_DIAGNOSTIC='  if test "${GRIDEX_IOS_CUSTOMER_FLOW:-false}" = true && ! test -s "$out/customer-suite-result.json"; then\n    node scripts/mobile-integration/ios-customer-suite.mjs report "$private_ui/results.xml" "$flow/suite-plan.json" "$out/customer-suite-result.json" || true\n  fi\n';
export const REUSE_STAMP='if test "${GRIDEX_IOS_CUSTOMER_FLOW:-false}" = true && test "${GRIDEX_IOS_CASE_REUSE:-false}" = true; then\n  node scripts/mobile-integration/ios-customer-suite.mjs stamp "$out/customer-suite-result.json" "$out/simulator-receipt.json"\nfi\n';
export function normalizedCustomerSmoke(source){
 if(source.includes(REUSE_STAMP)){assert.equal(source.split(REUSE_STAMP).length,2);source=source.replace(REUSE_STAMP,'');}
 assert.equal(typeof source,'string');
 if(source.includes(SUITE_CUSTOMER_SETUP)){
  assert.equal(source.split(SUITE_CUSTOMER_SETUP).length,2);
  assert.equal(source.split(SUITE_CUSTOMER_VERIFY).length,2);
  assert.equal(source.split(SUITE_CUSTOMER_DIAGNOSTIC).length,2);
  return source.replace(SUITE_CUSTOMER_SETUP,ORIGINAL_CUSTOMER_SETUP).replace(SUITE_CUSTOMER_VERIFY,'').replace(SUITE_CUSTOMER_DIAGNOSTIC,'');
 }
 assert.equal(source.split(ORIGINAL_CUSTOMER_SETUP).length,2);
 assert.ok(!source.includes(SUITE_CUSTOMER_VERIFY));
 return source;
}

function uniqueIndex(text,marker){
 assert.equal(text.split(marker).length,2,'Ambiguous or missing canonical matrix boundary');
 return text.indexOf(marker);
}
export function partitionMatrix(source){
 assert.ok(source.startsWith(header),'Unexpected canonical app/config header');
 const body=source.slice(header.length);
 const indexes=[uniqueIndex(body,supportStart),uniqueIndex(body,marketStart),uniqueIndex(body,sessionStart)];
 assert.ok(indexes[0]>0&&indexes[0]<indexes[1]&&indexes[1]<indexes[2]);
 const parts=[body.slice(0,indexes[0]),body.slice(indexes[0],indexes[1]),body.slice(indexes[1],indexes[2]),body.slice(indexes[2])];
 assert.ok(parts.every(p=>p.trim()));
 assert.equal(parts.join(''),body,'Canonical command partition must be lossless');
 return parts;
}

export function independentBSetup(core){
 const end=uniqueIndex(core,firstLoginEnd);
 let login=core.slice(0,end);
 assert.ok(login.startsWith('- launchApp:\n    clearState: true\n'));
 assert.equal((login.match(/\$\{LOGIN_A_EMAIL\}/g)??[]).length,2);
 assert.equal((login.match(/\$\{LOGIN_A_PASSWORD\}/g)??[]).length,1);
 assert.equal((login.match(/\$\{CONTRACT_A\}/g)??[]).length,1);
 assert.equal((login.match(/\$\{CUSTOMER_B\}/g)??[]).length,1);
 login=login.replaceAll('${LOGIN_A_EMAIL}','${LOGIN_B_EMAIL}').replaceAll('${LOGIN_A_PASSWORD}','${LOGIN_B_PASSWORD}').replaceAll('${CONTRACT_A}','${CONTRACT_B}').replaceAll('${CUSTOMER_B}','${CUSTOMER_A}');
 assert.ok(!/\$\{(?:LOGIN_A_|CONTRACT_A|CUSTOMER_B)/.test(login));
 // Maestro is always invoked with the newly created, recorded Simulator UDID.
 // clearKeychain resets that entire disposable simulator, never the host/device.
 return '- stopApp\n- clearKeychain\n'+
  '- runScript:\n    file: ios-control.js\n    env:\n      ACTION: reconnect\n'+
  '- runScript:\n    file: ios-control.js\n    env:\n      ACTION: reconnect-market\n'+login;
}

function absoluteHelpers(body,root){
 return body.replace(/^(\s*(?:- runFlow: |- runScript: |file: ))(ios-[a-z0-9.-]+\.(?:yaml|js))$/gm,(_match,prefix,file)=>{
  const path=resolve(root,file);assert.equal(dirname(path),resolve(root));assert.ok(existsSync(path),'Missing canonical helper');
  return prefix+JSON.stringify(path);
 });
}
export function buildSuite(source,{root,webCommit}){
 assert.match(webCommit??'',/^[a-f0-9]{40}$/);
 const parts=partitionMatrix(source),setup=independentBSetup(parts[0]);
 const files=Object.fromEntries(CASES.map((name,i)=>[name+'.yaml','appId: se.gridex.el.dev\nname: '+name+'\n---\n'+absoluteHelpers((i===0?'':setup)+parts[i],root)]));
 files['config.yaml']='flows:\n'+CASES.map(n=>'  - "'+n+'.yaml"\n').join('')+'executionOrder:\n  continueOnFailure: true\n  flowsOrder:\n'+CASES.map(n=>'    - '+n+'\n').join('');
 const plan={schema:'gridex.ios-customer-suite.v1',webCommit,expectedOpsSource:ANDROID_REFERENCE.ops,
  cases:CASES,canonicalSHA256:sha(source),canonicalPartitionLossless:true,
  originalCrossPhaseSessionCarryoverRetained:false,
  setup:'Core preserves A-to-B and lifecycle; other cases independently reset the owned Simulator and use ordinary verified B login. Network fault controls reset; documents are used only by Core and the owned database is destroyed on cleanup.',
  requiresOwnedDisposableSimulator:true,phaseSHA256:Object.fromEntries(CASES.map((n,i)=>[n,sha(parts[i])])),
  generatedSHA256:Object.fromEntries(CASES.map(n=>[n,sha(files[n+'.yaml'])]))};
 return {files,plan,parts,setup};
}

function attributes(text){
 const result={};for(const match of text.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g))result[match[1]]=match[3];return result;
}
export function inspectSuiteJUnit(xml,plan,webCommit){
 let planValid=false;
 try{
  assert.equal(plan?.schema,'gridex.ios-customer-suite.v1');assert.equal(plan.webCommit,webCommit);assert.match(webCommit??'',/^[a-f0-9]{40}$/);
  assert.deepEqual(plan.cases,CASES);assert.equal(plan.canonicalPartitionLossless,true);assert.equal(plan.expectedOpsSource,ANDROID_REFERENCE.ops);
  assert.match(plan.canonicalSHA256,/^[a-f0-9]{64}$/);assert.equal(plan.requiresOwnedDisposableSimulator,true);
  assert.equal(plan.originalCrossPhaseSessionCarryoverRetained,false);
  for(const name of CASES){assert.match(plan.phaseSHA256?.[name]??'',/^[a-f0-9]{64}$/);assert.match(plan.generatedSHA256?.[name]??'',/^[a-f0-9]{64}$/);}
  planValid=true;
 }catch{/* A diagnostic result is still written; it can never become PASS. */}
 const cases=[...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)].map(m=>({attributes:attributes(m[1]),body:m[2]??''}));
 const rows=CASES.map(name=>{
  const matches=cases.filter(c=>c.attributes.name===name),c=matches[0],a=c?.attributes??{},timestamp=Date.parse(a.timestamp);
  const reason=matches.length===0?'not-run':matches.length!==1?'duplicate':a.id!==name?'invalid-identity':/<skipped\b/i.test(c.body)?'skipped':/<(?:failure|error)\b/i.test(c.body)||a.status!=='SUCCESS'?'native-flow-error':!Number.isFinite(timestamp)?'invalid-timestamp':null;
  return {case:name,status:reason?(reason==='not-run'?'NOT_RUN':'FAIL'):'PASS',reason,startedAt:Number.isFinite(timestamp)?a.timestamp:null,timestamp};
 });
 const inOrder=rows.every((r,i)=>Number.isFinite(r.timestamp)&&(i===0||r.timestamp>=rows[i-1].timestamp));
 const declaredFailure=[...xml.matchAll(/<testsuite\b([^>]*)>/g)].some(m=>Number(attributes(m[1]).failures??0)!==0||Number(attributes(m[1]).errors??0)!==0);
 const passed=planValid&&cases.length===4&&rows.every(r=>r.status==='PASS')&&inOrder&&!declaredFailure&&!/<(?:failure|error|skipped)\b/i.test(xml);
 return {schema:'gridex.ios-customer-suite-result.v1',webCommit,expectedOpsSource:ANDROID_REFERENCE.ops,
  status:passed?'PASS':'FAIL',independentCases:true,unbrokenSingleJourney:false,
  uiFailureMarkersScope:'union-across-exported-failure-hierarchies; not a simultaneous foreground snapshot',
  canonicalSHA256:planValid?plan.canonicalSHA256:null,planValid,reportedCases:cases.length,executionOrderVerified:inOrder,
  results:rows.map(r=>({case:r.case,status:r.status,reason:r.reason,startedAt:r.startedAt}))};
}
export function verifySuiteJUnit(xml,plan,webCommit){const result=inspectSuiteJUnit(xml,plan,webCommit);assert.equal(result.status,'PASS','All four actual independent cases must pass in order');return result;}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 // Finish evaluating the library before a reuse adapter imports its exports.
 async function main(){
 const [command,...args]=process.argv.slice(2);
 if(command==='prepare'){
  await (await import('./ios-case-reuse.mjs')).prepare();
 }else if(command==='create'){
  const root=dirname(fileURLToPath(import.meta.url)),directory=resolve(args[0]??'');assert.ok(args[0]);
  assert.ok(!existsSync(directory)||readdirSync(directory).length===0,'Refuse stale generated suite');mkdirSync(directory,{recursive:true,mode:0o700});
  const {files,plan}=buildSuite(readFileSync(join(root,'ios-customer.yaml'),'utf8'),{root,webCommit:process.env.QUALIFICATION_WEB_COMMIT});
  for(const [name,body]of Object.entries(files))writeFileSync(join(directory,name),body,{mode:0o600});
  writeFileSync(join(directory,'suite-plan.json'),JSON.stringify(plan,null,2)+'\n',{mode:0o600});
  if(process.env.GRIDEX_IOS_CASE_REUSE==='true')await (await import('./ios-case-reuse.mjs')).createScoped(directory);
 }else if(command==='report'){
  let plan={};try{plan=JSON.parse(readFileSync(args[1],'utf8'));}catch{}
  const xml=existsSync(args[0])?readFileSync(args[0],'utf8'):'';
  const result=process.env.GRIDEX_IOS_CASE_REUSE==='true'?(await import('./ios-case-reuse.mjs')).compose(xml,plan,process.env.QUALIFICATION_WEB_COMMIT,JSON.parse(readFileSync(join(process.env.RUNNER_TEMP,'ios-case-reuse.json'),'utf8'))):inspectSuiteJUnit(xml,plan,process.env.QUALIFICATION_WEB_COMMIT);
  writeFileSync(args[2],JSON.stringify(result,null,2)+'\n');
  if(result.status!=='PASS')process.exitCode=1;
 }else if(command==='stamp'){
  const report=JSON.parse(readFileSync(args[0],'utf8')),receipt=JSON.parse(readFileSync(args[1],'utf8'));
  assert.equal(report.schema,'gridex.ios-composed-cases.v1');assert.equal(report.status,'PASS');assert.equal(report.webCommit,process.env.QUALIFICATION_WEB_COMMIT);
  receipt.authenticatedCoreCustomerFlowVerified=true;receipt.coreExecutedInThisRun=false;receipt.evidenceScope='two fresh cases plus two immutable source-equivalent reference cases';receipt.coreReference=report.reference;receipt.freshCases=['support','market'];receipt.reusedCases=['core','session'];
  writeFileSync(args[1],JSON.stringify(receipt,null,2)+'\n');
 }else throw Error('Unknown customer suite operation');
 }
 main().catch(error=>{console.error(error);process.exitCode=1;});
}
