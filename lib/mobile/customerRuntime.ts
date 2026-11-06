import { createClient } from '@supabase/supabase-js';
import { fetchOpsCustomerResource } from '@/lib/ops/client';
import { createContractsHandler } from './contractsHandler';
import { normalizeResource, type Resource } from './customerResources';
import { invoiceDetail, invoiceDocument, supportCases, supportDetail } from './customerDetails';
import { listOpsCustomerSupportCases, fetchOpsCustomerSupportCase, listOpsCustomerSupportMessages } from '@/lib/ops/client/customerSupport';

function authClient(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Auth configuration unavailable');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

async function authenticate(token: string) {
  const { data, error } = await authClient().auth.getUser(token);
  return !error && data.user?.email_confirmed_at ? data.user.id : null;
}
async function identity(subject: string, token: string) {
  const { data: profile, error } = await authClient(token).from('customer_profiles')
    .select('customer_number,external_customer_id').eq('user_id', subject).maybeSingle();
  if (error || !profile) throw new Error('Customer binding unavailable');
  return { userId: subject, customerNumber: profile.customer_number, externalCustomerId: profile.external_customer_id };
}
export function customerResourceRoute(resource: Resource) {
  return createContractsHandler({
    enabled: () => process.env.GRIDEX_MOBILE_API_ENABLED === 'true', authenticate,
    contracts: async (subject, token) => normalizeResource(resource,
      await fetchOpsCustomerResource(await identity(subject, token), resource)),
  }, resource);
}
export function customerDetailRoute(kind: 'invoiceDetail' | 'invoiceDocument' | 'support' | 'supportDetail', reference?: string, documentReference?: string) {
  return createContractsHandler({
    enabled: () => process.env.GRIDEX_MOBILE_API_ENABLED === 'true', authenticate,
    contracts: async (subject, token) => {
      const customer = await identity(subject, token);
      if (kind === 'support') return supportCases(await listOpsCustomerSupportCases(customer, { limit: 50 }));
      if (!reference || !/^[A-Za-z0-9_-]{1,240}$/.test(reference)) throw new Error('Invalid reference');
      if (kind === 'supportDetail') {
        const [detail, messages] = await Promise.all([fetchOpsCustomerSupportCase(customer, reference), listOpsCustomerSupportMessages(customer, reference)]);
        return [supportDetail(detail, messages, reference)];
      }
      const payload = await fetchOpsCustomerResource(customer, 'invoices', reference);
      const origins = (process.env.GRIDEX_MOBILE_DOCUMENT_ORIGINS ?? '').split(',').map(v => v.trim()).filter(Boolean);
      if (kind === 'invoiceDocument') {
        if (!documentReference || !/^[A-Za-z0-9_-]{1,240}$/.test(documentReference)) throw new Error('Invalid document reference');
        return [invoiceDocument(payload, reference, documentReference, origins)];
      }
      return [invoiceDetail(payload, reference, origins)];
    },
  }, kind);
}
