import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriceArea } from '@/lib/gridex/pricing/types'
import { calculateCustomerOffer } from '@/lib/gridex/offers'
import { normalizePostalCode } from '@/lib/gridex/postalAreas'
import { supabaseService } from '@/lib/supabase/service'

type SignupStatus =
  | 'customer_details_submitted'
  | 'account_created'
  | 'sent_to_cis'
  | 'waiting_for_cis'
  | 'signature_email_sent'
  | 'waiting_for_signature'
  | 'signed'
  | 'activation_pending'
  | 'active'
  | 'rejected_by_cis'
  | 'cancelled'
  | 'failed'

export type SignupOrderInput = {
  userId: string
  agreementId?: string | null
  email: string
  phone: string
  firstName: string
  lastName: string
  personalNumber: string
  address: string
  postalCode: string
  city: string
  apartment?: string | null
  facilityId: string
  moveInDate?: string | null
  contractSlug: string
  monthlyConsumptionKwh: number
  manualPriceArea?: PriceArea | null
  legalSnapshot?: Record<string, unknown>
  idempotencyKey: string
  signingProvider?: 'cis' | 'bankid' | 'email'
}

export type SignupOrderResult = {
  signupOrderId: string
  status: SignupStatus
  customerStatusLabel: string
  cisActionId: string | null
}

type SignupOrderRow = {
  id: string
  status: SignupStatus
  customer_status_label: string
}

function normalizePersonalNumber(input: string): string {
  return input.replace(/\D/g, '')
}

function luhnValid(value: string): boolean {
  let sum = 0
  const digits = value.split('').reverse().map(Number)

  for (let i = 0; i < digits.length; i += 1) {
    let n = digits[i]
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }

  return sum % 10 === 0
}

export function validateSwedishPersonalNumber(input: string): string {
  const digits = normalizePersonalNumber(input)
  const short = digits.length === 12 ? digits.slice(2) : digits

  if (!/^\d{10}$/.test(short) || !luhnValid(short)) {
    throw Object.assign(new Error('Ogiltigt personnummer.'), { status: 400 })
  }

  const month = Number(short.slice(2, 4))
  const day = Number(short.slice(4, 6))
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw Object.assign(new Error('Ogiltigt personnummer.'), { status: 400 })
  }

  return digits.length === 12 ? digits : short
}

export function maskPersonalNumber(input: string): string {
  const normalized = validateSwedishPersonalNumber(input)
  if (normalized.length === 12) {
    return `${normalized.slice(0, 8)}-****`
  }
  return `${normalized.slice(0, 6)}-****`
}

export function hashPersonalNumber(input: string): string {
  const pepper = process.env.PII_HASH_PEPPER ?? ''
  return createHash('sha256')
    .update(`${pepper}:${validateSwedishPersonalNumber(input)}`)
    .digest('hex')
}

