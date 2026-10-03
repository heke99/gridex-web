'use client'
import { useRef, useState, type FormEvent } from 'react'
import type { StaffClient } from './client'
import type { StaffContext } from './types'
import { Feedback, field, panel, primary, secondary } from './ui'

export default function StaffAuth({ context, client, onContext, initialView = 'login', recoveryToken = null }: {
  context: StaffContext; client: StaffClient; onContext: (context: StaffContext) => void; initialView?: 'login' | 'workspace' | 'recovery' | 'verify'; recoveryToken?: string | null
}) {
  const [view, setView] = useState(recoveryToken ? 'verify' : initialView === 'workspace' ? 'login' : initialView)
  const [challenge, setChallenge] = useState<{ challenge_reference: string; expires_at?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault()
    if (lock.current) return
    const form = event.currentTarget
    const values = new FormData(form)
    const value = (name: string) => String(values.get(name) ?? '').trim()
    let body: Record<string, unknown>
    if (action === 'login') body = { email: value('email'), password: String(values.get('password') ?? '') }
    else if (action === 'recovery') body = { email: value('email') }
    else if (action === 'recovery/verify') body = { token_hash: recoveryToken || value('token_hash') }
    else if (action === 'mfa/challenge') body = { factor_reference: value('factor_reference') }
    else if (action === 'mfa/verify') {
      if (!challenge) return
      if (!/^\d{6}$/.test(value('code'))) { setError('Ange den sexsiffriga koden från din autentiseringsapp.'); return }
      body = { challenge_reference: challenge.challenge_reference, code: value('code') }
    } else {
      const password = String(values.get('password') ?? '')
      if (password.length < 12 || password.length > 1024) { setError('Välj ett lösenord med 12–1024 tecken.'); return }
      if (password !== String(values.get('confirm_password') ?? '')) { setError('Lösenorden måste vara lika.'); return }
      body = { password }
    }
    lock.current = true; setBusy(true); setError(null); setNotice(null)
    try {
      if (action === 'recovery') {
        await client.write('/api/staff/session/recovery', body)
        form.reset(); setNotice('Om kontot kan återställas får du instruktioner via e-post.')
      } else if (action === 'mfa/challenge') {
        const result = await client.write<{ challenge_reference: string; expires_at?: string }>('/api/staff/session/mfa/challenge', body)
        setChallenge(result.data); setNotice('Ange koden från din autentiseringsapp.')
      } else {
        const result = await client.write<StaffContext>(`/api/staff/session/${action}`, body)
        form.reset(); setChallenge(null); onContext(result.data)
        setView('login')
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Inloggningen kunde inte genomföras.') }
    finally { lock.current = false; setBusy(false) }
  }
  const mfa = context.status === 'mfa_required'
  const passwordChange = context.status === 'password_change_required'
  return <section className={`${panel} mx-auto max-w-lg`} aria-labelledby="staff-auth-title">
    <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Gridex · Personal</p>
    <h1 id="staff-auth-title" className="mt-3 text-2xl font-semibold">{mfa ? 'Verifiera din inloggning' : passwordChange ? 'Välj ett nytt lösenord' : view === 'recovery' ? 'Återställ lösenord' : view === 'verify' ? 'Bekräfta återställning' : 'Logga in på arbetsytan'}</h1>
    <p className="mt-3 text-sm text-slate-400">{mfa ? 'Använd din registrerade autentiseringsapp.' : passwordChange ? 'Byt lösenord för att fortsätta till arbetsytan.' : 'Den här arbetsytan är till för behörig Gridex-personal.'}</p>
    <Feedback error={error} notice={notice} />
    {mfa ? <>{!challenge ? <form className="mt-6 space-y-4" onSubmit={(event) => submit(event, 'mfa/challenge')}>
      <label className="block text-sm">Autentiseringsapp<select name="factor_reference" required className={field}>{context.factors.map((factor) => <option key={factor.factor_reference} value={factor.factor_reference}>{factor.friendly_name || 'Autentiseringsapp'}</option>)}</select></label>
      {!context.factors.length && <p role="alert" className="text-sm text-rose-200">Ingen autentiseringsapp är tillgänglig. Kontakta din administratör.</p>}
      <button className={primary} disabled={busy || !context.factors.length}>Fortsätt med MFA</button>
    </form> : <form className="mt-6 space-y-4" onSubmit={(event) => submit(event, 'mfa/verify')}>
      <label className="block text-sm">Engångskod<input name="code" className={field} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
      <div className="flex flex-wrap gap-2"><button className={primary} disabled={busy}>Verifiera kod</button><button type="button" className={secondary} disabled={busy} onClick={() => setChallenge(null)}>Begär en ny verifiering</button></div>
    </form>}</> : passwordChange ? <form className="mt-6 space-y-4" onSubmit={(event) => submit(event, 'password')}>
      <label className="block text-sm">Nytt lösenord<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={1024} className={field} /></label>
      <label className="block text-sm">Bekräfta lösenord<input name="confirm_password" type="password" autoComplete="new-password" required minLength={12} maxLength={1024} className={field} /></label>
      <button className={primary} disabled={busy}>Spara nytt lösenord</button>
    </form> : view === 'verify' ? <form className="mt-6 space-y-4" onSubmit={(event) => submit(event, 'recovery/verify')}>
      {recoveryToken ? <p className="text-sm text-slate-300">Återställningskoden från ditt e-postmeddelande är mottagen. Bekräfta för att fortsätta.</p> : <label className="block text-sm">Återställningskod<input name="token_hash" autoComplete="off" className={field} required minLength={16} maxLength={512} pattern="[A-Za-z0-9_-]+" /></label>}
      <button className={primary} disabled={busy}>Bekräfta återställningskod</button>
    </form> : view === 'recovery' ? <form className="mt-6 space-y-4" onSubmit={(event) => submit(event, 'recovery')}>
      <label className="block text-sm">E-postadress<input name="email" type="email" autoComplete="username" required maxLength={254} className={field} /></label>
      <button className={primary} disabled={busy}>Skicka återställningsinstruktioner</button>
      <button type="button" className={`${secondary} block`} disabled={busy} onClick={() => { setView('verify'); setError(null); setNotice(null) }}>Jag har en återställningskod</button>
    </form> : <form className="mt-6 space-y-4" onSubmit={(event) => submit(event, 'login')}>
      <label className="block text-sm">E-postadress<input name="email" type="email" autoComplete="username" required maxLength={254} className={field} /></label>
      <label className="block text-sm">Lösenord<input name="password" type="password" autoComplete="current-password" required maxLength={1024} className={field} /></label>
      <button className={primary} disabled={busy}>{busy ? 'Loggar in…' : 'Logga in'}</button>
      <button type="button" className={`${secondary} block`} disabled={busy} onClick={() => { setView('recovery'); setError(null) }}>Glömt lösenord?</button>
    </form>}
    {!mfa && !passwordChange && view !== 'login' && <button type="button" className="mt-5 text-sm text-cyan-200 underline underline-offset-4" disabled={busy} onClick={() => { setView('login'); setError(null); setNotice(null) }}>Tillbaka till inloggning</button>}
  </section>
}
