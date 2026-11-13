import {customerEndpoint} from './customerEndpoint';
export const priceAreas=['SE1','SE2','SE3','SE4'] as const;
export type PriceArea=typeof priceAreas[number];
export type MarketEntry={sekPerKwh:number;timeStart:string;timeEnd:string};
export type MarketDay={area:PriceArea;date:string;source:string;disclaimer:string;entries:MarketEntry[];average:number|null};
export function marketDate(now=new Date()):string{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function relativeMarketDate(offset: -1 | 0 | 1, now = new Date()): string {
 const date = new Date(`${marketDate(now)}T12:00:00Z`);
 date.setUTCDate(date.getUTCDate() + offset);
 return marketDate(date);
}
export function nextMarketEntry(day: MarketDay, now = Date.now()): MarketEntry | null {
 return day.entries.find(entry => Date.parse(entry.timeStart) > now) ?? null;
}
export function marketPriceUrl(origin:string,area:PriceArea,date:string,prefix='/api/elpris'):string{
 if(!priceAreas.includes(area)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||marketDate(new Date(`${date}T12:00:00Z`))!==date)throw new Error('Invalid market selection');
 const url=new URL(customerEndpoint(origin,'day',undefined,prefix));url.searchParams.set('area',area);url.searchParams.set('date',date);return url.href;
}
export function parseMarketDay(body:unknown,area:PriceArea,date:string):MarketDay{
 const row=body as Record<string,unknown>;
 if(!row||row.priceArea!==area||row.date!==date||typeof row.sourceLabel!=='string'||!row.sourceLabel||typeof row.disclaimer!=='string'||!row.disclaimer||!Array.isArray(row.entries)||row.entries.length>150)throw new Error('Invalid market data');
 let previous=-Infinity,total=0,duration=0;
 const entries=row.entries.map(value=>{
  const r=value as MarketEntry;
  if(typeof r?.timeStart!=='string'||typeof r?.timeEnd!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(r.timeStart)||!/(Z|[+-]\d{2}:\d{2})$/.test(r.timeEnd))throw new Error('Invalid market timestamp');
  const start=Date.parse(r.timeStart),end=Date.parse(r.timeEnd);
  if(typeof r?.sekPerKwh!=='number'||!Number.isFinite(r.sekPerKwh)||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||start<previous||marketDate(new Date(start))!==date||marketDate(new Date(end-1))!==date)throw new Error('Invalid market interval');
  previous=end;total+=r.sekPerKwh*(end-start);duration+=end-start;
  return {sekPerKwh:r.sekPerKwh,timeStart:r.timeStart,timeEnd:r.timeEnd};
 });
 if (!Number.isFinite(total)) throw new Error('Invalid market total');
 return {area,date,source:row.sourceLabel,disclaimer:row.disclaimer,entries,average:duration?total/duration:null};
}
export function currentMarketPrice(day:MarketDay,now=Date.now()):number|null{return day.entries.find(e=>Date.parse(e.timeStart)<=now&&now<Date.parse(e.timeEnd))?.sekPerKwh??null;}
