import {test,after} from 'node:test';
import assert from 'node:assert/strict';
const old={...process.env};after(()=>{for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);delete globalThis.__mobileReadFixture;});
process.env.GRIDEX_MOBILE_API_ENABLED='true';process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-test';
const from='2026-11-01T00:00:00.000Z',to='2026-11-08T00:00:00.000Z';
const selection={facility:'facility_one',from,to};
const page=(more=false,cursor=null)=>({has_more:more,next_cursor:cursor});
const sites=()=>({data:{sites:[{facility_reference:'facility_one',facility_id:'735999123456789012'}],metering_points:[{metering_point_reference:'meter_one',facility_reference:'facility_one'}],delivery_access:{version:'customer-supply-periods-v1',complete:true,windows:[{facility_reference:'facility_one',metering_point_reference:'meter_one',from:'2026-11-03T00:00:00Z',to:null}]}},page:{sites:page()}});
const reading=(reference,day,kwh=1)=>({metering_value_reference:reference,metering_point_reference:'meter_one',period_start:`2026-11-0${day}T00:00:00Z`,period_end:`2026-11-0${day}T00:15:00Z`,quantity_kwh:kwh,revision_status:'current',direction:'consumption',unit:'kWh',status:'stored',internal_note:'must-not-leak'});
let scoped;const calls=[];
globalThis.__mobileReadFixture={createClient:()=>({auth:{getUser:async token=>({data:{user:{id:token==='other-customer-token'?'subject-two':'subject-one',email_confirmed_at:from}}})},from:()=>({select(){return this;},eq(_key,subject){this.subject=subject;return this;},async maybeSingle(){return {data:{customer_number:this.subject==='subject-two'?'own-two':'own-one'}};}})}),scoped:(...args)=>{calls.push(args);return scoped(...args);}};
const {GET}=await import('../app/api/mobile/customer/consumption/route.ts');
const request=()=>new Request(`https://test/api/mobile/customer/consumption?${new URLSearchParams(selection)}`,{headers:{authorization:'Bearer verified-customer-token'}});
test('actual Gridex route reads only verified identity, traverses meter pages and excludes pre-start values',async()=>{
 calls.length=0;scoped=async(path,identity)=>{assert.equal(identity.userId,'subject-one');assert.equal(identity.customerNumber,'own-one');const u=new URL(path,'https://ops.test');if(u.pathname.endsWith('/sites'))return sites();assert.equal(u.searchParams.get('facility_id'),'735999123456789012');assert.equal(u.searchParams.get('from'),from);assert.equal(u.searchParams.get('to'),to);return u.searchParams.has('cursor')?{data:[reading('value_new',5,2)],page:page()}:{data:[reading('value_before',1,90),reading('value_valid',4,0)],page:page(true,'next-page')};};
 const response=await GET(request());assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.consumption.totalKwh,2);assert.equal(body.data.consumption.complete,true);assert.deepEqual(body.data.consumption.items.map(r=>r.reference),['value_valid','value_new']);assert.ok(!JSON.stringify(body).includes('must-not-leak'));assert.equal(calls.length,3);
});
test('old OPS payload without delivery proof fails before requesting readings',async()=>{
 calls.length=0;scoped=async()=>{const value=sites();delete value.data.delivery_access;return value;};assert.equal((await GET(request())).status,503);assert.equal(calls.length,1);assert.ok(calls[0][0].startsWith('/api/v1/customer/consumption/sites'));
});
test('unowned facility, missing point scope and incomplete windows fail before metering',async()=>{
 for(const change of [s=>s.data.sites=[],s=>s.data.metering_points=[],s=>s.data.delivery_access.complete=false,s=>s.data.delivery_access.windows[0].metering_point_reference='foreign']){
  calls.length=0;scoped=async()=>{const value=sites();change(value);return value;};assert.equal((await GET(request())).status,503);assert.equal(calls.length,1);
 }
});
test('wrong meter, ambiguous revisions and wrong energy direction/unit cannot be summed',async()=>{
 for(const patch of [{metering_point_reference:'foreign'},{direction:'production'},{unit:'Wh'},{quantity_kwh:-1}]){
  scoped=async path=>path.startsWith('/api/v1/customer/consumption/sites')?sites():{data:[{...reading('value_valid',4),...patch}],page:page()};assert.equal((await GET(request())).status,503);
 }
 scoped=async path=>path.startsWith('/api/v1/customer/consumption/sites')?sites():{data:[reading('value_a',4),reading('value_b',4)],page:page()};assert.equal((await GET(request())).status,503);
});
test('cursor loops and malformed page metadata fail instead of claiming complete totals',async()=>{
 for(const pagination of [{has_more:true,next_cursor:null},{has_more:'false',next_cursor:null},page(true,'loop')]){
  calls.length=0;scoped=async path=>path.startsWith('/api/v1/customer/consumption/sites')?sites():{data:[reading('value_valid'+calls.length,4)],page:pagination};assert.equal((await GET(request())).status,503);assert.ok(calls.length<=3);
 }
});

