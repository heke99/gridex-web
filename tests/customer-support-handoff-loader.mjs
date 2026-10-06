import { resolve as priorResolve, load } from './staff-api-loader.mjs'

// Only framework, SDK and rate-limit boundaries are replaced. The dashboard
// actions, customer portal service, transports, schemas and Staff signer run.
export { load }
export async function resolve(specifier, context, nextResolve) {
  const boundaries = {
    'next/navigation': 'export function redirect(path){const e=new Error("REDIRECT "+path);e.location=path;throw e}',
    'next/cache': 'export function revalidatePath(path){globalThis.__customerHandoff.revalidations.push(path)}',
    '@/lib/supabase/server': 'export async function createSupabaseServerActionClient(){return globalThis.__customerHandoff.sdk} export async function createSupabaseServerClient(){return globalThis.__customerHandoff.sdk} export const getVerifiedServerUser=client=>client.auth.getUser()',
    '@/lib/security/rateLimit': 'export async function checkRateLimit(key){globalThis.__customerHandoff.rates.push(key);return {allowed:globalThis.__customerHandoff.rateAllowed}}',
  }
  if (boundaries[specifier]) return { url: `data:text/javascript,${encodeURIComponent(boundaries[specifier])}`, shortCircuit: true }
  return priorResolve(specifier, context, nextResolve)
}
