import { MAX_CONSUMPTION_ITEMS, consumptionSelection, type ConsumptionSelection } from '@/packages/customer-backend/consumption.mjs';
import type { OpsPortalIdentity } from '@/lib/ops/client/portal';

type Row = Record<string, unknown>;
export type ScopedRead = (path: string, identity: OpsPortalIdentity, signal: AbortSignal) => Promise<unknown>;
const record = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};
const ref = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,240}$/.test(v);
function instant(value: unknown) {
  const m = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) throw new Error('Invalid OPS instant');
  const [y,month,day,hour,minute,second] = m.slice(1,7).map(Number);
  const date = new Date(Date.UTC(y,month-1,day));
  const parsed = new Date(value as string);
  const timestamp = parsed.getTime();
  if (date.getUTCFullYear()!==y || date.getUTCMonth()!==month-1 || date.getUTCDate()!==day || hour>23 || minute>59 || second>59 || !Number.isFinite(timestamp)) throw new Error('Invalid OPS instant');
  return { iso: parsed.toISOString(), timestamp };
}
function nextPage(value: unknown): string | null {
  const p = record(value);
  if (typeof p.has_more !== 'boolean' || (p.next_cursor !== null && (typeof p.next_cursor !== 'string' || !p.next_cursor || p.next_cursor.length>2048)) || p.has_more && !p.next_cursor || !p.has_more && p.next_cursor!==null) throw new Error('Unverified OPS pagination');
  return p.has_more ? p.next_cursor as string : null;
}
type Instant = ReturnType<typeof instant>;
type Window = { point: string; from: Instant; to: Instant };
const openWindowEnd = instant('9999-12-31T00:00:00.000Z');
/** Independent customer-consumption-v1 supplement; never inferred from the legacy DTO.
 * Legacy/missing/incomplete proof must stop BEFORE metering reads. No DB access. */
