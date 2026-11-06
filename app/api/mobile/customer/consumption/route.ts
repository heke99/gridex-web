import { createConsumptionHandler } from '@/packages/customer-backend/consumption.mjs';
import { loadOpsConsumption } from '@/lib/mobile/opsConsumption';
import { opsCustomerFetch, type OpsPortalIdentity } from '@/lib/ops/client';
import { authenticateMobile, mobileIdentity } from '@/lib/mobile/customerRuntime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** OPS currently exposes customer-scoped readings but no authoritative facility delivery
 * windows. Fail closed BEFORE fetching readings; never infer supply rights from move-in,
 * meter installation or an unrelated customer contract. */
export const GET = createConsumptionHandler({
  enabled: () => process.env.GRIDEX_MOBILE_API_ENABLED === 'true',
  authenticate: async token => {
    const subject = await authenticateMobile(token);
    return subject ? mobileIdentity(subject, token) : null;
  },
  load: (binding, selection) => loadOpsConsumption(binding as OpsPortalIdentity, selection,
    (path, identity, signal) => opsCustomerFetch(path, identity, { signal })),
});
