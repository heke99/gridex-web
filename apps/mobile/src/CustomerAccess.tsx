import { ConsumptionPanel } from './ConsumptionPanel';
import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';
import type { MobileBrand } from '../../../packages/mobile-foundation/src/brand';
import {CustomerList,ContractSummary} from './CustomerList';
import { PhoneEditor } from './PhoneEditor';
import { CustomerExtraPanel } from './CustomerExtraPanel';
import { useCustomerAccount } from './useCustomerAccount';
import { customerApi } from './accountClient';
import { SupportComposer } from './SupportComposer';
import { InvoicePanel, SupportPanel } from './CustomerDetailPanels';
import { recoveryUrl, type Resource } from './customerData';

const labels: Record<Resource, string> = { contracts: 'Avtal', sites: 'Anläggningar', invoices: 'Fakturor', support: 'Support', profile:'Profil', notifications:'Meddelanden', documents:'Dokument', powers:'Fullmakter', acceptances:'Godkännanden' };
export function CustomerAccess({ brand, consumption = false }: { brand: MobileBrand; consumption?: boolean }) {
  const a = useCustomerAccount(brand.id);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [linkError, setLinkError] = useState('');
  const openSupportWeb = async () => {
    try { await Linking.openURL(new URL('/dashboard/support', customerApi).href); }
    catch { setLinkError('Kunde inte öppna Mina sidor på webben.'); }
  };
  const canLogin = !a.busy && Boolean(email.trim() && password);
  const submitLogin = () => {
    if (!canLogin) return;
    setPassword('');
    setLinkError('');
    void a.login(email, password);
  };
  const t = brand.theme;
  const listResource = a.resource === 'invoiceDetail' ? 'invoices' : a.resource === 'supportDetail' ? 'support' : a.resource;
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
      <TextInput accessibilityLabel="Lösenord" placeholder="Lösenord" placeholderTextColor={t.muted} secureTextEntry returnKeyType="go" onSubmitEditing={submitLogin} textContentType="password" value={password} onChangeText={setPassword} editable={!a.busy} style={input} />
      <Pressable accessibilityRole="button" disabled={!canLogin} onPress={submitLogin} style={[button, { opacity: canLogin ? 1 : 0.5 }]}>
        <Text style={{ color: t.accentText, textAlign: 'center', fontWeight: '700' }}>Logga in</Text>
      </Pressable>
      <Pressable accessibilityRole="link" disabled={a.busy} onPress={() => void openRecovery()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Glömt lösenord? Återställ på hemsidan</Text></Pressable>
    </> : <>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 20 }}>Mina sidor</Text>
      {consumption && <ConsumptionPanel theme={t} read={a.readConsumption} />}
      {!consumption && <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(labels) as Resource[]).map(resource => <Pressable key={resource} accessibilityRole="button" accessibilityState={{ selected: listResource === resource }} disabled={a.busy} onPress={() => void a.select(resource)} style={{ minHeight: 48, padding: 10, borderWidth: 1, borderColor: listResource === resource ? t.accent : t.muted, borderRadius: 10 }}><Text style={{ color: t.text }}>{labels[resource]}</Text></Pressable>)}
      </View>
      {a.rows && <CustomerList key={a.resource} resource={listResource} rows={a.rows} theme={t}>{row => <View key={row.reference} style={{ gap: 6, paddingVertical: 10 }}>
        <Text style={{ color: t.text, fontWeight: '600' }}>{String(row.name ?? row.address ?? row.number ?? row.title ?? row.reference)}</Text>
        {a.resource === 'profile' && <PhoneEditor key={row.reference} value={typeof row.phone==='string'?row.phone:null} theme={t} busy={a.busy} submit={a.updatePhone}/>}
        {a.resource === 'notifications' && row.status!=='read' && !row.readAt && <Pressable accessibilityRole="button" disabled={a.busy} onPress={()=>void a.markNotificationRead(row.reference)} style={button}><Text style={{color:t.accentText}}>Markera som läst</Text></Pressable>}
        {a.resource === 'support' && <>
          <Pressable accessibilityRole="button" disabled={a.busy} onPress={() => void a.select('supportDetail', row.reference)} style={button}><Text style={{ color: t.accentText }}>Öppna ärende och meddelanden</Text></Pressable>
        </>}
        {a.resource === 'contracts' && <ContractSummary row={row} theme={t}/>}
        {a.resource === 'sites' && <>
          <Text style={{ color: t.muted }}>{[row.postalCode, row.city].filter(Boolean).join(' ')}</Text>
          <Text style={{ color: t.muted }}>Anläggning: {row.facilityId ?? 'Uppgift saknas'}</Text>
          <Text style={{ color: t.muted }}>Elområde: {row.priceArea ?? 'Uppgift saknas'}</Text>
        </>}
        {a.resource === 'invoices' && <>
          <Pressable accessibilityRole="button" disabled={a.busy} onPress={() => void a.select('invoiceDetail', row.reference)} style={button}><Text style={{ color: t.accentText }}>Visa fakturadetaljer</Text></Pressable>
          <Text style={{ color: t.text }}>{row.amount === null ? 'Belopp saknas' : `${row.amount} ${row.currency ?? '(valuta saknas)'}`}</Text>
          <Text style={{ color: t.muted }}>Förfallodag: {row.dueDate ?? 'Uppgift saknas'}</Text>
          {row.paidAt && <Text style={{ color: t.muted }}>Betald: {row.paidAt}</Text>}
        </>}
        {['profile','notifications','documents','powers','acceptances'].includes(a.resource) ? <CustomerExtraPanel resource={a.resource as Resource} row={row} theme={t} busy={a.busy} open={()=>void a.openDocument(null,row.reference,url=>Linking.openURL(url))} /> : <Text style={{ color: t.muted }}>Status: {row.status ?? 'Uppgift saknas'}</Text>}
      </View>}</CustomerList>}
      {a.resource === 'support' && <SupportComposer theme={t} busy={a.busy} submit={(title, message) => a.submitSupport(title, message)} />}
      {a.support && a.support.status !== 'closed' && <SupportComposer key={a.support.reference} theme={t} busy={a.busy} reply submit={(title, message) => a.submitSupport(title, message, a.support!.reference)} />}
      {a.resource === 'support' && a.nextCursor && <Pressable accessibilityRole="button" disabled={a.busy} onPress={() => void a.loadMore()} style={button}><Text style={{ color: t.accentText }}>Visa fler ärenden</Text></Pressable>}
      {a.invoice && <InvoicePanel invoice={a.invoice} theme={t} busy={a.busy} back={() => void a.select('invoices')} openDocument={reference => void a.openDocument(a.invoice!.reference, reference, url => Linking.openURL(url))} />}
      {a.support && <SupportPanel detail={a.support} theme={t} busy={a.busy} back={() => void a.select('support')} openWeb={() => void openSupportWeb()} />}
      <Pressable accessibilityRole="button" disabled={a.busy} onPress={() => void a.retry()} style={button}><Text style={{ color: t.accentText, textAlign: 'center' }}>Hämta igen</Text></Pressable>
      </>}
    </>}
    {a.busy && <ActivityIndicator accessibilityLabel="Hämtar kunduppgifter" color={t.accent} />}
    {(a.error || linkError) !== '' && <Text accessibilityRole="alert" style={{ color: t.text }}>{a.error || linkError}</Text>}
    {(a.busy || a.authenticated) && <Pressable accessibilityRole="button" onPress={() => { setPassword(''); a.logout(); }} style={button}><Text style={{ color: t.accentText, textAlign: 'center' }}>{a.busy ? 'Avbryt och logga ut' : 'Logga ut'}</Text></Pressable>}
  </View>;
}
