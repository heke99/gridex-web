import assert from 'node:assert/strict'
import fs from 'node:fs'
import { registerHooks } from 'node:module'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const actorId = '11111111-1111-4111-8111-111111111111'
const state = globalThis.__gridexAgreementAuthorization = {
  context: { userId: actorId, permissions: [], supabase: null },
  globalPermissions: [], reads: 0, writes: [], pdfs: [], downloads: [], permissionCalls: [], recordCalls: [], recordError: null,
  pdfLookupError: null, pdfLookupMissing: false, revalidated: [],
}
const agreement = { id: '22222222-2222-4222-8222-222222222222', user_id: 'customer-1', status: 'email_signed' }
const service = {
  async rpc(name, args) {
    if (name === 'gridex_get_user_permissions') {
      state.permissionCalls.push(args)
      return { data: state.globalPermissions, error: null }
    }
    assert.equal(name, 'gridex_web_record_agreement_pdf')
    state.recordCalls.push(args)
    return { data: null, error: state.recordError }
  },
  from(table) {
    let mutation = false
    const result = () => {
      if (!mutation) state.reads++
      return { data: table === 'contract_agreements' ? agreement : [], error: null }
    }
    return {
      select() { return this }, eq() { return this }, order() { return this }, limit() { return this },
      update(payload) { mutation = true; state.writes.push({ table, payload }); return this },
      insert(payload) { mutation = true; state.writes.push({ table, payload }); return this },
      single: async () => result(),
      maybeSingle: async () => {
        state.reads++
        return { data: state.pdfLookupMissing ? null : agreement, error: state.pdfLookupError }
      },
      then(resolvePromise, rejectPromise) { return Promise.resolve(result()).then(resolvePromise, rejectPromise) },
    }
  },
  storage: { from: (bucket) => ({ download: async (path) => {
    state.downloads.push({ bucket, path })
    return { data: new Blob(['%PDF-test']), error: null }
  } }) },
}
state.context.supabase = service
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const mocks = {
  '@/lib/supabase/service': fixture('export const supabaseService = globalThis.__gridexAgreementAuthorization.context.supabase;'),
  '@/lib/admin/getAdminContext': fixture('export const getAdminContext = async () => globalThis.__gridexAgreementAuthorization.context;'),
  '@/lib/auth/audit': fixture('export const logPermissionAudit = async () => {};'),
  'next/navigation': fixture('export const redirect = (url) => { throw new Error(`redirect:${url}`); }; export const notFound = () => { throw new Error("not found"); };'),
  'next/cache': fixture('export const revalidatePath = (path) => { globalThis.__gridexAgreementAuthorization.revalidated.push(path); };'),
  'next/link': fixture('export default function Link() {}'),
  'next/server': fixture('export class NextRequest extends Request {} export class NextResponse extends Response { static json(data, init) { return new NextResponse(JSON.stringify(data), { ...init, headers: { "content-type": "application/json" } }); } }'),
  '@/lib/contracts/pdf': fixture('export const generateContractPDF = async (agreement) => { globalThis.__gridexAgreementAuthorization.pdfs.push(agreement.id); return `${agreement.id}.pdf`; };'),
}
function existingModule(candidate) {
  return (extname(candidate) ? [candidate] : [`${candidate}.ts`, `${candidate}.tsx`, `${candidate}.js`])
    .find((path) => fs.existsSync(path))
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './getAdminContext' && context.parentURL?.endsWith('/lib/admin/guards.ts')) {
      return { url: mocks['@/lib/admin/getAdminContext'], shortCircuit: true }
    }
    if (specifier === './pdf' && context.parentURL?.endsWith('/lib/contracts/finalizeAgreement.ts')) {
      return { url: mocks['@/lib/contracts/pdf'], shortCircuit: true }
    }
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
    const candidate = specifier.startsWith('@/') ? resolve(root, specifier.slice(2))
      : specifier.startsWith('.') && context.parentURL?.startsWith('file:')
        ? resolve(dirname(fileURLToPath(context.parentURL)), specifier) : null
    const path = candidate && existingModule(candidate)
    if (path) return { url: pathToFileURL(path).href, shortCircuit: true }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && /\.tsx?$/.test(url)) {
      return { format: 'module', shortCircuit: true, source: ts.transpileModule(fs.readFileSync(new URL(url), 'utf8'), {
        fileName: fileURLToPath(url),
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      }).outputText }
    }
    return nextLoad(url, context)
  },
})

