import React, {useRef,useState} from 'react';
import {Linking,Pressable,Text,View} from 'react-native';
import type {MobileTheme} from '../../../packages/mobile-foundation/src/brand';
import {contractWebUrl} from './customerEndpoint';
export function ContractActions({origin,theme:t}:{origin?:string;theme:MobileTheme}) {
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const opening=useRef(false);
 if(!origin)return null;
 const open=async(action:'signup'|'contracts'|'support')=>{if(opening.current)return;opening.current=true;setBusy(true);setError('');try{await Linking.openURL(contractWebUrl(origin,action));}catch{setError('Sidan kunde inte öppnas. Försök igen.');}finally{opening.current=false;setBusy(false);}};
 return <View style={{gap:10,backgroundColor:t.surface,padding:20,borderRadius:20}}>
  <Text accessibilityRole="header" style={{color:t.text,fontSize:20}}>Teckna och hantera elavtal</Text>
  <Text style={{color:t.muted}}>Avtalsteckning och avtalsändringar öppnas på leverantörens webbplats. Där slutför du inloggning och eventuell signering.</Text>
  {([['signup','Teckna nytt elavtal'],['contracts','Visa befintliga avtal'],['support','Få hjälp att byta avtal']] as const).map(([action,label])=><Pressable key={action} accessibilityRole="link" disabled={busy} onPress={()=>void open(action)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:t.accent}}>{label} ↗</Text></Pressable>)}
  {error!==''&&<Text accessibilityRole="alert" style={{color:t.text}}>{error}</Text>}
 </View>;
}
