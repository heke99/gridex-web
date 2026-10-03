'use client'
import { useEffect, useRef, useState } from 'react'
import GridexLogo from '@/components/brand/GridexLogo'
import StaffAuth from './StaffAuth'
import StaffCustomers from './StaffCustomers'
import StaffCases from './StaffCases'
import { consumeStaffRecoveryFragment, createStaffClient } from './client'
import type { StaffContext, StaffCustomerDetail } from './types'
import { Feedback, panel, secondary } from './ui'

export default function StaffPortal({ initialView = 'workspace' }: { initialView?: 'login' | 'workspace' | 'recovery' | 'verify' }) {
  const [recoveryToken, setRecoveryToken] = useState(consumeStaffRecoveryFragment)
  const [context, setContext] = useState<StaffContext | null>(null)
  const contextRef = useRef<StaffContext | null>(null)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [tab, setTab] = useState<'customers' | 'cases'>('cases')
  const [customer, setCustomer] = useState<StaffCustomerDetail | null>(null)
  const [client] = useState(() => createStaffClient(() => contextRef.current?.csrf_token ?? '', () => {
    contextRef.current = null; setContext(null); setCustomer(null); setRevision((value) => value + 1)
  }))
  function updateContext(next: StaffContext) {
    contextRef.current = next; setContext(next); setError(null)
    if (next.status !== 'authenticated') setCustomer(null)
    if (next.status !== 'anonymous') setRecoveryToken(null)
  }
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(null)
    void client.read<StaffContext>('/api/staff/session', controller.signal).then((result) => {
      if (!controller.signal.aborted) updateContext(result.data)
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Sessionen kunde inte hämtas.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [client, revision])
  async function sessionAction(action: 'refresh' | 'logout') {
    if (lock.current || loading || !context) return
    lock.current = true; setBusy(true); setError(null)
    if (action === 'logout') { setContext(null); setCustomer(null); setTab('cases'); setLoading(true) }
    let failureMessage: string | null = null
    try {
      const result = await client.write<StaffContext>(`/api/staff/session/${action}`, {})
      if (action === 'refresh') updateContext(result.data)
    } catch (failure) { failureMessage = failure instanceof Error ? failure.message : 'Sessionen kunde inte uppdateras.'; setError(failureMessage) }
    finally {
      if (action === 'logout') {
        // Logout removes the cookie; a new bootstrap supplies the anonymous CSRF.
        contextRef.current = null; setContext(null); setCustomer(null); setTab('cases'); setLoading(true)
        try { updateContext((await client.read<StaffContext>('/api/staff/session')).data); if (failureMessage) setError(failureMessage) }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Sessionen kunde inte hämtas.') }
        setLoading(false)
      }
      lock.current = false; setBusy(false)
    }
  }
  const staff = context?.status === 'authenticated' ? context.staff : null
  const canCustomers = Boolean(staff?.capabilities.includes('staff.customers.read') && (staff.permissions.includes('customers.read') || staff.is_platform_admin))
  const canCases = Boolean(staff?.capabilities.includes('staff.support.read') && (staff.permissions.includes('cases.read') || staff.is_platform_admin))
  const canWrite = Boolean(staff?.capabilities.includes('staff.support.write') && staff.permissions.includes('cases.write') && !staff.is_platform_admin)
  return <div className="min-h-screen bg-[var(--gx-canvas)] text-[var(--gx-text)]">
    <header className="border-b border-white/10 bg-[var(--gx-surface)]"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6"><div className="flex items-center gap-3"><GridexLogo className="h-9 w-9" /><div><p className="font-semibold">Gridex arbetsyta</p><p className="text-xs text-slate-400">Kunder och kundservice</p></div></div>{context && context.status !== 'anonymous' && <div className="flex flex-wrap items-center gap-2">{staff && <span className="mr-2 text-sm text-slate-300">{staff.display_name || 'Gridex-personal'}</span>}<button type="button" className={secondary} disabled={busy || loading} onClick={() => sessionAction('refresh')}>Uppdatera session</button><button type="button" className={secondary} disabled={busy || loading} onClick={() => sessionAction('logout')}>Logga ut</button></div>}</div></header>
    <main id="staff-main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10"><Feedback error={error} />
      {loading && !context && <p role="status" className={panel}>Kontrollerar din session…</p>}
      {!loading && !context && <button type="button" className={secondary} onClick={() => setRevision((value) => value + 1)}>Försök hämta sessionen igen</button>}
      {context && !staff && <StaffAuth key={`${context.status}:${initialView}`} context={context} client={client} onContext={updateContext} initialView={initialView} recoveryToken={recoveryToken} />}
      {staff && <><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Personalens arbetsyta</h1>{staff.is_platform_admin && <p className="mt-1 text-sm text-amber-200">Plattformsadministration: endast läsåtkomst.</p>}</div><nav aria-label="Arbetsyta" className="flex flex-wrap gap-2">{canCustomers && <button type="button" className={secondary} aria-pressed={tab === 'customers'} onClick={() => setTab('customers')}>Kundregister</button>}{canCases && <button type="button" className={secondary} aria-pressed={tab === 'cases'} onClick={() => setTab('cases')}>Ärendekö</button>}</nav></div>
      {customer && canCustomers && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3"><p className="text-sm">Vald kund: <strong>{customer.display_name || 'Kund'}</strong></p><div className="flex flex-wrap gap-2">{canCases && <button type="button" className={secondary} onClick={() => setTab('cases')}>Visa kundens ärenden</button>}<button type="button" className={secondary} onClick={() => setCustomer(null)}>Visa alla kunder och ärenden</button></div></div>}
      {(tab === 'customers' && canCustomers || !canCases && canCustomers) ? <StaffCustomers client={client} selectedReference={customer?.customer_reference} onSelect={setCustomer} /> : canCases ? <StaffCases client={client} canRead={canCases} canWrite={canWrite} customer={canCustomers ? customer : null} /> : <p className={panel}>Du har inga behörigheter för kunder eller ärenden i den här arbetsytan. Kontakta din administratör.</p>}
      </>}
    </main>
  </div>
}
