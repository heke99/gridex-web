import { createClient } from '@supabase/supabase-js';
import { fetchOpsCustomerResource } from '@/lib/ops/client';
import { createContractsHandler, type MobileContract } from '@/lib/mobile/contractsHandler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authClient(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Auth configuration unavailable');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

export const GET = createContractsHandler({
  enabled: () => process.env.GRIDEX_MOBILE_API_ENABLED === 'true',
  authenticate: async token => {
    const { data, error } = await authClient().auth.getUser(token);
    return !error && data.user?.email_confirmed_at ? data.user.id : null;
  },
  contracts: async (subject, token) => {
    // Existing tenant database; explicit subject + normal user RLS, no service role.
    const { data: profile, error } = await authClient(token).from('customer_profiles')
      .select('customer_number,external_customer_id').eq('user_id', subject).maybeSingle();
    if (error || !profile) throw new Error('Customer binding unavailable');
    // OPS verifies the active portal binding for this authenticated user.
    const payload = await fetchOpsCustomerResource({ userId: subject,
      customerNumber: profile.customer_number, externalCustomerId: profile.external_customer_id }, 'contracts');
    const root = payload as Record<string, unknown>;
    const data = root?.data;
    const rows = Array.isArray(data) ? data : (data as Record<string, unknown>)?.contracts;
    if (!Array.isArray(rows)) throw new Error('Invalid contracts envelope');
    const text = (r: Record<string, unknown>, k: string) => typeof r[k] === 'string' ? r[k] as string : null;
    return rows.map((row): MobileContract => {
      if (!row || typeof row !== 'object' || typeof row.contract_reference !== 'string') throw new Error('Invalid contract');
      return { reference: row.contract_reference, name: text(row, 'contract_name'),
        status: text(row, 'status'), startDate: text(row, 'start_date') };
    });
  },
});
