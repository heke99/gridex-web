import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { customerEndpoint } from './customerEndpoint';
import { createAccountClient, customerApi } from './accountClient';
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
  const mutationAttempt = useRef<{ signature: string; key: string } | null>(null);

  const invalidate = useCallback(() => { generation.current++; pending.current?.abort(); }, []);
  const clearDetails = useCallback(() => { setRows(null); setInvoice(null); setSupport(null); setNextCursor(null); }, []);
  const clear = useCallback(() => { clearDetails(); setAuthenticated(false); mutationAttempt.current = null; }, [clearDetails]);
  const signOut = useCallback(async () => {
    expectedSignout.current = true;
    try { const result = await client?.auth.signOut({ scope: 'local' }); if (result?.error) throw result.error; }
    catch { setError('Sessionen kunde inte rensas helt. Försök logga ut igen.'); }
    finally { wantsLogout.current = false; expectedSignout.current = false; }
  }, [client]);

  const run = useCallback(async (next: CustomerView, sessionAction: () => Promise<string | null>, reference?: string, cursor?: string) => {
    if (!client || inFlight.current) return;
    inFlight.current = true; const attempt = ++generation.current;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); if (!cursor) clearDetails(); selected.current = { view: next, reference }; setResource(next);
    try {
      const token = await sessionAction();
      if (attempt !== generation.current) return;
      if (!token) { clear(); return; }
      setAuthenticated(true);
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(customerEndpoint(customerApi, customerViewPath(next, reference), cursor, process.env.EXPO_PUBLIC_CUSTOMER_API_PATH), {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        if (response.status === 401) { clear(); await signOut(); throw new Error('expired'); }
        if (!response.ok) throw new Error('resource unavailable');
        const body = await response.json();
        if (attempt !== generation.current) return;
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
      } finally { clearTimeout(timeout); }
    } catch {
      if (attempt === generation.current) setError('Uppgifterna kunde inte hämtas. Kontrollera anslutningen och försök igen.');
    } finally {
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
      if (state === 'active') { client.auth.startAutoRefresh(); needsRestore.current = true; setRestoreTick(v => v + 1); }
      else { client.auth.stopAutoRefresh(); generation.current++; pending.current?.abort(); clearDetails(); }
    });
    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    return () => { invalidate(); client.auth.stopAutoRefresh(); auth.data.subscription.unsubscribe(); listener.remove(); };
  }, [client, clear, clearDetails, invalidate]);

  useEffect(() => {
    if (!client || !needsRestore.current || inFlight.current || !active) return;
    needsRestore.current = false;
    void run(selected.current.view, async () => {
      const saved = await client.auth.getSession();
      if (saved.error) throw saved.error;
      if (!saved.data.session) return null;
      // SecureStore may survive reinstall: stored values alone never show customer data.
      const refreshed = await client.auth.refreshSession();
      if (refreshed.error || !refreshed.data.session) { clear(); await signOut(); throw new Error('invalid session'); }
      return refreshed.data.session.access_token;
    }, selected.current.reference);
  }, [client, active, restoreTick, run, clear, signOut]);

  const login = (email: string, password: string) => run('contracts', async () => {
    const result = await client!.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error || !result.data.session) { clear(); await signOut(); throw new Error('login'); }
    return result.data.session.access_token;
  });
  const select = (next: CustomerView, reference?: string, cursor?: string) => run(next, async () => {
    const result = await client!.auth.getSession();
    if (result.error) throw result.error;
    return result.data.session?.access_token ?? null;
  }, reference, cursor);
  const loadMore = () => nextCursor ? select('support', undefined, nextCursor) : Promise.resolve();
  const retry = () => select(selected.current.view, selected.current.reference);
  const openDocument = async (invoiceRef: string | null, documentRef: string, open: (url: string) => Promise<unknown>) => {
    if (!client || inFlight.current) return;
    if (![...(invoiceRef ? [invoiceRef] : []), documentRef].every(ref => /^[A-Za-z0-9_-]{1,240}$/.test(ref))) { setError('Ogiltig dokumentreferens.'); return; }
    inFlight.current = true; const attempt = ++generation.current;
    const controller = new AbortController(); pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000); setBusy(true); setError('');
    try {
      const saved = await client.auth.getSession();
      if (saved.error || !saved.data.session) { clear(); await signOut(); throw new Error('expired'); }
      const response = await fetch(customerEndpoint(customerApi, invoiceRef ? `invoices/${encodeURIComponent(invoiceRef)}/documents/${encodeURIComponent(documentRef)}` : `documents/${encodeURIComponent(documentRef)}/open`, undefined, process.env.EXPO_PUBLIC_CUSTOMER_API_PATH), {
        headers: { Authorization: `Bearer ${saved.data.session.access_token}` }, signal: controller.signal,
      });
      if (response.status === 401) { clear(); await signOut(); throw new Error('expired'); }
      if (!response.ok) throw new Error('document unavailable');
      const url = parseDocumentLink(await response.json(), documentRef, invoiceRef ? 'invoiceDocument' : 'customerDocument');
      if (attempt === generation.current && AppState.currentState === 'active') await open(url);
    } catch { if (attempt === generation.current) setError('Dokumentet kunde inte öppnas. Hämta dokumentlistan eller fakturan igen och försök på nytt.'); }
    finally {
      clearTimeout(timeout); if (wantsLogout.current) await signOut();
      inFlight.current = false; setBusy(false);
      if (needsRestore.current && AppState.currentState === 'active') setRestoreTick(v => v + 1);
    }
  };
  const submitSupport = async (title: string, message: string, reference?: string) => {
    if (!client || inFlight.current) return false;
    inFlight.current = true; const attempt = ++generation.current;
    const controller = new AbortController(); pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000); setBusy(true); setError('');
    try {
      const saved = await client.auth.getSession();
      if (!saved.data.session || saved.error) throw new Error('login');
      const signature = JSON.stringify([saved.data.session.user.id, reference ?? null, title, message]);
      if (mutationAttempt.current?.signature !== signature) mutationAttempt.current = { signature, key: `support-${Date.now()}-${Math.random().toString(36).slice(2)}` };
      const suffix = reference ? `support/${encodeURIComponent(reference)}/messages` : 'support';
      const response = await fetch(customerEndpoint(customerApi, suffix, undefined, process.env.EXPO_PUBLIC_CUSTOMER_API_PATH), { method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${saved.data.session.access_token}`, 'Content-Type': 'application/json', 'Idempotency-Key': mutationAttempt.current.key },
        body: JSON.stringify(reference ? { message } : { title, message }),
      });
      if (attempt !== generation.current) return false;
      if (response.status === 401) { clear(); await signOut(); throw new Error('login'); }
      if (response.status === 409) { setError('Begäran behöver kontrolleras. Hämta ärendet igen innan du ändrar texten eller försöker på nytt.'); return false; }
      if (response.status === 429) { setError('För många försök. Vänta en stund och försök igen med samma text.'); return false; }
      if (!response.ok) throw new Error('support');
      const body = await response.json(); if (body?.data?.accepted !== true) throw new Error('response');
      if (attempt !== generation.current) return false;
      mutationAttempt.current = null;
      return true;
    } catch { if (attempt === generation.current) setError('Kunde inte bekräfta att meddelandet sparats. Försök igen med samma text för att undvika dubbletter.'); return false; }
    finally { clearTimeout(timeout); if (wantsLogout.current) await signOut(); inFlight.current = false; setBusy(false); if (needsRestore.current && AppState.currentState === 'active') setRestoreTick(v => v + 1); }
  };
  const logout = () => {
    needsRestore.current = false; wantsLogout.current = true;
    generation.current++; pending.current?.abort(); clear(); setError('');
    if (!inFlight.current) { setBusy(true); void signOut().finally(() => setBusy(false)); }
  };
  return { configured: Boolean(client), authenticated, busy, rows, invoice, support, resource, error, active, login, select, retry, openDocument, submitSupport, nextCursor, loadMore, logout };
}
