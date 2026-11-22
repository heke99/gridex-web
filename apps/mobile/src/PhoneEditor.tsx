import React,{useState} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import type {MobileTheme} from '../../../packages/mobile-foundation/src/brand';
import {isContactPhone} from '../../../packages/mobile-foundation/src/contactPhone';
export function PhoneEditor({value,theme:t,busy,submit}:{value:string|null;theme:MobileTheme;busy:boolean;submit:(phone:string)=>Promise<boolean>}){
 const [phone,setPhone]=useState(value??'');const [saved,setSaved]=useState(false);
 const normalizedPhone = phone.trim();
 const validPhone = isContactPhone(normalizedPhone);
 return <View style={{gap:10}}>
  <Text style={{color:t.text}}>Ändra telefonnummer</Text>
  <TextInput inputAccessoryViewID="gridex-keyboard-tools" accessibilityLabel="Nytt telefonnummer" value={phone} onChangeText={v=>{setPhone(v);setSaved(false);}} keyboardType="phone-pad" accessibilityHint="Ange numret med riktnummer eller landskod" autoComplete="tel" maxLength={32} editable={!busy} style={{borderColor:t.muted,borderWidth:1,borderRadius:10,padding:14,color:t.text}}/>
  <Pressable accessibilityRole="button" disabled={busy||saved||!validPhone||normalizedPhone===value?.trim()} onPress={()=>{setSaved(false);void submit(normalizedPhone).then(ok=>{if(ok)setSaved(true);});}} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:t.accent}}>Spara telefonnummer</Text></Pressable>
  {normalizedPhone && !validPhone && <Text accessibilityRole="alert" style={{color:t.text}}>Kontrollera telefonnumrets format.</Text>}
  {saved&&<Text accessibilityRole="alert" style={{color:t.text}}>Telefonnumret har sparats.</Text>}
 </View>;
}
