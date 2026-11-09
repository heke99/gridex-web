import React,{useState} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import type {MobileTheme} from '../../../packages/mobile-foundation/src/brand';
import type {CustomerRow,Resource} from './customerData';
import {visibleCustomerRows,loadedSummary,calendarDate} from './listTools';
export function ContractSummary({row,theme:t}:{row:CustomerRow;theme:MobileTheme}){return <View style={{gap:6}}><Text style={{color:t.text}}>Avtalsstart: {calendarDate(row.startDate)}</Text><Text selectable style={{color:t.muted}}>Avtalsreferens: {row.reference}</Text><Text style={{color:t.muted}}>För avtalsändringar och bindningstid, öppna befintliga avtal på webben.</Text></View>;}
export function CustomerList({resource,rows,theme:t,children}:{resource:Resource;rows:CustomerRow[];theme:MobileTheme;children:(row:CustomerRow)=>React.ReactNode}){
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all');
 const summary=loadedSummary(resource,rows),visible=visibleCustomerRows(resource,rows,query,status);
 const searchLabels: Partial<Record<Resource, string>> = {
  invoices: 'Sök fakturanummer eller referens',
  support: 'Sök bland hämtade ärenden',
  contracts: 'Sök avtal',
  sites: 'Sök adress eller anläggnings-ID',
  documents: 'Sök dokument',
  notifications: 'Sök meddelanden',
 };
 const searchLabel = searchLabels[resource];
 return <View style={{gap:12}}>
  <Text accessibilityRole="header" style={{color:t.text}}>{summary.count} {summary.label}</Text>
  <Text style={{color:t.muted}}>Översikten gäller endast poster som hämtats till den här vyn.</Text>
  {resource==='invoices'&&<Text style={{color:t.muted}}>Tidigaste förfallodag först</Text>}
  {resource==='support'&&<Text style={{color:t.muted}}>Senast uppdaterade först</Text>}
  {resource==='contracts'&&<Text style={{color:t.muted}}>Senaste avtalsstart först</Text>}
  {summary.statuses.map(([label,count])=><Text key={label} style={{color:t.muted}}>{label}: {count}</Text>)}
  {searchLabel&&<>
   <TextInput accessibilityLabel={searchLabel} placeholder="Sök i hämtade poster" placeholderTextColor={t.muted} value={query} onChangeText={setQuery} maxLength={160} autoCorrect={false} style={{color:t.text,borderWidth:1,borderColor:t.muted,padding:12,borderRadius:10}}/>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{['all',...summary.statuses.map(([s])=>s).filter(s=>s!=='Uppgift saknas')].map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:status===value}} onPress={()=>setStatus(value)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:status===value?t.accent:t.muted}}>{value==='all'?'Alla statusar':value}</Text></Pressable>)}</View>
   {(query||status!=='all')&&<Pressable accessibilityRole="button" onPress={()=>{setQuery('');setStatus('all');}} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:t.accent}}>Rensa sökning och filter</Text></Pressable>}
   <Text accessibilityLiveRegion="polite" style={{color:t.muted}}>Visar {visible.length} av {rows.length} hämtade poster</Text>
  </>}
  {visible.length===0&&<Text style={{color:t.muted}}>{rows.length?'Inga hämtade poster matchar ditt val.':resource==='invoices'?'Inga fakturor finns att visa.':resource==='support'?'Du har inga ärenden att visa.':'Inga uppgifter finns att visa.'}</Text>}
  {visible.map(row=><React.Fragment key={row.reference}>{children(row)}</React.Fragment>)}
 </View>;
}
