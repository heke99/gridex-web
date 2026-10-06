import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { resolve as priorResolve, load as priorLoad } from './typescript-alias-loader.mjs'
const stub = source => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) })
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@supabase/supabase-js' && context.parentURL?.includes('/lib/website/applicationResultStore.ts')) return stub('export const createClient=()=>globalThis.__auditResultDb')
  if (specifier === '@/lib/ops/client' && context.parentURL?.includes('/lib/ops/portalReadiness.ts')) return stub('export async function fetchOpsIntegrationContext(){return {capabilities:{customer_portal_ready:true,complete_integration_ready:false,missing_customer_portal_scopes:[],required_customer_portal_scopes:[]}}}; export function getOpsClientStatus(){return {configured:true}}; export function isOpsError(){return false}; export async function probeOpsEndpointAuthorization(path,init){globalThis.__auditProbes.push({path,init});return {ok:!path.includes("/support/"),status:path.includes("/support/")?403:422,code:null}}')
  if (specifier === '@/lib/supabase/server') return stub('export async function createSupabaseServerClient(){return globalThis.__auditRegression.db}; export const createSupabaseServerActionClient=createSupabaseServerClient')
  if (specifier === '@/lib/supabase/service') return stub('export const supabaseService=new Proxy({}, {get(_t,k){const value=globalThis.__auditRegression.db[k];return typeof value === "function"?value.bind(globalThis.__auditRegression.db):value}})')
  if (specifier === '@/lib/ops/client' && context.parentURL?.includes('/lib/customerPortal/service.ts')) return stub('export async function fetchOpsCustomerResource(){return {data:globalThis.__auditRegression.resource}}; export async function fetchOpsCustomerPortalBundle(){return globalThis.__auditRegression.bundle}; export async function markOpsCustomerNotificationsRead(){}')
  if (specifier === '@/lib/ops/client/customerSupport' && context.parentURL?.includes('/lib/customerPortal/service.ts')) return stub('export async function listOpsCustomerSupportCases(){throw new Error("Modeled support outage")}; export async function listOpsCustomerSupportMessages(){throw new Error("not used")}')
  if (specifier === '@/lib/customerPortal/onboardingResume') return stub('export async function resumePortalOnboardingForConfirmedUserSafely(){return {processed:0,completed:0,blocked:0}}')
  if (specifier === 'next/link') return nextResolve('next/link.js', context)
  return priorResolve(specifier, context, nextResolve)
}
export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},fileName:new URL(url).pathname}).outputText }
  return priorLoad(url,context,nextLoad)
}
