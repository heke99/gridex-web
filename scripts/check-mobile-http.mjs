import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const url=new URL(process.argv[2]??'https://gridex.se');
if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(url.protocol!=='https:'&&!(url.protocol==='http:'&&url.hostname==='127.0.0.1')))throw new Error('Expected trusted HTTPS origin');
const base='/api/mobile/customer';
const cases=[];
for(const resource of ['contracts','sites','invoices','support','profile','notifications','documents','powers','acceptances']){
 cases.push({path:`/${resource}`,status:401},{path:`/${resource}?customerId=foreign`,status:400});
}
for(const path of ['/invoices/invoice_test','/support/case_test','/documents/document_test/open','/invoices/invoice_test/documents/document_test'])cases.push({path,status:401});
for(const path of ['/support','/support/case_test/messages','/profile','/notifications/read'])cases.push({path,method:'POST',status:401});
const q='facility=facility_test&from=2026-11-01T00%3A00%3A00.000Z&to=2026-11-08T00%3A00%3A00.000Z';
cases.push({path:`/consumption?${q}`,status:401},{path:`/consumption?${q}&customerId=foreign`,status:400},{path:`/consumption?${q}&facility=other`,status:400},{path:'/consumption',status:400});
const results=[];
for(const c of cases){const started=Date.now();try{const response=await fetch(`${url.origin}${base}${c.path}`,{method:c.method??'GET',redirect:'manual',signal:AbortSignal.timeout(20000)});assert.equal(response.status,c.status);assert.equal(response.headers.get('cache-control'),'private, no-store');const body=await response.json();assert.equal(typeof body.error,'string');assert.ok(!('data'in body));results.push({...c,passed:true,durationMs:Date.now()-started});}catch(error){results.push({...c,passed:false,error:error.message});}}
const report={origin:url.origin,checkedAt:new Date().toISOString(),kind:'unauthenticated-http-guards',realCustomerVerified:false,results,passed:results.every(r=>r.passed)};
await writeFile(process.argv[3]??'/tmp/gridex-mobile-http.json',JSON.stringify(report,null,2)+'\n');
console.log(`${results.filter(r=>r.passed).length}/${results.length} mobile HTTP guards passed at ${url.origin}`);for(const result of results.filter(r=>!r.passed))console.error(result);if(!report.passed)process.exitCode=1;
