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
 for(const u of f.customers)execFileSync('psql',[process.env.DB_URL,'-X','-q','-v','ON_ERROR_STOP=1'],{input:`UPDATE public.customer_documents SET public_url=${q(origin+'/qualification-document/'+u.extra.document)} WHERE company_id=${q(f.companyId)} AND title=${q(u.extra.documentTitle)}; UPDATE public.customer_invoice_documents SET public_url=${q(origin+'/qualification-document/'+u.extra.invoiceDocument)} WHERE company_id=${q(f.companyId)} AND title=${q(u.extra.invoiceDocumentTitle)};`,stdio:['pipe','ignore','pipe']});
 process.exit(0);
}
const ref=(kind,id)=>kind+'_'+createHash('sha256').update(`gridex-public-reference:v1:${f.companyId}:${kind}:${id}`).digest('base64url').slice(0,32);
const scopes=['customer_contracts.read','customer_sites.read','customer_invoices.read','customer_profile.read','customer_contact.write','customer_support.read','customer_support.write','customer_documents.read','customer_notifications.read','customer_notifications.write','customer_power_of_attorney.read','customer_legal.read','customer_metering.read'];
let sql=`BEGIN; SET LOCAL request.jwt.claims='{"role":"service_role"}'; UPDATE public.integration_api_clients SET scopes=ARRAY[${scopes.map(q).join(',')}] WHERE id=${q(f.clientId)} AND company_id=${q(f.companyId)};`;
for(const u of f.customers){
 const invoice=`(SELECT id FROM public.customer_invoices WHERE company_id=${q(f.companyId)} AND invoice_number=${q(u.display.invoices)})`;
 const customer=`(SELECT id FROM public.customers WHERE company_id=${q(f.companyId)} AND customer_number=${q(u.number)})`;
 const ids=Object.fromEntries(['notification','document','acceptance','power_of_attorney','invoiceDocument','invoiceLine'].map(k=>[k,randomUUID()]));
 u.extra=Object.fromEntries(Object.entries(ids).map(([k,id])=>[k,ref(k==='invoiceDocument'?'document':k==='invoiceLine'?'invoice_line':k,id)]));
 u.extra.invoiceDocumentTitle=u.number+'-INVOICE-PDF';u.extra.invoiceLineTitle=u.number+'-INVOICE-LINE';
 u.extra.supportArchiveLast=u.number+'-ARCHIVE-50';
 u.extra.documentTitle=u.number+'-DOCUMENT';u.extra.notificationTitle=u.number+'-NOTIFICATION';u.extra.phone=u.label==='A'?'+46700000111':'+46700000222';
 sql+=`UPDATE public.customers SET phone=${q(u.extra.phone)},email=${q(u.login.email)} WHERE id=${customer};
 INSERT INTO public.customer_invoice_lines(id,company_id,invoice_id,description,quantity,unit_price,amount_ex_vat,vat_amount,amount_inc_vat) VALUES(${q(ids.invoiceLine)},${q(f.companyId)},${invoice},${q(u.extra.invoiceLineTitle)},1,${u.label==='A'?88.8:177.6},${u.label==='A'?88.8:177.6},${u.label==='A'?22.2:44.4},${u.label==='A'?111:222});
 INSERT INTO public.customer_invoice_documents(id,company_id,invoice_id,customer_id,document_type,title,mime_type,public_url) VALUES(${q(ids.invoiceDocument)},${q(f.companyId)},${invoice},${customer},'invoice_pdf',${q(u.extra.invoiceDocumentTitle)},'application/pdf','https://example.invalid/synthetic-invoice');
 INSERT INTO public.customer_notifications(id,company_id,customer_id,type,title,message,status) VALUES(${q(ids.notification)},${q(f.companyId)},${customer},'customer_notice',${q(u.extra.notificationTitle)},${q(u.number+'-PUBLIC-MESSAGE')},'unread');
 INSERT INTO public.customer_documents(id,company_id,customer_id,document_type,title,mime_type,public_url) VALUES(${q(ids.document)},${q(f.companyId)},${customer},'customer_document',${q(u.extra.documentTitle)},'application/pdf','https://example.invalid/synthetic-document');
 INSERT INTO public.customer_legal_acceptances(id,company_id,customer_id,acceptance_type,source) VALUES(${q(ids.acceptance)},${q(f.companyId)},${customer},'terms','customer_portal');
 INSERT INTO public.powers_of_attorney(id,company_id,customer_id,reference,scope,status) VALUES(${q(ids.power_of_attorney)},${q(f.companyId)},${customer},${q(u.extra.power_of_attorney)},'supplier_switch','draft');`;
 for(let n=0;n<51;n++){const id=randomUUID();sql+=`INSERT INTO public.customer_cases(id,company_id,customer_id,case_type,status,priority,title,source,metadata,created_at,updated_at) VALUES(${q(id)},${q(f.companyId)},${customer},'other',${q(n%2?'resolved':'open')},'normal',${q(u.number+'-ARCHIVE-'+String(n).padStart(2,'0'))},'tenant_support_customer_portal','{"support_case":true}',${q(new Date(Date.UTC(2020,0,1,0,0,51-n)).toISOString())},${q(new Date(Date.UTC(2020,0,1,0,0,51-n)).toISOString())});`;}
}
sql+='COMMIT;';
execFileSync('psql',[process.env.DB_URL,'-X','-q','-v','VERBOSITY=sqlstate','-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','ignore','pipe']});
writeFileSync(path,JSON.stringify(f),{mode:0o600});
console.log('Prepared isolated extra resources and exact customer scopes');
