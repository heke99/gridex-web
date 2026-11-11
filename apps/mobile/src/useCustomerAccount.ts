import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { customerEndpoint } from './customerEndpoint';
import { createAccountClient, customerApi, cancelAccountAuth } from './accountClient';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { abortable } from './abortable';
import { parseCustomerRows, type CustomerRow } from './customerData';
import { customerViewPath, parseInvoiceDetail, parseSupportDetail, parseDocumentLink, type CustomerView } from './detailData';
import type { InvoiceDetail, SupportDetail } from '../../../packages/mobile-foundation/src/customerDetails';

export function useCustomerAccount(brand: string) {
  const [client] = useState(() => createAccountClient(brand));
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<CustomerRow[] | null>(null);
  const [resource, setResource] = useState<CustomerView>('contracts');
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [support, setSupport] = useState<SupportDetail | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [restoreTick, setRestoreTick] = useState(0);
  const generation = useRef(0); const inFlight = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const selected = useRef<{ view: CustomerView; reference?: string }>({ view: 'contracts' });
  const needsRestore = useRef(true); const wantsLogout = useRef(false);
  const expectedSignout = useRef(false);
  const logoutBlocked = useRef(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const mutationAttempt = useRef<{ signature: string; key: string } | null>(null);
  const authPending = useRef(new Set<Promise<unknown>>());

  const authCall = useCallback(async <T,>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> => {
    const cancel = () => cancelAccountAuth(client);
    signal.addEventListener('abort', cancel, { once: true });
    try {
      await abortable(Promise.allSettled([...authPending.current]), signal);
      if (signal.aborted) throw new Error('Cancelled');
      const task = operation();
      authPending.current.add(task);
      task.then(() => authPending.current.delete(task), () => authPending.current.delete(task));
      return await abortable(task, signal);
    } finally { signal.removeEventListener('abort', cancel); }
  }, [client]);

  const invalidate = useCallback(() => { generation.current++; pending.current?.abort(); cancelAccountAuth(client); }, [client]);
  const clearDetails = useCallback(() => { setRows(null); setInvoice(null); setSupport(null); setNextCursor(null); }, []);
  const clear = useCallback(() => { clearDetails(); setAuthenticated(false); mutationAttempt.current = null; }, [clearDetails]);
  const signOut = useCallback(async () => {
    if (expectedSignout.current) return;
    expectedSignout.current = true;
    try {
      cancelAccountAuth(client);
      // SDK login persists before resolving. Cleanup must follow that persistence,
      // including a native storage write already in progress when logout was pressed.
      await Promise.allSettled([...authPending.current]);
      const result = await client?.auth.signOut({ scope: 'local' });
      if (result?.error) throw result.error;
      logoutBlocked.current = false;
      setLogoutFailed(false);
    } catch {
      logoutBlocked.current = true;
      setLogoutFailed(true);
      client?.auth.stopAutoRefresh();
      setError('Sessionen kunde inte rensas helt. Försök logga ut igen.');
    } finally {
      needsRestore.current = false;
      wantsLogout.current = false;
      expectedSignout.current = false;
    }
  }, [client]);

  const run = useCallback(async (next: CustomerView, sessionAction: (signal: AbortSignal) => Promise<string | null>, reference?: string, cursor?: string) => {
    if (!client || inFlight.current || expectedSignout.current || logoutBlocked.current || AppState.currentState !== 'active') return;
    inFlight.current = true; const attempt = ++generation.current;
    const controller = new AbortController(); pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    setBusy(true); setError(''); if (!cursor) clearDetails(); selected.current = { view: next, reference }; setResource(next);
    try {
      const token = await abortable(sessionAction(controller.signal), controller.signal);
      if (attempt !== generation.current) return;
      if (!token) { clear(); return; }
      setAuthenticated(true);
      {
        const response = await abortable(fetch(customerEndpoint(customerApi, customerViewPath(next, reference), cursor, process.env.EXPO_PUBLIC_CUSTOMER_API_PATH), {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        }), controller.signal);
        if (attempt !== generation.current || controller.signal.aborted) return;
        if (response.status === 401) { clear(); await signOut(); throw new Error('expired'); }
        if (!response.ok) throw new Error('resource unavailable');
        const body = await abortable(response.json(), controller.signal);
        if (attempt !== generation.current || controller.signal.aborted) return;
        if (next === 'invoiceDetail') setInvoice(parseInvoiceDetail(body, reference!));
        else if (next === 'supportDetail') setSupport(parseSupportDetail(body, reference!));
        else {
          const parsed = parseCustomerRows(next, body);
          const page = body.page;
          if (next === 'support' && page && ![true, false, null].includes(page.hasMore)) throw new Error('Invalid pagination');
          if (next === 'support' && page && (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || page.nextCursor.length > 2048))) throw new Error('Invalid pagination');
          if (next === 'support' && page?.hasMore === true && !page.nextCursor) throw new Error('Incomplete pagination');
          setRows(previous => cursor ? [...new Map([...(previous ?? []), ...parsed].map(row => [row.reference, row])).values()] : parsed);
          setNextCursor(next === 'support' && typeof page?.nextCursor === 'string' ? page.nextCursor : null);
        }
      }
    } catch {
      if (attempt === generation.current) setError('Uppgifterna kunde inte hämtas. Kontrollera anslutningen och försök igen.');
    } finally {
      clearTimeout(timeout);
      if (wantsLogout.current) await signOut();
      inFlight.current = false; setBusy(false);
      if (needsRestore.current && AppState.currentState === 'active') setRestoreTick(v => v + 1);
    }
  }, [client, clear, clearDetails, signOut]);

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
      if (state === 'active') {
        if (!expectedSignout.current && !logoutBlocked.current && !wantsLogout.current) {
          client.auth.startAutoRefresh(); needsRestore.current = true; setRestoreTick(v => v + 1);
        }
      } else { client.auth.stopAutoRefresh(); generation.current++; pending.current?.abort(); clearDetails(); }
    });
    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    return () => { invalidate(); client.auth.stopAutoRefresh(); auth.data.subscription.unsubscribe(); listener.remove(); };
  }, [client, clear, clearDetails, invalidate]);

  useEffect(() => {
    if (!client || !needsRestore.current || inFlight.current || !active) return;
    needsRestore.current = false;
    void run(selected.current.view, async signal => {
      const saved = await authCall(() => client.auth.getSession(), signal);
      if (signal.aborted) throw new Error('Cancelled');
      if (saved.error) throw saved.error;
      if (!saved.data.session) return null;
      // SecureStore may survive reinstall: stored values alone never show customer data.
      const refreshed = await authCall(() => client.auth.refreshSession(), signal);
      if (signal.aborted) throw new Error('Cancelled');
      if (isAuthRetryableFetchError(refreshed.error)) throw refreshed.error;
      if (refreshed.error || !refreshed.data.session) { clear(); await signOut(); throw new Error('invalid session'); }
      return refreshed.data.session.access_token;
    }, selected.current.reference);
  }, [client, active, restoreTick, run, clear, signOut, authCall]);

  const login = (email: string, password: string) => run('contracts', async signal => {
    const result = await authCall(() => client!.auth.signInWithPassword({ email: email.trim(), password }), signal);
    if (signal.aborted) throw new Error('Cancelled');
    if (result.error || !result.data.session) { clear(); await signOut(); throw new Error('login'); }
    if (AppState.currentState === 'active' && !wantsLogout.current) client!.auth.startAutoRefresh();
    return result.data.session.access_token;
  });
  const select = (next: CustomerView, reference?: string, cursor?: string) => run(next, async signal => {
    const result = await authCall(() => client!.auth.getSession(), signal);
    if (signal.aborted) throw new Error('Cancelled');
    if (result.error) throw result.error;
    return result.data.session?.access_token ?? null;
  }, reference, cursor);
  const loadMore = () => nextCursor ? select('support', undefined, nextCursor) : Promise.resolve();
  const retry = () => select(selected.current.view, selected.current.reference);
  const openDocument = async (invoiceRef: string | null, documentRef: string, open: (url: string) => Promise<unknown>) => {
    if (!client || inFlight.current || AppState.currentState !== 'active') return;
    if (![...(invoiceRef ? [invoiceRef] : []), documentRef].every(ref => /^[A-Za-z0-9_-]{1,240}$/.test(ref))) { setError('Ogiltig dokumentreferens.'); return; }
    inFlight.current = true; const attempt = ++generation.current;
    const controller = new AbortController(); pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000); setBusy(true); setError('');
    try {
      const saved = await authCall(() => client.auth.getSession(), controller.signal);
      if (attempt !== generation.current || controller.signal.aborted || AppState.currentState !== 'active') return;
      if (isAuthRetryableFetchError(saved.error)) { clearDetails(); throw saved.error; }
      if (saved.error || !saved.data.session) { clear(); await signOut(); throw new Error('expired'); }
      const response = await abortable(fetch(customerEndpoint(customerApi, invoiceRef ? `invoices/${encodeURIComponent(invoiceRef)}/documents/${encodeURIComponent(documentRef)}` : `documents/${encodeURIComponent(documentRef)}/open`, undefined, process.env.EXPO_PUBLIC_CUSTOMER_API_PATH), {
        headers: { Authorization: `Bearer ${saved.data.session.access_token}` }, signal: controller.signal,
      }), controller.signal);
      if (attempt !== generation.current || controller.signal.aborted) return;
      if (response.status === 401) { clear(); await signOut(); throw new Error('expired'); }
      if (!response.ok) throw new Error('document unavailable');
      const url = parseDocumentLink(await abortable(response.json(), controller.signal), documentRef, invoiceRef ? 'invoiceDocument' : 'customerDocument');
      if (attempt === generation.current && !controller.signal.aborted && AppState.currentState === 'active') await open(url);
    } catch { if (attempt === generation.current) { if (controller.signal.aborted) clearDetails(); setError('Dokumentet kunde inte öppnas. Hämta dokumentlistan eller fakturan igen och försök på nytt.'); } }
    finally {
      clearTimeout(timeout); if (wantsLogout.current) await signOut();
      inFlight.current = false; setBusy(false);
      if (needsRestore.current && AppState.currentState === 'active') setRestoreTick(v => v + 1);
    }
  };
  const submitWrite = async (suffix: string, input: Record<string,string>) => {
    if (!client || inFlight.current || AppState.currentState !== 'active') return null;
    inFlight.current = true; const attempt = ++generation.current;
    const controller = new AbortController(); pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000); setBusy(true); setError('');
    try {
      const saved = await authCall(() => client.auth.getSession(), controller.signal);
      if (attempt !== generation.current || controller.signal.aborted || AppState.currentState !== 'active') return null;
      if (isAuthRetryableFetchError(saved.error)) { clearDetails(); throw saved.error; }
      if (!saved.data.session || saved.error) {clear();await signOut();throw new Error('login');}
      const signature = JSON.stringify([saved.data.session.user.id, suffix, input]);
      if (mutationAttempt.current?.signature !== signature) mutationAttempt.current = { signature, key: `support-${Date.now()}-${Math.random().toString(36).slice(2)}` };
      const response = await abortable(fetch(customerEndpoint(customerApi, suffix, undefined, process.env.EXPO_PUBLIC_CUSTOMER_API_PATH), { method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${saved.data.session.access_token}`, 'Content-Type': 'application/json', 'Idempotency-Key': mutationAttempt.current.key },
        body: JSON.stringify(input),
      }), controller.signal);
      if (attempt !== generation.current || controller.signal.aborted) return null;
      if (response.status === 401) { clear(); await signOut(); throw new Error('login'); }
      if (response.status === 409) { setError('Begäran behöver kontrolleras. Hämta senaste uppgifterna igen innan du ändrar innehållet eller försöker på nytt.'); return null; }
      if (response.status === 429) { setError('För många försök. Vänta en stund och försök igen med samma uppgifter.'); return null; }
      if (!response.ok) throw new Error('support');
      const body = await abortable(response.json(), controller.signal); if (body?.data?.accepted !== true || suffix==='notifications/read' && (typeof body.data.readAt!=='string'||!Number.isFinite(Date.parse(body.data.readAt)))) throw new Error('response');
      if (attempt !== generation.current || controller.signal.aborted) return null;
      mutationAttempt.current = null;
      return {payload:body.data as Record<string,unknown>,epoch:attempt};
    } catch { if (attempt === generation.current) { if (controller.signal.aborted) clearDetails(); setError('Kunde inte bekräfta att ändringen sparats. Försök igen med samma innehåll för att undvika dubbletter.'); } return null; }
    finally { clearTimeout(timeout); if (wantsLogout.current) await signOut(); inFlight.current = false; setBusy(false); if (needsRestore.current && AppState.currentState === 'active') setRestoreTick(v => v + 1); }
  };
  const submitSupport = async (title:string,message:string,reference?:string) => {const result=await submitWrite(reference?`support/${encodeURIComponent(reference)}/messages`:'support',reference?{message}:{title,message});return Boolean(result&&result.epoch===generation.current);};
  const updatePhone = async (phone:string) => {const result=await submitWrite('profile',{phone});return Boolean(result&&result.epoch===generation.current);};
  const markNotificationRead = async (reference:string) => {
    const result=await submitWrite('notifications/read',{reference});
    if(!result||result.epoch!==generation.current)return false;
    const data=result.payload;
    if(typeof data.readAt!=='string'||!Number.isFinite(Date.parse(data.readAt))){setError('Lässtatusen kunde inte bekräftas. Hämta meddelandena igen.');return false;}
    setRows(previous=>previous?.map(row=>row.reference===reference?{...row,status:'read',readAt:data.readAt as string}:row)??null);
    return true;
  };
  const logout = () => {
    needsRestore.current = false; wantsLogout.current = true; logoutBlocked.current = true;
    generation.current++; pending.current?.abort(); clear(); setError('');
    if (!inFlight.current && !expectedSignout.current) { setBusy(true); void signOut().finally(() => setBusy(false)); }
  };
  const readConsumption = useCallback(async (kind: 'sites' | 'consumption', query: Record<string, string>, signal: AbortSignal): Promise<unknown> => {
    if (!client || AppState.currentState !== 'active') throw new Error('Login required');
    const epoch = generation.current;
    let saved;
    try { saved = await authCall(() => client.auth.getSession(), signal); }
    catch (error) { if (epoch === generation.current) clearDetails(); throw error; }
    if (signal.aborted || epoch !== generation.current) throw new Error('Cancelled');
    if (isAuthRetryableFetchError(saved.error)) { clearDetails(); throw saved.error; }
    if (saved.error || !saved.data.session) { clear(); await signOut(); throw new Error('Login required'); }
    const url = new URL(customerEndpoint(customerApi, kind, undefined, process.env.EXPO_PUBLIC_CUSTOMER_API_PATH));
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const response = await abortable(fetch(url.href, { headers: { Authorization: `Bearer ${saved.data.session.access_token}` }, signal }), signal);
    if (signal.aborted || epoch !== generation.current || AppState.currentState !== 'active') throw new Error('Cancelled');
    if (response.status === 401) { clear(); await signOut(); throw new Error('Login required'); }
    if (!response.ok) throw new Error('Consumption unavailable');
    const body: unknown = await abortable(response.json(), signal);
    if (signal.aborted || epoch !== generation.current || AppState.currentState !== 'active') throw new Error('Cancelled');
    return body;
  }, [client, clear, clearDetails, signOut, authCall]);
  return { configured: Boolean(client), authenticated, busy, logoutFailed, rows, invoice, support, resource, error, active, login, select, retry, openDocument, submitSupport, updatePhone, markNotificationRead, nextCursor, loadMore, logout, readConsumption };
}
