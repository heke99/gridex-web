import React,{useState} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import type {MobileTheme} from '../../../packages/mobile-foundation/src/brand';
export function PhoneEditor({value,theme:t,busy,submit}:{value:string|null;theme:MobileTheme;busy:boolean;submit:(phone:string)=>Promise<boolean>}){
 const [phone,setPhone]=useState(value??'');const [saved,setSaved]=useState(false);
 return <View style={{gap:10}}>
  <Text style={{color:t.text}}>Ändra telefonnummer</Text>
  <TextInput accessibilityLabel="Nytt telefonnummer" value={phone} onChangeText={v=>{setPhone(v);setSaved(false);}} keyboardType="phone-pad" autoComplete="tel" maxLength={40} editable={!busy} style={{borderColor:t.muted,borderWidth:1,borderRadius:10,padding:14,color:t.text}}/>
  <Pressable accessibilityRole="button" disabled={busy||saved||!phone.trim()||phone===value} onPress={()=>{setSaved(false);void submit(phone).then(ok=>{if(ok)setSaved(true);});}} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:t.accent}}>Spara telefonnummer</Text></Pressable>
  {saved&&<Text accessibilityRole="alert" style={{color:t.text}}>Telefonnumret har sparats. Hämta profilen igen för att se senaste uppgiften.</Text>}
 </View>;
}
