// Production binaries and guest UI are already verified on the same product
// sources. Do not rebuild them for customer-only Maestro/fixture changes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {canReuseAndroid,qualifiedSourceInputs,referenceRead} from './qualified-android.mjs';
import {normalizedCustomerSmoke} from './ios-customer-suite.mjs';
export const IOS_PRODUCTION_REFERENCE={source:'b270ddf792f889dc0a05e4a83bc73954b5e12fef',run:43317701158,artifact:13990897235,digest:'3e207110fd41ffe5e9fd46f022d8aeeeb7d3a68d779c9cce5903870e5e22317d'};
export const APPROVED_IOS_PRODUCTION_WORKFLOW='5bd7de6dfe206e216b2b79cb83670d54c6b9f1e0c79bb7a6b274b146b463bda9';
export function canReuseIosProduction(inputs,workflow){
 try{return canReuseAndroid(inputs)&&typeof workflow==='string'&&createHash('sha256').update(workflow).digest('hex')===APPROVED_IOS_PRODUCTION_WORKFLOW&&typeof inputs.referenceIosSmoke==='string'&&normalizedCustomerSmoke(inputs.currentIosSmoke)===inputs.referenceIosSmoke;}catch{return false;}
}
export function assertIosProductionMetadata(run,artifact){
 const r=IOS_PRODUCTION_REFERENCE;
 assert.equal(run?.id,r.run);assert.equal(run.head_sha,r.source);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
 assert.equal(artifact?.id,r.artifact);assert.equal(artifact.name,'gridex-ios-simulator');assert.equal(artifact.expired,false);assert.equal(artifact.workflow_run?.id,r.run);assert.equal(artifact.workflow_run.head_sha,r.source);assert.equal(artifact.digest,'sha256:'+r.digest);
}
async function prepare(target){
 const inputs=qualifiedSourceInputs(),workflow=readFileSync('.github/workflows/mobile-ios-qualification.yml','utf8');
 if(!canReuseIosProduction(inputs,workflow)){appendFileSync(process.env.GITHUB_OUTPUT,'approved=false\n');console.log('iOS production inputs changed; a new production qualification is required.');return;}
 try{
  assert.equal(process.env.GITHUB_REPOSITORY,'heke99/gridex-web');
  const r=IOS_PRODUCTION_REFERENCE;
  const [run,artifact]=await Promise.all([
   referenceRead(['api','repos/heke99/gridex-web/actions/runs/'+r.run],{encoding:'utf8',timeout:20000}),
   referenceRead(['api','repos/heke99/gridex-web/actions/artifacts/'+r.artifact],{encoding:'utf8',timeout:20000})
  ]);
  assertIosProductionMetadata(JSON.parse(run),JSON.parse(artifact));
  const receipt={status:'PASS_REUSED',currentSource:inputs.source,productionSourcesEquivalent:true,reference:r,workflowSHA256:APPROVED_IOS_PRODUCTION_WORKFLOW,newBinaryBuilt:false,guestUiRetested:false,distributionSigned:false,testFlightVerified:false,physicalDeviceVerified:false};
  writeFileSync(target,JSON.stringify(receipt,null,2)+'\n');appendFileSync(process.env.GITHUB_OUTPUT,'approved=true\n');console.log('Reusing verified iOS production artifacts from run '+r.run+'; no production build or guest UI rerun is started.');
 }catch{throw Error('Qualified iOS production evidence unavailable or invalid; no duplicate production build was started');}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await prepare(process.argv[2]);
