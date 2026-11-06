import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';
import type { MobileBrand } from '../../../packages/mobile-foundation/src/brand';
import { useCustomerAccount } from './useCustomerAccount';
import { customerApi } from './accountClient';
import { recoveryUrl, type Resource } from './customerData';

const labels: Record<Resource, string> = { contracts: 'Avtal', sites: 'Anläggningar', invoices: 'Fakturor' };
export function CustomerAccess({ brand }: { brand: MobileBrand }) {
  const a = useCustomerAccount(brand.id);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [linkError, setLinkError] = useState('');
  const t = brand.theme;
  const button = { minHeight: 48, padding: 14, borderRadius: 12, backgroundColor: t.accent };
  const input = { color: t.text, padding: 14, borderWidth: 1, borderColor: t.muted, borderRadius: 12 };
  if (!a.configured) return <Text style={{ color: t.muted }}>Kundanslutningen är inte konfigurerad i detta testbygge.</Text>;
  if (!a.active) return <Text style={{ color: t.muted }}>Kunduppgifterna är dolda när appen är inaktiv.</Text>;
  const openRecovery = async () => {
    setPassword(''); setLinkError('');
    try { await Linking.openURL(recoveryUrl(customerApi!)); }
    catch { setLinkError('Kunde inte öppna lösenordsåterställningen. Försök igen.'); }
  };
  return <View style={{ gap: 14, backgroundColor: t.surface, padding: 20, borderRadius: 20 }}>
    {!a.authenticated ? <>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 20 }}>Logga in på Mina sidor</Text>
      <Text style={{ color: t.muted }}>Använd samma konto som på hemsidan.</Text>
      <TextInput accessibilityLabel="E-post" placeholder="E-post" placeholderTextColor={t.muted} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" value={email} onChangeText={setEmail} editable={!a.busy} style={input} />
      <TextInput accessibilityLabel="Lösenord" placeholder="Lösenord" placeholderTextColor={t.muted} secureTextEntry textContentType="password" value={password} onChangeText={setPassword} editable={!a.busy} style={input} />
      <Pressable accessibilityRole="button" disabled={a.busy || !email.trim() || !password} onPress={() => { const value = password; setPassword(''); void a.login(email, value); }} style={[button, { opacity: a.busy || !email.trim() || !password ? 0.5 : 1 }]}>
        <Text style={{ color: t.accentText, textAlign: 'center', fontWeight: '700' }}>Logga in</Text>
      </Pressable>
      <Pressable accessibilityRole="link" disabled={a.busy} onPress={() => void openRecovery()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Glömt lösenord? Återställ på hemsidan</Text></Pressable>
    </> : <>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 20 }}>Mina sidor</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(labels) as Resource[]).map(resource => <Pressable key={resource} accessibilityRole="button" accessibilityState={{ selected: a.resource === resource }} disabled={a.busy} onPress={() => void a.select(resource)} style={{ minHeight: 48, padding: 10, borderWidth: 1, borderColor: a.resource === resource ? t.accent : t.muted, borderRadius: 10 }}><Text style={{ color: t.text }}>{labels[resource]}</Text></Pressable>)}
      </View>
      <Text style={{ color: t.muted }}>Hämtade {labels[a.resource].toLowerCase()}. Listan visar de uppgifter som API:t har lämnat.</Text>
      {a.rows?.length === 0 && <Text style={{ color: t.muted }}>Inga uppgifter finns att visa.</Text>}
      {a.rows?.map(row => <View key={row.reference} style={{ gap: 6, paddingVertical: 10 }}>
        <Text style={{ color: t.text, fontWeight: '600' }}>{String(row.name ?? row.address ?? row.number ?? row.reference)}</Text>
        {a.resource === 'contracts' && <Text style={{ color: t.muted }}>Start: {row.startDate ?? 'Uppgift saknas'}</Text>}
        {a.resource === 'sites' && <>
          <Text style={{ color: t.muted }}>{[row.postalCode, row.city].filter(Boolean).join(' ')}</Text>
          <Text style={{ color: t.muted }}>Anläggning: {row.facilityId ?? 'Uppgift saknas'}</Text>
          <Text style={{ color: t.muted }}>Elområde: {row.priceArea ?? 'Uppgift saknas'}</Text>
        </>}
        {a.resource === 'invoices' && <>
          <Text style={{ color: t.text }}>{row.amount === null ? 'Belopp saknas' : `${row.amount} ${row.currency ?? '(valuta saknas)'}`}</Text>
          <Text style={{ color: t.muted }}>Förfallodag: {row.dueDate ?? 'Uppgift saknas'}</Text>
          {row.paidAt && <Text style={{ color: t.muted }}>Betald: {row.paidAt}</Text>}
        </>}
        <Text style={{ color: t.muted }}>Status: {row.status ?? 'Uppgift saknas'}</Text>
      </View>)}
      <Pressable accessibilityRole="button" disabled={a.busy} onPress={() => void a.select(a.resource)} style={button}><Text style={{ color: t.accentText, textAlign: 'center' }}>Hämta igen</Text></Pressable>
    </>}
    {a.busy && <ActivityIndicator accessibilityLabel="Hämtar kunduppgifter" color={t.accent} />}
    {(a.error || linkError) !== '' && <Text accessibilityRole="alert" style={{ color: t.text }}>{a.error || linkError}</Text>}
    {(a.busy || a.authenticated) && <Pressable accessibilityRole="button" onPress={() => { setPassword(''); a.logout(); }} style={button}><Text style={{ color: t.accentText, textAlign: 'center' }}>{a.busy ? 'Avbryt och logga ut' : 'Logga ut'}</Text></Pressable>}
  </View>;
}
