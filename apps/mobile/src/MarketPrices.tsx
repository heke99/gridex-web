import React,{useEffect,useState} from 'react';
import {ActivityIndicator,AppState,Pressable,Text,View} from 'react-native';
import type {MobileTheme} from '../../../packages/mobile-foundation/src/brand';
import {currentMarketPrice,nextMarketEntry,relativeMarketDate,marketPriceUrl,parseMarketDay,priceAreas,type MarketDay,type PriceArea} from './marketPriceData';
const ore=(value:number)=>`${(value*100).toLocaleString('sv-SE',{maximumFractionDigits:2})} öre/kWh`;
const marketTimeFormatter = new Intl.DateTimeFormat('sv-SE', {
 timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset',
});
const time = (value: string) => marketTimeFormatter.format(new Date(value));
const dayOptions = [[-1, 'Igår'], [0, 'Idag'], [1, 'Imorgon']] as const;
export function MarketPrices({origin,theme:t}:{origin?:string;theme:MobileTheme}){
 const [area, setArea] = useState<PriceArea>('SE3');
 const [loaded, setLoaded] = useState<{ origin: string; day: MarketDay } | null>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [refreshCount, setRefreshCount] = useState(0);
 const [now, setNow] = useState(() => Date.now());
 const [dayOffset, setDayOffset] = useState<-1 | 0 | 1>(0);
 const [showIntervals, setShowIntervals] = useState(false);
 const [active, setActive] = useState(AppState.currentState === 'active');
 const date = relativeMarketDate(dayOffset, new Date(now));
 const publicationWindow = dayOffset === -1 ? null : Math.floor(now / (15 * 60_000));

 useEffect(() => {
  const sub = AppState.addEventListener('change', state => {
   if (state === 'active') setNow(Date.now());
   setActive(state === 'active');
  });
  return () => sub.remove();
 }, []);

 useEffect(() => {
  if (!active) return;
  const timer = setInterval(() => setNow(Date.now()), 60_000);
  return () => clearInterval(timer);
 }, [active]);

 useEffect(() => {
  let current = true;
  const controller = new AbortController();
  setError('');
  if (!origin || !active) {
   setBusy(false);
   return () => controller.abort();
  }

  setBusy(true);
  const timer = setTimeout(() => controller.abort(), 15_000);
  void (async () => {
   try {
    const response = await fetch(marketPriceUrl(origin, area, date, process.env.EXPO_PUBLIC_PRICES_PATH), {
     signal: controller.signal,
     redirect: 'error',
    });
    if (!response.ok) throw Error('Unavailable');
    const parsed = parseMarketDay(await response.json(), area, date);
    if (controller.signal.aborted) throw Error('Timed out');
    if (current) setLoaded({ origin, day: parsed });
   } catch {
    if (current) setError('Elpriserna kunde inte hämtas. Försök igen.');
   } finally {
    clearTimeout(timer);
    if (current) setBusy(false);
   }
  })();
  return () => {
   current = false;
   controller.abort();
   clearTimeout(timer);
  };
 }, [origin, area, active, refreshCount, publicationWindow, date]);

 if (!origin) return <Text style={{color:t.muted}}>Pristjänsten är inte ansluten.</Text>;
 const shownDay = active && loaded?.origin === origin && loaded.day.area === area && loaded.day.date === date
  ? loaded.day
  : null;
 const current=shownDay?currentMarketPrice(shownDay,now):null;
 const next = shownDay && dayOffset === 0 ? nextMarketEntry(shownDay,now) : null;
 const prices = shownDay?.entries.map(entry => entry.sekPerKwh) ?? [];
 const range = prices.length ? prices.reduce(
  ([low, high], price) => [Math.min(low, price), Math.max(high, price)],
  [prices[0], prices[0]],
 ) : null;
 return <View style={{gap:14,backgroundColor:t.surface,padding:20,borderRadius:20}}>
  <Text accessibilityRole="header" style={{color:t.text,fontSize:20}}>Spotpriser</Text>
  <View style={{flexDirection:'row',gap:12,flexWrap:'wrap'}}>{priceAreas.map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:value===area}} onPress={()=>{setShowIntervals(false);setArea(value);}} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:value===area?t.accent:t.muted}}>{value}</Text></Pressable>)}</View>
  <View style={{flexDirection:'row',gap:16,flexWrap:'wrap'}}>
   {dayOptions.map(([offset,label])=><Pressable key={offset} accessibilityRole="button" accessibilityState={{selected:offset===dayOffset}} onPress={()=>{setShowIntervals(false);setDayOffset(offset);}} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:offset===dayOffset?t.accent:t.muted}}>{label}</Text></Pressable>)}
  </View>
  {busy&&<ActivityIndicator accessibilityLabel="Hämtar elpriser" color={t.accent}/>}
  {shownDay&&<>
   <Text style={{color:t.text}}>{shownDay.date} · {shownDay.area}</Text>
   {dayOffset===0&&<Text style={{color:t.text,fontSize:24}}>Just nu: {current===null?'Uppgift saknas':ore(current)}</Text>}
   {next&&<Text style={{color:t.text}}>Nästa publicerade intervall från {time(next.timeStart)}: {ore(next.sekPerKwh)}</Text>}
   <Text style={{color:t.text}}>Medelpris för publicerade intervall: {shownDay.average===null?'Uppgift saknas':ore(shownDay.average)}</Text>
   {range&&<Text style={{color:t.text}}>Lägsta: {ore(range[0])} · Högsta: {ore(range[1])}</Text>}
   <Text style={{color:t.muted}}>Källa: {shownDay.source}</Text><Text style={{color:t.muted}}>{shownDay.disclaimer}</Text>
   {shownDay.entries.length===0&&<Text style={{color:t.muted}}>Inga priser har publicerats för det valda dygnet.</Text>}
   {shownDay.entries.length>0&&<Pressable accessibilityRole="button" accessibilityState={{expanded:showIntervals}} onPress={()=>setShowIntervals(value=>!value)} style={{minHeight:48,justifyContent:'center'}}>
    <Text style={{color:t.accent}}>{showIntervals?'Dölj intervallpriser':`Visa alla ${shownDay.entries.length} intervallpriser`}</Text>
   </Pressable>}
   {showIntervals&&shownDay.entries.map(entry=><View key={entry.timeStart} style={{flexDirection:'row',justifyContent:'space-between',gap:10}}><Text style={{color:t.muted}}>{time(entry.timeStart)}–{time(entry.timeEnd)}</Text><Text style={{color:t.text}}>{ore(entry.sekPerKwh)}{Date.parse(entry.timeStart)<=now&&now<Date.parse(entry.timeEnd)?' · Pågår':''}</Text></View>)}
  </>}
  {error!==''&&<Text accessibilityRole="alert" style={{color:t.text}}>{error}</Text>}
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setRefreshCount(value=>value+1)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:t.accent}}>Uppdatera elpriser</Text></Pressable>
 </View>;
}
