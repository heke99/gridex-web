// Used only as external service ports inside the disposable browser application.
import { cookies } from 'next/headers'

async function context() {
  const jar = await cookies()
  const mode = jar.get('journey-mode')?.value ?? 'fixed'
  return { mode, user: mode === 'guest' ? null : {
    id: '11111111-1111-4111-8111-111111111111', email: 'customer@example.invalid',
    email_confirmed_at: '2026-10-20T10:00:00Z', user_metadata: {},
  } }
}

function query() {
  return {
    select() { return this }, eq() { return this }, in() { return this }, order() { return this }, limit() { return this },
    maybeSingle: async () => ({ data: null, error: null }),
    returns: async () => ({ data: [{ role: 'customer', is_active: true }], error: null }),
    then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: [], count: 0, error: null }).then(resolve) },
  }
}

export const createSupabaseServerClient = async () => ({
  auth: { getUser: async () => ({ data: { user: (await context()).user }, error: null }) }, from: query,
})
export const getVerifiedServerUser = async () => ({ data: { user: (await context()).user }, error: null })
export const supabaseService = { from: query }
export const loadUserPermissionsWithClient = async () => []
const invoiceRows = ['issued', 'sent', 'paid', 'overdue', 'cancelled', 'credited', 'unknown'].map(status => ({
  invoice_reference: 'invoice_synthetic_' + status, invoice_number: 'TEST-' + status, status, currency: 'SEK',
  paid_at: status === 'paid' ? '2026-11-30T23:30:00Z' : null,
}))
export const fetchOpsCustomerResource = async (identity: { userId: string }, resource: string, reference?: string, cursor?: string) => {
  const { user, mode } = await context()
  if (resource !== 'invoices' || identity.userId !== user?.id) throw Error('Unexpected isolated resource call')
  if (!reference) {
    if (mode !== 'invoice-page') return { data: invoiceRows }
    if (cursor && cursor !== 'opaque+/=') throw Error('Changed synthetic invoice cursor')
    return cursor
      ? { data: [invoiceRows[1]], page: { has_more: false, next_cursor: null } }
      : { data: [invoiceRows[0]], page: { has_more: true, next_cursor: 'opaque+/=' } }
  }
  const invoice = invoiceRows.find(row => row.invoice_reference === reference)
  if (!invoice) throw Error('Missing synthetic invoice')
  return { data: { invoice, lines: [
    { line_reference: 'line_synthetic', description: 'Elförbrukning', amount_inc_vat: 125 },
  ], documents: [
    { document_reference: 'document_synthetic_invoice', title: 'Faktura-PDF', secure_url: mode === 'invoice-revoked' ? null : 'https://documents.example.invalid/invoice.pdf' },
    { document_reference: 'document_synthetic_unavailable', title: 'Otillgänglig PDF', secure_url: null },
  ] } }
}
export const markOpsCustomerNotificationsRead = async () => { throw Error('No production mutations allowed') }
export const listOpsCustomerSupportMessages = async () => ({ data: [] })
export const listOpsCustomerSupportCases = async () => ({ data: [] })

export async function fetchOpsCustomerPortalBundle(identity: { userId: string }) {
  const { user, mode } = await context()
  if (!user || identity.userId !== user.id) throw Error('Synthetic identity boundary failed')
  if (mode === 'outage') throw Error('Synthetic OPS outage')
  return {
    profile: { display_name: 'Syntetisk kund', customer_number: mode === 'empty' ? null : 'KTEST001' },
    contracts: mode === 'empty' ? [] : [{
      contract_reference: 'contract_synthetic_customer', contract_name: 'Syntetiskt kundavtal',
      contract_number: 'TEST-001', contract_type: mode === 'variable' ? 'variable_monthly' : 'fixed',
      ...(mode === 'start-dates' ? { requested_start_date: '2026-12-05', confirmed_start_date: '2026-12-14', actual_start_date: '2026-12-15' } : {}),
      status: 'signed', start_date: mode === 'invalid-date' ? 'not-a-date' : '2026-11-01',
      monthly_fee_sek: 49, invoice_fee_sek: 0, fixed_price_ore_per_kwh: mode === 'variable' ? null : 86.25,
      markup_ore_per_kwh: 3.5, price_area: 'SE2', energy_direction: 'consumption',
    }],
    sites: [], invoices: mode === 'invoice-status' ? invoiceRows : [], documents: [], legalAcceptances: [], powersOfAttorney: [],
    customerStatus: null, dataQuality: null, switchStatus: null, meteringValues: [], events: [], notifications: [],
  }
}

export const readPortalQueueStatus = async () => 'empty'