test('superseded versions are excluded and an entirely pre-delivery period makes no reading request',async()=>{
 scoped=async path=>path.startsWith('/api/v1/customer/consumption/sites')?sites():{data:[{...reading('old_value',4,99),revision_status:'superseded'},reading('current_value',4,2)],page:page()};const response=await GET(request());assert.equal(response.status,200);assert.equal((await response.json()).data.consumption.totalKwh,2);
 calls.length=0;scoped=async()=>{const value=sites();value.data.delivery_access.windows[0].from='2026-12-01T00:00:00Z';return value;};const empty=await GET(request());assert.equal(empty.status,200);assert.equal((await empty.json()).data.consumption.totalKwh,0);assert.equal(calls.length,1);
});

test('two authenticated Gridex customers retain distinct RLS bindings and cannot select the other facility',async()=>{
 scoped=async(path,identity)=>{const value=sites();if(identity.userId==='subject-two'){assert.equal(identity.customerNumber,'own-two');value.data.sites[0].facility_reference='facility_two';value.data.metering_points[0].facility_reference='facility_two';value.data.delivery_access.windows[0].facility_reference='facility_two';return value;}assert.equal(identity.customerNumber,'own-one');return path.includes('/sites')?value:{data:[reading('own_value',4)],page:page()};};
 const own=await GET(request());assert.equal(own.status,200);
 const other=new Request(request(),{headers:{authorization:'Bearer other-customer-token'}});const denied=await GET(other);assert.equal(denied.status,503);assert.ok(!JSON.stringify(await denied.json()).includes('own_value'));
 calls.length=0;const injected=new Request(request().url+'&customer_id=foreign',{headers:{authorization:'Bearer verified-customer-token'}});assert.equal((await GET(injected)).status,400);assert.equal(calls.length,0);
});
test('two current meters sum independently without borrowing the other meter delivery window',async()=>{
 scoped=async path=>{if(path.includes('/sites')){const s=sites();s.data.metering_points.push({metering_point_reference:'meter_two',facility_reference:'facility_one'});s.data.delivery_access.windows.push({facility_reference:'facility_one',metering_point_reference:'meter_two',from:'2026-11-05T00:00:00Z',to:null});return s;}return {data:[reading('one',4,2),{...reading('two_before',4,99),metering_point_reference:'meter_two'},reading('one_next',5,1),{...reading('two',5,3),metering_point_reference:'meter_two'}],page:page()};};
 const r=await GET(request());assert.equal(r.status,200);const data=(await r.json()).data.consumption;assert.equal(data.totalKwh,6);assert.deepEqual(data.items.map(r=>r.series),['meter_one','meter_one','meter_two']);
});
test('selected facility can appear on a later sites page; repeated site cursors fail',async()=>{
 calls.length=0;scoped=async path=>{if(!path.includes('/sites'))return {data:[],page:page()};if(path.includes('cursor='))return sites();const s=sites();s.data.sites[0].facility_reference='facility_other';s.data.metering_points[0].facility_reference='facility_other';s.data.metering_points[0].metering_point_reference='meter_other';s.data.delivery_access.windows[0].facility_reference='facility_other';s.data.delivery_access.windows[0].metering_point_reference='meter_other';s.page.sites=page(true,'site-next');return s;};
 assert.equal((await GET(request())).status,200);assert.equal(calls.length,3);assert.ok(calls[1][0].includes('cursor=site-next'));
 calls.length=0;scoped=async()=>({data:{sites:[],metering_points:[],delivery_access:{version:'customer-supply-periods-v1',complete:true,windows:[]}},page:{sites:page(true,'loop')}});assert.equal((await GET(request())).status,503);assert.equal(calls.length,2);
});
test('end boundaries and delivery gaps exclude whole crossing intervals',async()=>{
 scoped=async path=>{if(path.includes('/sites')){const s=sites();s.data.delivery_access.windows[0].to='2026-11-05T00:00:00Z';s.data.delivery_access.windows.push({facility_reference:'facility_one',metering_point_reference:'meter_one',from:'2026-11-06T00:00:00Z',to:'2026-11-07T00:00:00Z'});return s;}return {data:[reading('before_end',4,2),reading('gap',5,99),{...reading('cross_end',4,80),period_start:'2026-11-04T23:45:00Z',period_end:'2026-11-05T00:15:00Z'},reading('after_gap',6,3)],page:page()};};
 const r=await GET(request());assert.equal(r.status,200);assert.equal((await r.json()).data.consumption.totalKwh,5);
});
test('fractional delivery bounds preserve millisecond precision and exclude a one-millisecond crossing', async () => {
 scoped=async path=>{
  if(path.includes('/sites')){
   const payload=sites();
   Object.assign(payload.data.delivery_access.windows[0], {
    from:'2026-11-03T01:00:00.125+01:00',to:'2026-11-03T00:15:00.125Z',
   });
   return payload;
  }
  return {data:[
   {...reading('before_start',3,100),period_start:'2026-11-03T00:00:00.124Z',period_end:'2026-11-03T00:15:00.125Z'},
   {...reading('at_both_bounds',3,2),period_start:'2026-11-03T00:00:00.125Z',period_end:'2026-11-03T00:15:00.125Z'},
   {...reading('after_end',3,100),period_start:'2026-11-03T00:00:00.125Z',period_end:'2026-11-03T00:15:00.126Z'},
  ],page:page()};
 };
 const response=await GET(request());
 assert.equal(response.status,200);
 const data=(await response.json()).data.consumption;
 assert.equal(data.totalKwh,2);
 assert.deepEqual(data.items.map(row=>[row.reference,row.from,row.to]), [
  ['at_both_bounds','2026-11-03T00:00:00.125Z','2026-11-03T00:15:00.125Z'],
 ]);
});
test('an unsupported finer delivery timestamp is rejected before reading measurements', async () => {
 calls.length=0;
 scoped=async()=>{const payload=sites();payload.data.delivery_access.windows[0].from='2026-11-03T00:00:00.0001Z';return payload;};
 assert.equal((await GET(request())).status,503);
 assert.equal(calls.length,1);
});
test('forty metering pages remain explicitly partial instead of a fabricated full total',async()=>{
 let pageNumber=0;scoped=async path=>{if(path.includes('/sites'))return sites();const n=pageNumber++;return {data:Array.from({length:100},(_,i)=>({...reading(`value_${n}_${i}`,4),period_start:new Date(Date.parse('2026-11-03T00:00:00Z')+(n*100+i)*60000).toISOString(),period_end:new Date(Date.parse('2026-11-03T00:00:00Z')+(n*100+i+1)*60000).toISOString()})),page:page(true,`cursor-${n}`)};};
 const r=await GET(request());assert.equal(r.status,200);const data=(await r.json()).data.consumption;assert.equal(data.complete,false);assert.equal(data.items.length,4000);assert.equal(pageNumber,40);
});

