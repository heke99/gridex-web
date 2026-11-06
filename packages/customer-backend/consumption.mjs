const reference = /^[A-Za-z0-9_-]{1,240}$/;
const series = v => v === undefined || typeof v === 'string' && reference.test(v);
const instant = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export function consumptionSelection(value) {
 if (!value || Object.keys(value).some(k=>!['facility','from','to'].includes(k)) || (typeof value.facility!=='string'||!reference.test(value.facility)) || !instant(value.from) || !instant(value.to)) throw new Error('Invalid consumption selection');
 const duration = Date.parse(value.to)-Date.parse(value.from);
 if (duration <= 0 || duration > 32*86400000) throw new Error('Invalid consumption period');
 return {facility:value.facility,from:value.from,to:value.to};
}
/** Trusted provider must supply authoritative customer delivery windows for this facility.
 * Ownership or meter installation dates are NOT substitutes for delivery authorization. */
export function projectConsumption(input, selection) {
 const s=consumptionSelection(selection);
 if (!input || !Array.isArray(input.deliveryWindows) || !input.deliveryWindows.length || !Array.isArray(input.items) || input.items.length>4000 || typeof input.complete!=='boolean') throw new Error('Verified delivery windows required');
 const windows=input.deliveryWindows.map(w=>{
  if(!series(w.series)||w.facility!==s.facility || !instant(w.from) || !instant(w.to) || Date.parse(w.from)>=Date.parse(w.to))throw new Error('Invalid delivery window');
  return {from:Date.parse(w.from),to:Date.parse(w.to),series:w.series};
 });
 const seen=new Set();
 const items=input.items.flatMap(row=>{
  if(!row || !series(row.series) || (typeof row.reference!=='string'||!reference.test(row.reference)) || row.facility!==s.facility || !instant(row.from) || !instant(row.to) || Date.parse(row.from)>=Date.parse(row.to) || typeof row.kwh!=='number' || !Number.isFinite(row.kwh) || row.kwh<0 || seen.has(row.reference))throw new Error('Invalid consumption row');
  seen.add(row.reference);const from=Date.parse(row.from),to=Date.parse(row.to);
  if(from<Date.parse(s.from)||to>Date.parse(s.to)||!windows.some(w=>w.series===row.series&&from>=w.from&&to<=w.to))return [];
  return [{reference:row.reference,from:row.from,to:row.to,kwh:row.kwh,...(row.series===undefined?{}:{series:row.series})}];
 }).sort((a,b)=>a.from.localeCompare(b.from));
 // Overlapping revisions cannot be summed safely; fail rather than double count.
 const seriesEnds=new Map();for(const row of items){const key=row.series??'';if(Date.parse(row.from)<(seriesEnds.get(key)??-Infinity))throw new Error('Overlapping consumption intervals');seriesEnds.set(key,Date.parse(row.to));}
 const totalKwh=items.reduce((sum,row)=>sum+row.kwh,0);if(!Number.isFinite(totalKwh))throw new Error('Invalid total');
 return {...s,items,totalKwh,complete:input.complete};
}
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export function createConsumptionHandler({enabled=()=>true,authenticate,load}) {
 const reply=(status,body)=>Response.json(body,{status,headers});
 return async request=>{
  if(!enabled())return reply(404,{error:'Not found'});
  if(request.method!=='GET')return reply(405,{error:'Method not allowed'});
  const query=new URL(request.url).searchParams;let selection;
  try{if([...query.keys()].some(k=>!['facility','from','to'].includes(k))||['facility','from','to'].some(k=>query.getAll(k).length!==1))throw new Error();selection=consumptionSelection(Object.fromEntries(query));}catch{return reply(400,{error:'Invalid period or facility'});}
  const token=/^Bearer ([A-Za-z0-9._~-]{16,8192})$/.exec(request.headers.get('authorization')??'')?.[1];
  if(!token)return reply(401,{error:'Authentication required'});
  try{const binding=await authenticate(token);if(!binding)return reply(401,{error:'Authentication required'});
   return reply(200,{data:{consumption:projectConsumption(await load(binding,selection),selection)}});
  }catch{return reply(503,{error:'Förbrukningen kan inte visas innan leveransperioden har verifierats.'});}
 };
}
