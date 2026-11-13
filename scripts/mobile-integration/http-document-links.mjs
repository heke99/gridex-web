import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const f=JSON.parse(readFileSync(process.argv[2],'utf8')),results=[];
for(const [index,u]of f.customers.entries()){
 const login=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'content-type':'application/json'},body:JSON.stringify(u.login)});assert.equal(login.status,200);const {access_token:token}=await login.json();
 for(const [reference,own,path]of [
  [u.extra.document,true,'/documents/'+u.extra.document+'/open'],
  [f.customers[1-index].extra.document,false,'/documents/'+f.customers[1-index].extra.document+'/open'],
  [u.extra.invoiceDocument,true,'/invoices/'+u.references.invoices+'/documents/'+u.extra.invoiceDocument],
  [f.customers[1-index].extra.invoiceDocument,false,'/invoices/'+u.references.invoices+'/documents/'+f.customers[1-index].extra.invoiceDocument],
  [u.extra.invoiceDocument,false,'/invoices/'+f.customers[1-index].references.invoices+'/documents/'+u.extra.invoiceDocument],
 ]){
  const r=await fetch('http://127.0.0.1:3100/api/mobile/customer'+path,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(60000)});assert.equal(r.headers.get('cache-control'),'private, no-store');const body=await r.json();
  if(own){assert.equal(r.status,200);const row=(body.data.customerDocument??body.data.invoiceDocument)[0];assert.equal(row.url,process.env.GRIDEX_DEVICE_PUBLIC_ORIGIN+'/qualification-document/'+reference);assert.equal(row.reference,reference);}
  else{assert.ok([403,404,503].includes(r.status));assert.deepEqual(Object.keys(body),['error']);assert.ok(!JSON.stringify(body).includes(reference));}
 }
 results.push({id:u.label+':approved-customer-and-invoice-documents-foreign-denial',result:'PASS'});
}
writeFileSync(process.env.RUNNER_TEMP+'/mobile-document-links.json',JSON.stringify({opsCommit:process.env.GRIDEX_OPS_COMMIT,webCommit:process.env.GRIDEX_WEB_COMMIT,results},null,2)+'\n');
console.log('PASS approved own document links and foreign document denial');
