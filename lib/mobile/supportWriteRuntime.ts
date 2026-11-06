import { authenticateMobile, mobileIdentity } from './customerRuntime';
import { supportWriteHandler } from './supportWrites';
import { createOpsCustomerSupportCase, sendOpsCustomerSupportMessage } from '@/lib/ops/client/customerSupport';
export function supportMutation(reference?: string) {
  return supportWriteHandler({ enabled: () => process.env.GRIDEX_MOBILE_API_ENABLED === 'true', authenticate: authenticateMobile,
    submit: async (subject, token, input, key) => {
      const identity = await mobileIdentity(subject, token);
      if (reference) await sendOpsCustomerSupportMessage(identity, reference, { message: input.message }, key);
      else await createOpsCustomerSupportCase(identity, { title: input.title!, message: input.message }, key);
      return { accepted: true };
    },
  }, !reference);
}
