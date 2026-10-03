import assert from 'node:assert/strict'
import fs from 'node:fs'
import { registerHooks } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const state = globalThis.__gridexLegacySign = {
  rows: [], error: null, lookups: [], writes: 0, pdfs: 0,
}
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const service = {
  from(table) {
    assert.equal(table, 'contract_agreements')
    const lookup = { table }
    state.lookups.push(lookup)
    return {
      select(columns) { lookup.columns = columns; return this },
      eq(column, value) { lookup.filter = [column, value]; return this },
      limit(value) { lookup.limit = value; return this },
      returns() { return this },
      update() { state.writes++; throw new Error('GET attempted an agreement write') },
      insert() { state.writes++; throw new Error('GET attempted an audit write') },
      then(resolvePromise, rejectPromise) {
        return Promise.resolve({ data: state.rows, error: state.error }).then(resolvePromise, rejectPromise)
      },
    }
  },
}
state.service = service
const mocks = {
  '@/lib/supabase/service': fixture('export const supabaseService = globalThis.__gridexLegacySign.service;'),
  '@/lib/contracts/finalizeAgreement': fixture('export const finalizeAgreement = async () => { globalThis.__gridexLegacySign.pdfs++; };'),
  'next/link': fixture('export default function Link() {}'),
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
    if (specifier.startsWith('@/')) {
      return { url: pathToFileURL(resolve(root, `${specifier.slice(2)}.ts`)).href, shortCircuit: true }
    }
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

const { default: emailSign, dynamic } = await import('../app/sign/email/[token]/page.tsx')
assert.equal(dynamic, 'force-dynamic')
const token = 'e'.repeat(64)
const params = Promise.resolve({ token })
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== 'object') return []
  return [node, ...nodes(node.props?.children)]
}
async function title() {
  const rendered = nodes(await emailSign({ params }))
  assert.equal(rendered.filter((node) => node.type === 'form' || node.type === 'button').length, 0,
    'an unsupported legacy link must not offer signing authority')
  assert.deepEqual(rendered.filter((node) => node.props?.href).map((node) => node.props.href), ['/dashboard', '/dashboard/support'])
  return rendered.find((node) => node.type === 'h1').props.children
}

assert.equal(await title(), 'Signeringslänken är ogiltig', 'unknown token never says signed')
state.rows = [{ sign_method: 'email', email_signed_at: null }]
assert.equal(await title(), 'Den här länken kan inte användas för signering')
assert.equal(await title(), 'Den här länken kan inte användas för signering', 'repeated/scanner GETs remain readonly')
state.rows = [{ sign_method: 'email', email_signed_at: '2026-09-30T14:00:00Z' }]
assert.equal(await title(), 'En signering är redan registrerad', 'only a persisted email signature can be reported')
state.rows = [{ sign_method: 'email', email_signed_at: 'invalid date' }]
assert.equal(await title(), 'Den här länken kan inte användas för signering')
state.rows = [{ sign_method: 'bankid', email_signed_at: '2026-09-30T14:00:00Z' }]
assert.equal(await title(), 'Signeringslänken är ogiltig', 'BankID rows cannot claim email signing')
state.rows = [
  { sign_method: 'email', email_signed_at: '2026-09-30T14:00:00Z' },
  { sign_method: 'email', email_signed_at: null },
]
assert.equal(await title(), 'Signeringslänken är ogiltig', 'nonunique bearer token cannot identify an agreement')
state.error = { message: 'database connection failed' }
assert.equal(await title(), 'Signeringslänken kunde inte kontrolleras', 'lookup failure cannot report a signature')
assert.equal(state.writes, 0)
assert.equal(state.pdfs, 0)
assert.ok(state.lookups.every((lookup) => lookup.columns === 'sign_method,email_signed_at' && lookup.limit === 2))
assert.ok(state.lookups.every((lookup) => lookup.filter[0] === 'email_sign_token' && lookup.filter[1] === token))
const count = state.lookups.length
for (const invalidToken of ['', 'e'.repeat(301), null]) {
  const rendered = nodes(await emailSign({ params: Promise.resolve({ token: invalidToken }) }))
  assert.equal(rendered.find((node) => node.type === 'h1').props.children, 'Signeringslänken är ogiltig')
}
assert.equal(state.lookups.length, count, 'malformed input never queries the service client')
delete globalThis.__gridexLegacySign
console.log('Legacy email signing is readonly, retired unsigned links cannot sign, and recorded state requires actual signature evidence')
