import { resolve as priorResolve, load } from './typescript-alias-loader.mjs'
export { load }
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/supabase/server') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
    export async function createSupabaseServerActionClient() { return globalThis.__privacyBoundary.authClient }
  `) }
  if (specifier === '@/lib/customerPortal/service') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
    export class CustomerPortalAccessError extends Error {}
    export async function getOpsPortalIdentityForUser(client,user) { return {userId:user.id,email:user.email} }
  `) }
  if (specifier === '@/lib/supabase/service') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
    export const supabaseService = new Proxy({}, {get(_,name){const client=globalThis.__privacyBoundary.service;const value=client[name];return typeof value==='function'?value.bind(client):value}})
  `) }
  if (specifier === '@/lib/ops/client/customerSupport') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
    export async function createOpsCustomerSupportCase(...args) { return globalThis.__privacy.createCase(...args) }
  `) }
  return priorResolve(specifier, context, nextResolve)
}