function encryptPersonalNumber(input: string): {
  ciphertext: string | null
  keyRef: string | null
} {
  const rawKey = process.env.PII_ENCRYPTION_KEY
  if (!rawKey) return { ciphertext: null, keyRef: null }

  const key = createHash('sha256').update(rawKey).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(validateSwedishPersonalNumber(input), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return {
    ciphertext: Buffer.concat([iv, tag, encrypted]).toString('base64'),
    keyRef: 'PII_ENCRYPTION_KEY',
  }
}

function customerStatus(status: SignupStatus) {
  switch (status) {
    case 'signature_email_sent':
    case 'waiting_for_signature':
      return { label: 'Avtal väntar på signering', step: 2 }
    case 'signed':
      return { label: 'Avtal signerat', step: 3 }
    case 'activation_pending':
      return { label: 'Avtal aktiveras', step: 4 }
    case 'active':
      return { label: 'Avtal aktivt', step: 5 }
    case 'rejected_by_cis':
      return { label: 'Avtal kunde inte godkännas', step: 2 }
    default:
      return { label: 'Vi har tagit emot din beställning', step: 1 }
  }
}

async function logEvent(
  supabase: SupabaseClient,
  params: {
    userId: string
    agreementId?: string | null
    signupOrderId?: string | null
    eventType: string
    summary: string
    payload?: Record<string, unknown>
    customerVisible?: boolean
    customerLabel?: string | null
    source?: string
  }
) {
  await supabase.from('customer_agreement_events').insert({
    user_id: params.userId,
    agreement_id: params.agreementId ?? null,
    signup_order_id: params.signupOrderId ?? null,
    event_type: params.eventType,
    summary: params.summary,
    payload: params.payload ?? {},
    customer_visible: params.customerVisible ?? false,
    customer_label: params.customerLabel ?? null,
    source: params.source ?? 'gridex',
  })
}

async function upsertPortalData(
  supabase: SupabaseClient,
  input: SignupOrderInput,
  params: {
    personalNumberHash: string
    personalNumberMasked: string
    signupOrderId: string
    priceArea: PriceArea
    priceSnapshot: Record<string, unknown>
    customerStatusLabel: string
    customerStatusStep: number
  }
) {
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ')

  await supabase.from('customer_profiles').upsert(
    {
      user_id: input.userId,
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      full_name: fullName,
      phone: input.phone,
      personal_number_hash: params.personalNumberHash,
      personal_number_masked: params.personalNumberMasked,
      onboarding_state: 'pending_signature',
      metadata: {
        source: 'signup_order',
        signup_order_id: params.signupOrderId,
      },
    },
    { onConflict: 'user_id' }
  )

  await supabase.from('customer_delivery_points').upsert(
    {
      user_id: input.userId,
      facility_id: input.facilityId,
      address: input.address,
      postal_code: normalizePostalCode(input.postalCode),
      city: input.city,
      apartment: input.apartment || null,
      area_code: params.priceArea,
      move_in_date: input.moveInDate || null,
      is_primary: true,
      metadata: {
        source: 'signup_order',
        signup_order_id: params.signupOrderId,
      },
    },
    { onConflict: 'user_id,facility_id' }
  )

  const portalLink = {
    user_id: input.userId,
    agreement_id: input.agreementId ?? null,
    signup_order_id: params.signupOrderId,
    contract_slug: input.contractSlug,
    contract_name: String(params.priceSnapshot.contractName ?? ''),
    status: 'sent_to_cis',
    customer_status_label: params.customerStatusLabel,
    customer_status_step: params.customerStatusStep,
    pricing_snapshot: params.priceSnapshot,
    contract_provider_key: 'cis',
    billing_provider_key: 'cis',
    metadata: {
      source: 'signup_order',
      signing_provider: input.signingProvider ?? 'cis',
    },
  }

  if (input.agreementId) {
    await supabase
      .from('customer_contract_portal_links')
      .upsert(portalLink, { onConflict: 'agreement_id' })
  } else {
    await supabase.from('customer_contract_portal_links').insert(portalLink)
  }

}

async function queueCisAction(
  supabase: SupabaseClient,
  input: SignupOrderInput,
  params: {
    signupOrderId: string
    priceSnapshot: Record<string, unknown>
    personalNumber: string
  }
): Promise<string | null> {
  const requestPayload = {
    action: 'create_customer_contract_and_send_signature',
    customer: {
      userId: input.userId,
      email: input.email,
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      personalNumber: params.personalNumber,
    },
    deliveryPoint: {
      address: input.address,
      postalCode: normalizePostalCode(input.postalCode),
      city: input.city,
      apartment: input.apartment ?? null,
      facilityId: input.facilityId,
      moveInDate: input.moveInDate ?? null,
    },
    agreement: {
      agreementId: input.agreementId ?? null,
      signupOrderId: params.signupOrderId,
      contractSlug: input.contractSlug,
      signingProvider: input.signingProvider ?? 'cis',
      priceSnapshot: params.priceSnapshot,
    },
  }

  const { data, error } = await supabase
    .from('cis_sync_actions')
    .insert({
      signup_order_id: params.signupOrderId,
      agreement_id: input.agreementId ?? null,
      user_id: input.userId,
      action_type: 'create_customer_contract_and_send_signature',
      status: 'queued',
      provider_key: 'cis',
      idempotency_key: `cis:create:${input.idempotencyKey}`,
      request_payload: requestPayload,
    })
    .select('id')
    .single<{ id: string }>()

  if (error) {
    console.error('[queueCisAction] failed', error)
    return null
  }

  await supabase.from('integration_sync_jobs').insert({
    provider_key: 'cis',
    entity_type: 'signup_order',
    entity_id: params.signupOrderId,
    direction: 'outbound',
    status: 'queued',
    payload: requestPayload,
    response_payload: {},
    idempotency_key: `cis:create:${input.idempotencyKey}`,
  })

  return data.id
}

export async function createSignupOrder(
  input: SignupOrderInput
): Promise<SignupOrderResult> {
  const personalNumber = validateSwedishPersonalNumber(input.personalNumber)
  const personalNumberHash = hashPersonalNumber(personalNumber)
  const personalNumberMasked = maskPersonalNumber(personalNumber)
  const encrypted = encryptPersonalNumber(personalNumber)
  const offer = await calculateCustomerOffer({
    supabase: supabaseService,
    contractSlug: input.contractSlug,
    postalCode: input.postalCode,
    manualPriceArea: input.manualPriceArea ?? null,
    kwh: input.monthlyConsumptionKwh,
  })
  const initialStatus: SignupStatus = 'sent_to_cis'
  const status = customerStatus(initialStatus)
  const priceSnapshot = {
    ...offer.snapshot,
    contractName: offer.contract.name,
    agreementId: input.agreementId ?? null,
    acceptedAt: new Date().toISOString(),
  }

  await supabaseService.from('customer_sensitive_identities').upsert(
    {
      user_id: input.userId,
      personal_number_hash: personalNumberHash,
      personal_number_masked: personalNumberMasked,
      personal_number_ciphertext: encrypted.ciphertext,
      encryption_key_ref: encrypted.keyRef,
      source: 'signup',
      last_sent_to_cis_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  let order: SignupOrderRow | null = null
  const { data, error } = await supabaseService
    .from('customer_signup_orders')
    .insert({
      user_id: input.userId,
      agreement_id: input.agreementId ?? null,
      contract_slug: input.contractSlug,
      contract_name: offer.contract.name,
      contract_type: offer.contract.contractType,
      pricing_version_id: offer.pricingVersionId,
      status: initialStatus,
      customer_status_label: status.label,
      customer_status_step: status.step,
      email: input.email,
      phone: input.phone,
      first_name: input.firstName,
      last_name: input.lastName,
      personal_number_hash: personalNumberHash,
      personal_number_masked: personalNumberMasked,
      address: input.address,
      postal_code: normalizePostalCode(input.postalCode),
      city: input.city,
      apartment: input.apartment ?? null,
      facility_id: input.facilityId,
      move_in_date: input.moveInDate || null,
      price_area: offer.priceArea,
      monthly_consumption_kwh: offer.kwh,
      price_snapshot: priceSnapshot,
      legal_snapshot: input.legalSnapshot ?? {},
      cis_payload: {},
      signing_provider: input.signingProvider ?? 'cis',
      signing_status: 'waiting_for_cis',
      idempotency_key: input.idempotencyKey,
    })
    .select('id,status,customer_status_label')
    .single<SignupOrderRow>()

  if (error) {
    const duplicate = error.message.toLowerCase().includes('duplicate')
    if (!duplicate) throw Object.assign(new Error(error.message), { status: 500 })

    const existing = await supabaseService
      .from('customer_signup_orders')
      .select('id,status,customer_status_label')
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle<SignupOrderRow>()

    if (existing.error || !existing.data) {
      throw Object.assign(
        new Error(existing.error?.message ?? 'Befintlig beställning hittades inte.'),
        { status: 500 }
      )
    }

    order = existing.data
  } else {
    order = data
  }

  await upsertPortalData(supabaseService, input, {
    personalNumberHash,
    personalNumberMasked,
    signupOrderId: order.id,
    priceArea: offer.priceArea,
    priceSnapshot,
    customerStatusLabel: status.label,
    customerStatusStep: status.step,
  })

  if (input.agreementId) {
    await supabaseService
      .from('contract_agreements')
      .update({
        personal_number_hash: personalNumberHash,
        personal_number_masked: personalNumberMasked,
        monthly_consumption_kwh: offer.kwh,
        price_area: offer.priceArea,
        price_snapshot: priceSnapshot,
        customer_status_label: status.label,
        customer_status_step: status.step,
        status: initialStatus,
      })
      .eq('id', input.agreementId)
      .then(({ error }) => {
        if (error) console.error('[createSignupOrder] contract update failed', error)
      })
  }

  await logEvent(supabaseService, {
    userId: input.userId,
    agreementId: input.agreementId ?? null,
    signupOrderId: order.id,
    eventType: 'agreement_snapshot_created',
    summary: 'Pris-snapshot skapades för kundens valda avtal.',
    payload: { pricingVersionId: offer.pricingVersionId, priceArea: offer.priceArea },
  })

  const cisActionId = await queueCisAction(supabaseService, input, {
    signupOrderId: order.id,
    priceSnapshot,
    personalNumber,
  })

  await logEvent(supabaseService, {
    userId: input.userId,
    agreementId: input.agreementId ?? null,
    signupOrderId: order.id,
    eventType: 'agreement_sent_to_cis',
    summary: 'Beställningen har köats för CIS, kundskapande och signeringsmail.',
    payload: { cisActionId },
    customerVisible: true,
    customerLabel: status.label,
  })

  return {
    signupOrderId: order.id,
    status: order.status,
    customerStatusLabel: order.customer_status_label,
    cisActionId,
  }
}
