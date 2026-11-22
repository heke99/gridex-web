import { DAILY_CONSUMPTION_MEDIA_TYPE } from '../../../packages/customer-backend/consumption.mjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { customerEndpoint } from './customerEndpoint';
import { createAccountClient, customerApi, cancelAccountAuth } from './accountClient';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { abortable } from './abortable';
import { parseCustomerRows, type CustomerRow } from './customerData';
import { customerViewPath, parseInvoiceDetail, parseSupportDetail, parseSupportContinuation, parseSupportMessage, parseDocumentLink, type CustomerView } from './detailData';
import type { InvoiceDetail, SupportDetail } from '../../../packages/mobile-foundation/src/customerDetails';

export type ConsumptionPreference = { facility: string; days: number };
const defaultConsumptionPreference = { facility: '', days: 7 };

export function useCustomerAccount(brand: string, consumption = false) {
  const [client] = useState(() => createAccountClient(brand));
  const [authenticated, setAuthenticated] = useState(false);
  const verifiedAccount = useRef<string | null>(null);
  const [consumptionPreference, setConsumptionPreference] = useState<ConsumptionPreference>(defaultConsumptionPreference);
  const [busy, setBusy] = useState(false);
  const [readingList, setReadingList] = useState(false);
  const [rows, setRows] = useState<CustomerRow[] | null>(null);
  const [resource, setResource] = useState<CustomerView>('contracts');
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [support, setSupport] = useState<SupportDetail | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const currentMode = useRef(consumption);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [restoreTick, setRestoreTick] = useState(0);
  const generation = useRef(0); const inFlight = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const replaceableRead = useRef<AbortController | null>(null);
  const failedCursor = useRef<string | undefined>(undefined);
  const selected = useRef<{ view: CustomerView; reference?: string }>({ view: 'contracts' });
  const needsRestore = useRef(true); const wantsLogout = useRef(false);
  const expectedSignout = useRef(false);
  const logoutBlocked = useRef(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const mutationAccount = useRef<string | null>(null);
  const mutationAttempts = useRef(new Map<string, { signature: string; key: string; requiresRefresh?: boolean }>());
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
  const clearDetails = useCallback(() => { failedCursor.current = undefined; setRows(null); setInvoice(null); setSupport(null); setNextCursor(null); setListError(''); }, []);
  const clear = useCallback(() => {
    clearDetails();
    setAuthenticated(false);
    verifiedAccount.current = null;
    setConsumptionPreference(defaultConsumptionPreference);
    mutationAccount.current = null;
    mutationAttempts.current.clear();
  }, [clearDetails]);
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

  const run = useCallback(async (next: CustomerView, sessionAction: (signal: AbortSignal) => Promise<Session | null>, reference?: string, cursor?: string, replaceRead = false) => {
    if (!client || wantsLogout.current || expectedSignout.current || logoutBlocked.current || AppState.currentState !== 'active') return;
    if (inFlight.current) {
      if (!replaceRead || !replaceableRead.current || pending.current !== replaceableRead.current) return;
      replaceableRead.current.abort();
    }
    replaceableRead.current = null;
    setReadingList(false);
    inFlight.current = true; const attempt = ++generation.current;
    const controller = new AbortController(); pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    failedCursor.current = undefined;
    setBusy(true); setError(''); setListError(''); if (!cursor) clearDetails(); selected.current = { view: next, reference }; setResource(next);
    let loadingList = false;
    let retryCursor = cursor;
    try {
      const session = await abortable(sessionAction(controller.signal), controller.signal);
      if (attempt !== generation.current) return;
      if (!session) { clear(); return; }
      const account = session.user?.id ?? null;
      if (next === 'supportDetail' && cursor && (!account || account !== verifiedAccount.current)) { clear(); return; }
      if (!account || account !== verifiedAccount.current) {
        verifiedAccount.current = account;
        setConsumptionPreference(defaultConsumptionPreference);
      }
      setAuthenticated(true);
      if (currentMode.current) return;
      loadingList = true;
      replaceableRead.current = controller;
      setReadingList(true);
      {
        const response = await abortable(fetch(customerEndpoint(customerApi, customerViewPath(next, reference), cursor, process.env.EXPO_PUBLIC_CUSTOMER_API_PATH), {
          headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal,
        }), controller.signal);
        if (attempt !== generation.current || controller.signal.aborted) return;
        if (response.status === 401) {
          retryCursor = undefined;
          replaceableRead.current = null;
          setReadingList(false);
          clear();
          await signOut();
          throw new Error('expired');
        }
        if (!response.ok) throw new Error('resource unavailable');
        const body = await abortable(response.json(), controller.signal);
        if (attempt !== generation.current || controller.signal.aborted) return;
        if (next === 'invoiceDetail') setInvoice(parseInvoiceDetail(body, reference!));
        else if (next === 'supportDetail') {
          const following = body.page?.nextCursor ?? null;
          if (following !== null && (typeof following !== 'string' || !following.trim() || following.length > 2048 || following === cursor)) throw new Error('Invalid pagination');
          if (cursor) {
            const messages = parseSupportContinuation(body, reference!);
            setSupport(previous => previous && previous.reference === reference ? {
              ...previous,
              moreMessages: Boolean(following),
              messages: [...new Map([...previous.messages, ...messages].map(message => [message.reference, message])).values()]
                .sort((left, right) => Date.parse(left.createdAt ?? '') - Date.parse(right.createdAt ?? '')),
            } : previous);
          } else setSupport(parseSupportDetail(body, reference!));
          setNextCursor(following);
        }
        else {
          const parsed = parseCustomerRows(next, body);
          if (next === 'profile' && parsed.length === 1 && mutationAttempts.current.get('profile')?.requiresRefresh) {
            mutationAttempts.current.delete('profile');
          }
          const page = body.page;
          const paginated = next === 'support' || next === 'invoices';
          if (paginated && page && ![true, false, null].includes(page.hasMore)) throw new Error('Invalid pagination');
          if (paginated && page && (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || page.nextCursor.length > 2048))) throw new Error('Invalid pagination');
          if (paginated && page?.hasMore === true && !page.nextCursor) throw new Error('Incomplete pagination');
          setRows(previous => cursor ? [...new Map([...(previous ?? []), ...parsed].map(row => [row.reference, row])).values()] : parsed);
          setNextCursor(paginated && page?.hasMore !== false && typeof page?.nextCursor === 'string' && page.nextCursor !== cursor ? page.nextCursor : null);
        }
      }
    } catch {
      if (attempt === generation.current) {
        failedCursor.current = retryCursor;
        const message = 'Uppgifterna kunde inte hämtas. Kontrollera anslutningen och försök igen.';
        if (loadingList) setListError(message);
        else setError(message);
      }
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) {
        replaceableRead.current = null;
        setReadingList(false);
        if (wantsLogout.current) await signOut();
        inFlight.current = false; setBusy(false);
        if (needsRestore.current && AppState.currentState === 'active') setRestoreTick(v => v + 1);
      }
    }
  }, [client, clear, clearDetails, signOut]);

  useEffect(() => {
    if (!client) return;
    const auth = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        if (!expectedSignout.current) { generation.current++; pending.current?.abort(); }
        clear();
      } else if (session?.user?.id && verifiedAccount.current && session.user.id !== verifiedAccount.current) {
        invalidate();
        clear();
        needsRestore.current = true;
        setRestoreTick(value => value + 1);
      }
    });
    const listener = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state === 'active') {
        if (!expectedSignout.current && !logoutBlocked.current && !wantsLogout.current) {
          client.auth.startAutoRefresh(); needsRestore.current = true; setRestoreTick(v => v + 1);
        }
      } else {
        client.auth.stopAutoRefresh();
        generation.current++;
        pending.current?.abort();
        clearDetails();
        if (currentMode.current) setAuthenticated(false);
      }
    });
    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    return () => { invalidate(); client.auth.stopAutoRefresh(); auth.data.subscription.unsubscribe(); listener.remove(); };
  }, [client, clear, clearDetails, invalidate]);

  useEffect(() => {
    if (currentMode.current === consumption) return;
    currentMode.current = consumption;
    if (!client || wantsLogout.current || logoutBlocked.current || expectedSignout.current) return;
    invalidate();
    clearDetails();
    setAuthenticated(false);
    setError('');
    needsRestore.current = true;
    setRestoreTick(value => value + 1);
  }, [consumption, client, invalidate, clearDetails]);

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
      return refreshed.data.session;
    }, selected.current.reference);
  }, [client, active, restoreTick, run, clear, signOut, authCall]);

  const login = (email: string, password: string) => run('contracts', async signal => {
    const result = await authCall(() => client!.auth.signInWithPassword({ email: email.trim(), password }), signal);
    if (signal.aborted) throw new Error('Cancelled');
    if (result.error || !result.data.session) { clear(); await signOut(); throw new Error('login'); }
    if (AppState.currentState === 'active' && !wantsLogout.current) client!.auth.startAutoRefresh();
    return result.data.session;
  });
  const select = (next: CustomerView, reference?: string, cursor?: string, replaceRead = false) => run(next, async signal => {
    const result = await authCall(() => client!.auth.getSession(), signal);
    if (signal.aborted) throw new Error('Cancelled');
    if (result.error) throw result.error;
    return result.data.session ?? null;
  }, reference, cursor, replaceRead);
  const switchView = (next: CustomerView) => select(next, undefined, undefined, true);
  const loadMore = () => nextCursor && (resource === 'support' || resource === 'invoices' || resource === 'supportDetail') ? select(resource, selected.current.reference, nextCursor) : Promise.resolve();
  const retry = () => select(selected.current.view, selected.current.reference, failedCursor.current);
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
  const submitWrite = async (suffix: string, input: Record<string,string>, applyReceipt?: (data: Record<string, unknown>, account: string) => void) => {
    if (!client || inFlight.current || AppState.currentState !== 'active') return null;
    inFlight.current = true; const attempt = ++generation.current;
    const controller = new AbortController(); pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000); setBusy(true); setError('');
    try {
      const saved = await authCall(() => client.auth.getSession(), controller.signal);
      if (attempt !== generation.current || controller.signal.aborted || AppState.currentState !== 'active') return null;
      if (isAuthRetryableFetchError(saved.error)) { clearDetails(); throw saved.error; }
      if (!saved.data.session || saved.error) {clear();await signOut();throw new Error('login');}
      const account = saved.data.session.user.id;
      if (mutationAccount.current !== account) {
        mutationAttempts.current.clear();
        mutationAccount.current = account;
      }
      const signature = JSON.stringify(input);
      const previous = mutationAttempts.current.get(suffix);
      if (previous?.requiresRefresh) {
        setError('Profilen har ändrats. Hämta profilen igen innan du sparar.');
        return null;
      }
      const currentAttempt = previous?.signature === signature
        ? previous
        : { signature, key: `support-${Date.now()}-${Math.random().toString(36).slice(2)}` };
      mutationAttempts.current.set(suffix, currentAttempt);
      const response = await abortable(fetch(customerEndpoint(customerApi, suffix, undefined, process.env.EXPO_PUBLIC_CUSTOMER_API_PATH), { method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${saved.data.session.access_token}`, 'Content-Type': 'application/json', 'Idempotency-Key': currentAttempt.key },
        body: JSON.stringify(input),
      }), controller.signal);
      if (attempt !== generation.current || controller.signal.aborted) return null;
      if (response.status === 401) { clear(); await signOut(); throw new Error('login'); }
      if (suffix === 'profile' && (response.status === 400 || response.status === 422)) { setError('Kontrollera telefonnumrets format.'); return null; }
      if (response.status === 409) {
        if (suffix === 'profile') {
          const conflict = await abortable(response.json(), controller.signal).catch(() => null);
          if (attempt !== generation.current || controller.signal.aborted) return null;
          if (conflict?.code === 'profile_version_conflict') {
            mutationAttempts.current.set(suffix, { ...currentAttempt, requiresRefresh: true });
            setError('Profilen har ändrats. Hämta profilen igen innan du sparar.');
            return null;
          }
        }
        setError('Begäran behöver kontrolleras. Hämta senaste uppgifterna igen innan du ändrar innehållet eller försöker på nytt.');
        return null;
      }
      if (response.status === 429) { setError('För många försök. Vänta en stund och försök igen med samma uppgifter.'); return null; }
      if (!response.ok) throw new Error('support');
      const body = await abortable(response.json(), controller.signal); if (body?.data?.accepted !== true || suffix==='notifications/read' && (typeof body.data.readAt!=='string'||!Number.isFinite(Date.parse(body.data.readAt)))) throw new Error('response');
      if (attempt !== generation.current || controller.signal.aborted) return null;
      applyReceipt?.(body.data, account);
      mutationAttempts.current.delete(suffix);
      if (suffix === 'profile' && selected.current.view === 'profile') {
        try {
          const profile = await abortable(fetch(customerEndpoint(customerApi, 'profile', undefined, process.env.EXPO_PUBLIC_CUSTOMER_API_PATH), {
            headers: { Authorization: `Bearer ${saved.data.session.access_token}` },
            signal: controller.signal,
            cache: 'no-store',
          }), controller.signal);
          if (attempt !== generation.current || controller.signal.aborted) return null;
          if (profile.status === 401) {
            clear();
            await signOut();
            return null;
          }
          if (!profile.ok) throw new Error('Profile refresh failed');
          const rows = parseCustomerRows('profile', await abortable(profile.json(), controller.signal));
          if (attempt !== generation.current || controller.signal.aborted) return null;
          setRows(rows);
        } catch {
          if (attempt !== generation.current) return null;
          setError('Telefonnumret sparades. Profilen kunde inte hämtas på nytt.');
        }
      }
      return {payload:body.data as Record<string,unknown>,epoch:attempt};
    } catch { if (attempt === generation.current) { if (controller.signal.aborted) clearDetails(); setError('Kunde inte bekräfta att ändringen sparats. Försök igen med samma innehåll för att undvika dubbletter.'); } return null; }
    finally { clearTimeout(timeout); if (wantsLogout.current) await signOut(); inFlight.current = false; setBusy(false); if (needsRestore.current && AppState.currentState === 'active') setRestoreTick(v => v + 1); }
  };
  const submitSupport = async (title: string, message: string, reference?: string) => {
    const suffix = reference ? `support/${encodeURIComponent(reference)}/messages` : 'support';
    const result = await submitWrite(suffix, reference ? { message } : { title, message }, (data, account) => {
      if (reference && data.message !== undefined) {
        const saved = parseSupportMessage(data.message);
        if (data.caseReference !== reference || saved.author !== 'customer' || saved.kind !== 'message') throw new Error('Invalid reply receipt');
        if (verifiedAccount.current === account && selected.current.view === 'supportDetail' && selected.current.reference === reference) {
          setSupport(previous => previous && previous.reference === reference && !previous.messages.some(item => item.reference === saved.reference)
            ? { ...previous, messages: [...previous.messages, saved] } : previous);
        }
      } else if (!reference && data.supportCase !== undefined) {
        const [saved] = parseCustomerRows('support', { data: { support: [data.supportCase] } });
        if (!/^[A-Za-z0-9_-]{1,240}$/.test(saved.reference) || !saved.title ||
            !['received', 'in_progress', 'resolved', 'closed'].includes(String(saved.status))) throw new Error('Invalid case receipt');
        if (verifiedAccount.current === account && selected.current.view === 'support') {
          setRows(previous => [saved, ...(previous ?? []).filter(row => row.reference !== saved.reference)]);
        }
      }
    });
    return Boolean(result && result.epoch === generation.current);
  };
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
    if (verifiedAccount.current && saved.data.session.user?.id !== verifiedAccount.current) {
      clear();
      needsRestore.current = true;
      setRestoreTick(value => value + 1);
      throw new Error('Account changed');
    }
    const url = new URL(customerEndpoint(customerApi, kind, undefined, process.env.EXPO_PUBLIC_CUSTOMER_API_PATH));
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const response = await abortable(fetch(url.href, { headers: { Authorization: `Bearer ${saved.data.session.access_token}`,
      ...(kind === 'consumption' ? { Accept: DAILY_CONSUMPTION_MEDIA_TYPE } : {}),
    }, signal }), signal);
    if (signal.aborted || epoch !== generation.current || AppState.currentState !== 'active') throw new Error('Cancelled');
    if (response.status === 401) { clear(); await signOut(); throw new Error('Login required'); }
    if (!response.ok) throw new Error('Consumption unavailable');
    const body: unknown = await abortable(response.json(), signal);
    if (signal.aborted || epoch !== generation.current || AppState.currentState !== 'active') throw new Error('Cancelled');
    return body;
  }, [client, clear, clearDetails, signOut, authCall]);
  return { configured: Boolean(client), authenticated, busy, navigationBlocked: busy && !readingList, logoutFailed, rows, invoice, support, resource, error: error || (consumption ? '' : listError), active, login, select, switchView, retry, openDocument, submitSupport, updatePhone, markNotificationRead, nextCursor, loadMore, logout, readConsumption, consumptionPreference, setConsumptionPreference };
}
