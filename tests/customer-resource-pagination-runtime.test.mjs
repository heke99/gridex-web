import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import React from 'react'
import ts from 'typescript'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
function existingModule(candidate) {
  return (extname(candidate) ? [candidate] : [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}.js`, resolve(candidate, 'index.ts')])
    .find((path) => existsSync(path) && statSync(path).isFile())
}
const state = globalThis.__gridexResourcePagination = {
  user: { id: '11111111-1111-4111-8111-111111111111', email: 'verified@example.test' },
  payloads: {}, failures: {}, calls: [], authCalls: 0,
}
class Query {
  constructor(table) { this.table = table }
  select() { return this }
  eq() { return this }
  or() { return this }
  order() { return this }
  limit() { return this }
  async maybeSingle() {
    if (this.table === 'user_profiles') return { data: { user_status: 'active' }, error: null }
    if (this.table === 'customer_profiles') return { data: { user_id: state.user.id, email: state.user.email,
      first_name: 'Kund', last_name: 'Test', customer_number: 'DX-TEST', external_customer_id: 'external-stable', metadata: {} }, error: null }
    throw new Error(`Unexpected table ${this.table}`)
  }
}
state.client = { from: (table) => new Query(table) }
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const errorsUrl = pathToFileURL(resolve(projectRoot, 'lib/ops/errors.ts')).href
const mocks = {
  'next/link': fixture("export default 'a';"),
  '@/lib/supabase/server': fixture(`
    export const createSupabaseServerClient=async()=>globalThis.__gridexResourcePagination.client;
    export const getSupabaseUser=async()=>{const s=globalThis.__gridexResourcePagination;s.authCalls++;return {data:{user:s.user},error:null};};
  `),
  '@/lib/supabase/service': fixture('export const supabaseService=globalThis.__gridexResourcePagination.client;'),
  '@/lib/ops/client/support': fixture(`
    export const fetchOpsCustomerSupportTickets=()=>{throw new Error('Unexpected support read');};
    export const fetchOpsCustomerSupportMessages=()=>{throw new Error('Unexpected support messages');};
  `),
  '@/lib/ops/client': fixture(`
    export { OpsError, isOpsError } from '${errorsUrl}';
    export const fetchOpsCustomerResource=async(identity,resource,id)=>{
      const s=globalThis.__gridexResourcePagination;s.calls.push({identity,resource,id});
      if(s.failures[resource]) throw s.failures[resource];
      return structuredClone(s.payloads[resource]);
    };
    export const fetchOpsCustomerPortalBundle=()=>{throw new Error('Granular read must not load whole bundle');};
    export const markOpsCustomerNotificationsRead=()=>{throw new Error('Unexpected write');};
  `),
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
    if (specifier.startsWith('@/')) {
      const path = existingModule(resolve(projectRoot, specifier.slice(2)))
      if (path) return { url: pathToFileURL(path).href, shortCircuit: true }
    }
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      const path = existingModule(resolve(dirname(fileURLToPath(context.parentURL)), specifier))
      if (path) return { url: pathToFileURL(path).href, shortCircuit: true }
    }
    if (specifier === 'next/server') return nextResolve('next/server.js', context)
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.tsx')) {
      const result = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      })
      return { format: 'module', source: result.outputText, shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})
const { canonicalResourcePage } = await import('../lib/customerPortal/resourceData.ts')
const { getCanonicalCustomerResource } = await import('../lib/customerPortal/service.ts')
const { customerResourceResponse } = await import('../lib/customerPortal/resourceRoute.ts')
const { GET: invoiceBff } = await import('../app/api/web/customer/invoices/route.ts')
const { OpsError } = await import('../lib/ops/errors.ts')
const { default: InvoicePage } = await import('../app/dashboard/invoices/page.tsx')
const { default: DocumentPage } = await import('../app/dashboard/documents/page.tsx')
const { default: ContractPage } = await import('../app/dashboard/contracts/page.tsx')
const { default: ApprovalPage } = await import('../app/dashboard/approvals/page.tsx')
const { default: HistoryNotice } = await import('../components/customer/CustomerHistoryNotice.tsx')
function text(value) {
  if (Array.isArray(value)) return value.map(text).join('')
  if (React.isValidElement(value)) return typeof value.type === 'function' ? text(value.type(value.props)) : text(value.props.children)
  return value == null || typeof value === 'boolean' ? '' : String(value)
}
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes)
  if (!React.isValidElement(value)) return []
  if (typeof value.type === 'function') return nodes(value.type(value.props))
  return [value, ...nodes(value.props.children)]
}
const page = { limit: 50, offset: 0, returned: 1, has_more: true, next_cursor: 'opaque_encrypted_cursor' }
const envelope = (data, metadata = page) => ({ data, ...(metadata === undefined ? {} : { page: metadata }),
  request_id: 'pagination_request', correlation_id: 'pagination_correlation', contract_schema_version: '2026-10-02.4' })
state.payloads.invoices = envelope([{ invoice_reference: 'invoice_canonical', invoice_number: 'INV-1', amount_inc_vat: 100 }])
state.payloads.documents = envelope([{ document_reference: 'document_canonical', title: 'Villkor', version: '2026.4' }])
state.payloads.contracts = envelope([{ contract_reference: 'contract_canonical', contract_number: 'CTR-1', contract_name: 'Elavtal', created_at: '2026-10-02T12:00:00Z' }])
state.payloads.sites = envelope({ sites: [{ facility_reference: 'facility_canonical', facility_id: '7359991234567890', address: { street: 'Gatan1' } }],
  metering_points: [{ facility_reference: 'facility_canonical', metering_point_id: '735999000000000001' }] }, { sites: page })
state.payloads.events = envelope(Array.from({ length: 12 }, (_, n) => ({ event_reference: `event_${n}`, event_type: 'supplier_switch.updated', occurred_at: '2026-10-02T12:00:00Z' })), { ...page, returned: 12 })
state.payloads['legal-acceptances'] = envelope([{ acceptance_reference: 'acceptance_canonical', acceptance_type: 'terms', document_version: '2026.4' }])
state.payloads['powers-of-attorney'] = envelope([{ power_of_attorney_reference: 'poa_canonical', scope: 'supplier_switch', status: 'active' }])

assert.deepEqual(canonicalResourcePage(state.payloads.invoices, 'invoices', 1), page)
assert.deepEqual(canonicalResourcePage(state.payloads.sites, 'sites', 1), page, 'actual grouped page.sites shape is projected')
assert.equal(canonicalResourcePage({ data: [] }, 'invoices', 0), null, 'absence is unknown metadata, not fabricated complete pagination')
assert.deepEqual(canonicalResourcePage(envelope([], { ...page, returned: 0, has_more: false, next_cursor: null }), 'invoices', 0), { ...page, returned: 0, has_more: false, next_cursor: null })
assert.deepEqual(canonicalResourcePage(envelope([{}], { ...page, next_cursor: null, internal_customer_id: 'must-not-leak' }), 'invoices', 1), { ...page, next_cursor: null }, 'future extra metadata is not forwarded to the browser')
for (const invalid of [null, {}, { ...page, limit: '50' }, { ...page, limit: 101 }, { ...page, offset: -1 },
  { ...page, returned: 2 }, { ...page, returned: 51 }, { ...page, has_more: 'true' },
  { ...page, next_cursor: 'https://internal.test/secret' }, { ...page, next_cursor: undefined }]) {
  assert.throws(() => canonicalResourcePage(envelope([{}], invalid), 'invoices', 1),
    (error) => error.code === 'ops_customer_pagination_invalid' && error.status === 502 && error.details.retryable === false)
}
const invoiceResource = await getCanonicalCustomerResource('invoices')
assert.deepEqual(invoiceResource.page, page, 'actual service preserves top-level pagination through canonical DTO mapping')
assert.equal(invoiceResource.data[0].invoice_reference, 'invoice_canonical')
assert.equal((await getCanonicalCustomerResource('sites')).data[0].metering_point_id, '735999000000000001', 'page projection preserves the actual separate metering resource')
const bff = await invoiceBff(new Request('https://gridex.se/api/web/customer/invoices?limit=100&cursor=attacker'))
assert.equal(bff.status, 200)
assert.equal(bff.headers.get('cache-control'), 'private, no-store')
assert.deepEqual((await bff.json()).page, page)
assert.ok(state.calls.every((call) => call.identity.userId === state.user.id && call.id === undefined), 'identity stays verified and incoming pagination is never forwarded as a fabricated detail ID')
assert.ok(state.calls.every((call) => Object.keys(call).join(',') === 'identity,resource,id'), 'no undocumented query parameters are added to OPS calls')
state.payloads.invoices.page = { ...page, returned: 2 }
const invalidResponse = await customerResourceResponse('invoices')
assert.equal(invalidResponse.status, 502)
const invalidError = (await invalidResponse.json()).error
assert.equal(invalidError.code, 'ops_customer_pagination_invalid')
assert.equal(invalidError.request_id, 'pagination_request')
assert.equal(invalidError.correlation_id, 'pagination_correlation')
assert.equal(invalidError.retryable, false)
assert.equal((await customerResourceResponse('documents')).status, 200, 'invalid invoice metadata does not poison independent document reads')
state.payloads.invoices.page = page
state.failures.invoices = new OpsError('Unavailable', 503, { code: 'upstream_unavailable', retryable: true })
assert.equal((await customerResourceResponse('invoices')).status, 503, 'an actual resource failure is retained instead of becoming empty history')
delete state.failures.invoices

for (const [component, labels] of [[InvoicePage, ['1 senaste fakturorna']], [DocumentPage, ['1 senaste dokumenten']],
  [ContractPage, ['1 senaste avtalen', '1 senaste anläggningarna', '8 senaste händelserna']],
  [ApprovalPage, ['1 senaste godkännandena', '1 senaste fullmakterna']]]) {
  const tree = await component()
  const renderedText = text(tree)
  for (const label of labels) assert.ok(renderedText.includes(label), 'actual page displays explicit truncated history')
  assert.ok(renderedText.includes('Fler uppgifter finns tillgängliga.'))
  assert.ok(!nodes(tree).some((node) => (node.type === 'a' && /cursor=|limit=/.test(node.props.href ?? '')) || node.type === 'button'), 'notices cannot offer unsupported pagination actions')
}
assert.equal(HistoryNotice({ page: null, label: 'fakturorna' }), null)
assert.equal(HistoryNotice({ page: { ...page, has_more: false }, label: 'fakturorna' }), null)
state.payloads.invoices.page = { ...page, has_more: false, next_cursor: null }
assert.ok(!text(await InvoicePage()).includes('Fler uppgifter finns tillgängliga.'), 'complete first page does not invent more business history')
delete state.payloads.documents.page
assert.equal((await getCanonicalCustomerResource('documents')).page, null)
assert.ok(!text(await DocumentPage()).includes('Fler uppgifter finns tillgängliga.'), 'legacy absence of page remains compatible')
console.log('Actual granular service/BFF/page truncation, metadata validation and independent resource error regressions passed')
