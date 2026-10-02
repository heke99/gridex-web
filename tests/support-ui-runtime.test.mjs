import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import React from 'react'
import ts from 'typescript'

// Run the actual TSX with React elements and a small hook host; no source-string
// assertions or copied request handlers. HTTP promises are controlled below.
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const state = globalThis.__gridexSupportUi = { context: null, rules: [] }
const mocks = {
  'next/link': fixture(`export default 'a';`),
  '@/lib/admin/guards': fixture(`export const requireGlobalAdminPageAccess = async (rule) => { globalThis.__gridexSupportUi.rules.push(rule); return globalThis.__gridexSupportUi.context; };`),
  '@/lib/support/staff': fixture(`export const opsStaffSupportUrl = () => 'https://app.gridex.se/admin/support';`),
  '@/app/admin/support-tickets/actions': fixture(`export const assignSupportTicketAction = () => {}; export const replyToSupportTicketAction = () => {}; export const updateSupportTicketStatusAction = () => {};`),
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
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

const { default: SupportWorkspace } = await import('../components/support/SupportWorkspace.tsx')
const { default: StaffSupportPage } = await import('../app/support-center/staff/page.tsx')
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes)
  if (!React.isValidElement(value)) return []
  return [value, ...nodes(value.props.children)]
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join('')
  if (React.isValidElement(value)) return text(value.props.children)
  return value == null || typeof value === 'boolean' ? '' : String(value)
}
function element(tree, predicate) {
  const found = nodes(tree).find(predicate)
  assert.ok(found, 'expected rendered element exists')
  return found
}
function hookHost(component, props) {
  const slots = []
  let cursor = 0
  let effects = []
  const dispatcher = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(callback, dependencies) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || dependencies.some((value, offset) => !Object.is(value, previous.dependencies[offset]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: callback() } })
      }
    },
  }
  return {
    render() {
      cursor = 0
      effects = []
      const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
      const previous = internals.H
      let tree
      try { internals.H = dispatcher; tree = component(props) }
      finally { internals.H = previous }
      for (const effect of effects) effect()
      return tree
    },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
  }
}
const settle = () => new Promise((resolve) => setImmediate(resolve))
async function waitUntil(predicate) {
  const deadline = Date.now() + 2000
  while (!predicate() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5))
  assert.ok(predicate(), 'async operation reached expected state')
}
const caseReference = 'support_case_123456789012345678901234'
const ticket = { case_reference: caseReference, title: 'Testärende', description: 'Fråga', status: 'received', channel: 'portal', created_at: '2026-10-02T12:00:00Z', updated_at: '2026-10-02T12:00:00Z', resolved_at: null }
const response = (data) => new Response(JSON.stringify({ data, request_id: 'trace', contract_schema_version: '2026-10-02.2' }), { headers: { 'content-type': 'application/json' } })

async function attachmentOrdering() {
  const requests = []
  const originalFetch = globalThis.fetch
  const OriginalFormData = globalThis.FormData
  globalThis.fetch = (url, options = {}) => new Promise((resolve) => { requests.push({ url, options, resolve }) })
  globalThis.FormData = class {
    constructor(form) { this.values = form.values }
    get(name) { return this.values.get(name) }
  }
  const host = hookHost(SupportWorkspace, { initial: { data: [ticket], page: { next_cursor: null } } })
  try {
    let tree = host.render()
    element(tree, (node) => node.type === 'button' && node.props['aria-pressed'] === false).props.onClick()
    host.render()
    assert.equal(requests.length, 2, 'detail and attachments start concurrently')
    requests[0].resolve(response({ ...ticket, messages: [] }))
    await settle()
    tree = host.render()
    assert.ok(text(tree).includes('Testärende'), 'conversation renders before slow attachment read')
    const uploadForm = element(tree, (node) => node.type === 'form' && nodes(node).some((child) => child.type === 'input' && child.props.type === 'file'))
    const uploadButton = element(uploadForm, (node) => node.type === 'button')
    assert.equal(uploadButton.props.disabled, true, 'upload cannot overtake the pending attachment snapshot')
    const refresh = element(tree, (node) => node.type === 'button' && text(node) === 'Uppdatera ärendet')
    assert.equal(refresh.props.disabled, true, 'case refresh cannot start a competing attachment snapshot')
    const form = { values: new Map([['file', new File(['%PDF-1.7'], 'new.pdf', { type: 'application/pdf' })]]), resets: 0, reset() { this.resets++ } }
    await uploadForm.props.onSubmit({ preventDefault() {}, currentTarget: form })
    refresh.props.onClick()
    await settle()
    assert.equal(requests.length, 2, 'handlers also guard pending attachments independent of button disabled state')

    const existing = { attachment_reference: 'existing-file', file_name: 'existing.pdf', byte_size: 8, mime_type: 'application/pdf' }
    requests[1].resolve(response([existing]))
    await settle()
    tree = host.render()
    const readyForm = element(tree, (node) => node.type === 'form' && nodes(node).some((child) => child.type === 'input' && child.props.type === 'file'))
    assert.equal(element(readyForm, (node) => node.type === 'button').props.disabled, false)
    const upload = readyForm.props.onSubmit({ preventDefault() {}, currentTarget: form })
    await waitUntil(() => requests.length === 3)
    assert.equal(requests.length, 3)
    assert.equal(requests[2].options.method, 'POST')
    requests[2].resolve(response({ ...existing, attachment_reference: 'new-file', file_name: 'new.pdf' }))
    await upload
    await settle()
    tree = host.render()
    const downloadLinks = nodes(tree).filter((node) => node.type === 'a' && node.props.href.includes('/attachments/'))
    assert.deepEqual(downloadLinks.map((node) => node.props.href.split('/').at(-1)), ['existing-file', 'new-file'], 'previous and newly accepted attachments both remain visible')
    assert.ok(text(tree).includes('Bilagan har tagits emot och kontrollerats.'))
    assert.equal(form.resets, 1)

    element(tree, (node) => node.type === 'button' && text(node) === 'Uppdatera ärendet').props.onClick()
    assert.equal(requests.length, 5)
    requests[3].resolve(new Response(JSON.stringify({ error: { message: 'Tillfälligt fel' } }), { status: 503 }))
    await settle()
    tree = host.render()
    const pendingForm = element(tree, (node) => node.type === 'form' && nodes(node).some((child) => child.type === 'input' && child.props.type === 'file'))
    assert.equal(element(pendingForm, (node) => node.type === 'button').props.disabled, true, 'an early detail failure does not release a pending refresh snapshot')
    await pendingForm.props.onSubmit({ preventDefault() {}, currentTarget: form })
    assert.equal(requests.length, 5, 'upload handler waits for remaining refresh read even when another read failed')
    requests[4].resolve(response([existing, { ...existing, attachment_reference: 'new-file', file_name: 'new.pdf' }]))
    await settle()
    tree = host.render()
    assert.ok(text(tree).includes('Tillfälligt fel'))
    const recoveredForm = element(tree, (node) => node.type === 'form' && nodes(node).some((child) => child.type === 'input' && child.props.type === 'file'))
    assert.equal(element(recoveredForm, (node) => node.type === 'button').props.disabled, false, 'write controls recover after all reads settle')
    console.log('PASS actual support UI delayed attachment read cannot erase a successful upload')
  } finally { host.unmount(); globalThis.fetch = originalFetch; globalThis.FormData = OriginalFormData }
}

