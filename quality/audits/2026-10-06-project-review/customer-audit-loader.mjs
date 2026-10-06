// Offline seams only; production credentials and services are never constructed.
import { resolve as priorResolve, load } from './pricing-audit-loader.mjs'
export { load }
export async function resolve(specifier, context, nextResolve) {
  const stub = source => ({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(source)})
  if (specifier === '@/lib/supabase/server') return stub('export async function createSupabaseServerClient(){return globalThis.__customerAudit.db}; export const createSupabaseServerActionClient=createSupabaseServerClient')
  if (specifier === '@/lib/supabase/service') return stub('export const supabaseService = new Proxy({}, {get(_target,key){const value=globalThis.__customerAudit.db[key];return typeof value === "function" ? value.bind(globalThis.__customerAudit.db):value}})')
  if (specifier === '@/lib/customerPortal/onboardingResume' && context.parentURL?.includes('/app/auth/confirm/')) return stub('export async function resumePortalOnboardingForConfirmedUserSafely(){return {processed:0,completed:0,blocked:0}}')
  if (specifier === '@/lib/ops/client' && context.parentURL?.includes('/lib/customerPortal/service.ts')) return stub('export async function fetchOpsCustomerResource(){return {data:globalThis.__customerAudit.resource}}; export async function fetchOpsCustomerPortalBundle(){return globalThis.__customerAudit.bundle}; export async function markOpsCustomerNotificationsRead(){throw new Error("not used")};')
  if (specifier === '@/lib/ops/client/customerSupport' && context.parentURL?.includes('/lib/customerPortal/service.ts')) return stub('export async function listOpsCustomerSupportCases(){return {data:{cases:[]}}}; export async function listOpsCustomerSupportMessages(){return {data:{messages:[]}}}')
  return priorResolve(specifier, context, nextResolve)
}
