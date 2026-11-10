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