const { finalizeAgreementAction } = await import('../app/admin/agreements/actions.ts')
const { finalizeAgreement } = await import('../lib/contracts/finalizeAgreement.ts')
const { default: agreements } = await import('../app/admin/agreements/page.tsx')
const { default: agreementDetail } = await import('../app/admin/agreements/[id]/page.tsx')
const { default: customers } = await import('../app/admin/customers/page.tsx')
const { default: customerDetail } = await import('../app/admin/customers/[id]/page.tsx')
const { GET: downloadAgreementPDF } = await import('../app/api/agreements/[id]/pdf/route.ts')
const { GET: exportAgreements } = await import('../app/api/admin/agreements/export/route.ts')
const params = Promise.resolve({ id: agreement.id })
const pdfRequest = new Request(`https://gridex.test/api/agreements/${agreement.id}/pdf`)
const setPermissions = (local, global) => {
  state.context.permissions = local
  state.globalPermissions = global
}

// Exercise the actual pages/route/action and actual global guard. A company
// permission is returned by getAdminContext but excluded by the global RPC.
setPermissions(['agreements.read', 'agreements.write', 'agreements.export'], [])
for (const run of [() => agreements({}), () => agreementDetail({ params }), () => customers({}), () => customerDetail({ params })]) {
  await assert.rejects(run, /redirect:\/admin/, 'company-only grants cannot enter a global customer directory')
}
await assert.rejects(() => finalizeAgreementAction(agreement.id), (error) => error.status === 403)
assert.equal((await downloadAgreementPDF(pdfRequest, { params })).status, 403)
assert.equal((await exportAgreements()).status, 403, 'company-only export grant never reads the global directory')
assert.equal(state.reads, 0)
assert.deepEqual(state.writes, [])
assert.deepEqual(state.pdfs, [])
assert.deepEqual(state.downloads, [])
assert.deepEqual(state.recordCalls, [])
assert.ok(state.permissionCalls.every((args) => args.p_user_id === actorId && args.p_company_id === null))
for (const invalidActor of ['', undefined, 'unverified-actor']) {
  await assert.rejects(() => finalizeAgreement(agreement.id, invalidActor), /Invalid verified actor id/)
}
for (const invalidAgreement of ['', undefined, 'invalid-agreement']) {
  await assert.rejects(() => finalizeAgreement(invalidAgreement, actorId), /Invalid agreement id/)
}
assert.equal(state.reads, 0, 'unverified actor or malformed agreement fails before privileged reads')

function formsIn(node) {
  if (Array.isArray(node)) return node.flatMap(formsIn)
  if (!node || typeof node !== 'object') return []
  return [...(node.type === 'form' ? [node] : []), ...formsIn(node.props?.children)]
}

