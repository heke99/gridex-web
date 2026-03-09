import type { Metadata } from 'next'
import { createHash, randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ElectricityCalculator from '@/components/ElectricityCalculator'
import { fetchLivePublishedContracts } from '@/lib/gridex/pricing/db'
import { supabaseService } from '@/lib/supabase/service'

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
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-12">
      <div>
        <h1 className="text-4xl font-bold">Teckna elavtal</h1>
        <p className="text-gray-400 mt-3 max-w-2xl">
          Börja med att räkna ditt elpris. När du är nöjd fyller du i uppgifterna och signerar.
        </p>
      </div>

      <ElectricityCalculator contracts={options} />

      <section className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <h2 className="text-2xl font-bold mb-6">Teckna avtal</h2>

        <form action={signContractAction} className="grid gap-6 md:grid-cols-2">
          <div>
            <label>Förnamn</label>
            <input
              name="first_name"
              required
              className="w-full mt-2 h-11 rounded-xl bg-black/40 border border-gray-800 px-3"
            />
          </div>

          <div>
            <label>Efternamn</label>
            <input
              name="last_name"
              required
              className="w-full mt-2 h-11 rounded-xl bg-black/40 border border-gray-800 px-3"
            />
          </div>

          <div>
            <label>Personnummer</label>
            <input
              name="personal_number"
              required
              className="w-full mt-2 h-11 rounded-xl bg-black/40 border border-gray-800 px-3"
            />
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
            <label>Ort</label>
            <input
              name="city"
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
            <label>Inflyttningsdatum</label>
            <input
              type="date"
              name="move_in_date"
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
            <label>Avtal</label>
            <select
              name="contract_slug"
              required
              className="w-full mt-2 h-11 rounded-xl bg-black/40 border border-gray-800 px-3"
            >
              {options.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </select>
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

          <div className="md:col-span-2 rounded-2xl border border-gray-800 bg-black/30 p-5 space-y-3">
            <div className="text-sm text-gray-300">
              För att teckna måste du acceptera:
            </div>

            <label className="flex items-start gap-3 text-sm text-gray-300">
              <input type="checkbox" name="accept_villkor" required className="mt-1" />
              <span>
                Jag accepterar{' '}
                <a
                  className="text-cyan-300 hover:text-cyan-200 underline"
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
                  className="text-cyan-300 hover:text-cyan-200 underline"
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
                  className="text-cyan-300 hover:text-cyan-200 underline"
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

            <div className="text-xs text-gray-500">
            </div>
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