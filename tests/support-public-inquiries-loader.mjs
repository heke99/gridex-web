import { resolve as previousResolve, load } from "./support-auth-loader.mjs";
export { load };
export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL?.endsWith("/apps/support/lib/public-inquiries.ts")) {
    const boundaries = {
      "./session":
        'export async function requireSupportSession(){if(!globalThis.__publicInquirySession)throw new Error("Missing session boundary");return globalThis.__publicInquirySession()}',
      "@supabase/supabase-js":
        'export function createClient(url,key,options){if(!globalThis.__publicInquiryClient)throw new Error("Missing service boundary");return globalThis.__publicInquiryClient(url,key,options)}',
    };
    if (boundaries[specifier])
      return {
        url: `data:text/javascript,${encodeURIComponent(boundaries[specifier])}`,
        shortCircuit: true,
      };
  }
  return previousResolve(specifier, context, nextResolve);
}
