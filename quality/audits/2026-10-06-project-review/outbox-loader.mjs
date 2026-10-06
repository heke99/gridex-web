import { resolve as priorResolve, load } from '../../../tests/typescript-alias-loader.mjs'
export { load }
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@supabase/supabase-js') return { shortCircuit: true,
    url: 'data:text/javascript,' + encodeURIComponent('export function createClient(){return globalThis.__auditOutbox.client}') }
  if (specifier === '@/lib/ops/client') {
    const errors = new URL('../../../lib/ops/errors.ts', import.meta.url).href
    const source = `export { isOpsError } from ${JSON.stringify(errors)};
      export async function sendOpsCustomerEvent(){await globalThis.__auditOutbox.dispatch()}
      export const markOpsCustomerNotificationsRead=sendOpsCustomerEvent;
      export const submitOpsCustomerMoveOut=sendOpsCustomerEvent;
      export const submitOpsCustomerPortalSync=sendOpsCustomerEvent;
      export const submitOpsCustomerProfileUpdate=sendOpsCustomerEvent;
      export const submitOpsCustomerSync=sendOpsCustomerEvent;`
    return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) }
  }
  return priorResolve(specifier, context, nextResolve)
}
