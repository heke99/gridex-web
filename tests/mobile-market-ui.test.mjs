import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import React from '../apps/mobile/node_modules/react/index.js';
import Renderer from '../apps/mobile/node_modules/react-test-renderer/index.js';
import {gridexBrand} from '../apps/mobile/brands/gridex.mjs';
import {marketDate} from '../apps/mobile/src/marketPriceData.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const {act}=Renderer;
const listeners=new Set();globalThis.__marketFixture={currentState:'active',addEventListener:(_key,fn)=>{listeners.add(fn);return {remove:()=>listeners.delete(fn)};}};
const {MarketPrices}=await import('../apps/mobile/src/MarketPrices.tsx');
const oldFetch=globalThis.fetch;after(()=>{globalThis.fetch=oldFetch;delete globalThis.__marketFixture;});
const payload=(area)=>({date:marketDate(),priceArea:area,sourceLabel:`Own feed ${area}`,disclaimer:'Excludes fees',entries:[{sekPerKwh:0,timeStart:`${marketDate()}T12:00:00+01:00`,timeEnd:`${marketDate()}T12:15:00+01:00`}]});
test('native market view suppresses stale area responses and never sends customer tokens',async()=>{
 const pending=[];globalThis.fetch=(url,options)=>{assert.equal(options.headers,undefined);pending.push({url,options,resolve:null});return new Promise(resolve=>{pending.at(-1).resolve=resolve;});};let view;
 await act(async()=>{view=Renderer.create(React.createElement(MarketPrices,{origin:'https://gridex.se',theme:gridexBrand.theme}));});assert.ok(pending[0].url.includes('area=SE3'));
 await act(async()=>view.root.findAllByType('Pressable')[3].props.onPress());assert.ok(pending[0].options.signal.aborted);
 await act(async()=>{pending[1].resolve(Response.json(payload('SE4')));});
 await act(async()=>{pending[0].resolve(Response.json(payload('SE3')));});
 const text=JSON.stringify(view.toJSON());assert.ok(text.includes('Own feed SE4'));assert.ok(!text.includes('Own feed SE3'));assert.ok(text.includes('0 öre/kWh'));
 await act(async()=>{for(const fn of listeners)fn('background');});assert.ok(!JSON.stringify(view.toJSON()).includes('Own feed SE4'));
 await act(async()=>view.unmount());
});
test('unconfigured template makes no request and bad provider data offers retry',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({secret:'must-not-leak'});};let view;
 await act(async()=>{view=Renderer.create(React.createElement(MarketPrices,{theme:gridexBrand.theme}));});assert.equal(calls,0);await act(async()=>view.unmount());
 await act(async()=>{view=Renderer.create(React.createElement(MarketPrices,{origin:'https://gridex.se',theme:gridexBrand.theme}));});const text=JSON.stringify(view.toJSON());assert.ok(text.includes('Elpriserna kunde inte hämtas'));assert.ok(!text.includes('must-not-leak'));await act(async()=>view.unmount());
});

test('yesterday does not poll every minute and a failed manual refresh preserves the displayed prices', async () => {
 const original = { interval: globalThis.setInterval, clear: globalThis.clearInterval, now: Date.now };
 let now = Date.parse('2026-11-22T10:00:00Z');
 let refreshClock;
 globalThis.setInterval = (callback, delay, ...args) => {
  if (delay !== 60_000) return original.interval(callback, delay, ...args);
  refreshClock = callback;
  return Symbol.for('market-clock');
 };
 globalThis.clearInterval = handle => {
  if (handle !== Symbol.for('market-clock')) original.clear(handle);
 };
 Date.now = () => now;
 let view;
 try {
  const calls = [];
  let fail = false;
  globalThis.fetch = async input => {
   const url = new URL(input);
   const date = url.searchParams.get('date');
   calls.push(date);
   if (fail) return new Response(null, { status: 503 });
   return Response.json({
    date, priceArea: 'SE3', sourceLabel: `Spotpris ${date}`, disclaimer: 'Marknadsinformation',
    entries: [{ sekPerKwh: 0.1, timeStart: `${date}T12:00:00+01:00`, timeEnd: `${date}T12:15:00+01:00` }],
   });
  };
  await act(async () => { view = Renderer.create(React.createElement(MarketPrices, { origin: 'https://gridex.se', theme: gridexBrand.theme })); });
  await act(async () => view.root.findAllByType('Pressable')[4].props.onPress());
  assert.deepEqual(calls, ['2026-11-22', '2026-11-21']);
  for (const minutes of [1, 1, 15]) {
   now += minutes * 60_000;
   await act(async () => refreshClock());
  }
  assert.equal(calls.length, 2);

  fail = true;
  await act(async () => view.root.findAllByType('Pressable').at(-1).props.onPress());
  assert.equal(calls.length, 3);
  const output = JSON.stringify(view.toJSON());
  assert.ok(output.includes('Spotpris 2026-11-21'));
  assert.ok(output.includes('Elpriserna kunde inte hämtas'));
 } finally {
  if (view) await act(async () => view.unmount());
  globalThis.setInterval = original.interval;
  globalThis.clearInterval = original.clear;
  Date.now = original.now;
 }
});
