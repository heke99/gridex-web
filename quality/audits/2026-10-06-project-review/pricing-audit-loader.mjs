// Isolated offline boundaries; no production clients are created.
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { resolve as priorResolve, load as priorLoad } from '../../../tests/typescript-alias-loader.mjs'

export async function resolve(specifier, context, nextResolve) {
  const stub = (source) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) })
  if (specifier === '@/lib/supabase/server') return stub('export async function createSupabaseServerClient(){return globalThis.__pricingAudit.db}; export const createSupabaseServerActionClient=createSupabaseServerClient')
  if (specifier === '@supabase/supabase-js') return stub('export function createClient(){return globalThis.__pricingAudit.db}')
  if (specifier === '@/lib/admin/guards') return stub('export async function requireAdminActionAccess(){return globalThis.__pricingAudit.admin}')
  if (specifier === '@/lib/auth/admin') return stub('export async function requireAdminRole(){return globalThis.__pricingAudit.admin}')
  if (specifier === '@/lib/contracts/finalizeAgreement') return stub('export async function finalizeAgreement(){throw new Error("No valid agreement should be finalized in this proof")}')
  if (specifier === '@/lib/ops/client' && context.parentURL?.includes('/lib/customerPortal/service.ts')) return stub('export async function fetchOpsCustomerResource(){return {data:globalThis.__pricingAudit.resource}}; export async function fetchOpsCustomerPortalBundle(){throw new Error("not used")}; export async function markOpsCustomerNotificationsRead(){throw new Error("not used")}')
  if (specifier === '@/lib/ops/client/customerSupport' && context.parentURL?.includes('/lib/customerPortal/service.ts')) return stub('export async function listOpsCustomerSupportCases(){throw new Error("not used")}; export async function listOpsCustomerSupportMessages(){throw new Error("not used")}')
  if (specifier === 'next/cache') return stub('export function revalidatePath(){}; export function revalidateTag(){}; export function unstable_cache(fn){return fn}')
  if (specifier === 'next/link') return nextResolve('next/link.js', context)
  if (specifier === 'next/navigation') return nextResolve('next/navigation.js', context)
  return priorResolve(specifier, context, nextResolve)
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.tsx')) {
    const source = await readFile(new URL(url), 'utf8')
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      fileName: new URL(url).pathname,
    }).outputText }
  }
  return priorLoad(url, context, nextLoad)
}
