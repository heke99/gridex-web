import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { MobileTheme } from '../../../packages/mobile-foundation/src/brand';
export function SupportComposer({ theme: t, busy, reply = false, submit }: { theme: MobileTheme; busy: boolean; reply?: boolean; submit: (title: string, message: string) => Promise<boolean> }) {
 const [title, setTitle] = useState(''); const [message, setMessage] = useState(''); const [sent, setSent] = useState(false);
 const input = { color: t.text, borderWidth: 1, borderColor: t.muted, borderRadius: 10, padding: 14 };
 return <View style={{ gap: 12 }}>
  <Text style={{ color: t.text, fontSize: 18 }}>{reply ? 'Svara i ärendet' : 'Nytt ärende'}</Text>
  {!reply && <TextInput accessibilityLabel="Ärendets rubrik" placeholder="Rubrik" placeholderTextColor={t.muted} maxLength={180} value={title} onChangeText={setTitle} editable={!busy} style={input} />}
  <TextInput accessibilityLabel="Meddelande till kundservice" placeholder="Ditt meddelande" placeholderTextColor={t.muted} multiline maxLength={8000} value={message} onChangeText={setMessage} editable={!busy} style={[input, { minHeight: 100 }]} />
  <Text style={{ color: t.muted }}>{message.length.toLocaleString('sv-SE')} / 8 000 tecken</Text>
  <Pressable accessibilityRole="button" disabled={busy || !message.trim() || (!reply && !title.trim())} onPress={() => { setSent(false); void submit(title, message).then(ok => { if (ok) { setMessage(''); setTitle(''); setSent(true); } }); }} style={{ minHeight: 48, padding: 14, backgroundColor: t.accent, borderRadius: 10 }}><Text style={{ color: t.accentText }}>{reply ? 'Skicka svar' : 'Skapa ärende'}</Text></Pressable>
  {sent && <Text accessibilityRole="alert" style={{ color: t.text }}>Meddelandet har sparats. Hämta igen för att se senaste uppgifterna.</Text>}
 </View>;
}