setPermissions(['agreements.read'], ['agreements.read'])
await assert.rejects(() => finalizeAgreementAction(agreement.id), (error) => error.status === 403)
const readerView = await agreementDetail({ params })
assert.equal(formsIn(readerView).length, 0, 'read-only agreement details expose no finalization action')
assert.deepEqual(state.writes, [])
agreement.contract_pdf_path = 'archive/legacy-agreement.pdf'
const downloaded = await downloadAgreementPDF(pdfRequest, { params })
assert.equal(downloaded.status, 200)
assert.equal(downloaded.headers.get('cache-control'), 'private, no-store')
assert.equal(downloaded.headers.get('x-content-type-options'), 'nosniff')
assert.match(downloaded.headers.get('content-disposition'), /^attachment;/)
assert.equal(state.downloads.length, 1, 'global agreement readers can still download the protected PDF')
assert.equal(state.downloads.at(-1).path, 'archive/legacy-agreement.pdf', 'historical stored references are used instead of guessing a new filename')
const downloadCount = state.downloads.length
agreement.contract_pdf_path = null
assert.equal((await downloadAgreementPDF(pdfRequest, { params })).status, 404, 'a missing PDF reference is never guessed')
agreement.contract_pdf_path = '../other-customer.pdf'
assert.equal((await downloadAgreementPDF(pdfRequest, { params })).status, 503, 'unsafe stored references cannot reach storage')
state.pdfLookupMissing = true
assert.equal((await downloadAgreementPDF(pdfRequest, { params })).status, 404)
state.pdfLookupMissing = false
state.pdfLookupError = { message: 'database unavailable' }
assert.equal((await downloadAgreementPDF(pdfRequest, { params })).status, 503, 'a database failure is distinct from missing content')
state.pdfLookupError = null
assert.equal((await downloadAgreementPDF(pdfRequest, { params: Promise.resolve({ id: '../other' }) })).status, 400)
assert.equal(state.downloads.length, downloadCount, 'invalid or unavailable references are rejected before storage')
agreement.contract_pdf_path = null

setPermissions(['agreements.write'], ['agreements.write'])
const writerView = await agreementDetail({ params })
const forms = formsIn(writerView)
assert.equal(forms.length, 1)
// Revoke the grant after rendering. The captured server action must authorize
// again at submission and must not reach privileged finalization I/O.
state.globalPermissions = []
await assert.rejects(() => forms[0].props.action(), (error) => error.status === 403)
assert.deepEqual(state.writes, [])
assert.deepEqual(state.pdfs, [])
state.context.userId = ''
await assert.rejects(() => forms[0].props.action(), (error) => error.status === 401)
assert.deepEqual(state.writes, [])
state.context.userId = actorId
state.globalPermissions = ['agreements.write']
await forms[0].props.action()
assert.deepEqual(state.pdfs, [agreement.id])
assert.deepEqual(state.recordCalls, [{ p_actor_id: actorId, p_agreement_id: agreement.id, p_pdf_path: `${agreement.id}.pdf` }],
  'the authenticated actor and generated path reach one atomic PDF/audit operation')
assert.deepEqual(state.writes, [], 'PDF generation never directly changes lifecycle or mail flags')
assert.equal(agreement.status, 'email_signed')
assert.deepEqual(state.revalidated, [`/admin/agreements/${agreement.id}`, '/admin/agreements', '/admin/customers'])

state.pdfs = []
const refreshesBeforeFailure = state.revalidated.length
state.recordError = { message: 'agreement-pdf-update-failed' }
await assert.rejects(() => forms[0].props.action(), /agreement-pdf-update-failed/)
assert.deepEqual(state.writes, [])
assert.equal(state.revalidated.length, refreshesBeforeFailure, 'failed atomic persistence cannot refresh success')

agreement.contract_pdf_path = `${agreement.id}.pdf`
agreement.status = 'finalized'
state.pdfs = []
state.recordError = { message: 'audit-insert-failed' }
await assert.rejects(() => forms[0].props.action(), /audit-insert-failed/)
assert.deepEqual(state.pdfs, [], 'an existing PDF is reused when metadata or audit persistence is retried')
assert.equal(state.recordCalls.at(-1).p_pdf_path, agreement.contract_pdf_path)
state.recordError = null
await forms[0].props.action()
assert.deepEqual(state.pdfs, [])
assert.deepEqual(state.recordCalls.at(-1), { p_actor_id: actorId, p_agreement_id: agreement.id, p_pdf_path: agreement.contract_pdf_path },
  'a failed PDF/audit record can be retried even when the agreement is already finalized')
state.recordError = { message: 'GLOBAL_AGREEMENT_WRITE_REQUIRED', code: '42501' }
await assert.rejects(() => forms[0].props.action(), /GLOBAL_AGREEMENT_WRITE_REQUIRED/,
  'an independent database authorization failure is propagated instead of reporting success')
assert.deepEqual(state.writes, [])
delete globalThis.__gridexAgreementAuthorization
console.log('Global agreement/customer authorization runtime regressions passed')
