import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createAccountClient, customerApi } from './accountClient';
import { parseCustomerRows, type CustomerRow, type Resource } from './customerData';

export function useCustomerAccount(brand: string) {
  const [client] = useState(() => createAccountClient(brand));
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<CustomerRow[] | null>(null);
  const [resource, setResource] = useState<Resource>('contracts');
  const [error, setError] = useState('');
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [restoreTick, setRestoreTick] = useState(0);
  const generation = useRef(0); const inFlight = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const selected = useRef<Resource>('contracts');
  const needsRestore = useRef(true); const wantsLogout = useRef(false);
  const expectedSignout = useRef(false);

  const invalidate = useCallback(() => { generation.current++; pending.current?.abort(); }, []);
  const clear = useCallback(() => { setRows(null); setAuthenticated(false); }, []);
  const signOut = useCallback(async () => {
    expectedSignout.current = true;
    try { const result = await client?.auth.signOut({ scope: 'local' }); if (result?.error) throw result.error; }
    catch { setError('Sessionen kunde inte rensas helt. Försök logga ut igen.'); }
    finally { wantsLogout.current = false; expectedSignout.current = false; }
  }, [client]);

  const run = useCallback(async (next: Resource, sessionAction: () => Promise<string | null>) => {
    if (!client || inFlight.current) return;
    inFlight.current = true; const attempt = ++generation.current;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setRows(null); selected.current = next; setResource(next);
    try {
      const token = await sessionAction();
      if (attempt !== generation.current) return;
      if (!token) { clear(); return; }
      setAuthenticated(true);
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(`${customerApi!.replace(/\/$/, '')}/api/mobile/customer/${next}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        if (response.status === 401) { clear(); await signOut(); throw new Error('expired'); }
        if (!response.ok) throw new Error('resource unavailable');
        const values = parseCustomerRows(next, await response.json());
        if (attempt === generation.current) setRows(values);
      } finally { clearTimeout(timeout); }
    } catch {
      if (attempt === generation.current) setError('Uppgifterna kunde inte hämtas. Kontrollera anslutningen och försök igen.');
    } finally {
      if (wantsLogout.current) await signOut();
      inFlight.current = false; setBusy(false);
      if (needsRestore.current && AppState.currentState === 'active') setRestoreTick(v => v + 1);
    }
  }, [client, clear, signOut]);

  useEffect(() => {
    if (!client) return;
    const auth = client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        if (!expectedSignout.current) { generation.current++; pending.current?.abort(); }
        clear();
      }
    });
    const listener = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state === 'active') { client.auth.startAutoRefresh(); needsRestore.current = true; setRestoreTick(v => v + 1); }
      else { client.auth.stopAutoRefresh(); generation.current++; pending.current?.abort(); setRows(null); }
    });
    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    return () => { invalidate(); client.auth.stopAutoRefresh(); auth.data.subscription.unsubscribe(); listener.remove(); };
  }, [client, clear, invalidate]);

  useEffect(() => {
    if (!client || !needsRestore.current || inFlight.current || !active) return;
    needsRestore.current = false;
    void run(selected.current, async () => {
      const saved = await client.auth.getSession();
      if (saved.error) throw saved.error;
      if (!saved.data.session) return null;
      // SecureStore may survive reinstall: stored values alone never show customer data.
      const refreshed = await client.auth.refreshSession();
      if (refreshed.error || !refreshed.data.session) { clear(); await signOut(); throw new Error('invalid session'); }
      return refreshed.data.session.access_token;
    });
  }, [client, active, restoreTick, run, clear, signOut]);

  const login = (email: string, password: string) => run('contracts', async () => {
    const result = await client!.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error || !result.data.session) { clear(); await signOut(); throw new Error('login'); }
    return result.data.session.access_token;
  });
  const select = (next: Resource) => run(next, async () => {
    const result = await client!.auth.getSession();
    if (result.error) throw result.error;
    return result.data.session?.access_token ?? null;
  });
  const logout = () => {
    needsRestore.current = false; wantsLogout.current = true;
    generation.current++; pending.current?.abort(); clear(); setError('');
    if (!inFlight.current) { setBusy(true); void signOut().finally(() => setBusy(false)); }
  };
  return { configured: Boolean(client), authenticated, busy, rows, resource, error, active, login, select, logout };
}