export async function loadOpsConsumption(identity: OpsPortalIdentity, request: ConsumptionSelection, read: ScopedRead, requestSignal?: AbortSignal) {
  const selection = consumptionSelection(request);
  const start = Date.parse(selection.from), end = Date.parse(selection.to);
  if (!identity || typeof identity.userId!=='string' || !identity.userId) throw new Error('Verified binding required');
  const binding = Object.freeze({userId:identity.userId,customerNumber:identity.customerNumber,externalCustomerId:identity.externalCustomerId});
  const deadline = Date.now() + 15_000;
  const timeout = AbortSignal.timeout(15_000);
  const signal = requestSignal ? AbortSignal.any([requestSignal, timeout]) : timeout;
  const fetchPage = async (resource: 'sites' | 'metering-values', query: URLSearchParams) => {
    signal.throwIfAborted();
    if (Date.now() >= deadline) throw new Error('Consumption deadline exceeded');
    const suffix = query.size ? `?${query}` : '';
    const value = await read(`/api/v1/customer/consumption/${resource}${suffix}`, binding, signal);
    signal.throwIfAborted();
    if (Date.now() >= deadline) throw new Error('Consumption deadline exceeded');
    return record(value);
  };
  let selected: Row | null = null; let windows: Window[] = [];
  const points = new Map<string,string>(); const facilities = new Set<string>(); const siteCursors = new Set<string>();
  let cursor: string | null = null;
  for (let index=0;index<10;index++) {
    const query = new URLSearchParams(); if(cursor){query.set('cursor',cursor);query.set('limit','100');}
    const payload = await fetchPage('sites',query); const data=record(payload.data);
    if (!Array.isArray(data.sites) || data.sites.length>100 || !Array.isArray(data.metering_points) || data.metering_points.length>1000) throw new Error('Invalid OPS sites');
    const access=record(data.delivery_access);
    if(access.version!=='customer-supply-periods-v1' || access.complete!==true || !Array.isArray(access.windows) || access.windows.length>1000)throw new Error('OPS delivery capability unavailable');
    const pageFacilities = new Set<string>();
    for(const value of data.sites){const site=record(value);if(!ref(site.facility_reference)||facilities.has(site.facility_reference))throw new Error('Ambiguous site reference');facilities.add(site.facility_reference);pageFacilities.add(site.facility_reference);if(site.facility_reference===selection.facility){if(typeof site.facility_id!=='string'||! /^[A-Za-z0-9_-]{1,64}$/.test(site.facility_id))throw new Error('Facility ID unavailable');selected=site;}}
    for(const value of data.metering_points){const point=record(value);if(!ref(point.metering_point_reference)||!ref(point.facility_reference)||!pageFacilities.has(point.facility_reference)||points.has(point.metering_point_reference))throw new Error('Ambiguous meter scope');points.set(point.metering_point_reference,point.facility_reference);}
    for(const value of access.windows){const w=record(value);if(!ref(w.facility_reference)||!pageFacilities.has(w.facility_reference)||!ref(w.metering_point_reference)||points.get(w.metering_point_reference)!==w.facility_reference)throw new Error('Foreign delivery window');const from=instant(w.from),to=w.to===null?openWindowEnd:instant(w.to);if(from.timestamp>=to.timestamp)throw new Error('Invalid delivery range');if(w.facility_reference===selection.facility)windows.push({point:w.metering_point_reference,from,to});}
    cursor=nextPage(record(payload.page).sites);
    if(selected)break;
    if(!cursor)break;
    if(siteCursors.has(cursor)||index===9)throw new Error('Incomplete facility scan');siteCursors.add(cursor);
  }
  if(!selected || !windows.length)throw new Error('Owned facility delivery unavailable');
  // Disjoint meter histories retain their own rights even within the same facility.
  windows=windows.filter(w=>points.get(w.point)===selection.facility);
  const providerWindows=windows.map(w=>({facility:selection.facility,series:w.point,from:w.from.iso,to:w.to.iso}));
  if(!windows.some(w=>w.from.timestamp<end&&w.to.timestamp>start))return {deliveryWindows:providerWindows,items:[],complete:true};
  const items: Array<{reference:string;facility:string;from:string;to:string;kwh:number;series:string}> = [];
  const seen=new Set<string>(); const cursors=new Set<string>(); cursor=null;let complete=false;
  const pageSize = 100;
  const duration = end - start;
  // Two quarter-hour meters produce up to 192 rows per day.
  const pageBudget = duration > 20 * 86400000 ? MAX_CONSUMPTION_ITEMS / pageSize : 40;
  for(let index=0;index<pageBudget;index++){
    const query=new URLSearchParams({limit:String(pageSize),from:selection.from,to:selection.to,facility_id:selected.facility_id as string});if(cursor)query.set('cursor',cursor);
    const payload=await fetchPage('metering-values',query);
    if(!Array.isArray(payload.data)||payload.data.length>pageSize)throw new Error('Invalid metering page');
    for(const value of payload.data){const row=record(value);if(!ref(row.metering_value_reference)||seen.has(row.metering_value_reference)||!ref(row.metering_point_reference)||points.get(row.metering_point_reference)!==selection.facility)throw new Error('Foreign or duplicate metering row');seen.add(row.metering_value_reference);
      if(!['current','replaced','superseded','void'].includes(String(row.revision_status)))throw new Error('Revision authority unavailable');
      if(row.revision_status!=='current')continue;
      if(row.direction!=='consumption'||row.unit!=='kWh'||row.status!=='stored'||typeof row.quantity_kwh!=='number'||!Number.isFinite(row.quantity_kwh)||row.quantity_kwh<0)throw new Error('Unsupported metering quantity');
      const from=instant(row.period_start),to=instant(row.period_end);if(from.timestamp>=to.timestamp)throw new Error('Invalid metering range');
      if(!windows.some(w=>w.point===row.metering_point_reference&&from.timestamp>=w.from.timestamp&&to.timestamp<=w.to.timestamp))continue;
      items.push({reference:row.metering_value_reference,facility:selection.facility,series:row.metering_point_reference,from:from.iso,to:to.iso,kwh:row.quantity_kwh});
    }
    cursor=nextPage(payload.page);if(!cursor){complete=true;break;}if(cursors.has(cursor))throw new Error('Meter cursor loop');cursors.add(cursor);
  }
  return { deliveryWindows: providerWindows, items, complete };
}
