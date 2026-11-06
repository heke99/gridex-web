import { createClient } from '@supabase/supabase-js';
import { fetchOpsCustomerResource } from '@/lib/ops/client';
import { createContractsHandler } from './contractsHandler';
import { normalizeResource, type Resource } from './customerResources';

function authClient(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Auth configuration unavailable');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

export function customerResourceRoute(resource: Resource) {
  return createContractsHandler({
    enabled: () => process.env.GRIDEX_MOBILE_API_ENABLED === 'true',
    authenticate: async token => {
      const { data, error } = await authClient().auth.getUser(token);
      return !error && data.user?.email_confirmed_at ? data.user.id : null;
    },
    contracts: async (subject, token) => {
      const { data: profile, error } = await authClient(token).from('customer_profiles')
        .select('customer_number,external_customer_id').eq('user_id', subject).maybeSingle();
      if (error || !profile) throw new Error('Customer binding unavailable');
      const payload = await fetchOpsCustomerResource({ userId: subject,
        customerNumber: profile.customer_number, externalCustomerId: profile.external_customer_id }, resource);
      return normalizeResource(resource, payload);
    },
  }, resource);
}
