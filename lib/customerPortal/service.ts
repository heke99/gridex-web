import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  CustomerInvoice,
  CustomerNotification,
  CustomerPortalContract,
  CustomerPortalOverview,
  CustomerProfile,
  CustomerAgreementEvent,
  CustomerSignupOrder,
  CustomerSupportMessage,
  CustomerSupportTicket,
  ExternalConnection,
} from './types'

type ContractAgreementFallbackRow = {
  id: string
  contract_slug: string | null
  status: string | null
  created_at: string
  email_signed_at: string | null
  bankid_signed_at: string | null
}

type CustomerProfileFallbackRow = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
}

async function getUserOrThrow(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  return user
}

export async function getPortalSession() {
  const supabase = await createSupabaseServerClient()
  const user = await getUserOrThrow(supabase)

  return { supabase, user }
}

export async function getCustomerProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerProfile | null> {
  const { data } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<CustomerProfile>()

  if (data) {
    return data
  }

  const { data: fallback } = await supabase
    .from('contract_agreements')
    .select('user_id,email,first_name,last_name,phone')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<CustomerProfileFallbackRow>()

  if (!fallback) {
    return null
  }

  const fullName =
    [fallback.first_name, fallback.last_name].filter(Boolean).join(' ') || null

  return {
    user_id: fallback.user_id,
    email: fallback.email,
    first_name: fallback.first_name,
    last_name: fallback.last_name,
    full_name: fullName,
    phone: fallback.phone,
    language_code: 'sv',
    timezone: 'Europe/Stockholm',
    email_verified_at: null,
    onboarding_state: 'pending_migration',
    billing_customer_ref: null,
    contract_customer_ref: null,
    metadata: {},
    customer_type: null,
    company_name: null,
  }
}

export async function getCustomerContracts(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerPortalContract[]> {
  const { data } = await supabase
    .from('customer_contract_portal_links')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if ((data?.length ?? 0) > 0) {
    return (data ?? []) as CustomerPortalContract[]
  }

  const { data: agreements } = await supabase
    .from('contract_agreements')
    .select(
      'id,contract_slug,status,created_at,email_signed_at,bankid_signed_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .returns<ContractAgreementFallbackRow[]>()

  return (agreements ?? []).map((row) => ({
    id: row.id,
    agreement_id: row.id,
    contract_slug: row.contract_slug,
    contract_name: null,
    status: row.status ?? 'unknown',
    signed_at: row.email_signed_at ?? row.bankid_signed_at ?? null,
    starts_at: null,
    ends_at: null,
    billing_provider_key: null,
    contract_provider_key: null,
    contract_external_ref: null,
    billing_contract_ref: null,
    pricing_snapshot: {},
    metadata: { source: 'contract_agreements_fallback' },
    created_at: row.created_at,
  }))
}

export async function getCustomerInvoices(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerInvoice[]> {
  const { data } = await supabase
    .from('customer_invoices')
    .select('*')
    .eq('user_id', userId)
    .order('issued_at', { ascending: false })

  return (data ?? []) as CustomerInvoice[]
}

export async function getCustomerTickets(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerSupportTicket[]> {
  const { data } = await supabase
    .from('customer_support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return (data ?? []) as CustomerSupportTicket[]
}

export async function getTicketMessages(
  supabase: SupabaseClient,
  ticketId: string
): Promise<CustomerSupportMessage[]> {
  const { data } = await supabase
    .from('customer_support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  return (data ?? []) as CustomerSupportMessage[]
}

export async function getCustomerNotifications(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerNotification[]> {
  const { data } = await supabase
    .from('customer_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  return (data ?? []) as CustomerNotification[]
}

export async function getCustomerSignupOrders(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerSignupOrder[]> {
  const { data } = await supabase
    .from('customer_signup_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return (data ?? []) as CustomerSignupOrder[]
}

export async function getCustomerAgreementEvents(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerAgreementEvent[]> {
  const { data } = await supabase
    .from('customer_agreement_events')
    .select('*')
    .eq('user_id', userId)
    .eq('customer_visible', true)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []) as CustomerAgreementEvent[]
}

export async function getExternalConnections(
  supabase: SupabaseClient
): Promise<ExternalConnection[]> {
  const { data } = await supabase
    .from('external_system_connections')
    .select(
      'id,provider_key,connection_name,domain,status,is_sandbox,last_success_at,health_payload'
    )
    .order('domain', { ascending: true })

  return (data ?? []) as ExternalConnection[]
}

export async function getCustomerPortalOverview(): Promise<CustomerPortalOverview> {
  const { supabase, user } = await getPortalSession()

  const [
    profile,
    contracts,
    invoices,
    tickets,
    notifications,
    signupOrders,
    agreementEvents,
    connections,
  ] =
    await Promise.all([
      getCustomerProfile(supabase, user.id),
      getCustomerContracts(supabase, user.id),
      getCustomerInvoices(supabase, user.id),
      getCustomerTickets(supabase, user.id),
      getCustomerNotifications(supabase, user.id),
      getCustomerSignupOrders(supabase, user.id),
      getCustomerAgreementEvents(supabase, user.id),
      getExternalConnections(supabase),
    ])

  return {
    profile,
    contracts,
    invoices,
    tickets,
    notifications,
    signupOrders,
    agreementEvents,
    connections,
  }
}