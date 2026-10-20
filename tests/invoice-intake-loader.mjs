import {resolve as priorResolve,load} from './typescript-alias-loader.mjs'
export {load}
export async function resolve(specifier,context,nextResolve){
 if(specifier==='@/lib/supabase/service')return {shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(`export const supabaseService=new Proxy({},{get(_,name){return (...args)=>globalThis.__invoiceRoute.client[name](...args)}})`)}
 return priorResolve(specifier,context,nextResolve)
}
