import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'

const state = globalThis.__gridexPortalReadinessTest = {
  contextFailure: false,
  context: {
    capabilities: {
      customer_portal_ready: true,
      complete_integration_ready: true,
      missing_customer_portal_scopes: [],
      required_customer_portal_scopes: [],
    },
  },
}
const mock = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const client = mock(`
  export const getOpsClientStatus = () => ({ configured: true });
  export const isOpsError = () => false;
  export const fetchOpsIntegrationContext = async () => {
    const state = globalThis.__gridexPortalReadinessTest;
    if (state.contextFailure) throw new Error('context unavailable');
    return state.context;
  };
  export const probeOpsEndpointAuthorization = async () => ({ ok: true, status: 422, code: 'invalid_request' });
`)
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = {
      '@/lib/ops/client': client,
      '@/lib/ops/client/portal': mock('export const verifiedPortalHeaders = async () => new Headers();'),
      '@/lib/ops/customerAssertion': mock('export const getOpsCustomerAssertionStatus = () => ({ valid: true });'),
    }
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/lib/ops/portalReadiness.ts')) return {
      format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8')), shortCircuit: true,
    }
    return nextLoad(url, context)
  },
})
const { checkOpsCustomerPortalReadiness } = await import('../lib/ops/portalReadiness.ts')

state.contextFailure = true
let result = await checkOpsCustomerPortalReadiness()
assert.equal(result.ready, false, 'successful invalid-body probes do not replace unavailable authoritative tenant context')
state.contextFailure = false
state.context.capabilities.missing_customer_portal_scopes = ['customer_notifications.write']
result = await checkOpsCustomerPortalReadiness()
assert.equal(result.ready, false, 'authoritative missing scope remains blocking even when a validation probe passes')
assert.equal(result.scopes.find(({ scope }) => scope === 'customer_notifications.write').status, 'missing')
state.context.capabilities.missing_customer_portal_scopes = []
state.context.capabilities.customer_portal_ready = false
assert.equal((await checkOpsCustomerPortalReadiness()).ready, false)
state.context.capabilities.customer_portal_ready = true
result = await checkOpsCustomerPortalReadiness()
assert.equal(result.ready, true)
assert.equal(result.authenticatedCustomerFlowVerified, false, 'synthetic authorization probes must never claim actual customer flow proof')
assert.match(result.message, /kundflöden.*återstår/i)
console.log('Portal readiness runtime regressions passed.')
