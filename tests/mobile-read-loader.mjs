import { stat } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = code => ({ url: `data:text/javascript,${encodeURIComponent(code)}`, shortCircuit: true });
export async function resolve(specifier, context, next) {
  if (specifier === '@supabase/supabase-js') return source('export const createClient = (...args) => globalThis.__mobileReadFixture.createClient(...args);');
  if (specifier === '@/lib/ops/client') return source('export const opsCustomerFetch=(...a)=>globalThis.__mobileReadFixture.scoped(...a); export const fetchOpsCustomerResource = (...args) => globalThis.__mobileReadFixture.resource(...args); export const submitOpsCustomerProfileUpdate=(...args)=>globalThis.__mobileReadFixture.profileUpdate(...args); export const markOpsCustomerNotificationsRead=(...args)=>globalThis.__mobileReadFixture.readNotification(...args);');
  if (specifier === '@/lib/ops/client/customerSupport') return source('export const createOpsCustomerSupportCase = (...a) => globalThis.__mobileReadFixture.createCase(...a); export const sendOpsCustomerSupportMessage = (...a) => globalThis.__mobileReadFixture.reply(...a); export const listOpsCustomerSupportCases = (...args) => globalThis.__mobileReadFixture.cases(...args); export const fetchOpsCustomerSupportCase = (...args) => globalThis.__mobileReadFixture.caseDetail(...args); export const listOpsCustomerSupportMessages = (...args) => globalThis.__mobileReadFixture.messages(...args);');
  if (specifier.startsWith('@/')) return { url: new URL(/\.[a-z]+$/i.test(specifier) ? specifier.slice(2) : `${specifier.slice(2)}.ts`, root).href, shortCircuit: true };
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:') && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(`${specifier}.ts`, context.parentURL); try { await stat(url); return { url: url.href, shortCircuit: true }; } catch { /* default resolver */ }
  }
  return next(specifier, context);
}
