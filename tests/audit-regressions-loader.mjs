import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { resolve as priorResolve, load as priorLoad } from './typescript-alias-loader.mjs'
const stub = source => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) })
export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL?.includes('/app/api/checkout/switch-status/route.ts')) {
    if (specifier === '@/lib/ops/client') return stub('export const isOpsError = () => false; export const fetchOpsWebsiteSwitchStatus = (...args) => globalThis.__auditSwitchStatus(...args)')
    if (specifier === '@/lib/security/rateLimit') return stub('export const checkRateLimit = () => ({allowed:true}); export const clientIpFromHeaders = () => "127.0.0.1"')
  }
  if (decodeURI(context.parentURL ?? '').endsWith('/app/api/checkout/applications/[applicationId]/route.ts')) {
    if (specifier === '@/lib/ops/client') return stub('export const isOpsError = () => false; export const fetchOpsWebsiteApplicationStatus = (...args) => globalThis.__auditApplicationStatus(...args)')
    if (specifier === '@/lib/security/rateLimit') return stub('export const checkRateLimit = () => ({allowed:true}); export const clientIpFromHeaders = () => "127.0.0.1"')
  }
  if (specifier === '@supabase/supabase-js' && context.parentURL?.includes('/lib/website/applicationResultStore.ts')) return stub('export const createClient=()=>globalThis.__auditResultDb')
  if (specifier === '@supabase/supabase-js' && context.parentURL?.endsWith('/lib/website/submissionStore.ts')) return stub('export const createClient=()=>globalThis.__auditSubmissionDb')
  if (context.parentURL?.includes('/app/dashboard/profile/actions.ts')) {
    if (specifier === 'next/cache') return stub('export const revalidatePath = () => {}')
    if (specifier === 'next/navigation') return stub('export const redirect = path => { throw Object.assign(new Error(path), { path }) }')
    if (specifier === '@/lib/customerPortal/service') return stub('export const getOpsPortalIdentityForUser = (_client, user) => ({ userId: user.id })')
    if (specifier === '@/lib/customerPortal/apiErrors') return stub('export const opsErrorDetails = error => error.details ?? {}')
    if (specifier === '@/lib/ops/client') return stub('export const isOpsError = error => error.name === "OpsError"; export const submitOpsCustomerProfileUpdate = input => globalThis.__profileUpdate.submit(input)')
  }
  if (specifier === '@/lib/ops/client' && context.parentURL?.includes('/lib/ops/portalReadiness.ts')) return stub('export async function fetchOpsIntegrationContext(){return {capabilities:{customer_portal_ready:true,complete_integration_ready:false,missing_customer_portal_scopes:[],required_customer_portal_scopes:[]}}}; export function getOpsClientStatus(){return {configured:true}}; export function isOpsError(){return false}; export async function probeOpsEndpointAuthorization(path,init){globalThis.__auditProbes.push({path,init});return {ok:!path.includes("/support/"),status:path.includes("/support/")?403:422,code:null}}')
  if (specifier === '@/lib/supabase/server') return stub('export async function createSupabaseServerClient(){return globalThis.__auditRegression.db}; export const createSupabaseServerActionClient=createSupabaseServerClient; export const getVerifiedServerUser=client=>client.auth.getUser()')
  if (specifier === '@/lib/supabase/service') return stub('export const supabaseService=new Proxy({}, {get(_t,k){const value=globalThis.__auditRegression.db[k];return typeof value === "function"?value.bind(globalThis.__auditRegression.db):value}})')
  if (specifier === '@/lib/ops/client' && context.parentURL?.includes('/lib/customerPortal/service.ts')) return stub('export async function fetchOpsCustomerResource(...args){return globalThis.__auditRegression.fetchResource ? globalThis.__auditRegression.fetchResource(...args) : {data:globalThis.__auditRegression.resource}}; export async function fetchOpsCustomerPortalBundle(){return globalThis.__auditRegression.bundle}; export async function markOpsCustomerNotificationsRead(){}')
  if (specifier === '@/lib/ops/client/customerSupport' && context.parentURL?.includes('/lib/customerPortal/service.ts')) return stub('export async function listOpsCustomerSupportCases(){throw new Error("Modeled support outage")}; export async function listOpsCustomerSupportMessages(){throw new Error("not used")}')
  if (specifier === '@/lib/customerPortal/onboardingResume') return stub('export async function resumePortalOnboardingForConfirmedUserSafely(){globalThis.__auditRegression?.observeOnboardingResume?.();return {processed:0,completed:0,blocked:0}}')
  if (specifier === 'next/link') return nextResolve('next/link.js', context)
  return priorResolve(specifier, context, nextResolve)
}
export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},fileName:new URL(url).pathname}).outputText }
  return priorLoad(url,context,nextLoad)
}
