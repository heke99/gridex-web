import { resolve as priorResolve, load } from './audit-outbox-loader.mjs'
export { load }
export async function resolve(specifier, context, nextResolve) {
  if (specifier === './privacyDispatch' && context.parentURL?.endsWith('/outbox.ts')) {
    return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent('export async function dispatchPrivacyRequest(row){return globalThis.__auditOutbox.dispatch(row)}') }
  }
  return priorResolve(specifier, context, nextResolve)
}
