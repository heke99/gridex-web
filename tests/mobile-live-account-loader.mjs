import {resolve as baselineResolve} from './mobile-account-loader.mjs';
export {load} from './mobile-account-loader.mjs';
export async function resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/useCustomerAccount.ts') && specifier === './accountClient') {
    return {url:`data:text/javascript,${encodeURIComponent("export const customerApi = 'https://gridex.se'; export function createAccountClient() { return globalThis.__mobileFixture.client; }")}`,shortCircuit:true};
  }
  return baselineResolve(specifier,context,next);
}
