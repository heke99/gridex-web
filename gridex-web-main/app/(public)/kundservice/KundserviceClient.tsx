'use client'

import { useState, type FormEvent } from 'react'

type SubmitState = 'idle' | 'sending' | 'sent' | 'error'

type FaqItem = {
  question: string
  answer: string
}

export default function KundserviceClient({ faqItems }: { faqItems: FaqItem[] }) {
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

      const data = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        setError(data.error ?? 'Vi kunde inte skicka ärendet just nu. Försök igen om en stund eller mejla kundservice.')
        setState('error')
        return
      }

      form.reset()
      setState('sent')
    } catch {
      setError('Vi kunde inte skicka ärendet just nu. Försök igen om en stund eller mejla kundservice.')
      setState('error')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-16 text-white">
      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          Kundservice • elavtal • faktura • flytt
        </div>
        <h1 className="mt-4 text-3xl font-bold md:text-4xl">Kontakta Gridex</h1>
        <p className="mt-3 max-w-3xl text-gray-400">
          Vi hjälper dig med frågor om elavtal, teckning, startdatum, faktura, flytt, Mina sidor och saknade anläggningsuppgifter. Vanligtvis återkommer vi via e-post så snart vi kan under vardagar.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-gray-950 p-6 md:p-8">
          {state === 'sent' ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6" aria-live="polite">
              <div className="font-semibold text-emerald-300">
                Tack! Ditt ärende har skickats.
              </div>
              <p className="mt-2 text-sm text-emerald-100/80">
                Vi återkommer via e-post. Om du behöver komplettera ärendet kan du svara på bekräftelsen eller mejla support@gridex.se.
              </p>
            </div>
          ) : (
            <form onSubmit={submitSupportTicket} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Namn" name="name" required autoComplete="name" />
                <Field label="E-post" name="email" type="email" required autoComplete="email" />
                <Field label="Telefon" name="phone" autoComplete="tel" />
                <div>
                  <label htmlFor="category" className="text-sm font-medium text-white/80">Kategori</label>
                  <select
                    id="category"
                    name="category"
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30"
                  >
                    <option value="general">Allmän fråga</option>
                    <option value="contract">Elavtal och teckning</option>
                    <option value="invoice">Faktura</option>
                    <option value="move">Flytt</option>
                    <option value="price">Pris och avgifter</option>
                  </select>
                </div>
              </div>

              <Field label="Ämne" name="subject" required />

              <div>
                <label htmlFor="message" className="text-sm font-medium text-white/80">
                  Beskriv ditt ärende
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30"
                  placeholder="Beskriv vad du behöver hjälp med. Ange gärna kundnummer, anläggnings-ID eller fakturanummer om du har det."
                />
                <p className="mt-2 text-xs leading-5 text-white/45">
                  Vi använder uppgifterna för att hantera ditt ärende och återkoppla till dig. Skicka inte känsliga uppgifter som inte behövs för ärendet.
                </p>
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
            <a href="mailto:support@gridex.se" className="mt-2 block text-cyan-300 underline underline-offset-4">
              support@gridex.se
            </a>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold text-white">Detta händer efter inskickat ärende</div>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-400">
              <li>Du får en bekräftelse om ärendet tas emot.</li>
              <li>Gridex går igenom uppgifterna och kontaktar dig via e-post.</li>
              <li>Om något saknas ber vi dig komplettera innan ärendet kan avslutas.</li>
            </ol>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold text-white">Bra att ha redo</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-400">
              <li>• Kundnummer om du har det</li>
              <li>• Anläggnings-ID om frågan gäller leveransstart eller byte</li>
              <li>• Fakturanummer om frågan gäller faktura</li>
              <li>• Flyttdatum om frågan gäller inflytt eller utflytt</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-100">
            Akuta elnätsfel eller strömavbrott ska anmälas till din nätägare. Gridex hanterar elavtal, pris, faktura och kundärenden.
          </div>
        </aside>
      </div>

      <section className="rounded-3xl border border-white/10 bg-gray-950 p-6 md:p-8">
        <h2 className="text-2xl font-bold text-white">Vanliga frågor</h2>
        <div className="mt-6 space-y-4">
          {faqItems.map((item) => (
            <details key={item.question} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-6 text-gray-300">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  autoComplete,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  autoComplete?: string
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium text-white/80">
        {label} {required ? <span className="text-cyan-300">*</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30"
      />
    </div>
  )
}
