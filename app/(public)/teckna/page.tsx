import type { Metadata } from 'next'
import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ElectricityCalculator from '@/components/ElectricityCalculator'
import { fetchLivePublishedContracts } from '@/lib/gridex/pricing/db'

export const metadata: Metadata = {
  title: 'Teckna elavtal – snabbt & transparent',
  description:
    'Räkna ditt elpris och teckna elavtal direkt. Full specifikation innan du bekräftar.',
  alternates: { canonical: 'https://gridex.se/teckna' },
}

type ContractOption = {
  name: string
  slug: string
}

export default async function TecknaPage() {
  const supabase = await createSupabaseServerClient()
  const nowIso = new Date().toISOString()

  const visible = await fetchLivePublishedContracts(supabase, nowIso)

  const options: ContractOption[] = visible.map((c) => ({
    name: c.name,
    slug: c.slug,
  }))

  /* ======================================================
     SERVER ACTION – FULL CONTRACT SIGN FLOW
  ====================================================== */

  async function signContractAction(formData: FormData) {
    'use server'

    const supabase = await createSupabaseServerClient()

    const contractSlug = String(formData.get('contract_slug') || '')
    const address = String(formData.get('address') || '')
    const postalCode = String(formData.get('postal_code') || '')
    const apartment = String(formData.get('apartment') || '')
    const facilityId = String(formData.get('facility_id') || '')
    const email = String(formData.get('email') || '').toLowerCase()
    const phone = String(formData.get('phone') || '')
    const signMethod = String(formData.get('sign_method') || 'email') // email | bankid

    if (!email || !facilityId || !address || !postalCode) {
      throw new Error('Missing required fields')
    }

    /* ==========================================
       1️⃣  CREATE OR FETCH USER
    ========================================== */

    let userId: string | null = null

    const { data: existingUser } = await supabase.auth.admin.listUsers()

    const found = existingUser?.users.find((u) => u.email === email)

    if (found) {
      userId = found.id
    } else {
      const tempPassword = randomBytes(8).toString('hex')

      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      })

      if (error) throw new Error(error.message)
      userId = newUser.user?.id ?? null

      // TODO: Replace with real mail service
      await supabase.from('system_emails').insert({
        to_email: email,
        subject: 'Ditt konto hos Gridex',
        body: `Ditt konto är skapat. Temporärt lösenord: ${tempPassword}`,
      })
    }

    if (!userId) throw new Error('User creation failed')

    /* ==========================================
       2️⃣ CREATE AGREEMENT ROW
    ========================================== */

    const { data: agreement, error: agreementError } = await supabase
      .from('contract_agreements')
      .insert({
        user_id: userId,
        contract_slug: contractSlug,
        address,
        postal_code: postalCode,
        apartment,
        facility_id: facilityId,
        phone,
        email,
        status: 'pending_signature',
        sign_method: signMethod,
      })
      .select()
      .single()

    if (agreementError) throw new Error(agreementError.message)

    /* ==========================================
       3️⃣ SIGN FLOW
    ========================================== */

    if (signMethod === 'bankid') {
      // Placeholder for BankID provider
      // Here you would call external BankID API

      await supabase
        .from('contract_agreements')
        .update({ status: 'bankid_started' })
        .eq('id', agreement.id)

      redirect(`/sign/bankid/${agreement.id}`)
    }

    if (signMethod === 'email') {
      const token = randomBytes(32).toString('hex')

      await supabase
        .from('contract_agreements')
        .update({
          email_sign_token: token,
        })
        .eq('id', agreement.id)

      // TODO: Replace with real email provider
      await supabase.from('system_emails').insert({
        to_email: email,
        subject: 'Signera ditt elavtal',
        body: `Klicka för att signera: https://gridex.se/sign/email/${token}`,
      })

      redirect('/sign/check-email')
    }

    revalidatePath('/teckna')
  }

  /* ====================================================== */

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-12">
      <div>
        <h1 className="text-4xl font-bold">Teckna elavtal</h1>
        <p className="text-gray-400 mt-3 max-w-2xl">
          Börja med att räkna ditt elpris. När du är nöjd fyller du i uppgifterna och signerar.
        </p>
      </div>

      <ElectricityCalculator contracts={options} />

      {/* ================= SIGN FORM ================= */}

      <section className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h2 className="text-2xl font-bold mb-6">Teckna avtal</h2>

        <form action={signContractAction} className="grid gap-6 md:grid-cols-2">
          <div>
            <label>Avtal</label>
            <select
              name="contract_slug"
              className="w-full mt-2 h-11 rounded-xl bg-black/40 border border-gray-800 px-3"
              required
            >
              {options.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Anläggnings-ID</label>
            <input
              name="facility_id"
              required
              className="w-full mt-2 h-11 rounded-xl bg-black/40 border border-gray-800 px-3"
            />
          </div>

          <div>
            <label>Adress</label>
            <input
              name="address"
              required
              className="w-full mt-2 h-11 rounded-xl bg-black/40 border border-gray-800 px-3"
            />
          </div>

          <div>
            <label>Postnummer</label>
            <input
              name="postal_code"
              required
              className="w-full mt-2 h-11 rounded-xl bg-black/40 border border-gray-800 px-3"
            />
          </div>

          <div>
            <label>Lägenhet</label>
            <input
              name="apartment"
              className="w-full mt-2 h-11 rounded-xl bg-black/40 border border-gray-800 px-3"
            />
          </div>

          <div>
            <label>Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full mt-2 h-11 rounded-xl bg-black/40 border border-gray-800 px-3"
            />
          </div>

          <div>
            <label>Telefon</label>
            <input
              name="phone"
              required
              className="w-full mt-2 h-11 rounded-xl bg-black/40 border border-gray-800 px-3"
            />
          </div>

          <div>
            <label>Signeringsmetod</label>
            <select
              name="sign_method"
              className="w-full mt-2 h-11 rounded-xl bg-black/40 border border-gray-800 px-3"
            >
              <option value="email">Signera via email</option>
              <option value="bankid">Signera med BankID</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button className="w-full h-12 rounded-xl bg-cyan-500 font-bold text-black hover:bg-cyan-400">
              Gå vidare till signering
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}