test('overall request deadline stops before metering after a slow capability read',async()=>{
 const now=Date.now;let elapsed=0;Date.now=()=>now()+elapsed;calls.length=0;
 try{scoped=async()=>{elapsed=16000;return sites();};assert.equal((await GET(request())).status,503);assert.equal(calls.length,1);assert.ok(calls[0][2].signal instanceof AbortSignal);}finally{Date.now=now;}
});

test('30 days of quarter-hour values from two meters fit the bounded OPS pagination', async () => {
 const from = '2026-11-01T00:00:00.000Z';
 const to = '2026-12-01T00:00:00.000Z';
 const start = Date.parse(from);
 const quarter = 15 * 60 * 1000;
 const rows = Array.from({ length: 30 * 96 * 2 }, (_, i) => {
  const index = Math.floor(i / 2);
  return {
   ...reading(`value_${i}`, 1),
   metering_point_reference: i % 2 ? 'meter_two' : 'meter_one',
   period_start: new Date(start + index * quarter).toISOString(),
   period_end: new Date(start + (index + 1) * quarter).toISOString(),
  };
 });
 let pages = 0;
 scoped = async path => {
  const url = new URL(path, 'https://ops.test');
  if (url.pathname.endsWith('/sites')) {
   const payload = sites();
   payload.data.delivery_access.windows[0].from = from;
   payload.data.metering_points.push({ ...payload.data.metering_points[0], metering_point_reference: 'meter_two' });
   payload.data.delivery_access.windows.push({ ...payload.data.delivery_access.windows[0], metering_point_reference: 'meter_two' });
   return payload;
  }
  assert.equal(url.searchParams.get('from'), from);
  assert.equal(url.searchParams.get('to'), to);
  assert.equal(url.searchParams.get('limit'), '100');
  assert.equal(url.searchParams.get('cursor'), pages ? String(pages * 100) : null);
  const offset = pages++ * 100;
  const next = offset + 100;
  return { data: rows.slice(offset, next), page: next < rows.length ? page(true, String(next)) : page() };
 };
 const query = new URLSearchParams({ facility: selection.facility, from, to });
 const response = await GET(new Request(`https://test/api/mobile/customer/consumption?${query}`, {
  headers: { authorization: 'Bearer verified-customer-token' },
 }));
 assert.equal(response.status, 200);
 const { data: { consumption } } = await response.json();
 assert.equal(pages, 58);
 assert.equal(consumption.complete, true);
 assert.equal(consumption.items.length, 5760);
 assert.equal(consumption.totalKwh, 5760);
 assert.equal(consumption.items[0].from, from);
 assert.equal(consumption.items.at(-1).to, to);
});

test('caller cancellation aborts the OPS signal on the first metering page and skips continuation', async () => {
  calls.length = 0;
  const controller = new AbortController();
  scoped = async (path, identity, { signal }) => {
    assert.equal(identity.userId, 'subject-one');
    assert.equal(signal.aborted, false);
    if (path.endsWith('/sites')) return sites();
    controller.abort();
    return { data: [reading('first', 4)], page: page(true, 'second-page') };
  };
  const response = await GET(new Request(request(), { signal: controller.signal }));
  assert.equal(response.status, 499);
  assert.equal(await response.text(), '');
  assert.equal(calls.length, 2);
  assert.match(calls[1][0], /\/metering-values\?/);
  assert.equal(calls[0][2].signal, calls[1][2].signal);
  assert.equal(calls[1][2].signal.aborted, true);
});
