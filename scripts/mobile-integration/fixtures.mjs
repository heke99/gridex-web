// Extends the reviewed OPS loopback-only fixture; never accepts a hosted DB.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const path=process.argv[2];
const f=JSON.parse(readFileSync(path,'utf8'));
const db=new URL(process.env.DB_URL);
assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'54322');assert.equal(db.pathname,'/postgres');
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
if(process.argv[3]==='--document-origin'){
 const origin=process.env.GRIDEX_DEVICE_PUBLIC_ORIGIN;
 assert.match(origin,/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/);
 for(const u of f.customers)execFileSync('psql',[process.env.DB_URL,'-X','-q','-v','ON_ERROR_STOP=1'],{input:`UPDATE public.customer_documents SET public_url=${q(origin+'/qualification-document/'+u.extra.document)} WHERE company_id=${q(f.companyId)} AND title=${q(u.extra.documentTitle)};`,stdio:['pipe','ignore','pipe']});
 process.exit(0);
}
const ref=(kind,id)=>kind+'_'+createHash('sha256').update(`gridex-public-reference:v1:${f.companyId}:${kind}:${id}`).digest('base64url').slice(0,32);
const scopes=['customer_contracts.read','customer_sites.read','customer_invoices.read','customer_profile.read','customer_contact.write','customer_support.read','customer_support.write','customer_documents.read','customer_notifications.read','customer_notifications.write','customer_power_of_attorney.read','customer_legal.read','customer_metering.read'];
let sql=`BEGIN; SET LOCAL request.jwt.claims='{"role":"service_role"}'; UPDATE public.integration_api_clients SET scopes=ARRAY[${scopes.map(q).join(',')}] WHERE id=${q(f.clientId)} AND company_id=${q(f.companyId)};`;
for(const u of f.customers){
 const customer=`(SELECT id FROM public.customers WHERE company_id=${q(f.companyId)} AND customer_number=${q(u.number)})`;
 const ids=Object.fromEntries(['notification','document','acceptance','power_of_attorney'].map(k=>[k,randomUUID()]));
 u.extra=Object.fromEntries(Object.entries(ids).map(([k,id])=>[k,ref(k,id)]));
 u.extra.documentTitle=u.number+'-DOCUMENT';u.extra.notificationTitle=u.number+'-NOTIFICATION';u.extra.phone=u.label==='A'?'+46700000111':'+46700000222';
 sql+=`UPDATE public.customers SET phone=${q(u.extra.phone)},email=${q(u.login.email)} WHERE id=${customer};
 INSERT INTO public.customer_notifications(id,company_id,customer_id,type,title,message,status) VALUES(${q(ids.notification)},${q(f.companyId)},${customer},'customer_notice',${q(u.extra.notificationTitle)},${q(u.number+'-PUBLIC-MESSAGE')},'unread');
 INSERT INTO public.customer_documents(id,company_id,customer_id,document_type,title,mime_type,public_url) VALUES(${q(ids.document)},${q(f.companyId)},${customer},'customer_document',${q(u.extra.documentTitle)},'application/pdf','https://example.invalid/synthetic-document');
 INSERT INTO public.customer_legal_acceptances(id,company_id,customer_id,acceptance_type,source) VALUES(${q(ids.acceptance)},${q(f.companyId)},${customer},'terms','customer_portal');
 INSERT INTO public.powers_of_attorney(id,company_id,customer_id,reference,scope,status) VALUES(${q(ids.power_of_attorney)},${q(f.companyId)},${customer},${q(u.extra.power_of_attorney)},'supplier_switch','draft');`;
}
sql+='COMMIT;';
execFileSync('psql',[process.env.DB_URL,'-X','-q','-v','VERBOSITY=sqlstate','-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','ignore','pipe']});
writeFileSync(path,JSON.stringify(f),{mode:0o600});
console.log('Prepared isolated extra resources and exact customer scopes');
