import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { MobileBrand } from '../../../packages/mobile-foundation/src/brand';
import { MAX_CONSUMPTION_ITEMS, consumptionSelection, summarizeDailyConsumption, type DailyConsumption, type Consumption, type ConsumptionSelection } from '../../../packages/customer-backend/consumption.mjs';
import type { ConsumptionPreference } from './useCustomerAccount';
import { parseCustomerRows, type CustomerRow } from './customerData';

type Read = (kind: 'sites' | 'consumption', query: Record<string, string>, signal: AbortSignal) => Promise<unknown>;
const stockholmDate = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'});
const localDate = (value: Date) => stockholmDate.format(value);
/** Calendar days in Stockholm, including 23/25-hour DST days. Wire instants stay UTC. */
export function consumptionPeriod(days: number, now = new Date()) {
  if (![7,30].includes(days)) throw new Error('Invalid period');
  const [year,month,day] = localDate(now).split('-').map(Number);
  const end = Date.UTC(year,month-1,day+1);
  const midnight = (utc: number) => {
    const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(utc));
    const n = (key: string) => Number(parts.find(p=>p.type===key)?.value);
    const offset = Date.UTC(n('year'),n('month')-1,n('day'),n('hour'),n('minute'),n('second'))-utc;
    return new Date(utc-offset).toISOString();
  };
  return {from:midnight(end-days*86400000),to:midnight(end)};
}
export function parseConsumption(body: unknown, expected: ConsumptionSelection): Consumption {
  const value = (body as {data?:{consumption?:Consumption}})?.data?.consumption;
  if (!value || value.facility !== expected.facility || value.from !== expected.from || value.to !== expected.to || typeof value.complete !== 'boolean' || !Array.isArray(value.items) || value.items.length > MAX_CONSUMPTION_ITEMS) throw new Error('Invalid consumption response');
  consumptionSelection(value && {facility:value.facility,from:value.from,to:value.to});
  const seen = new Set<string>(); const seriesEnds = new Map<string,number>(); let sum = 0;
  for (const row of value.items) {
    if (!row || typeof row !== 'object') throw new Error('Invalid consumption interval');
    const series = row.series ?? '';
    if (row.series !== undefined && (typeof row.series !== 'string' || !/^[A-Za-z0-9_-]{1,240}$/.test(row.series))) throw new Error('Invalid meter series');
    if (!row || typeof row.reference !== 'string' || !/^[A-Za-z0-9_-]{1,240}$/.test(row.reference) || seen.has(row.reference) || typeof row.kwh !== 'number' || !Number.isFinite(row.kwh) || row.kwh < 0 || typeof row.from !== 'string' || typeof row.to !== 'string' || !Number.isFinite(Date.parse(row.from)) || !Number.isFinite(Date.parse(row.to)) || Date.parse(row.from) < (seriesEnds.get(series) ?? Date.parse(expected.from)) || Date.parse(row.to) <= Date.parse(row.from) || Date.parse(row.to) > Date.parse(expected.to)) throw new Error('Invalid consumption interval');
    seen.add(row.reference); seriesEnds.set(series,Date.parse(row.to)); sum += row.kwh;
  }
  if (!Number.isFinite(sum) || !Number.isFinite(value.totalKwh) || Math.abs(sum - value.totalKwh) > 0.000001) throw new Error('Invalid consumption total');
  return { ...expected, items: value.items.map(r=>({reference:r.reference,from:r.from,to:r.to,kwh:r.kwh,...(r.series===undefined?{}:{series:r.series})})), totalKwh:sum, complete:value.complete };
}
export function parseDailyConsumption(body: unknown, expected: ConsumptionSelection): DailyConsumption {
  const value = (body as { data?: { consumption?: DailyConsumption } })?.data?.consumption;
  if (!value || typeof value !== 'object' || !('days' in value)) return summarizeDailyConsumption(parseConsumption(body, expected));
  if (value.facility !== expected.facility || value.from !== expected.from || value.to !== expected.to ||
      typeof value.complete !== 'boolean' || !Array.isArray(value.days) || value.days.length > 33) throw new Error('Invalid daily consumption');
  const first = localDate(new Date(expected.from));
  const last = localDate(new Date(Date.parse(expected.to) - 1));
  let previous = '';
  let total = 0;
  let intervals = 0;
  const days = value.days.map(day => {
    if (!day || typeof day.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
        day.date <= previous || day.date < first || day.date > last ||
        new Date(Date.parse(day.date)).toJSON()?.slice(0, 10) !== day.date ||
        !Number.isFinite(day.kwh) || day.kwh < 0 || !Number.isSafeInteger(day.intervals) || day.intervals <= 0) {
      throw new Error('Invalid consumption day');
    }
    previous = day.date;
    total += day.kwh;
    intervals += day.intervals;
    return { date: day.date, kwh: day.kwh, intervals: day.intervals };
  });
  if (!Number.isFinite(total) || !Number.isFinite(value.totalKwh) ||
      Math.abs(total - value.totalKwh) > Math.max(0.000001, total * 1e-12) || intervals > MAX_CONSUMPTION_ITEMS) {
    throw new Error('Invalid daily consumption total');
  }
  return { ...expected, days, totalKwh: total, complete: value.complete };
}
export function ConsumptionPanel({ theme:t, read, initialPreference, onPreferenceChange }: {
  theme: MobileBrand['theme'];
  read: Read;
  initialPreference?: ConsumptionPreference;
  onPreferenceChange?: (selection: ConsumptionPreference) => void;
}) {
  const [sites,setSites]=useState<CustomerRow[]>([]);
  const [preferredFacility] = useState(initialPreference?.facility ?? '');
  const [facility,setFacility]=useState('');
  const [days,setDays]=useState(initialPreference?.days ?? 7);
  const [tick,setTick]=useState(0);
  const [data,setData]=useState<DailyConsumption|null>(null); const [busy,setBusy]=useState(true); const [error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController(); let current=true; const timeout=setTimeout(()=>controller.abort(),20000);
    void (async()=>{
      await Promise.resolve(); if(!current)return;
      setBusy(true);setData(null);setError('');
      if (!facility) {
        const rows = parseCustomerRows('sites', await read('sites', {}, controller.signal));
        if (!current || controller.signal.aborted) return;
        setSites(rows);
        const selected = rows.find(row => row.reference === preferredFacility) ?? rows[0];
        if (selected) {
          setFacility(selected.reference);
          onPreferenceChange?.({ facility: selected.reference, days });
        }
        return;
      }
      const selection={facility,...consumptionPeriod(days)};
      const result=parseDailyConsumption(await read('consumption',selection,controller.signal),selection);
      if(current&&!controller.signal.aborted)setData(result);
    })().catch(()=>{if(current)setError('Förbrukningen kan inte visas just nu. Leveransperioden måste kunna verifieras. Försök igen senare.');}).finally(()=>{clearTimeout(timeout);if(current)setBusy(false);});
    return ()=>{current=false;controller.abort();clearTimeout(timeout);};
  },[read,facility,days,tick,preferredFacility,onPreferenceChange]);
  const daily = data?.days ?? [];
  const max = Math.max(1, ...daily.map(day => day.kwh));
  const button={minHeight:48,padding:12,borderWidth:1,borderColor:t.muted,borderRadius:10};
  return <View style={{gap:12}}>
    <Text accessibilityRole="header" style={{color:t.text,fontSize:22}}>Din förbrukning</Text>
    <Text style={{color:t.muted}}>Välj anläggning och period. Period och startdygn visas i svensk tid. Saknade mätvärden räknas inte som noll.</Text>
    {sites.map(site=><Pressable key={site.reference} accessibilityRole="button" accessibilityState={{selected:facility===site.reference}} onPress={()=>{if (site.reference !== facility) { setData(null); setFacility(site.reference); onPreferenceChange?.({ facility: site.reference, days }); }}} style={[button,{borderColor:facility===site.reference?t.accent:t.muted}]}><Text style={{color:t.text}}>{site.address??site.facilityId??site.reference}</Text></Pressable>)}
    <View style={{flexDirection:'row',gap:8}}>{[7,30].map(n=><Pressable key={n} accessibilityRole="button" accessibilityState={{selected:days===n}} onPress={()=>{if (n !== days) { setData(null); setDays(n); onPreferenceChange?.({ facility, days: n }); }}} style={[button,{borderColor:days===n?t.accent:t.muted}]}><Text style={{color:t.text}}>{n} dagar</Text></Pressable>)}</View>
    {busy&&<ActivityIndicator accessibilityLabel="Hämtar förbrukning" color={t.accent}/>}
    {!busy&&!error&&!sites.length&&<Text style={{color:t.muted}}>Du har inga hämtade anläggningar.</Text>}
    {error!==''&&<Text accessibilityRole="alert" style={{color:t.text}}>{error}</Text>}
    {data&&<>
      <Text style={{color:t.text}}>{daily.length
        ? `${data.totalKwh.toLocaleString('sv-SE',{maximumFractionDigits:2})} kWh i hämtade mätvärden`
        : 'Mätvärden saknas'}</Text>
      <Text style={{color:t.muted}}>{localDate(new Date(data.from))} – {localDate(new Date(data.to))} (slutgränsen ingår inte). {data.complete?'Alla tillgängliga sidor har hämtats.':'Fler sidor kan finnas.'}</Text>
      <Text style={{color:t.muted}}>Dagar med hämtade mätvärden: {daily.length} av {days}.</Text>
      {daily.map(({date,kwh})=><View key={date} accessible accessibilityLabel={`${date}: ${kwh.toFixed(2)} kilowattimmar`} style={{gap:4}}><Text style={{color:t.text}}>{date}: {kwh.toFixed(2)} kWh</Text><View style={{height:12,width:`${100*kwh/max}%`,backgroundColor:t.accent,borderRadius:4}}/></View>)}
    </>}
    <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{disabled:busy}} onPress={()=>{setData(null);setTick(v=>v+1);}} style={button}><Text style={{color:t.accent}}>Hämta förbrukning igen</Text></Pressable>
  </View>;
}
