// app/(public)/teckna/page.tsx
import type { Metadata } from 'next'
import { createHash, randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ElectricityCalculator from '@/components/ElectricityCalculator'
import { fetchLivePublishedContracts } from '@/lib/gridex/pricing/db'
import { supabaseService } from '@/lib/supabase/service'
import {
  createSignupOrder,
  hashPersonalNumber,
  maskPersonalNumber,
} from '@/lib/customerSignup/service'

export const metadata: Metadata = {
  title: 'Teckna elavtal – snabbt & transparent',
  description:
    'Räkna ditt elpris och teckna elavtal direkt. Tydliga villkor, full specifikation och smidig signering.',
  alternates: { canonical: 'https://gridex.se/teckna' },
}

type ContractOption = {
  name: string
  slug: string
}

type LiveDoc = {
  slug: string
  title: string
  version: string
}

type RateLimitRow = {
  allowed?: boolean
}

type AgreementRow = {
  id: string
}

function getClientIpFromHeaders(h: Headers): string | null {
  const xff = h.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }

  const xrip = h.get('x-real-ip')
  if (xrip) return xrip.trim()

  return null
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function normalizeText(value: FormDataEntryValue | null): string {
  return String(value || '').trim()
}

function normalizeEmail(value: FormDataEntryValue | null): string {
  return String(value || '').trim().toLowerCase()
}

function isDuplicateError(message: string): boolean {
  const msg = message.toLowerCase()
  return (
    msg.includes('duplicate') ||
    msg.includes('unique') ||
    msg.includes('idempotency')
  )
}

async function fetchLiveLegalDocs(): Promise<LiveDoc[]> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('legal_documents_live')
    .select('slug,title,version')

  if (error || !data) {
    return [
      { slug: 'villkor', title: 'Allmänna villkor', version: 'unknown' },
      { slug: 'integritet', title: 'Integritetspolicy', version: 'unknown' },
      { slug: 'cookies', title: 'Cookiepolicy', version: 'unknown' },
    ]
  }

  const wanted = new Set(['villkor', 'integritet', 'cookies'])
  const picked = (data as LiveDoc[]).filter((d) => wanted.has(d.slug))
  const bySlug = new Map(picked.map((d) => [d.slug, d]))

  const ensure = (slug: string, title: string): LiveDoc =>
    bySlug.get(slug) ?? { slug, title, version: 'unknown' }

  return [
    ensure('villkor', 'Allmänna villkor'),
    ensure('integritet', 'Integritetspolicy'),
    ensure('cookies', 'Cookiepolicy'),
  ]
}

async function ensureUserProfile(params: {
  userId: string
  email: string
  fullName?: string | null
  phone?: string | null
  personalNumber?: string | null
}) {
  const { userId, email, fullName, phone, personalNumber } = params

  const { error } = await supabaseService
    .from('user_profiles')
    .upsert(
      {
        id: userId,
        user_id: userId,
        email,
        full_name: fullName || null,
        phone: phone || null,
        personal_number: personalNumber || null,
      },
      { onConflict: 'id' }
    )

  if (error) {
    throw new Error(`Failed to sync user profile: ${error.message}`)
  }
}

async function findUserByEmail(email: string) {
  const { data, error } = await supabaseService.auth.admin.listUsers()

  if (error) {
    throw new Error(`Failed to list users: ${error.message}`)
  }

  return data.users.find((u) => u.email?.toLowerCase() === email) ?? null
}

async function ensurePortalUser(params: {
  email: string
  firstName: string
  lastName: string
  phone: string
  personalNumber: string
}) {
  const { email, firstName, lastName, phone, personalNumber } = params
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()

  const existingUser = await findUserByEmail(email)

  if (existingUser?.id) {
    await ensureUserProfile({
      userId: existingUser.id,
      email,
      fullName,
      phone,
      personalNumber,
    })

    return {
      userId: existingUser.id,
      created: false,
    }
  }

  const redirectTo = `${
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gridex.se'
  }/login?next=/dashboard`

  const invited = await supabaseService.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      source: 'contract_signup',
      first_name: firstName,
      last_name: lastName,
    },
  })

  if (invited.error || !invited.data.user?.id) {
    throw new Error(invited.error?.message || 'Failed to invite user')
  }

  await ensureUserProfile({
    userId: invited.data.user.id,
    email,
    fullName,
    phone,
    personalNumber,
  })

  return {
    userId: invited.data.user.id,
    created: true,
  }
}

