import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { resolve as priorResolve, load as priorLoad } from './staff-api-loader.mjs'

// Only framework, SDK and rate-limit boundaries are replaced. The dashboard
// actions, customer portal service, transports, schemas and Staff signer run.
export async function resolve(specifier, context, nextResolve) {
  const boundaries = {
    'next/link': "export default 'a'",
    '@/components/support/AttachmentUpload': "export default 'div'",
    'next/navigation': 'export function redirect(path){const e=new Error("REDIRECT "+path);e.location=path;throw e}',
    'next/cache': 'export function revalidatePath(path){globalThis.__customerHandoff.revalidations.push(path)}',
    '@/lib/supabase/server': 'export async function createSupabaseServerActionClient(){return globalThis.__customerHandoff.sdk} export async function createSupabaseServerClient(){return globalThis.__customerHandoff.sdk} export const getVerifiedServerUser=client=>client.auth.getUser()',
    '@/lib/security/rateLimit': 'export async function checkRateLimit(key){globalThis.__customerHandoff.rates.push(key);return {allowed:globalThis.__customerHandoff.rateAllowed}}',
  }
  if (boundaries[specifier]) return { url: `data:text/javascript,${encodeURIComponent(boundaries[specifier])}`, shortCircuit: true }
  return priorResolve(specifier, context, nextResolve)
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('/app/dashboard/support/page.tsx')) {
    const source = await readFile(new URL(url), 'utf8')
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText }
  }
  return priorLoad(url, context, nextLoad)
}
