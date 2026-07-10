import { createHash } from 'node:crypto'
import type { OpsCustomerApplicationResult } from '@/lib/ops/client'

type SupabaseServiceClient = Awaited<typeof import('@/lib/supabase/service')>['supabaseService']

type PortalOnboardingStatus =
  | 'email_confirmation_sent'
  | 'invite_sent'
  | 'profile_linked'
  | 'pending'
  | 'failed'
  | 'skipped'

export type PortalOnboardingResult = {
  status: PortalOnboardingStatus
  userId?: string | null
  message?: string | null
}

export type PortalOnboardingInput = {
  application: OpsCustomerApplicationResult
  email: string
  firstName?: string | null
  lastName?: string | null
  companyName?: string | null
  phone?: string | null
  customerType: 'private' | 'company'
  address?: string | null
  postalCode?: string | null
  city?: string | null
  facilityId?: string | null
  meteringPointId?: string | null
  offerReference: string
  productCode?: string | null
  contractName?: string | null
  authenticatedUserId?: string | null
}

type ExistingProfile = {
  user_id: string
  email: string | null
  customer_number: string | null
  contract_customer_ref: string | null
  external_customer_id: string | null
}

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

function siteUrl(): string {
  return env('NEXT_PUBLIC_SITE_URL') ?? 'https://gridex.se'
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function fullName(input: PortalOnboardingInput): string | null {
  if (input.customerType === 'company') return input.companyName?.trim() || null
  return [input.firstName, input.lastName].filter(Boolean).join(' ').trim() || null
}

function emailHash(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex')
}

function isUuid(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  )
}

function authRedirectTo(): string {
  const next = encodeURIComponent('/login/reset-password')
  return `${siteUrl()}/auth/confirm?next=${next}`
}

async function loadServiceClient(): Promise<SupabaseServiceClient> {
  const { supabaseService } = await import('@/lib/supabase/service')
  return supabaseService
}

function stableProfileMatchesApplication(profile: ExistingProfile, input: PortalOnboardingInput): boolean {
  const appExternal = input.application.external_customer_id?.trim() || null
  const appCustomerNumber = input.application.customer_number?.trim() || null
  const externalMatches = Boolean(
    appExternal && profile.external_customer_id && profile.external_customer_id === appExternal,
  )
  const customerNumberMatches = Boolean(
    appCustomerNumber &&
      (profile.customer_number === appCustomerNumber ||
        profile.contract_customer_ref === appCustomerNumber),
  )
  return externalMatches || customerNumberMatches
}

async function findSafelyLinkedProfile(
  supabase: SupabaseServiceClient,
  input: PortalOnboardingInput,
): Promise<ExistingProfile | null> {
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('user_id,email,customer_number,contract_customer_ref,external_customer_id')
    .eq('email', normalizeEmail(input.email))
    .limit(3)
    .returns<ExistingProfile[]>()
  if (error) throw new Error(error.message)
  const rows = data ?? []
  if (rows.length !== 1) return null
  return stableProfileMatchesApplication(rows[0], input) ? rows[0] : null
}

function profilePayload(
  input: PortalOnboardingInput,
  userId: string,
  onboardingState: 'portal_email_confirmation_sent' | 'portal_existing_customer_linked',
) {
  const app = input.application
  const metadata = {
    source: 'ops_application_onboarding',
    customer_id: app.customer_id ?? null,
    application_id: app.application_id ?? null,
    application_number: app.application_number ?? null,
    portal_identity_id: app.portal_identity_id ?? null,
    contract_id: app.contract_id ?? null,
    contract_number: app.contract_number ?? null,
    customer_site_id: app.customer_site_id ?? null,
    metering_point_id: app.metering_point_id ?? null,
    offer_reference: app.offer_reference ?? input.offerReference,
    status: app.status,
    missing_fields: app.missing_fields,
    blocking_reasons: app.blocking_reasons,
    warnings: app.warnings,
  }

  return {
    user_id: userId,
    email: normalizeEmail(input.email),
    first_name: input.firstName ?? null,
    last_name: input.lastName ?? null,
    full_name: fullName(input),
    phone: input.phone ?? null,
    onboarding_state: onboardingState,
    billing_customer_ref: app.customer_number ?? app.customer_id ?? null,
    contract_customer_ref: app.customer_number ?? app.external_customer_id ?? null,
    external_identity_ref: app.portal_identity_id ?? app.external_customer_id ?? app.customer_id ?? null,
    customer_number: app.customer_number ?? null,
    external_customer_id: app.external_customer_id ?? null,
    portal_identity_id: app.portal_identity_id ?? null,
    customer_type: input.customerType,
    company_name: input.companyName ?? null,
    metadata,
  }
}

