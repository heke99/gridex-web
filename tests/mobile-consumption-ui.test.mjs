import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from '../apps/mobile/node_modules/react/index.js';
import Renderer from '../apps/mobile/node_modules/react-test-renderer/index.js';
import {gridexBrand} from '../apps/mobile/brands/gridex.mjs';
const {ConsumptionPanel,parseConsumption,consumptionPeriod}=await import('../apps/mobile/src/ConsumptionPanel.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const {act}=Renderer;
const sites={data:{sites:['one','two'].map(reference=>({reference,address:reference,postalCode:null,city:null,facilityId:null,priceArea:null,status:null}))}};
const result=s=>({data:{consumption:{...s,items:[{reference:'reading_one',from:s.from,to:new Date(Date.parse(s.from)+3600000).toISOString(),kwh:3}],totalKwh:3,complete:false}}});
test('native consumption uses selected facility, aborts stale requests, renders chart and partial total',async()=>{
 const pending=[];const read=async(kind,s,signal)=>{if(kind==='sites')return sites;return new Promise(resolve=>pending.push({s,signal,resolve}));};let view;
 await act(async()=>{view=Renderer.create(React.createElement(ConsumptionPanel,{theme:gridexBrand.theme,read}));});assert.equal(pending[0].s.facility,'one');
 await act(async()=>view.root.findAllByType('Pressable')[1].props.onPress());assert.equal(pending[0].signal.aborted,true);assert.equal(pending[1].s.facility,'two');
 await act(async()=>pending[1].resolve(result(pending[1].s)));assert.ok(JSON.stringify(view.toJSON()).includes('Delvis hämtad period.'));
 await act(async()=>pending[0].resolve(result({...pending[0].s,facility:'wrong'})));assert.ok(!JSON.stringify(view.toJSON()).includes('alert'));
 await act(async()=>view.root.findAllByType('Pressable')[3].props.onPress());assert.deepEqual({from:pending[2].s.from,to:pending[2].s.to},consumptionPeriod(30));assert.ok(!JSON.stringify(view.toJSON()).includes('Delvis hämtad period.'));
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
