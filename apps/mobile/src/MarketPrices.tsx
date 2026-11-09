import React,{useEffect,useState} from 'react';
import {ActivityIndicator,AppState,Pressable,Text,View} from 'react-native';
import type {MobileTheme} from '../../../packages/mobile-foundation/src/brand';
import {currentMarketPrice,marketDate,marketPriceUrl,parseMarketDay,priceAreas,type MarketDay,type PriceArea} from './marketPrices';
const ore=(value:number)=>`${(value*100).toLocaleString('sv-SE',{maximumFractionDigits:2})} öre/kWh`;
const time=(value:string)=>new Date(value).toLocaleTimeString('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit',timeZoneName:'shortOffset'});
export function MarketPrices({origin,theme:t}:{origin?:string;theme:MobileTheme}){
 const [area,setArea]=useState<PriceArea>('SE3'),[day,setDay]=useState<MarketDay|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[tick,setTick]=useState(0);
 const [showIntervals,setShowIntervals]=useState(false);
 const [active,setActive]=useState(AppState.currentState==='active');
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{setActive(state==='active');if(state==='active')setTick(v=>v+1);});return()=>sub.remove();},[]);
 useEffect(()=>{
  let current=true;const controller=new AbortController();setDay(null);setError('');
  if(!origin||!active){setBusy(false);return()=>controller.abort();}
  const date=marketDate();setBusy(true);const timer=setTimeout(()=>controller.abort(),15000);
  void(async()=>{try{
   const response=await fetch(marketPriceUrl(origin,area,date,process.env.EXPO_PUBLIC_PRICES_PATH),{signal:controller.signal,redirect:'error'});
   if(!response.ok)throw Error('Unavailable');const parsed=parseMarketDay(await response.json(),area,date);
   if(current)setDay(parsed);
  }catch{if(current)setError('Elpriserna kunde inte hämtas. Försök igen.');}finally{clearTimeout(timer);if(current)setBusy(false);}})();
  return()=>{current=false;controller.abort();clearTimeout(timer);};
 },[origin,area,active,tick]);
 // Refresh the current interval and the calendar date while the screen stays open.
 useEffect(()=>{if(!active)return;const timer=setInterval(()=>setTick(v=>v+1),60000);return()=>clearInterval(timer);},[active]);
 if(!origin)return <Text style={{color:t.muted}}>Pristjänsten är inte ansluten.</Text>;
 const current=day?currentMarketPrice(day):null;
 const prices = day?.entries.map(entry => entry.sekPerKwh) ?? [];
 const range = prices.length ? prices.reduce(
  ([low, high], price) => [Math.min(low, price), Math.max(high, price)],
  [prices[0], prices[0]],
 ) : null;
 return <View style={{gap:14,backgroundColor:t.surface,padding:20,borderRadius:20}}>
  <Text accessibilityRole="header" style={{color:t.text,fontSize:20}}>Dagens spotpris</Text>
  <View style={{flexDirection:'row',gap:12,flexWrap:'wrap'}}>{priceAreas.map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:value===area}} onPress={()=>setArea(value)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:value===area?t.accent:t.muted}}>{value}</Text></Pressable>)}</View>
  {busy&&<ActivityIndicator accessibilityLabel="Hämtar elpriser" color={t.accent}/>}
  {day&&<>
   <Text style={{color:t.text}}>{day.date} · {day.area}</Text>
   <Text style={{color:t.text,fontSize:24}}>Just nu: {current===null?'Uppgift saknas':ore(current)}</Text>
   <Text style={{color:t.text}}>Medelpris för publicerade intervall: {day.average===null?'Uppgift saknas':ore(day.average)}</Text>
   {range&&<Text style={{color:t.text}}>Lägsta: {ore(range[0])} · Högsta: {ore(range[1])}</Text>}
   <Text style={{color:t.muted}}>Källa: {day.source}</Text><Text style={{color:t.muted}}>{day.disclaimer}</Text>
   {day.entries.length===0&&<Text style={{color:t.muted}}>Inga priser har publicerats för det valda dygnet.</Text>}
   {day.entries.length>0&&<Pressable accessibilityRole="button" accessibilityState={{expanded:showIntervals}} onPress={()=>setShowIntervals(value=>!value)} style={{minHeight:48,justifyContent:'center'}}>
    <Text style={{color:t.accent}}>{showIntervals?'Dölj intervallpriser':`Visa alla ${day.entries.length} intervallpriser`}</Text>
   </Pressable>}
   {showIntervals&&day.entries.map(entry=><View key={entry.timeStart} style={{flexDirection:'row',justifyContent:'space-between',gap:10}}><Text style={{color:t.muted}}>{time(entry.timeStart)}–{time(entry.timeEnd)}</Text><Text style={{color:t.text}}>{ore(entry.sekPerKwh)}</Text></View>)}
  </>}
  {error!==''&&<Text accessibilityRole="alert" style={{color:t.text}}>{error}</Text>}
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setTick(v=>v+1)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:t.accent}}>Uppdatera elpriser</Text></Pressable>
 </View>;
}