async function notesChronology() {
  const selectedId = '11111111-1111-4111-8111-111111111111'
  const selected = { id: selectedId, subject: 'Förfrågan', description: 'Text', status: 'open', category: 'general', created_at: ticket.created_at, assigned_user_id: null, metadata: {} }
  const notes = Array.from({ length: 105 }, (_, index) => ({
    id: String(index + 1).padStart(5, '0'), body: `Anteckning ${index + 1}`, is_internal_note: true,
    created_at: new Date(Date.UTC(2026, 9, 2, 12, Math.floor(index / 2))).toISOString(),
  }))
  const queries = []
  function query(table) {
    const current = { table, orders: [], limit: null }
    queries.push(current)
    const builder = {
      select() { return this }, eq() { return this }, is() { return this }, range() { return this },
      order(column, options) { current.orders.push({ column, ascending: options.ascending }); return this },
      limit(count) { current.limit = count; return this },
      maybeSingle() { return Promise.resolve({ data: selected, error: null }) },
      then(fulfill, reject) {
        const rows = table === 'customer_support_messages' ? [...notes] : [selected]
        rows.sort((left, right) => {
          for (const { column, ascending } of current.orders) {
            const comparison = left[column].localeCompare(right[column])
            if (comparison) return ascending ? comparison : -comparison
          }
          return 0
        })
        return Promise.resolve({ data: current.limit ? rows.slice(0, current.limit) : rows, error: null }).then(fulfill, reject)
      },
    }
    return builder
  }
  state.context = { userId: selectedId, permissions: ['support_tickets.read', 'support_tickets.reply'], supabase: { from: query } }
  let tree = await StaffSupportPage({ searchParams: Promise.resolve({ id: selectedId }) })
  assert.deepEqual(state.rules.at(-1), { allOf: ['support_tickets.read'] }, 'staff list retains global read guard')
  const noteQuery = queries.find((item) => item.table === 'customer_support_messages')
  assert.equal(noteQuery.limit, 100, 'query remains bounded')
  let renderedNotes = nodes(tree).filter((node) => node.type === 'article').map((node) => text(element(node, (child) => child.type === 'p')))
  assert.deepEqual(renderedNotes, notes.slice(-100).map((note) => note.body), 'actual staff page shows newest 100 notes in chronological order, including timestamp ties')
  assert.ok(text(tree).includes('De senaste 100 anteckningarna visas.'), 'history cutoff is stated')
  notes.push({ id: '00106', body: 'Ny sparad anteckning', created_at: notes.at(-1).created_at, is_internal_note: true })
  tree = await StaffSupportPage({ searchParams: Promise.resolve({ id: selectedId }) })
  renderedNotes = nodes(tree).filter((node) => node.type === 'article').map((node) => text(element(node, (child) => child.type === 'p')))
  assert.deepEqual(renderedNotes, notes.slice(-100).map((note) => note.body), 'newly saved note remains visible after server refresh instead of falling beyond oldest100 cutoff')
  console.log('PASS actual staff page renders newest100 notes chronologically with stable timestamp ties')
}

if (!process.argv.includes('--notes')) await attachmentOrdering()
if (!process.argv.includes('--attachments')) await notesChronology()
