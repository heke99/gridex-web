import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
export function requireLoopback(value=process.env.DB_URL){
 const db=new URL(value);assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'54322');assert.equal(db.pathname,'/postgres');assert.equal(db.username,'postgres');assert.equal(db.search,'');assert.equal(db.hash,'');assert.ok(['postgres:','postgresql:'].includes(db.protocol));return value;
}
export function sql(text){try{return execFileSync('psql',[requireLoopback(),'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{input:text,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']}).trim();}catch(error){if(process.env.RUNNER_TEMP)writeFileSync(process.env.RUNNER_TEMP+'/consumption-private-sql-error.log',String(error.stderr??''),{mode:0o600});throw new Error('Isolated consumption SQL failed: '+(String(error.stderr).match(/ERROR:\s+(\w{5})/)?.[1]??'unknown'));}}
export const reference=(kind,company,id)=>kind+'_'+createHash('sha256').update(`gridex-public-reference:v1:${company}:${kind}:${id}`).digest('base64url').slice(0,32);
export function bounds(days,now=new Date()){
 assert.ok([7,30].includes(days),'Only qualified calendar selections');
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return JSON.parse(sql(`SELECT json_build_object('from',to_char(((${quote(date)}::date+1-${Number(days)})::timestamp AT TIME ZONE 'Europe/Stockholm') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS".000Z"'),'to',to_char(((${quote(date)}::date+1)::timestamp AT TIME ZONE 'Europe/Stockholm') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS".000Z"'));`));
}
export function oracle(f,user,facility,from,to){
 assert.match(from,/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);assert.match(to,/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
 const rows=JSON.parse(sql(`SELECT coalesce(json_agg(json_build_object('id',v.id,'kwh',v.quantity_kwh)),'[]') FROM public.normalized_metering_values v JOIN public.customers c ON c.id=v.customer_id AND c.company_id=v.company_id WHERE c.company_id=${quote(f.companyId)} AND c.customer_number=${quote(user.number)} AND v.facility_id=${quote(facility)} AND v.revision_status='current' AND v.direction='consumption' AND v.unit='kWh' AND v.status='stored' AND v.period_start>=${quote(from)}::timestamptz AND v.period_end<=${quote(to)}::timestamptz AND EXISTS(SELECT 1 FROM public.customer_supply_periods p WHERE p.company_id=v.company_id AND p.customer_id=v.customer_id AND p.metering_point_id=v.metering_point_id AND p.status IN('active','confirmed_by_grid_owner','ending','ended') AND p.actual_start_date IS NOT NULL AND p.market_start_at IS NOT NULL AND v.period_start>=greatest(p.actual_start_date::timestamp AT TIME ZONE 'Europe/Stockholm',p.market_start_at) AND (p.status<>'ended' OR p.actual_end_date IS NOT NULL) AND v.period_end<=least(coalesce((p.actual_end_date+1)::timestamp AT TIME ZONE 'Europe/Stockholm','infinity'::timestamptz),coalesce((p.end_date+1)::timestamp AT TIME ZONE 'Europe/Stockholm','infinity'::timestamptz),coalesce(p.market_end_at,'infinity'::timestamptz)));`));
 return {references:rows.map(r=>reference('metering_value',f.companyId,r.id)).sort(),totalKwh:rows.reduce((s,r)=>s+Number(r.kwh),0),count:rows.length};
}
export function sourceDigest(f){return sql(`SELECT count(*)||':'||md5(string_agg(v.id||':'||v.metering_point_id||':'||v.period_start||':'||v.period_end||':'||v.quantity_kwh||':'||v.revision_status,',' ORDER BY v.id)) FROM public.normalized_metering_values v WHERE company_id=${quote(f.companyId)};`);}
export function prepare(path){
 requireLoopback();const f=JSON.parse(readFileSync(path,'utf8'));assert.equal(f.customers.length,2);assert.match(f.companyId,/^[a-f0-9-]{36}$/);
 let statement=`BEGIN; SET LOCAL request.jwt.claims='{"role":"service_role"}'; UPDATE public.integration_api_clients SET rate_limit_per_minute=2000 WHERE id=${quote(f.clientId)} AND company_id=${quote(f.companyId)};`;
 for(const [index,u]of f.customers.entries()){
  const c=`(SELECT id FROM public.customers WHERE company_id=${quote(f.companyId)} AND customer_number=${quote(u.number)})`;
  const s=`(SELECT id FROM public.customer_sites WHERE company_id=${quote(f.companyId)} AND facility_reference=${quote(u.references.sites)})`;
  const alt=randomUUID(),ids=Array.from({length:5},()=>randomUUID()),factor=index?5:1;
  const primary='73599900000000000'+index,secondary='73599900000000010'+index;
  u.consumption={primary,secondary,primaryReference:u.references.sites,secondaryReference:reference('facility',f.companyId,alt),secondaryTitle:u.display.sites+'-SECOND'};
  statement+=`UPDATE public.customer_sites SET facility_id=${quote(primary)} WHERE id=${s}; INSERT INTO public.customer_sites(id,company_id,customer_id,facility_id,facility_reference,site_name,street,created_at) VALUES(${quote(alt)},${quote(f.companyId)},${c},${quote(secondary)},${quote(u.consumption.secondaryReference)},${quote(u.consumption.secondaryTitle)},${quote(u.consumption.secondaryTitle)},now()-interval '2 days');`;
  for(let n=0;n<5;n++){
   const site=n<3?s:quote(alt),facility=n<3?primary:secondary;
   statement+=`INSERT INTO public.metering_points(id,company_id,customer_id,site_id,customer_site_id,metering_point_id,site_facility_id,status,is_test_data) VALUES(${quote(ids[n])},${quote(f.companyId)},${c},${site},${site},${quote('E2E-'+randomUUID())},${quote(facility)},'active',true);`;
   const start=n===2?"((now() AT TIME ZONE 'Europe/Stockholm')::date-15)":n===4?"'2026-03-28'::date":"((now() AT TIME ZONE 'Europe/Stockholm')::date-65)";
   const end=n===1?"((now() AT TIME ZONE 'Europe/Stockholm')::date-16)":n===4?"'2026-03-30'::date":'NULL::date';
   statement+=`INSERT INTO public.customer_supply_periods(company_id,customer_id,metering_point_id,start_date,end_date,actual_start_date,actual_end_date,market_start_at,market_end_at,status,source,metadata) VALUES(${quote(f.companyId)},${c},${quote(ids[n])},${start},${end},${start},${end},(${start})::timestamp AT TIME ZONE 'Europe/Stockholm',CASE WHEN ${end} IS NULL THEN NULL ELSE ((${end})+1)::timestamp AT TIME ZONE 'Europe/Stockholm' END,${quote([1,4].includes(n)?'ended':'active')},'manual','{"synthetic_acceptance":true}');`;
   const genStart=n===4?"'2026-03-27 00:00:00+00'::timestamptz":"date_trunc('day',now())-interval '66 days'";
   const genEnd=n===4?"'2026-04-01 00:00:00+00'::timestamptz":"date_trunc('day',now())+interval '3 days'";
   const qty=[1,2,3,11,7][n]*factor;
   statement+=`INSERT INTO public.normalized_metering_values(company_id,customer_id,customer_site_id,site_id,metering_point_id,facility_id,period_start,period_end,resolution,quantity_kwh,source_type,status,revision_status,direction,unit) SELECT ${quote(f.companyId)},${c},${site},${site},${quote(ids[n])},${quote(facility)},t,t+interval '1 hour','PT1H',${qty},'synthetic_customer_consumption_acceptance','stored','current','consumption','kWh' FROM generate_series(${genStart},${genEnd},interval '1 hour') AS t;`;
  }
  for(const revision of ['replaced','superseded','void'])statement+=`INSERT INTO public.normalized_metering_values(company_id,customer_id,customer_site_id,site_id,metering_point_id,facility_id,period_start,period_end,quantity_kwh,source_type,revision_status,source_transaction_reference) VALUES(${quote(f.companyId)},${c},${s},${s},${quote(ids[0])},${quote(primary)},date_trunc('day',now()),date_trunc('day',now())+interval '1 hour',999999,'synthetic_customer_consumption_acceptance',${quote(revision)},${quote('E2E-revision-'+revision+'-'+randomUUID())});`;
 }
 sql(statement+'COMMIT;');
 for(const u of f.customers){u.consumption.expected={};for(const days of [7,30]){const range=bounds(days);for(const kind of ['primary','secondary']){const expected=oracle(f,u,u.consumption[kind],range.from,range.to);u.consumption.expected[kind+days]={...range,totalKwh:expected.totalKwh,count:expected.count,display:expected.totalKwh.toLocaleString('sv-SE',{maximumFractionDigits:2})+' kWh i hämtade mätvärden'};}}}
 f.consumptionSourceDigest=sourceDigest(f);writeFileSync(path,JSON.stringify(f),{mode:0o600});console.log('Prepared isolated consumption graphs and independent PostgreSQL expectations; no production data or market acceptance claim');
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)prepare(process.argv[2]);
