import { resolve as resolveAlias, load as loadAlias } from './typescript-alias-loader.mjs'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const reactUrl = pathToFileURL(createRequire(import.meta.url).resolve('react')).href

export async function resolve(specifier, context, nextResolve) {
  const ports = {
    '@/lib/supabase/server': `export const createSupabaseServerClient=async()=>globalThis.__customerJourney.client; export const getVerifiedServerUser=async client=>client.auth.getUser(); export const createSupabaseServerActionClient=createSupabaseServerClient;`,
    '@/lib/supabase/service': `export const supabaseService={from:(...args)=>globalThis.__customerJourney.queue(...args)};`,
    '@/lib/ops/client': `export const fetchOpsCustomerPortalBundle=async (identity,view)=>globalThis.__customerJourney.bundle(identity,view); export const fetchOpsCustomerResource=async(identity,resource,id,query)=>globalThis.__customerJourney.resource(identity,resource,id,query); export const markOpsCustomerNotificationsRead=async(...args)=>globalThis.__customerJourney.readNotifications(...args); export const submitOpsCustomerProfileUpdate=async()=>{throw Error('Unexpected profile update')}; export const isOpsError=()=>false;`,
    '@/lib/ops/client/customerSupport': `export const listOpsCustomerSupportCases=async identity=>globalThis.__customerJourney.support(identity); export const listOpsCustomerSupportMessages=async()=>{throw Error('Unexpected messages request')};`,
    '@/components/customer/PoaArchiveDocuments': `export const loadPoaArchiveDocuments = async cursor => { globalThis.__customerJourney.archiveCursor = cursor; }; export default function Archive(){return globalThis.__customerJourney.archiveText ?? null;}`,
    '@/components/account/LogoutForm': `export default function Logout(){return null;}`,
    'next/cache': 'export function revalidatePath(){}',
    'next/navigation': `export const redirect=path=>{throw Error('REDIRECT:'+path)}; export const useRouter=()=>({refresh(){}}); export const usePathname=()=>'/dashboard';`,
    'next/link': `import {createElement} from ${JSON.stringify(reactUrl)}; export default function Link({children,href,...props}){delete props.prefetch;return createElement('a',{...props,href},children);}`,
  }
  if (Object.hasOwn(ports, specifier)) return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(ports[specifier]) }
  return resolveAlias(specifier, context, nextResolve)
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.tsx')) {
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText }
  }
  return loadAlias(url, context, nextLoad)
}
