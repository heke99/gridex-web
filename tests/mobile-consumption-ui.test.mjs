import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from '../apps/mobile/node_modules/react/index.js';
import Renderer from '../apps/mobile/node_modules/react-test-renderer/index.js';
import {gridexBrand} from '../apps/mobile/brands/gridex.mjs';
const {ConsumptionPanel,parseConsumption,parseDailyConsumption,consumptionPeriod}=await import('../apps/mobile/src/ConsumptionPanel.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const {act}=Renderer;
const sites={data:{sites:['one','two'].map(reference=>({reference,address:reference,postalCode:null,city:null,facilityId:null,priceArea:null,status:null}))}};
const result=s=>({data:{consumption:{...s,items:[{reference:'reading_one',from:s.from,to:new Date(Date.parse(s.from)+3600000).toISOString(),kwh:3}],totalKwh:3,complete:false}}});
test('native consumption uses selected facility, aborts stale requests, renders chart and partial total',async()=>{
 const pending=[];const read=async(kind,s,signal)=>{if(kind==='sites')return sites;return new Promise(resolve=>pending.push({s,signal,resolve}));};let view;
 await act(async()=>{view=Renderer.create(React.createElement(ConsumptionPanel,{theme:gridexBrand.theme,read}));});assert.equal(pending[0].s.facility,'one');
 await act(async()=>view.root.findAllByType('Pressable')[1].props.onPress());assert.equal(pending[0].signal.aborted,true);assert.equal(pending[1].s.facility,'two');
 await act(async()=>pending[1].resolve(result(pending[1].s)));assert.ok(JSON.stringify(view.toJSON()).includes('Fler sidor kan finnas.'));
 await act(async()=>pending[0].resolve(result({...pending[0].s,facility:'wrong'})));assert.ok(!JSON.stringify(view.toJSON()).includes('alert'));
 await act(async()=>view.root.findAllByType('Pressable')[3].props.onPress());assert.deepEqual({from:pending[2].s.from,to:pending[2].s.to},consumptionPeriod(30));assert.ok(!JSON.stringify(view.toJSON()).includes('Fler sidor kan finnas.'));
 await act(async()=>view.unmount());assert.equal(pending[2].signal.aborted,true);
});
test('native failed provider exposes retry, never raw body; empty sites no meter call',async()=>{
 let view,calls=0;const read=async kind=>{calls++;if(kind==='sites')return {data:{sites:[]}};throw new Error('secret');};
 await act(async()=>{view=Renderer.create(React.createElement(ConsumptionPanel,{theme:gridexBrand.theme,read}));});assert.equal(calls,1);assert.ok(JSON.stringify(view.toJSON()).includes('inga hämtade anläggningar'));await act(async()=>view.unmount());
 await act(async()=>{view=Renderer.create(React.createElement(ConsumptionPanel,{theme:gridexBrand.theme,read:async kind=>kind==='sites'?sites:Promise.reject(new Error('private secret'))}));});const text=JSON.stringify(view.toJSON());assert.ok(text.includes('Leveransperioden måste kunna verifieras'));assert.ok(!text.includes('private secret'));await act(async()=>view.unmount());
});
test('native rejects wrong selection, totals, overlapping revisions and foreign periods',()=>{
 const s={facility:'one',from:'2026-11-01T00:00:00.000Z',to:'2026-11-08T00:00:00.000Z'};const valid=result(s);assert.equal(parseConsumption(valid,s).totalKwh,3);
 for(const patch of [{facility:'foreign'},{totalKwh:9},{items:[...valid.data.consumption.items,...valid.data.consumption.items]},{items:[{...valid.data.consumption.items[0],from:'2026-10-31T00:00:00.000Z'}]}])assert.throws(()=>parseConsumption({data:{consumption:{...valid.data.consumption,...patch}}},s));
});

test('consumption periods use Stockholm calendar boundaries over spring and autumn DST',()=>{
 const spring=consumptionPeriod(7,new Date('2026-03-29T12:00:00Z'));assert.equal(Date.parse(spring.to)-Date.parse(spring.from),(7*24-1)*3600000);
 const autumn=consumptionPeriod(7,new Date('2026-10-25T12:00:00Z'));assert.equal(Date.parse(autumn.to)-Date.parse(autumn.from),(7*24+1)*3600000);
 assert.equal(consumptionPeriod(7,new Date('2026-11-06T23:30:00Z')).to,'2026-11-07T23:00:00.000Z');
});
test('native allows simultaneous independent meters but rejects overlap within one meter',()=>{
 const s={facility:'one',from:'2026-11-01T00:00:00.000Z',to:'2026-11-08T00:00:00.000Z'};
 const body=result(s);const first=body.data.consumption.items[0];body.data.consumption.items=[{...first,series:'meter_one'},{...first,reference:'second',series:'meter_two'}];body.data.consumption.totalKwh=6;
 assert.equal(parseConsumption(body,s).totalKwh,6);
 body.data.consumption.items[1].series='meter_one';assert.throws(()=>parseConsumption(body,s));
});


test('empty, partial and measured zero consumption use distinct labels', async () => {
 for (const [mode, expected, coverage, pages] of [
  ['empty', 'Mätvärden saknas', '0 av 7', 'Alla tillgängliga sidor har hämtats.'],
  ['partial', '3 kWh i hämtade mätvärden', '1 av 7', 'Fler sidor kan finnas.'],
  ['zero', '0 kWh i hämtade mätvärden', '1 av 7', 'Alla tillgängliga sidor har hämtats.'],
 ]) {
  let view;
  const read = async (kind, selection) => {
   if (kind === 'sites') return sites;
   const payload = result(selection);
   const data = payload.data.consumption;
   if (mode !== 'partial') data.complete = true;
   if (mode === 'empty') { data.items = []; data.totalKwh = 0; }
   if (mode === 'zero') { data.items[0].kwh = 0; data.totalKwh = 0; }
   return payload;
  };
  await act(async () => { view = Renderer.create(React.createElement(ConsumptionPanel, { theme: gridexBrand.theme, read })); });
  const rendered = JSON.stringify(view.toJSON());
  assert.ok(rendered.includes(expected), mode);
  assert.ok(rendered.replace(/["\s,]/g, '').includes(coverage.replace(/\s/g, '')), mode);
  assert.ok(rendered.includes(pages), mode);
  if (mode === 'empty') assert.ok(!rendered.includes('0 kWh i hämtade mätvärden'));
  await act(async () => view.unmount());
 }
});

test('the native 30-day selection displays all days for two quarter-hour meters', async () => {
 let view;
 const read = async (kind, selection) => {
  if (kind === 'sites') return sites;
  const start = Date.parse(selection.from);
  const quarter = 900000;
  const count = (Date.parse(selection.to) - start) / quarter;
  const items = Array.from({ length: count * 2 }, (_, i) => {
   const offset = Math.floor(i / 2) * quarter;
   return {
    reference: `reading_${i}`,
    series: i % 2 ? 'meter_one' : 'meter_two',
    from: new Date(start + offset).toISOString(),
    to: new Date(start + offset + quarter).toISOString(),
    kwh: 1,
   };
  });
  return { data: { consumption: { ...selection, items, totalKwh: items.length, complete: true } } };
 };
 await act(async () => {
  view = Renderer.create(React.createElement(ConsumptionPanel, { theme: gridexBrand.theme, read }));
 });
 await act(async () => view.root.findAllByType('Pressable')[3].props.onPress());
 const rendered = JSON.stringify(view.toJSON());
 assert.ok(rendered.replace(/["\s,]/g, '').includes('30av30'));
 assert.ok(rendered.includes('Alla tillgängliga sidor har hämtats.'));
 await act(async () => view.unmount());
});

test('rerendering consumption reuses grouping across the Swedish autumn clock change', async () => {
 const OriginalDate = globalThis.Date;
 const prototype = Intl.DateTimeFormat.prototype;
 const format = Object.getOwnPropertyDescriptor(prototype, 'format');
 let calls = 0, view;
 globalThis.Date = class extends OriginalDate {
  constructor(...args) { super(...(args.length ? args : ['2026-10-25T12:00:00Z'])); }
 };
 Object.defineProperty(prototype, 'format', {
  ...format,
  get() {
   const bound = format.get.call(this);
   return (...args) => { calls++; return bound(...args); };
  },
 });
 try {
  const times = ['2026-10-24T21:45:00Z', '2026-10-24T22:00:00Z', '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z'];
  const read = async (kind, selection) => kind === 'sites' ? sites : ({
   data: { consumption: { ...selection, complete: true, totalKwh: 4,
    items: times.map((from, index) => ({
     reference: `reading_${index}`, from, to: new Date(Date.parse(from) + 900000).toISOString(), kwh: 1,
    })),
   } },
  });
  const panel = theme => React.createElement(ConsumptionPanel, { theme, read });
  await act(async () => { view = Renderer.create(panel(gridexBrand.theme)); });
  const counts = () => view.root.findAllByType('View').map(node => node.props.accessibilityLabel).filter(Boolean);
  assert.deepEqual(counts(), ['2026-10-24: 1.00 kilowattimmar', '2026-10-25: 3.00 kilowattimmar']);
  calls = 0;
  await act(async () => view.update(panel({ ...gridexBrand.theme })));
  assert.deepEqual(counts(), ['2026-10-24: 1.00 kilowattimmar', '2026-10-25: 3.00 kilowattimmar']);
  assert.equal(calls, 2, 'only the displayed range boundaries are formatted again');
 } finally {
  if (view) await act(async () => view.unmount());
  globalThis.Date = OriginalDate;
  Object.defineProperty(prototype, 'format', format);
 }
});

test('native chart accepts compact days, preserves measured zero and rejects malformed coverage', async () => {
 const read = async (kind, selection) => {
  if (kind === 'sites') return sites;
  const date = new Intl.DateTimeFormat('sv-SE', {
   timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(selection.from));
  return { data: { consumption: { ...selection, days: [{ date, kwh: 0, intervals: 23 }], totalKwh: 0, complete: false } } };
 };
 let view;
 await act(async () => { view = Renderer.create(React.createElement(ConsumptionPanel, { theme: gridexBrand.theme, read })); });
 assert.ok(JSON.stringify(view.toJSON()).includes('0 kWh i hämtade mätvärden'));
 assert.ok(JSON.stringify(view.toJSON()).includes('Fler sidor kan finnas.'));
 await act(async () => view.unmount());
 const selection = { facility: 'one', ...consumptionPeriod(7, new Date('2026-03-29T12:00:00Z')) };
 const valid = await read('consumption', selection);
 assert.equal(parseDailyConsumption(valid, selection).days[0].intervals, 23);
 for (const patch of [{ intervals: 0 }, { intervals: 6401 }, { date: '2026-02-30' }, { kwh: 4 }]) {
  const invalid = structuredClone(valid);
  Object.assign(invalid.data.consumption.days[0], patch);
  assert.throws(() => parseDailyConsumption(invalid, selection));
 }
});
