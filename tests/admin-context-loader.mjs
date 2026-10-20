import {resolve as priorResolve,load} from './typescript-alias-loader.mjs'
export {load}
export async function resolve(specifier,context,nextResolve){
 const source=specifier==='@/lib/supabase/server'?`export const createSupabaseServerClient=async()=>globalThis.__adminBoundary.client;`:
 specifier==='@/lib/customerPortal/outbox'?`export const replayPortalWriteOutbox=async()=>{globalThis.__adminBoundary.privilegedWrites++};`:
 specifier==='@/lib/integrations/cisActions'?`export const runCisActionOperation=async()=>{globalThis.__adminBoundary.privilegedWrites++;return {ok:true}};`:
 specifier==='@/lib/supabase/service'?`export const supabaseService={};`:
 specifier==='next/navigation'?`export const redirect=path=>{throw new Error('REDIRECT:'+path)};`:null
 if(source)return {shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(source)}
 return priorResolve(specifier,context,nextResolve)
}