async function insertLegalAcceptances(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  userId: string
  email: string
  agreementId: string
  ip: string | null
  userAgent: string | null
  villkorVersion: string
  integritetVersion: string
  cookiesVersion: string
}) {
  const {
    supabase,
    userId,
    email,
    agreementId,
    ip,
    userAgent,
    villkorVersion,
    integritetVersion,
    cookiesVersion,
  } = params

  const payload = [
    {
      user_id: userId,
      email,
      agreement_id: agreementId,
      document_slug: 'villkor',
      document_version: villkorVersion,
      ip,
      user_agent: userAgent,
      metadata: { source: 'teckna', accepted: true },
    },
    {
      user_id: userId,
      email,
      agreement_id: agreementId,
      document_slug: 'integritet',
      document_version: integritetVersion,
      ip,
      user_agent: userAgent,
      metadata: { source: 'teckna', accepted: true },
    },
    {
      user_id: userId,
      email,
      agreement_id: agreementId,
      document_slug: 'cookies',
      document_version: cookiesVersion,
      ip,
      user_agent: userAgent,
      metadata: { source: 'teckna', accepted: true },
    },
  ]

  const { error } = await supabase.from('legal_acceptances').insert(payload)

  if (error && !isDuplicateError(error.message)) {
    throw new Error(error.message)
  }
}