async function upsertLocalPortalRows(
  supabase: SupabaseServiceClient,
  input: PortalOnboardingInput,
  userId: string,
  onboardingState: 'portal_email_confirmation_sent' | 'portal_existing_customer_linked',
) {
  const profile = profilePayload(input, userId, onboardingState)

  const { error: profileError } = await supabase
    .from('customer_profiles')
    .upsert(profile, { onConflict: 'user_id' })
  if (profileError) throw new Error(`Portal profile upsert failed: ${profileError.message}`)

  if (isUuid(input.application.contract_id)) {
    const { error: contractLinkError } = await supabase
      .from('customer_contract_portal_links')
      .upsert(
        {
          user_id: userId,
          agreement_id: input.application.contract_id,
          contract_slug: input.productCode ?? input.offerReference,
          contract_name: input.contractName ?? input.productCode ?? 'Elavtal',
          status: input.application.status ?? 'application_received',
          billing_customer_ref: input.application.customer_number ?? null,
          contract_provider_key: 'ops',
          contract_external_ref: input.application.contract_number ?? null,
          pricing_snapshot: {
            offer_reference: input.application.offer_reference ?? input.offerReference,
            contract_price_snapshot_id: input.application.contract_price_snapshot_id ?? null,
          },
          metadata: {
            source: 'ops_application_onboarding',
            application_id: input.application.application_id ?? null,
            application_number: input.application.application_number ?? null,
            portal_identity_id: input.application.portal_identity_id ?? null,
            customer_number: input.application.customer_number ?? null,
          },
        },
        { onConflict: 'agreement_id' },
      )
    if (contractLinkError) {
      throw new Error(`Portal contract link upsert failed: ${contractLinkError.message}`)
    }
  }

  const facilityId = input.facilityId || null
  if (facilityId) {
    const { error: deliveryPointError } = await supabase
      .from('customer_delivery_points')
      .upsert(
        {
          user_id: userId,
          facility_id: facilityId,
          address: input.address ?? null,
          postal_code: input.postalCode ?? null,
          city: input.city ?? null,
          external_metering_ref: input.meteringPointId ?? null,
          metadata: {
            source: 'ops_application_onboarding',
            customer_site_id: input.application.customer_site_id ?? null,
            metering_point_id: input.application.metering_point_id ?? null,
          },
          is_primary: true,
        },
        { onConflict: 'user_id,facility_id' },
      )
    if (deliveryPointError) {
      throw new Error(`Portal delivery point upsert failed: ${deliveryPointError.message}`)
    }
  }
}

async function recordOnboardingFailure(
  supabase: SupabaseServiceClient,
  input: PortalOnboardingInput,
  reason: string,
) {
  const { error } = await supabase.from('website_submission_failures').insert({
    flow: 'portal_onboarding',
    email_hash: emailHash(input.email),
    reason,
    metadata: {
      application_number: input.application.application_number ?? null,
      customer_number: input.application.customer_number ?? null,
      portal_identity_id: input.application.portal_identity_id ?? null,
      contract_number: input.application.contract_number ?? null,
    },
  })
  if (error) throw new Error(`Portal onboarding failure audit insert failed: ${error.message}`)
}

export async function ensureCustomerPortalOnboarding(
  input: PortalOnboardingInput,
): Promise<PortalOnboardingResult> {
  if (env('GRIDEX_ENABLE_PORTAL_ONBOARDING') === 'false') {
    return { status: 'skipped' }
  }

  if (!input.application.customer_number && !input.application.external_customer_id) {
    return { status: 'pending', message: 'OPS returned no customer reference yet.' }
  }

  let supabase: SupabaseServiceClient | null = null

  try {
    supabase = await loadServiceClient()
    const authenticatedUserId = input.authenticatedUserId?.trim() || null
    if (authenticatedUserId) {
      await upsertLocalPortalRows(
        supabase,
        input,
        authenticatedUserId,
        'portal_existing_customer_linked',
      )
      return { status: 'profile_linked', userId: authenticatedUserId }
    }

    // Never attach an unauthenticated application to an existing account from
    // email alone. A previously linked profile is reusable only when its email
    // and at least one stable OPS/customer identifier match this application.
    const safelyLinkedProfile = await findSafelyLinkedProfile(supabase, input)
    if (safelyLinkedProfile?.user_id) {
      await upsertLocalPortalRows(
        supabase,
        input,
        safelyLinkedProfile.user_id,
        'portal_existing_customer_linked',
      )
      return { status: 'profile_linked', userId: safelyLinkedProfile.user_id }
    }

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(normalizeEmail(input.email), {
      redirectTo: authRedirectTo(),
      data: {
        full_name: fullName(input),
        customer_number: input.application.customer_number ?? null,
        external_customer_id: input.application.external_customer_id ?? null,
        portal_identity_id: input.application.portal_identity_id ?? null,
        contract_number: input.application.contract_number ?? null,
        application_number: input.application.application_number ?? null,
        source: 'gridex_website_application',
      },
    })

    if (error) {
      // An existing Supabase account may make inviteUserByEmail fail. Do not
      // fall back to email-only linking: the customer must authenticate first,
      // after which the normal server-side portal identity flow can link safely.
      await recordOnboardingFailure(supabase, input, 'invite_failed_or_existing_auth_requires_login')
      return {
        status: 'pending',
        message: 'Ett konto finns redan för e-postadressen. Logga in för att slutföra Mina sidor-kopplingen.',
      }
    }

    const userId = data.user?.id ?? null
    if (!userId) {
      await recordOnboardingFailure(supabase, input, 'invite_missing_user')
      return { status: 'pending' }
    }

    await upsertLocalPortalRows(
      supabase,
      input,
      userId,
      'portal_email_confirmation_sent',
    )
    return { status: 'email_confirmation_sent', userId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'portal_onboarding_failed'
    console.error('[customer portal] non-blocking onboarding failed', error)
    if (supabase) {
      await recordOnboardingFailure(supabase, input, message).catch(() => null)
    }
    return { status: 'failed', message }
  }
}
