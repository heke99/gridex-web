'use client'

import { useState, type FormEvent } from 'react'

type SubmitState = 'idle' | 'sending' | 'sent' | 'error'

export default function KundserviceClient() {
  const [state, setState] = useState<SubmitState>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submitSupportTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('sending')
    setError(null)

    const form = event.currentTarget
    const formData = new FormData(form)

    const payload = {
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      category: String(formData.get('category') ?? 'general'),
      subject: String(formData.get('subject') ?? ''),
      message: String(formData.get('message') ?? ''),
      website: String(formData.get('website') ?? ''),
    }

    try {
      const response = await fetch('/api/support/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        setError(data.error ?? 'Kunde inte skicka ärendet.')
        setState('error')
        return
      }

      form.reset()
      setState('sent')
    } catch {
      setError('Kunde inte skicka ärendet just nu. Försök igen eller maila oss.')
      setState('error')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-16 text-white">
      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Kundservice • faktura • elavtal • flytt
        </div>
        <h1 className="mt-4 text-3xl font-bold md:text-4xl">Kontakta Gridex AB</h1>
        <p className="mt-3 max-w-3xl text-gray-400">
          Har du frågor om elavtal, faktura, pris, anläggnings-ID eller flytt?
          Skicka ett ärende så återkommer vi via e-post.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-gray-950 p-6 md:p-8">
          {state === 'sent' ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
              <div className="font-semibold text-emerald-300">
                Tack! Ditt ärende har skickats.
              </div>
              <p className="mt-2 text-sm text-emerald-100/80">
                Vi återkommer till dig via e-post. Du kan även maila
                support@gridex.se om du behöver komplettera ärendet.
              </p>
            </div>
          ) : (
            <form onSubmit={submitSupportTicket} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Namn" name="name" required />
                <Field label="E-post" name="email" type="email" required />
                <Field label="Telefon" name="phone" />
                <div>
                  <label className="text-sm font-medium text-white/80">Kategori</label>
                  <select
                    name="category"
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition focus:border-cyan-500/40"
                  >
                    <option value="general">Allmän fråga</option>
                    <option value="contract">Elavtal</option>
                    <option value="invoice">Faktura</option>
                    <option value="move">Flytt</option>
                    <option value="price">Pris/fråga om elpris</option>
                  </select>
                </div>
              </div>

              <Field label="Ämne" name="subject" required />

              <div>
                <label className="text-sm font-medium text-white/80">
                  Beskriv ditt ärende
                </label>
                <textarea
                  name="message"
                  required
                  rows={6}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40"
                  placeholder="Skriv vad du behöver hjälp med. Ange gärna kundnummer, anläggnings-ID eller fakturanummer om du har det."
                />
              </div>

              <input
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />

              <div aria-live="polite">
                {state === 'error' && error ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                    {error}
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={state === 'sending'}
                className="h-12 rounded-2xl bg-cyan-500 px-8 font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state === 'sending' ? 'Skickar...' : 'Skicka ärende'}
              </button>
            </form>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold text-white">E-post</div>
            <a
              href="mailto:support@gridex.se"
              className="mt-2 block text-cyan-300 underline underline-offset-4"
            >
              support@gridex.se
            </a>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold text-white">Bra att ha redo</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-400">
              <li>• Anläggnings-ID om frågan gäller leveransstart eller byte</li>
              <li>• Fakturanummer om frågan gäller faktura</li>
              <li>• Flyttdatum om frågan gäller inflytt eller utflytt</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-100">
            Akuta elnätsfel eller strömavbrott ska anmälas till din nätägare.
            Gridex AB hanterar elavtal, pris, faktura och kundärenden.
          </div>
        </aside>
      </div>
    </div>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="text-sm font-medium text-white/80">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40"
      />
    </div>
  )
}
