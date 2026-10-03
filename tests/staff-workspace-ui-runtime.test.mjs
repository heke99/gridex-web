import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import React from 'react'
import ts from 'typescript'

// Execute the production components and their request handlers. This host supplies
// React's hook dispatcher; the test controls only HTTP responses and user events.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
function modulePath(candidate) {
  return (extname(candidate) ? [candidate] : [candidate, `${candidate}.ts`, `${candidate}.tsx`])
    .find((path) => existsSync(path) && statSync(path).isFile())
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/image') return { url: 'data:text/javascript,export default function Image(p){return null}', shortCircuit: true }
    if (specifier.startsWith('@/')) {
      const path = modulePath(resolve(root, specifier.slice(2)))
      if (path) return { url: pathToFileURL(path).href, shortCircuit: true }
    }
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const path = modulePath(resolve(dirname(fileURLToPath(context.parentURL)), specifier))
      if (path) return { url: pathToFileURL(path).href, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && /\.tsx?$/.test(url)) {
      const result = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      })
      return { format: 'module', source: result.outputText, shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})

function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes)
  if (!React.isValidElement(value)) return []
  const expanded = typeof value.type === 'function' && ['Feedback', 'Value', 'PageControls'].includes(value.type.name) ? value.type(value.props) : value.props.children
  return [value, ...nodes(expanded)]
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join('')
  if (React.isValidElement(value)) return text(typeof value.type === 'function' && ['Feedback', 'Value', 'PageControls'].includes(value.type.name) ? value.type(value.props) : value.props.children)
  return value == null || typeof value === 'boolean' ? '' : String(value)
}
function element(tree, predicate, label = 'rendered element') {
  const found = nodes(tree).find(predicate)
  assert.ok(found, `${label} exists in actual component output: ${text(tree)}`)
  return found
}
function button(tree, label) {
  return element(tree, (node) => node.type === 'button' && text(node) === label, `button ${label}`)
}
function formFor(tree, name) {
  return element(tree, (node) => node.type === 'form' && nodes(node).some((child) => child.props.name === name), `form containing ${name}`)
}
const submit = { preventDefault() {} }
function hookHost(component, initialProps) {
  const slots = []
  let cursor = 0
  let effects = []
  let props = initialProps
  function memo(callback, dependencies) {
    const index = cursor++
    const previous = slots[index]
    if (!previous || !dependencies || dependencies.some((value, offset) => !Object.is(value, previous.dependencies?.[offset]))) {
      slots[index] = { dependencies, value: callback() }
    }
    return slots[index].value
  }
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
    useMemo: memo,
    useCallback(callback, dependencies) { return memo(() => callback, dependencies) },
    useEffect(callback, dependencies) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || !dependencies || dependencies.some((value, offset) => !Object.is(value, previous.dependencies?.[offset]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: callback() } })
      }
    },
    useId() { return memo(() => `staff-test-${cursor}`, []) },
  }
  return {
    render(nextProps) {
      if (nextProps) props = nextProps
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
const response = (data, status = 200) => new Response(JSON.stringify({ data }), {
  status, headers: { 'content-type': 'application/json' },
})
function controlledHttp() {
  const requests = []
  const original = globalThis.fetch
  globalThis.fetch = (url, init = {}) => new Promise((resolve, reject) => {
    requests.push({ url: String(url), init, resolve, reject })
  })
  return { requests, restore() { globalThis.fetch = original } }
}

const { default: StaffAuth } = await import('../components/staff/StaffAuth.tsx')
const { default: StaffCustomers, StaffCustomerCard } = await import('../components/staff/StaffCustomers.tsx')
const { default: StaffCases, StaffCaseDetail } = await import('../components/staff/StaffCases.tsx')
const { default: StaffPortal } = await import('../components/staff/StaffPortal.tsx')
const { createStaffClient } = await import('../components/staff/client.ts')
const NativeFormData = globalThis.FormData
globalThis.FormData = class extends NativeFormData {
  constructor(form) {
    super()
    if (form?.values) for (const [name, value] of Object.entries(form.values)) this.set(name, value)
  }
}
function testForm(values) { return { values, resets: 0, reset() { this.resets++ } } }
function send(formElement, form) { return formElement.props.onSubmit({ ...submit, currentTarget: form }) }
const csrf = 'c'.repeat(43)
const anonymous = { status: 'anonymous', csrf_token: csrf, factors: [], staff: null }
const authenticated = { ...anonymous, status: 'authenticated', staff: { staff_reference: 'staff_123', display_name: 'Supportpersonal', organization_reference: 'org_123', is_platform_admin: false, permissions: ['customers.read', 'cases.read', 'cases.write'], capabilities: ['staff.customers.read', 'staff.support.read', 'staff.support.write'] } }
const customer = { customer_reference: 'customer_alpha', customer_number: '12345', customer_type: 'private', status: 'active', display_name: 'Testkund', email: 'example@example.test', phone: '0101234567', created_at: '2026-10-03T10:00:00Z', first_name: 'Test', last_name: 'Kund', company_name: null, masked_personal_number: '********1234', org_number: null, apartment_number: null, preferred_language: 'sv', updated_at: '2026-10-03T11:00:00Z', moved_out_at: null, lifecycle_closed_at: null }
const ticket = { case_reference: 'support_case_alpha', customer_reference: customer.customer_reference, customer_number: customer.customer_number, customer_display_name: customer.display_name, facility_reference: null, title: 'Testärende', description: 'Intern beskrivning', description_visibility: 'internal', category: 'general', status: 'open', public_status: 'in_progress', priority: 'normal', channel: 'admin', assigned_to: null, next_action: null, next_action_due_at: null, created_at: '2026-10-03T10:00:00Z', updated_at: '2026-10-03T11:00:00Z', resolved_at: null, closed_at: null }
function paged(data, cursor = null) { return new Response(JSON.stringify({ data, page: { limit: 50, returned: data.length, has_more: Boolean(cursor), next_cursor: cursor } }), { headers: { 'content-type': 'application/json' } }) }
function router(handler) {
  const original = globalThis.fetch; const requests = []
  globalThis.fetch = async (url, init = {}) => { const request = { url: String(url), init }; requests.push(request); return handler(request, requests.length - 1) }
  return { requests, restore() { globalThis.fetch = original } }
}

async function authStages() {
  const http = controlledHttp(); let updated = null
  const client = createStaffClient(() => csrf)
  const host = hookHost(StaffAuth, { context: anonymous, client, onContext: (value) => { updated = value } })
  try {
    let tree = host.render()
    assert.equal(nodes(tree).filter((node) => node.type === 'a').length, 0, 'login has no customer registration or native OPS link')
    const form = testForm({ email: 'agent@example.test', password: 'Exact password$1' })
    const first = send(formFor(tree, 'password'), form)
    assertMutation(http.requests[0], csrf)
    assert.deepEqual(jsonRequest(http.requests[0]), form.values)
    http.requests[0].reject(new TypeError('Lost response'))
    await first; tree = host.render()
    assert.equal(form.resets, 0, 'uncertain login keeps the user input for retry')
    const retry = send(formFor(tree, 'password'), form)
    assert.equal(new Headers(http.requests[1].init.headers).get('idempotency-key'), new Headers(http.requests[0].init.headers).get('idempotency-key'), 'uncertain login retries the original operation')
    assert.equal(http.requests[1].init.body, http.requests[0].init.body)
    const mfa = { ...anonymous, status: 'mfa_required', factors: [{ factor_reference: 'factor_alpha', method: 'totp', friendly_name: 'Min app' }] }
    http.requests[1].resolve(response(mfa)); await retry
    assert.deepEqual(updated, mfa)
    tree = host.render({ context: mfa, client, onContext: (value) => { updated = value } })
    assert.ok(text(tree).includes('Verifiera din inloggning'))
    const challenge = send(formFor(tree, 'factor_reference'), testForm({ factor_reference: 'factor_alpha' }))
    assert.equal(http.requests[2].url, '/api/staff/session/mfa/challenge')
    http.requests[2].resolve(response({ challenge_reference: 'challenge_alpha', method: 'totp', expires_at: '2026-10-03T11:05:00Z' })); await challenge
    tree = host.render()
    await send(formFor(tree, 'code'), testForm({ code: '12' }))
    assert.equal(http.requests.length, 3, 'malformed MFA codes cannot submit a protected verify request')
    tree = host.render()
    const verify = send(formFor(tree, 'code'), testForm({ code: '123456' }))
    assert.deepEqual(jsonRequest(http.requests[3]), { challenge_reference: 'challenge_alpha', code: '123456' })
    assertMutation(http.requests[3], csrf)
    http.requests[3].resolve(response(authenticated)); await verify
    assert.equal(updated.status, 'authenticated')
    tree = host.render({ context: { ...anonymous, status: 'password_change_required' }, client, onContext: (value) => { updated = value } })
    await send(formFor(tree, 'confirm_password'), testForm({ password: 'Strong password', confirm_password: 'Wrong password' }))
    assert.equal(http.requests.length, 4, 'password confirmation is enforced by the real handler')
    tree = host.render()
    const password = send(formFor(tree, 'confirm_password'), testForm({ password: 'Strong password', confirm_password: 'Strong password' }))
    assert.equal(http.requests[4].url, '/api/staff/session/password')
    assert.deepEqual(jsonRequest(http.requests[4]), { password: 'Strong password' })
    http.requests[4].resolve(response(authenticated)); await password
    console.log('PASS actual staff login stable retry, MFA challenge/verify and mandatory password stage')
  } finally { host.unmount(); http.restore() }
  const recoveryHttp = router(() => response({ accepted: true }, 202))
  const recoveryHost = hookHost(StaffAuth, { context: anonymous, client: createStaffClient(() => csrf), onContext() {}, initialView: 'recovery' })
  try {
    let tree = recoveryHost.render()
    await send(formFor(tree, 'email'), testForm({ email: 'agent@example.test' }))
    tree = recoveryHost.render()
    assert.ok(text(tree).includes('Om kontot kan återställas'))
    button(tree, 'Jag har en återställningskod').props.onClick()
    tree = recoveryHost.render()
    await send(formFor(tree, 'token_hash'), testForm({ token_hash: 'explicit-recovery-token' }))
    assert.equal(recoveryHttp.requests[1].url, '/api/staff/session/recovery/verify')
    assert.deepEqual(jsonRequest(recoveryHttp.requests[1]), { token_hash: 'explicit-recovery-token' })
    assertMutation(recoveryHttp.requests[1], csrf)
    assert.ok(recoveryHttp.requests.every((request) => !request.url.includes('explicit-recovery-token')), 'recovery tokens never enter request URLs')
    console.log('PASS actual staff password recovery uses explicit POST proof and neutral accepted notice')
  } finally { recoveryHost.unmount(); recoveryHttp.restore() }
}

async function customerPaging() {
  const http = router((request) => {
    const url = new URL(request.url, 'https://staff.invalid')
    if (url.pathname === '/api/staff/customers' && url.searchParams.has('cursor')) return paged([{ ...customer, customer_reference: 'customer_beta', display_name: 'Senare kund' }])
    if (url.pathname === '/api/staff/customers') return paged([customer], 'opaque%+/customer-cursor')
    return response(customer)
  })
  let selected = null
  const client = createStaffClient(() => csrf)
  const host = hookHost(StaffCustomers, { client, onSelect: (value) => { selected = value } })
  try {
    host.render(); await settle(); let tree = host.render()
    button(tree, 'Visa fler kunder').props.onClick(); await settle(); tree = host.render()
    assert.ok(text(tree).includes('Senare kund'))
    assert.equal(new URL(http.requests[1].url, 'https://staff.invalid').searchParams.get('cursor'), 'opaque%+/customer-cursor', 'opaque customer continuation is preserved exactly')
    await send(formFor(tree, 'q'), testForm({ q: 'Senare kund', customer_type: 'private' })); host.render(); await settle(); tree = host.render()
    const filtered = new URL(http.requests.at(-1).url, 'https://staff.invalid')
    assert.equal(filtered.searchParams.get('q'), 'Senare kund'); assert.equal(filtered.searchParams.has('cursor'), false, 'changed filters restart pagination')
    const pick = element(tree, (node) => node.type === 'button' && text(node).includes('Testkund'))
    await pick.props.onClick(); tree = host.render()
    assert.equal(selected.customer_reference, customer.customer_reference)
    assert.ok(nodes(tree).some((node) => node.type === StaffCustomerCard), 'selected canonical customer mounts the full card')
    console.log('PASS actual staff customer directory complete opaque pages, filter reset and canonical detail selection')
  } finally { host.unmount(); http.restore() }
  const resources = {
    contacts: [{ contact_reference: 'contact_a', name: 'Första kontakt', email: 'contact@example.test', phone: null, title: null, type: 'billing', is_primary: true, created_at: customer.created_at }, { contact_reference: 'contact_b', name: 'Senare kontakt', email: null, phone: '123', title: null, type: null, is_primary: false, created_at: customer.created_at }],
    addresses: [{ address_reference: 'address_a', street_1: 'Första gatan', postal_code: '12345', city: 'Teststad', country: 'SE', type: 'billing', is_active: true, created_at: customer.created_at }, { address_reference: 'address_b', street_1: 'Senare gatan', city: 'Teststad', is_active: false, created_at: customer.created_at }],
    facilities: [{ facility_reference: 'facility_a', site_name: 'Första anläggningen', facility_id: '123456', status: 'active', created_at: customer.created_at }, { facility_reference: 'facility_b', site_name: 'Senare anläggningen', facility_id: '654321', status: 'active', created_at: customer.created_at }],
  }
  const childHttp = router((request) => { const url = new URL(request.url, 'https://staff.invalid'); const name = url.pathname.split('/').at(-1); return paged([resources[name][url.searchParams.has('cursor') ? 1 : 0]], url.searchParams.has('cursor') ? null : `opaque_${name}`) })
  const card = hookHost(StaffCustomerCard, { customer, client })
  try {
    card.render(); assert.equal(childHttp.requests.length, 3, 'all independent card resources start concurrently'); await settle(); let tree = card.render()
    for (const label of ['kontaktpersoner', 'adresser', 'anläggningar']) button(tree, `Visa fler ${label}`).props.onClick()
    await settle(); tree = card.render()
    for (const expected of ['Senare kontakt', 'Senare gatan', 'Senare anläggningen', '********1234']) assert.ok(text(tree).includes(expected), `full customer card renders ${expected}`)
    for (const resource of Object.keys(resources)) assert.ok(childHttp.requests.some((request) => request.url.includes(resource) && request.url.includes(`cursor=opaque_${resource}`)), `${resource} own continuation is queried`)
    console.log('PASS actual staff customer card paginates every contact/address/facility resource without silent caps')
  } finally { card.unmount(); childHttp.restore() }
}

async function caseActions() {
  let caseData = { ...ticket }
  let lost = true
  let stale = false
  const entry = { entry_reference: 'entry_a', case_reference: ticket.case_reference, kind: 'internal_note', visibility: 'internal', author_type: 'staff', author: { staff_reference: 'staff_alpha', display_name: 'Handläggare' }, body: 'Intern testanteckning', created_at: ticket.updated_at }
  const attachment = { attachment_reference: 'attachment_alpha', case_reference: ticket.case_reference, file_name: 'test.pdf', mime_type: 'application/pdf', byte_size: 8, sha256: 'abc', visibility: 'internal', uploaded_by: 'staff', scan_status: 'released', scan_reason: null, created_at: ticket.updated_at }
  const http = router((request) => {
    const path = new URL(request.url, 'https://staff.invalid').pathname
    if (request.init.method === 'POST') {
      if (path.endsWith('/replies') && lost) { lost = false; throw new TypeError('Response lost') }
      if (path.endsWith('/status') && stale) return new Response(JSON.stringify({ error: { code: 'support_case_version_conflict', message: 'Conflict' } }), { status: 409 })
      if (path.endsWith('/status')) caseData = { ...caseData, status: JSON.parse(request.init.body).status, updated_at: '2026-10-03T12:00:00Z' }
      return response(path.endsWith('/attachments') ? attachment : entry, 201)
    }
    if (path.endsWith('/entries')) return paged([entry])
    if (path.endsWith('/attachments')) return paged([attachment, { ...attachment, attachment_reference: 'attachment_rejected', file_name: 'rejected.pdf', scan_status: 'rejected' }])
    if (path.endsWith('/assignees')) return paged([{ staff_reference: 'staff_alpha', display_name: 'Handläggare' }], 'opaque_staff_more')
    return response(caseData)
  })
  const client = createStaffClient(() => csrf)
  const host = hookHost(StaffCaseDetail, { reference: ticket.case_reference, client, canWrite: true })
  try {
    let tree = host.render()
    assert.equal(http.requests.length, 4, 'detail, entries, attachments and eligible assignees start independently')
    await settle(); tree = host.render()
    assert.ok(text(tree).includes('Intern testanteckning'))
    const downloads = nodes(tree).filter((node) => node.type === 'a')
    assert.equal(downloads.length, 1, 'rejected attachments have no downloadable link')
    assert.equal(downloads[0].props.href, `/api/staff/support/cases/${ticket.case_reference}/attachments/attachment_alpha`, 'binary download goes only through BFF')
    const replyForm = testForm({ message: 'Kundsvar', kind: 'message' })
    await send(formFor(tree, 'kind'), replyForm); tree = host.render()
    assert.equal(replyForm.resets, 0)
    const first = http.requests.find((request) => request.url.endsWith('/replies'))
    await send(formFor(tree, 'kind'), replyForm); await settle(); tree = host.render()
    const replies = http.requests.filter((request) => request.url.endsWith('/replies'))
    assert.equal(replies.length, 2)
    assert.equal(new Headers(replies[0].init.headers).get('idempotency-key'), new Headers(replies[1].init.headers).get('idempotency-key'), 'lost reply retries same exact command')
    assertMutation(first, csrf); assert.deepEqual(jsonRequest(first), { message: 'Kundsvar', kind: 'message' })
    assert.equal(replyForm.resets, 1)
    assert.ok(text(tree).includes('Svaret är sparat och synligt för kunden.'))
    const noteForm = element(tree, (node) => node.type === 'form' && text(node).includes('Intern anteckning'))
    await send(noteForm, testForm({ message: 'Endast personal' })); await settle(); tree = host.render()
    const note = http.requests.find((request) => request.url.endsWith('/internal-notes'))
    assert.deepEqual(jsonRequest(note), { message: 'Endast personal' }, 'internal notes never accept caller-controlled visibility')
    await send(formFor(tree, 'assignee_reference'), testForm({ assignee_reference: 'staff_alpha' })); await settle(); tree = host.render()
    const assignment = http.requests.find((request) => request.url.endsWith('/assignment'))
    assert.deepEqual(jsonRequest(assignment), { assignee_reference: 'staff_alpha', expected_updated_at: ticket.updated_at })
    stale = true
    await send(formFor(tree, 'status'), testForm({ status: 'closed', message: 'Avslutar' })); tree = host.render()
    assert.ok(text(tree).includes('Ärendet har ändrats'))
    assert.ok(formFor(tree, 'kind'), 'conflict cannot silently mutate the displayed canonical case')
    stale = false
    const file = new File(['%PDF-1.7'], 'test.pdf', { type: 'application/pdf' })
    const upload = send(formFor(tree, 'file'), testForm({ file, visibility: 'internal' })); await upload; await settle(); tree = host.render()
    const uploaded = http.requests.find((request) => request.init.method === 'POST' && request.url.endsWith('/attachments'))
    assertMutation(uploaded, csrf)
    assert.equal(new Headers(uploaded.init.headers).get('content-type'), null, 'browser generates multipart boundary')
    assert.equal(uploaded.init.body.get('visibility'), 'internal')
    assert.equal(uploaded.init.body.get('file').name, 'test.pdf')
    await send(formFor(tree, 'status'), testForm({ status: 'closed', message: '' })); await settle(); tree = host.render()
    assert.ok(!nodes(tree).some((node) => node.props.name === 'file' || node.props.name === 'kind'), 'closed cases hide upload and reply controls')
    assert.ok(text(tree).includes('återöppna'))
    console.log('PASS actual staff case replies/notes/assignment/status conflict, byte-bound upload and closed-case write controls')
  } finally { host.unmount(); http.restore() }
}

async function queueCreateAndRbac() {
  const http = router((request) => request.init.method === 'POST' ? response({ case_reference: 'support_case_new' }, 201) : paged([ticket], request.url.includes('cursor=') ? null : 'opaque_case_more'))
  const client = createStaffClient(() => csrf)
  const host = hookHost(StaffCases, { client, canRead: true, canWrite: true, customer })
  try {
    host.render(); await settle(); let tree = host.render()
    button(tree, 'Visa fler ärenden').props.onClick(); await settle(); tree = host.render()
    const more = http.requests.find((request) => request.url.includes('cursor=opaque_case_more'))
    assert.equal(new URL(more.url, 'https://staff.invalid').searchParams.get('customer_reference'), customer.customer_reference)
    const form = testForm({ title: 'Nytt ärende', description: 'Intern beskrivning', category: 'billing', priority: 'high', facility_reference: '' })
    await send(formFor(tree, 'title'), form); tree = host.render()
    const created = http.requests.find((request) => request.init.method === 'POST')
    assert.deepEqual(jsonRequest(created), { customer_reference: customer.customer_reference, title: 'Nytt ärende', description: 'Intern beskrivning', category: 'billing', priority: 'high' })
    assertMutation(created, csrf)
    assert.ok(nodes(tree).some((node) => node.type === StaffCaseDetail && node.props.reference === 'support_case_new'))
    console.log('PASS actual staff customer-scoped queue paging and canonical creation receipt selection')
  } finally { host.unmount(); http.restore() }
  let session = { ...authenticated, staff: { ...authenticated.staff, is_platform_admin: true } }
  const rbacHttp = router((request) => response(request.url.endsWith('/logout') ? { logged_out: true } : session))
  const portal = hookHost(StaffPortal, {})
  try {
    portal.render(); await settle(); let tree = portal.render()
    assert.ok(text(tree).includes('endast läsåtkomst'))
    const cases = element(tree, (node) => node.type === StaffCases)
    assert.equal(cases.props.canWrite, false, 'platform context can never mount write-enabled case handlers')
    assert.ok(nodes(tree).some((node) => node.type === 'button' && text(node) === 'Kundregister'))
    session = { ...authenticated, staff: { ...authenticated.staff, is_platform_admin: true, permissions: [] } }
    await button(tree, 'Uppdatera session').props.onClick(); tree = portal.render()
    assert.ok(nodes(tree).some((node) => node.type === StaffCases), 'returned read capability authorizes the platform read exception without fabricated native permissions')
    session = { ...authenticated, staff: { ...authenticated.staff, permissions: ['cases.read'] } }
    await button(tree, 'Uppdatera session').props.onClick(); tree = portal.render()
    assert.equal(nodes(tree).some((node) => node.type === 'button' && text(node) === 'Kundregister'), false, 'fresh canonical permissions remove customer navigation')
    const readOnly = element(tree, (node) => node.type === StaffCases)
    assert.equal(readOnly.props.canWrite, false); assert.equal(readOnly.props.customer, null)
    session = { ...anonymous, csrf_token: 'n'.repeat(43) }
    await button(tree, 'Logga ut').props.onClick(); tree = portal.render()
    assert.ok(nodes(tree).some((node) => node.type === StaffAuth))
    assert.equal(element(tree, (node) => node.type === StaffAuth).props.context.csrf_token, 'n'.repeat(43), 'logout bootstraps the anonymous cookie and fresh CSRF after logged_out receipt')
    assert.equal(rbacHttp.requests.at(-1).url, '/api/staff/session')
    assert.ok(!nodes(tree).some((node) => node.type === StaffCases || node.type === StaffCustomers), 'logout removes customer data components')
    assertMutation(rbacHttp.requests[1], csrf)
    console.log('PASS actual mounted staff workspace enforces platform read-only, fresh role navigation and logout clearing')
  } finally { portal.unmount(); rbacHttp.restore() }
}

async function recoveryFragmentAndBusyErrors() {
  const originalWindow = globalThis.window
  const order = []
  globalThis.window = {
    location: { pathname: '/login/recovery', search: '', hash: '#token_hash=mail-recovery-proof' },
    history: { replaceState(_state, _unused, url) { order.push(['clear', url]); globalThis.window.location.hash = '' } },
  }
  const http = router((request) => { order.push(['request', request.url]); return response(request.init.method === 'POST' ? { ...anonymous, status: 'password_change_required' } : anonymous) })
  const portal = hookHost(StaffPortal, { initialView: 'recovery' })
  let auth
  try {
    portal.render(); await settle(); const tree = portal.render()
    assert.deepEqual(order[0], ['clear', '/login/recovery'], 'fragment is cleared before session bootstrap makes any request')
    assert.equal(http.requests.length, 1, 'email link cannot automatically verify its recovery proof')
    const authNode = element(tree, (node) => node.type === StaffAuth)
    assert.equal(authNode.props.recoveryToken, 'mail-recovery-proof')
    auth = hookHost(StaffAuth, authNode.props)
    const authTree = auth.render()
    assert.ok(!text(authTree).includes('mail-recovery-proof'), 'memory-held recovery proof is never rendered')
    await send(element(authTree, (node) => node.type === 'form'), testForm({}))
    assert.equal(http.requests[1].url, '/api/staff/session/recovery/verify')
    assert.deepEqual(jsonRequest(http.requests[1]), { token_hash: 'mail-recovery-proof' })
    const restricted = portal.render()
    assert.equal(element(restricted, (node) => node.type === StaffAuth).props.context.status, 'password_change_required')
    assert.ok(!nodes(restricted).some((node) => node.type === StaffCases || node.type === StaffCustomers), 'verified recovery retains restricted stages before customer access')
    console.log('PASS actual staff email recovery clears fragment before HTTP and consumes proof only after explicit confirmation')
  } finally { auth?.unmount(); portal.unmount(); http.restore(); globalThis.window = originalWindow }
  const waitingHttp = router(() => new Response(JSON.stringify({ error: { code: 'staff_session_busy', message: 'Busy' } }), { status: 409 }))
  try {
    await assert.rejects(createStaffClient(() => csrf).write('/api/staff/session/refresh', {}), (error) => error.message.includes('behandlas fortfarande') && !error.message.includes('Ärendet har ändrats'))
    console.log('PASS staff session contention is shown as retryable waiting rather than a case version conflict')
  } finally { waitingHttp.restore() }
}

async function supersededReadsAndLogout() {
  const http = controlledHttp()
  const client = createStaffClient(() => csrf)
  let selected = null
  const customers = hookHost(StaffCustomers, { client, onSelect: (value) => { selected = value } })
  try {
    let tree = customers.render()
    await send(formFor(tree, 'q'), testForm({ q: 'Senare', customer_type: '', status: 'active' }))
    customers.render()
    assert.equal(http.requests[0].init.signal.aborted, true, 'changed filters cancel the preceding list request')
    http.requests[1].resolve(paged([{ ...customer, customer_reference: 'customer_new', display_name: 'Senare sökträff' }]))
    await settle(); http.requests[0].resolve(paged([customer])); await settle(); tree = customers.render()
    assert.ok(text(tree).includes('Senare sökträff'))
    assert.ok(!text(tree).includes('Testkund'), 'late old-filter result cannot overwrite the current directory')
    const selecting = element(tree, (node) => node.type === 'button' && text(node).includes('Senare sökträff')).props.onClick()
    customers.unmount()
    http.requests[2].resolve(response(customer)); await selecting
    assert.equal(selected, null, 'unmounted customer detail cannot select a customer into another workspace view')
    console.log('PASS actual staff directory ignores stale filter/detail responses after cancellation')
  } finally { customers.unmount(); http.restore() }
  const logoutHttp = controlledHttp(); const portal = hookHost(StaffPortal, {})
  try {
    portal.render(); logoutHttp.requests[0].resolve(response(authenticated)); await settle(); let tree = portal.render()
    const logout = button(tree, 'Logga ut').props.onClick(); tree = portal.render()
    assert.ok(!nodes(tree).some((node) => node.type === StaffCases || node.type === StaffCustomers), 'logout removes sensitive resource components before waiting on OPS')
    assertMutation(logoutHttp.requests[1], csrf)
    logoutHttp.requests[1].resolve(response({ logged_out: true })); await settle()
    assert.equal(logoutHttp.requests[2].url, '/api/staff/session')
    logoutHttp.requests[2].resolve(response({ ...anonymous, csrf_token: 'f'.repeat(43) })); await logout; tree = portal.render()
    assert.equal(element(tree, (node) => node.type === StaffAuth).props.context.csrf_token, 'f'.repeat(43))
    console.log('PASS actual staff logout clears customer components immediately and uses fresh anonymous CSRF')
  } finally { portal.unmount(); logoutHttp.restore() }
}

async function rejectedAuthAndLogoutFailure() {
  let invalidated = 0
  const denied = router(() => new Response(JSON.stringify({ error: { code: 'staff_session_invalid', message: 'Sessionen har upphört.' }, request_id: 'auth-trace' }), { status: 401 }))
  try {
    const client = createStaffClient(() => csrf, () => { invalidated++ })
    for (const path of ['/session/login', '/session/recovery', '/session/recovery/verify']) {
      await assert.rejects(client.write(`/api/staff${path}`, {}), (error) => error.status === 401)
    }
    assert.equal(invalidated, 0, 'anonymous auth failures retain the bootstrap CSRF context for another attempt')
    for (const path of ['/session/refresh', '/session/mfa/verify', '/session/password', '/customers']) {
      await assert.rejects(client.write(`/api/staff${path}`, {}), (error) => error.status === 401)
    }
    assert.equal(invalidated, 4, 'expired protected auth stages invalidate context and require a fresh bootstrap')
  } finally { denied.restore() }
  const http = controlledHttp(); const portal = hookHost(StaffPortal, {})
  try {
    portal.render(); http.requests[0].resolve(response(authenticated)); await settle(); let tree = portal.render()
    const logout = button(tree, 'Logga ut').props.onClick(); tree = portal.render()
    assert.ok(!nodes(tree).some(node => node.type === StaffCases || node.type === StaffCustomers))
    http.requests[1].resolve(new Response(JSON.stringify({ error: { code: 'staff_session_busy', message: 'Upstream busy' }, request_id: 'logout-trace' }), { status: 409, headers: { 'Retry-After': '1' } })); await settle()
    assert.equal(http.requests[2].url, '/api/staff/session', 'failed authorized logout still bootstraps after browser cookie deletion')
    http.requests[2].resolve(response({ ...anonymous, csrf_token: 'z'.repeat(43) })); await logout; tree = portal.render()
    assert.equal(element(tree, node => node.type === StaffAuth).props.context.csrf_token, 'z'.repeat(43))
    assert.ok(text(tree).includes('logout-trace'), 'logout error remains reviewable after safe anonymous bootstrap')
    console.log('PASS protected auth401 resets context; failed logout clears customer views and bootstraps new CSRF')
  } finally { portal.unmount(); http.restore() }
}

try {
  await authStages()
  await customerPaging()
  await caseActions()
  await queueCreateAndRbac()
  await recoveryFragmentAndBusyErrors()
  await supersededReadsAndLogout()
  await rejectedAuthAndLogoutFailure()
} finally { globalThis.FormData = NativeFormData }
function jsonRequest(request) { return JSON.parse(request.init.body) }
function assertMutation(request, csrf) {
  const headers = new Headers(request.init.headers)
  assert.equal(headers.get('x-gridex-staff-csrf'), csrf, 'mutation includes current BFF CSRF nonce')
  assert.match(headers.get('idempotency-key') ?? '', /^[A-Za-z0-9._:-]{16,128}$/, 'mutation has a valid operation key')
  assert.equal(headers.get('authorization'), null, 'browser never sends an upstream staff bearer token')
  assert.equal(request.init.credentials, 'same-origin', 'only the first-party protected session cookie is used')
}
