import { resolve as priorResolve, load } from './typescript-alias-loader.mjs'
export { load }
const rateUrl = new URL('../lib/security/rateLimit.ts', import.meta.url).href
export async function resolve(specifier, context, nextResolve) {
  const source = specifier === '@/lib/supabase/service' ? `
    export const supabaseService={rpc: (...args)=>globalThis.__publicSupport.rpc(...args)};
  ` : specifier === '@/lib/security/rateLimit' ? `
    export {clientIpFromHeaders} from ${JSON.stringify(rateUrl)};
    export const checkRateLimit=(...args)=>globalThis.__publicSupport.rate(...args);
  ` : specifier === '@/lib/ops/client' ? `
    export const hashIp=ip=>'hashed:'+ip;
  ` : null
  if (source) return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) }
  return priorResolve(specifier, context, nextResolve)
}