async function handleSigningFlow(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  agreementId: string
  email: string
  signMethod: string
}) {
  const { supabase, agreementId, email, signMethod } = params

  if (signMethod === 'bankid') {
    const { error } = await supabase
      .from('contract_agreements')
      .update({ status: 'bankid_started' })
      .eq('id', agreementId)

    if (error) {
      throw new Error(error.message)
    }

    redirect(`/sign/bankid/${agreementId}`)
  }

  const token = randomBytes(32).toString('hex')

  const { error: updateError } = await supabase
    .from('contract_agreements')
    .update({
      email_sign_token: token,
      status: 'email_sent',
    })
    .eq('id', agreementId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  const { error: emailError } = await supabase.from('system_emails').insert({
    to_email: email,
    subject: 'Signera ditt elavtal',
    body: `Klicka för att signera: https://gridex.se/sign/email/${token}`,
  })

  if (emailError) {
    throw new Error(emailError.message)
  }

  redirect('/sign/check-email')
}

export default async function TecknaPage() {
  const supabase = await createSupabaseServerClient()
  const nowIso = new Date().toISOString()

  const visible = await fetchLivePublishedContracts(supabase, nowIso)

  const options: ContractOption[] = visible
    .map((c) => ({
      name: c.contract.name,
      slug: c.contract.slug,
    }))
    .filter(
      (o): o is ContractOption =>
        typeof o.slug === 'string' && o.slug.length > 0
    )

  const legalDocs = await fetchLiveLegalDocs()
  const villkorDoc = legalDocs.find((d) => d.slug === 'villkor')
  const integritetDoc = legalDocs.find((d) => d.slug === 'integritet')
  const cookiesDoc = legalDocs.find((d) => d.slug === 'cookies')

  async function signContractAction(formData: FormData) {
    'use server'

    const supabase = await createSupabaseServerClient()
    const h = await headers()

    const ip = getClientIpFromHeaders(h)
    const userAgent = h.get('user-agent')

    const contractSlug = normalizeText(formData.get('contract_slug'))
    const firstName = normalizeText(formData.get('first_name'))
    const lastName = normalizeText(formData.get('last_name'))
    const personalNumber = normalizeText(formData.get('personal_number'))
    const address = normalizeText(formData.get('address'))
    const postalCode = normalizeText(formData.get('postal_code'))
    const city = normalizeText(formData.get('city'))
    const apartment = normalizeText(formData.get('apartment'))
    const facilityId = normalizeText(formData.get('facility_id'))
    const moveInDate = normalizeText(formData.get('move_in_date'))
    const email = normalizeEmail(formData.get('email'))
    const phone = normalizeText(formData.get('phone'))
    const signMethod = normalizeText(formData.get('sign_method')) || 'email'

    const acceptVillkor = String(formData.get('accept_villkor') || '') === 'on'
    const acceptIntegritet =
      String(formData.get('accept_integritet') || '') === 'on'
    const acceptCookies = String(formData.get('accept_cookies') || '') === 'on'

    if (
      !email ||
      !facilityId ||
      !address ||
      !postalCode ||
      !city ||
      !firstName ||
      !lastName ||
      !personalNumber ||
      !contractSlug ||
      !phone
    ) {
      throw new Error('Missing required fields')
    }

    if (!acceptVillkor || !acceptIntegritet || !acceptCookies) {
      throw new Error(
        'Du måste acceptera villkor, integritetspolicy och cookiepolicy.'
      )
    }

    const windowSeconds = 600
    const maxRequests = 5
    const ipKey = ip ? `ip:${ip}` : 'ip:unknown'
    const emailKey = `email:${email}`

    const ipRl = await supabase.rpc('gridex_rate_limit_check_and_inc', {
      p_action: 'sign_contract',
      p_key: ipKey,
      p_window_seconds: windowSeconds,
      p_max_requests: maxRequests,
    })

    if (ipRl.error) {
      throw new Error(ipRl.error.message)
    }

    const ipRlRows = Array.isArray(ipRl.data)
      ? (ipRl.data as RateLimitRow[])
      : []

    if (ipRlRows[0]?.allowed === false) {
      throw new Error('För många försök. Vänta en stund och prova igen.')
    }

    const emailRl = await supabase.rpc('gridex_rate_limit_check_and_inc', {
      p_action: 'sign_contract',
      p_key: emailKey,
      p_window_seconds: windowSeconds,
      p_max_requests: maxRequests,
    })

    if (emailRl.error) {
      throw new Error(emailRl.error.message)
    }

    const emailRlRows = Array.isArray(emailRl.data)
      ? (emailRl.data as RateLimitRow[])
      : []

    if (emailRlRows[0]?.allowed === false) {
      throw new Error(
        'För många försök för denna e-post. Vänta en stund och prova igen.'
      )
    }

    const personalNumberMasked = maskPersonalNumber(personalNumber)
    const personalNumberHash = hashPersonalNumber(personalNumber)

    const idempotencyKey = sha256(
      [
        'sign_contract_v1',
        email,
        personalNumber,
        facilityId,
        contractSlug,
        postalCode,
        moveInDate || 'no_move_in_date',
      ].join('|')
    )

    const { userId, created } = await ensurePortalUser({
      email,
      firstName,
      lastName,
      phone,
      personalNumber,
    })

    if (created) {
      const { error: systemEmailError } = await supabase.from('system_emails').insert({
        to_email: email,
        subject: 'Aktivera din kundportal hos Gridex',
        body: 'Vi har skickat en aktiveringslänk till dig. Bekräfta e-postadressen för att slutföra ditt kundkonto och logga in på Mina sidor.',
      })

      if (systemEmailError) {
        throw new Error(systemEmailError.message)
      }
    }

    const agreementInsert = {
      user_id: userId,
      contract_slug: contractSlug,
      first_name: firstName,
      last_name: lastName,
      personal_number: personalNumber,
      address,
      postal_code: postalCode,
      city,
      apartment: apartment || null,
      facility_id: facilityId,
      move_in_date: moveInDate || null,
      phone,
      email,
      status: 'pending_signature',
      sign_method: signMethod,
      idempotency_key: idempotencyKey,
    }

    const { data: agreement, error: agreementError } = await supabase
      .from('contract_agreements')
      .insert(agreementInsert)
      .select('id')
      .single<AgreementRow>()

    let agreementId: string

    if (agreementError) {
      if (!isDuplicateError(agreementError.message)) {
        throw new Error(agreementError.message)
      }

      const { data: existingAgreement, error: fetchErr } = await supabase
        .from('contract_agreements')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle<AgreementRow>()

      if (fetchErr) {
        throw new Error(fetchErr.message)
      }

      if (!existingAgreement?.id) {
        throw new Error(
          'Idempotency triggered but existing agreement not found.'
        )
      }

      agreementId = existingAgreement.id
    } else {
      if (!agreement?.id) {
        throw new Error('Agreement created without id')
      }

      agreementId = agreement.id
    }

    await insertLegalAcceptances({
      supabase,
      userId,
      email,
      agreementId,
      ip,
      userAgent,
      villkorVersion: villkorDoc?.version ?? 'unknown',
      integritetVersion: integritetDoc?.version ?? 'unknown',
      cookiesVersion: cookiesDoc?.version ?? 'unknown',
    })

    await handleSigningFlow({
      supabase,
      agreementId,
      email,
      signMethod,
    })

    revalidatePath('/teckna')
  }

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 py-12 md:py-16">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-[120px]" />

        <div className="relative grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
              Räkna först • Teckna tryggt • Signera smidigt
            </div>

            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                Teckna elavtal
                <br />
                på ett tydligare sätt
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">
                Börja med att räkna på ditt pris. När du känner dig trygg med
                valet fyller du i dina uppgifter och går vidare till signering.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                1. Räkna på ditt pris
              </div>
              <p className="mt-1 text-sm text-gray-400">
                Ange elområde, förbrukning och välj avtal.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                2. Fyll i dina uppgifter
              </div>
              <p className="mt-1 text-sm text-gray-400">
                Vi behöver information för att kunna starta ditt avtal korrekt.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-white">
                3. Signera tryggt
              </div>
              <p className="mt-1 text-sm text-gray-400">
                Signera via e-post eller BankID när det är tillgängligt.
              </p>
            </div>
          </div>
        </div>
      </section>

      <ElectricityCalculator contracts={options} />

      <section className="rounded-3xl border border-white/10 bg-gray-950 p-8 md:p-10">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Fyll i uppgifter för att teckna avtal
          </h2>
          <p className="mt-3 text-gray-400">
            Kontrollera att uppgifterna stämmer. Det gör processen snabbare och
            minskar risken för fel i signering och uppstart.
          </p>
        </div>

        <form action={signContractAction} className="space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Förnamn" name="first_name" required />
            <Field label="Efternamn" name="last_name" required />
            <Field label="Personnummer" name="personal_number" required />
            <Field label="Anläggnings-ID" name="facility_id" required />
            <Field label="Adress" name="address" required />
            <Field label="Postnummer" name="postal_code" required />
            <Field label="Ort" name="city" required />
            <Field label="Lägenhet" name="apartment" />
            <Field label="Inflyttningsdatum" name="move_in_date" type="date" />
            <Field label="E-post" name="email" type="email" required />
            <Field label="Telefon" name="phone" required />

            <div>
              <label className="text-sm font-medium text-white/80">Avtal</label>
              <select
                name="contract_slug"
                required
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition focus:border-cyan-500/40"
              >
                {options.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-white/80">
                Signeringsmetod
              </label>
              <select
                name="sign_method"
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition focus:border-cyan-500/40"
              >
                <option value="email">Signera via e-post</option>
                <option value="bankid">Signera med BankID</option>
              </select>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/30 p-6 space-y-4">
            <div className="text-sm font-medium text-white">
              Godkänn villkor för att gå vidare
            </div>

            <label className="flex items-start gap-3 text-sm text-gray-300">
              <input type="checkbox" name="accept_villkor" required className="mt-1" />
              <span>
                Jag accepterar{' '}
                <a
                  className="text-cyan-300 underline hover:text-cyan-200"
                  href="/villkor"
                  target="_blank"
                  rel="noreferrer"
                >
                  allmänna villkor
                </a>{' '}
                {villkorDoc?.version ? (
                  <span className="text-xs text-gray-500">({villkorDoc.version})</span>
                ) : null}
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm text-gray-300">
              <input type="checkbox" name="accept_integritet" required className="mt-1" />
              <span>
                Jag accepterar{' '}
                <a
                  className="text-cyan-300 underline hover:text-cyan-200"
                  href="/integritet"
                  target="_blank"
                  rel="noreferrer"
                >
                  integritetspolicy
                </a>{' '}
                {integritetDoc?.version ? (
                  <span className="text-xs text-gray-500">({integritetDoc.version})</span>
                ) : null}
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm text-gray-300">
              <input type="checkbox" name="accept_cookies" required className="mt-1" />
              <span>
                Jag har läst{' '}
                <a
                  className="text-cyan-300 underline hover:text-cyan-200"
                  href="/cookies"
                  target="_blank"
                  rel="noreferrer"
                >
                  cookiepolicy
                </a>{' '}
                {cookiesDoc?.version ? (
                  <span className="text-xs text-gray-500">({cookiesDoc.version})</span>
                ) : null}
              </span>
            </label>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-gray-400">
              När du går vidare skapas ditt ärende och du skickas till signering
              via vald metod.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="text-sm text-gray-400">
              Kontrollera gärna att e-postadress, telefonnummer och anläggnings-ID
              är korrekta innan du fortsätter.
            </div>

            <button className="h-12 rounded-2xl bg-cyan-500 px-8 font-bold text-black transition hover:bg-cyan-400">
              Gå vidare till signering
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function Field({
  label,
  name,
  required = false,
  type = 'text',
}: {
  label: string
  name: string
  required?: boolean
  type?: string
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