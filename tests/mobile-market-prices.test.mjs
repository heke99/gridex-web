import test from 'node:test';
import assert from 'node:assert/strict';
import {marketDate,relativeMarketDate,nextMarketEntry,marketPriceUrl,parseMarketDay,currentMarketPrice} from '../apps/mobile/src/marketPriceData.ts';
const date='2026-11-06';
const entry=(sekPerKwh=0,timeStart=`${date}T00:00:00+01:00`,timeEnd=`${date}T01:00:00+01:00`)=>({sekPerKwh,timeStart,timeEnd});
const payload=(entries)=>({priceArea:'SE3',date,sourceLabel:'Own public price feed',disclaimer:'Spot prices exclude fees',entries});
test('market day handles zero, negative and absent prices without invented values',()=>{
 const day=parseMarketDay(payload([entry(0),entry(-1,`${date}T01:00:00+01:00`,`${date}T02:00:00+01:00`)]),'SE3',date);
 assert.equal(day.average,-0.5);assert.equal(currentMarketPrice(day,Date.parse(`${date}T00:15:00+01:00`)),0);assert.equal(currentMarketPrice(day,Date.parse(`${date}T01:15:00+01:00`)),-1);assert.equal(currentMarketPrice(day,Date.parse(`${date}T02:15:00+01:00`)),null);
 assert.equal(parseMarketDay(payload([]),'SE3',date).average,null);
});
test('published interval mean is duration weighted and excludes unknown intervals',()=>{
 const day=parseMarketDay(payload([entry(0,`${date}T00:00:00+01:00`,`${date}T00:15:00+01:00`),entry(2,`${date}T00:15:00+01:00`,`${date}T01:00:00+01:00`)]),'SE3',date);assert.equal(day.average,1.5);
});
test('wrong area/day, overlapping intervals and malformed prices are rejected',()=>{
 for(const body of [{...payload([]),priceArea:'SE4'},{...payload([]),date:'2026-11-05'},payload([entry(),entry()]),payload([entry(NaN)]),payload([entry('0')]),payload([entry(1,`${date}T00:00:00`,`${date}T01:00:00`)]),payload([entry(1,'2026-11-05T00:00:00Z','2026-11-05T01:00:00Z')])])assert.throws(()=>parseMarketDay(body,'SE3',date));
});
test('Stockholm market date and repeated autumn hours preserve their distinct instants',()=>{
 assert.equal(marketDate(new Date('2026-11-05T23:30:00Z')),date);
 const day=parseMarketDay({...payload([entry(1,'2026-10-25T02:00:00+02:00','2026-10-25T02:00:00+01:00'),entry(2,'2026-10-25T02:00:00+01:00','2026-10-25T03:00:00+01:00')]),date:'2026-10-25'},'SE3','2026-10-25');assert.equal(day.entries.length,2);assert.equal(day.average,1.5);
});
test('price provider is replaceable without OPS or customer credentials',()=>{
 assert.equal(marketPriceUrl('https://buyer.test','SE1',date,'/public/prices'),'https://buyer.test/public/prices/day?area=SE1&date=2026-11-06');
 assert.throws(()=>marketPriceUrl('http://unsafe.test','SE1',date));assert.throws(()=>marketPriceUrl('https://buyer.test','SE5',date));assert.throws(()=>marketPriceUrl('https://buyer.test','SE1','2026-02-30'));
});

test('relative days follow the Stockholm calendar across DST and year boundaries', () => {
 const midnight = new Date('2026-10-24T22:30:00Z');
 assert.equal(relativeMarketDate(-1, midnight), '2026-10-24');
 assert.equal(relativeMarketDate(1, midnight), '2026-10-26');
 assert.equal(relativeMarketDate(1, new Date('2026-12-31T12:00:00Z')), '2027-01-01');
});

test('next interval preserves a published zero and returns null after the final start', () => {
 const day = parseMarketDay(payload([entry()]), 'SE3', date);
 const start = Date.parse(day.entries[0].timeStart);
 assert.equal(nextMarketEntry(day, start - 1)?.sekPerKwh, 0);
 assert.equal(nextMarketEntry(day, start), null);
 assert.throws(() => parseMarketDay(payload([entry(Number.MAX_VALUE)]), 'SE3', date));
});
