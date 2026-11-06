import test from 'node:test';
import assert from 'node:assert/strict';
import {checkMobileReadiness} from '../scripts/check-mobile-readiness.mjs';
test('readiness probes never send credentials or claim customer verification',async()=>{
 const report=await checkMobileReadiness('https://gridex.se',async(url,options)=>{assert.equal(options.redirect,'manual');assert.equal(options.headers,undefined);return new Response('',{status:url.search?400:401,headers:{'cache-control':'private, no-store'}});});assert.equal(report.guardsReady,true);assert.equal(report.authenticatedCustomerVerified,false);
});
test('disabled APIs, protection redirects and transport errors fail readiness',async()=>{
 for(const status of [404,302,500])assert.equal((await checkMobileReadiness('https://gridex.se',async()=>new Response('',{status}))).guardsReady,false);
 assert.equal((await checkMobileReadiness('https://gridex.se',async()=>{throw Error('secret token');})).guardsReady,false);
 await assert.rejects(checkMobileReadiness('http://gridex.se'));
});
