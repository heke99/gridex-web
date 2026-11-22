export const MAX_CONSUMPTION_ITEMS = 6400;
const reference = /^[A-Za-z0-9_-]{1,240}$/;
const series = v => v === undefined || typeof v === 'string' && reference.test(v);
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return NaN;
  const date = new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) && date.toISOString() === value ? timestamp : NaN;
}

function selectionBounds(value) {
  if (!value || Object.keys(value).some(key => !['facility', 'from', 'to'].includes(key)) ||
      typeof value.facility !== 'string' || !reference.test(value.facility)) throw new Error('Invalid consumption selection');
  const from = instant(value.from), to = instant(value.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || !value.from.endsWith('.000Z') || !value.to.endsWith('.000Z')) {
    throw new Error('Invalid consumption selection');
  }
  const duration = to - from;
  if (duration <= 0 || duration > 32 * 86400000) throw new Error('Invalid consumption period');
  return { from, to };
}

export function consumptionSelection(value) {
  selectionBounds(value);
  return { facility: value.facility, from: value.from, to: value.to };
}

/** Trusted provider must supply authoritative customer delivery windows for this facility.
 * Ownership or meter installation dates are NOT substitutes for delivery authorization. */
export function projectConsumption(input, selection) {
  const bounds = selectionBounds(selection);
  const { facility } = selection;
  if (!input || !Array.isArray(input.deliveryWindows) || !input.deliveryWindows.length ||
      !Array.isArray(input.items) || input.items.length > MAX_CONSUMPTION_ITEMS || typeof input.complete !== 'boolean') {
    throw new Error('Verified delivery windows required');
  }
  const windows = input.deliveryWindows.map(window => {
    const from = instant(window.from), to = instant(window.to);
    if (!series(window.series) || window.facility !== facility || !(from < to)) throw new Error('Invalid delivery window');
    return { from, to, series: window.series };
  });
  const seen = new Set();
  const selected = [];
  for (const row of input.items) {
    if (!row || !series(row.series) || typeof row.reference !== 'string' || !reference.test(row.reference) ||
        row.facility !== facility || typeof row.kwh !== 'number' || !Number.isFinite(row.kwh) || row.kwh < 0 || seen.has(row.reference)) {
      throw new Error('Invalid consumption row');
    }
    const from = instant(row.from), to = instant(row.to);
    if (!(from < to)) throw new Error('Invalid consumption row');
    seen.add(row.reference);
    if (from < bounds.from || to > bounds.to || !windows.some(window =>
      window.series === row.series && from >= window.from && to <= window.to)) continue;
    selected.push({ row, from, to });
  }
  selected.sort((a, b) => a.from - b.from);

  // Overlapping revisions cannot be summed safely.
  const seriesEnds = new Map();
  let totalKwh = 0;
  const items = selected.map(({ row, from, to }) => {
    const key = row.series ?? '';
    if (from < (seriesEnds.get(key) ?? -Infinity)) throw new Error('Overlapping consumption intervals');
    seriesEnds.set(key, to);
    totalKwh += row.kwh;
    return { reference: row.reference, from: row.from, to: row.to, kwh: row.kwh, ...(row.series === undefined ? {} : { series: row.series }) };
  });
  if (!Number.isFinite(totalKwh)) throw new Error('Invalid total');
  return { facility, from: selection.from, to: selection.to, items, totalKwh, complete: input.complete };
}
export const DAILY_CONSUMPTION_MEDIA_TYPE = 'application/vnd.gridex.consumption-daily+json';

const stockholmDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function summarizeDailyConsumption({ items, ...period }) {
  const days = new Map();
  for (const row of items) {
    const date = stockholmDate.format(new Date(row.from));
    const day = days.get(date) ?? { date, kwh: 0, intervals: 0 };
    day.kwh += row.kwh;
    day.intervals++;
    days.set(date, day);
  }
  return { ...period, days: [...days.values()] };
}

const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export function createConsumptionHandler({enabled=()=>true,authenticate,load}) {
 const reply=(status,body)=>Response.json(body,{status,headers});
 return async request=>{
  const cancelled = () => new Response(null, { status: 499, headers });
  if(request.signal.aborted)return cancelled();
  if(!enabled())return reply(404,{error:'Not found'});
  if(request.method!=='GET')return reply(405,{error:'Method not allowed'});
  const query=new URL(request.url).searchParams;let selection;
  try{if([...query.keys()].some(k=>!['facility','from','to'].includes(k))||['facility','from','to'].some(k=>query.getAll(k).length!==1))throw new Error();selection=consumptionSelection(Object.fromEntries(query));}catch{return reply(400,{error:'Invalid period or facility'});}
  const token=/^Bearer ([A-Za-z0-9._~-]{16,8192})$/.exec(request.headers.get('authorization')??'')?.[1];
  if(!token)return reply(401,{error:'Authentication required'});
  try {
   const binding = await authenticate(token);
   request.signal.throwIfAborted();
   if (!binding) return reply(401, { error: 'Authentication required' });
   const provider = await load(binding, selection, request.signal);
   request.signal.throwIfAborted();
   const consumption = projectConsumption(provider, selection);
   const daily = request.headers.get('accept') === DAILY_CONSUMPTION_MEDIA_TYPE;
   return Response.json({ data: { consumption: daily ? summarizeDailyConsumption(consumption) : consumption } }, {
    headers: daily ? { ...headers, 'Content-Type': DAILY_CONSUMPTION_MEDIA_TYPE, Vary: 'Accept' } : { ...headers, Vary: 'Accept' },
   });
  } catch {
   if (request.signal.aborted) return cancelled();
   return reply(503, { error: 'Förbrukningen kan inte visas innan leveransperioden har verifierats.' });
  }
 };
}
