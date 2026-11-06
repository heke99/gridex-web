import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MobileTheme } from '../../../packages/mobile-foundation/src/brand';
import type { CustomerRow, Resource } from './customerData';
const fields: Partial<Record<Resource, Record<string,string>>> = {
 profile:{email:'E-post',phone:'Telefon',customerNumber:'Kundnummer',customerType:'Kundtyp',status:'Status'},
 notifications:{message:'Meddelande',createdAt:'Datum',readAt:'Läst',severity:'Prioritet'},
 documents:{type:'Dokumenttyp',version:'Version',createdAt:'Datum'},
 powers:{scope:'Omfattning',status:'Status',acceptedAt:'Godkänd',validFrom:'Gäller från',validTo:'Gäller till'},
 acceptances:{type:'Typ',documentCode:'Dokument',version:'Version',acceptedAt:'Godkänt',source:'Registrerat via'},
};
export function CustomerExtraPanel({ resource,row,theme:t,busy,open }: {resource:Resource;row:CustomerRow;theme:MobileTheme;busy:boolean;open:()=>void}) {
 return <View style={{gap:8}}>
  {Object.entries(fields[resource]??{}).map(([key,label])=><Text key={key} style={{color:t.muted}}>{label}: {row[key]??'Uppgift saknas'}</Text>)}
  {resource==='documents' && (row.availability==='available'?<Pressable accessibilityRole="button" disabled={busy} onPress={open} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:t.accent}}>Öppna dokument i extern läsare</Text></Pressable>:<Text style={{color:t.muted}}>Dokumentet är inte tillgängligt i appen.</Text>)}
 </View>;
}
