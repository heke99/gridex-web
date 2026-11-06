import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import type { MobileBrand } from '../../../packages/mobile-foundation/src/brand';

type Contract = { reference: string; name: string | null; status: string | null; startDate: string | null };
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const api = process.env.EXPO_PUBLIC_CUSTOMER_API_URL;
const validUrl = (value?: string) => { try { const u = new URL(value ?? ''); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash; } catch { return false; } };
function publicKey(value?: string) {
  if (!value) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  try {
    const part = value.split('.')[1];
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'anon';
  } catch { return false; }
}
const configured = validUrl(url) && validUrl(api) && publicKey(key);

/** The first adapter uses memory-only sessions: no tokens/passwords stored on disk. */
export function CustomerAccess({ brand }: { brand: MobileBrand }) {
  const [client] = useState(() => configured ? createClient(url!, key!, { auth: {
    persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
  } }) : null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { generation.current++; pending.current?.abort(); void client?.auth.signOut({ scope: 'local' }); }, [client]);
  const logout = () => {
    generation.current++; pending.current?.abort(); setContracts(null); setPassword(''); setError(''); if (!inFlight.current) setBusy(false);
    void client?.auth.signOut({ scope: 'local' });
  };
  async function login() {
    if (!client || inFlight.current) return;
    inFlight.current = true;
    const attempt = ++generation.current;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError('');
    try {
      const { data, error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (attempt !== generation.current) { await client.auth.signOut({ scope: 'local' }); return; }
      setPassword('');
      if (authError || !data.session) throw new Error('login');
      const response = await fetch(`${api!.replace(/\/$/, '')}/api/mobile/customer/contracts`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: controller.signal,
      });
      if (!response.ok) throw new Error('customer');
      const body = await response.json();
      const rows: unknown = body?.data?.contracts;
      if (!Array.isArray(rows) || rows.some(r => !r || typeof r.reference !== 'string'
        || ['name', 'status', 'startDate'].some(k => r[k] !== null && typeof r[k] !== 'string'))) throw new Error('response');
      if (attempt === generation.current) setContracts(rows);
    } catch {
      if (attempt === generation.current) { setError('Inloggning eller hämtning av kunduppgifter misslyckades. Kontrollera uppgifterna och försök igen.'); await client.auth.signOut({ scope: 'local' }); }
    } finally { inFlight.current = false; setBusy(false); }
  }
  const t = brand.theme;
  const button = { minHeight: 48, padding: 14, borderRadius: 12, backgroundColor: t.accent };
  if (!client) return <Text style={{ color: t.muted }}>Kundanslutningen är inte konfigurerad i detta testbygge.</Text>;
  return <View style={{ gap: 14, backgroundColor: t.surface, padding: 20, borderRadius: 20 }}>
    {contracts === null ? <>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 20 }}>Logga in på Mina sidor</Text>
      <Text style={{ color: t.muted }}>Använd samma konto som på hemsidan.</Text>
      <TextInput accessibilityLabel="E-post" placeholder="E-post" placeholderTextColor={t.muted} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" value={email} onChangeText={setEmail} editable={!busy} style={{ color: t.text, padding: 14, borderWidth: 1, borderColor: t.muted, borderRadius: 12 }} />
      <TextInput accessibilityLabel="Lösenord" placeholder="Lösenord" placeholderTextColor={t.muted} secureTextEntry textContentType="password" value={password} onChangeText={setPassword} editable={!busy} style={{ color: t.text, padding: 14, borderWidth: 1, borderColor: t.muted, borderRadius: 12 }} />
      <Pressable accessibilityRole="button" disabled={busy || !email.trim() || !password} onPress={() => void login()} style={[button, { opacity: busy || !email.trim() || !password ? 0.5 : 1 }]}>
        {busy ? <ActivityIndicator color={t.accentText} /> : <Text style={{ color: t.accentText, textAlign: 'center', fontWeight: '700' }}>Logga in</Text>}
      </Pressable>
    </> : <>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 20 }}>Dina avtal</Text>
      {contracts.length === 0 && <Text style={{ color: t.muted }}>Inga avtal finns att visa.</Text>}
      {contracts.map(c => <View key={c.reference} style={{ gap: 6, paddingVertical: 10 }}>
        <Text style={{ color: t.text, fontWeight: '600' }}>{c.name ?? 'Elavtal'}</Text>
        <Text style={{ color: t.muted }}>{c.reference}</Text>
        {c.status && <Text style={{ color: t.muted }}>Status: {c.status}</Text>}
        {c.startDate && <Text style={{ color: t.muted }}>Start: {c.startDate}</Text>}
      </View>)}
    </>}
    {error !== '' && <Text accessibilityRole="alert" style={{ color: t.text }}>{error}</Text>}
    {(busy || contracts !== null) && <Pressable accessibilityRole="button" onPress={logout} style={button}><Text style={{ color: t.accentText, textAlign: 'center' }}>{busy ? 'Avbryt' : 'Logga ut'}</Text></Pressable>}
  </View>;
}
