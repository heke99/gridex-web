import 'server-only'
import { createHash } from 'node:crypto'
import type { User } from '@supabase/supabase-js'
import { supabaseService } from '@/lib/supabase/service'
import { fetchOpsCustomerResource, OpsError, submitOpsCustomerPortalSync, submitOpsCustomerSync } from '@/lib/ops/client'
import { signCustomerAssertion } from '@/lib/ops/customerAssertion'
import { stablePortalCustomerIdentityConflicts, writePortalProfileWithStableIdentity } from './stableIdentity'

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null
function refused(code: string, status = 409): never {
  throw new OpsError('Kundkopplingen kunde inte bekräftas. Kontrollera kundnumret eller kontakta kundservice.', status, { code, retryable: false })
}

/** Called only with the current user returned by server-side Auth.getUser().
 * No Auth account/session, checkout submission, consent or staff role is created.
 */
export async function linkExistingPortalCustomer(input: { user: User; customerNumber: unknown; operationId: string }) {
  const user = input.user as User & { deleted_at?: string | null; banned_until?: string | null }
  const email = text(user.email)?.toLowerCase()
  if (!user.id || !email || !user.email_confirmed_at || user.is_anonymous || user.deleted_at ||
    (user.banned_until && (!Number.isFinite(Date.parse(user.banned_until)) || Date.parse(user.banned_until) > Date.now()))) refused('customer_login_verification_required', 403)
  const number = text(input.customerNumber)
  if (!number || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(number)) refused('invalid_customer_number', 422)
  if (!input.operationId || input.operationId.length > 220) refused('invalid_client_operation_id', 422)
  // Validate complete signing configuration BEFORE an explicit link API can write.
  // The transport generates its own fresh assertion for each actual request.
  if (!signCustomerAssertion(user.id)) refused('customer_assertion_not_configured', 503)

  const current = await supabaseService.from('customer_profiles')
    .select('customer_number,contract_customer_ref,external_customer_id').eq('user_id', user.id).maybeSingle()
  if (current.error) throw new OpsError('Kundkopplingen kan inte kontrolleras just nu.', 503, { code: 'portal_profile_unavailable' })
  const before = record(current.data)
  const priorNumber = text(before.customer_number) ?? text(before.contract_customer_ref)
  if ((priorNumber && priorNumber !== number) || (!priorNumber && text(before.external_customer_id))) refused('portal_existing_customer_conflict')

  // Do not add a newly persisted external id on retry: the original request body
  // and operation key must stay byte-for-byte stable after local reconciliation.
  const identity = { userId: user.id, email, customerNumber: number, externalCustomerId: null }
  const operation = createHash('sha256').update(JSON.stringify(['existing-customer-link', user.id, number, input.operationId])).digest('hex')
  const sync = await submitOpsCustomerSync({ identity, idempotencyKey: operation, metadata: { source: 'verified_existing_customer_link' } })
  if (!sync.ok || sync.status !== 'synced' || sync.synced?.customer_number !== number) refused('customer_link_sync_unconfirmed')
  const external = text(sync.synced.external_customer_id)
  if (!external || stablePortalCustomerIdentityConflicts(before, { customer_number: number, external_customer_id: external })) refused('portal_existing_customer_conflict')

  const linkedIdentity = { ...identity, externalCustomerId: external }
  const linked = await submitOpsCustomerPortalSync({
    identity: linkedIdentity, idempotencyKey: operation, customerNumber: number, externalCustomerId: external, email,
    metadata: { source: 'verified_existing_customer_link' },
  })
  if (!linked.ok || linked.status !== 'linked' || linked.synced?.access_granted !== true || linked.synced.portal_role !== 'owner') refused('customer_link_access_unconfirmed')
  if (linked.synced.customer_number !== number || text(linked.synced.external_customer_id) !== external ||
    linked.synced.auth_user_id !== user.id ||
    linked.synced.customer_portal_user_id !== user.id) refused('customer_link_identity_conflict')
  const envelope = record(await fetchOpsCustomerResource(linkedIdentity, 'me'))
  const data = record(envelope.data), me = Object.keys(record(data.profile)).length ? record(data.profile) : data
  if (me.customer_number !== number || text(me.email)?.toLowerCase() !== email || text(me.external_customer_id) !== external) refused('customer_link_readback_conflict')

  // Re-read and CAS the stable profile identity after ALL remote awaits. A
  // concurrent profile or another customer must never be overwritten.
  await writePortalProfileWithStableIdentity(supabaseService, user.id,
    { customer_number: number, external_customer_id: external }, {
      user_id: user.id, email, email_verified_at: user.email_confirmed_at,
      customer_number: number, contract_customer_ref: number, external_customer_id: external, onboarding_state: 'verified',
    }, async () => {})
  return linked
}
