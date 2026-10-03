import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, extname, resolve } from 'node:path'
import React from 'react'
import ts from 'typescript'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
function existingModule(candidate) {
  return (extname(candidate) ? [candidate] : [candidate, `${candidate}.ts`, `${candidate}.tsx`])
    .find((path) => existsSync(path) && statSync(path).isFile())
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const path = existingModule(resolve(projectRoot, specifier.slice(2)))
      if (path) return { url: pathToFileURL(path).href, shortCircuit: true }
    }
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
const { default: SelfService } = await import('../components/customer/CustomerPortalSelfService.tsx')
const { default: SwitchStatusCard } = await import('../components/signup/SwitchStatusCard.tsx')
const { default: OverviewCards } = await import('../components/dashboard/OverviewCards.tsx')
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes)
  if (!React.isValidElement(value)) return []
  if (typeof value.type === 'function') return nodes(value.type(value.props))
  return [value, ...nodes(value.props.children)]
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join('')
  if (React.isValidElement(value)) return typeof value.type === 'function' ? text(value.type(value.props)) : text(value.props.children)
  return value == null || typeof value === 'boolean' ? '' : String(value)
}
function element(tree, predicate) {
  const found = nodes(tree).find(predicate)
  assert.ok(found, 'expected actual rendered element exists')
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
    useMemo(callback, dependencies) {
      const index = cursor++
      if (!slots[index] || dependencies.some((value, i) => !Object.is(value, slots[index].dependencies[i]))) slots[index] = { dependencies, value: callback() }
      return slots[index].value
    },
    useEffect(callback, dependencies) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: callback() } })
      }
    },
  }
  return {
    render() {
      cursor = 0; effects = []
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
const response = (data, status = 200, headers = {}) => new Response(JSON.stringify({ data }), { status, headers: { 'content-type': 'application/json', ...headers } })
const originalFetch = globalThis.fetch
const site = { id: 'facility_canonical', facilityId: '7359991234567890', meteringPointId: '735999000000000001',
  gridAreaCode: 'STH', priceAreaCode: 'SE3', address: 'Gatan 1', postalCode: '12345', city: 'Stockholm' }
const formEvent = { preventDefault() {} }
try {
  for (const [status, access_granted] of [['linked', false], ['pending_review', true], ['rejected', true]]) {
    const host = hookHost(SelfService, { site })
    globalThis.fetch = async () => response({ ok: status === 'linked' && access_granted, status, synced: { access_granted } })
    await element(host.render(), (node) => node.type === 'button' && text(node) === 'Uppdatera Mina sidor').props.onClick()
    assert.ok(text(host.render()).includes('Kontakta kundservice.'))
    assert.ok(!text(host.render()).includes('Kopplingen till Mina sidor är uppdaterad.'), 'HTTP success cannot grant customer access')
  }
  const host = hookHost(SelfService, { site })
  const requests = []
  let loseResponse = true
  globalThis.fetch = async (url, init) => {
    requests.push({ url, body: init.body })
    if (loseResponse) throw new Error('Svaret kunde inte hämtas.')
    if (url.includes('profile-update')) return response({ ok: true, status: 'submitted', data: { facility_updated: false } })
    if (url.includes('move-out')) return response({ ok: true, status: 'submitted' })
    return response({ ok: true, status: 'synced' })
  }
  let tree = host.render()
  assert.ok(text(tree).includes('Nätområde: STH • Elområde: SE3'))
  assert.ok(!nodes(tree).some((node) => node.type === 'label' && ['Nätområde', 'Elområde'].includes(text(node))), 'authoritative pricing/grid areas are not editable')
  const facilityForm = () => element(host.render(), (node) => node.type === 'form' && text(node).includes('Anläggningsuppgifter'))
  await facilityForm().props.onSubmit(formEvent)
  loseResponse = false
  await facilityForm().props.onSubmit(formEvent)
  assert.deepEqual(requests[1], requests[0], 'lost response retry keeps exact body and client operation ID')
  const facilityBody = JSON.parse(requests[0].body)
  assert.deepEqual(facilityBody.facility_data, { facility_reference: site.id, facility_id: site.facilityId, metering_point_id: site.meteringPointId })
  assert.ok(facilityBody.client_operation_id)
  assert.ok(text(host.render()).includes('Anläggningsuppgifterna är uppdaterade.'))
  await element(host.render(), (node) => node.type === 'form' && text(node).includes('Anläggningsadress')).props.onSubmit(formEvent)
  assert.deepEqual(JSON.parse(requests.at(-1).body).facility_data, { facility_reference: site.id,
    address: { street: site.address, postal_code: site.postalCode, city: site.city, country: 'SE' } })
  assert.ok(text(host.render()).includes('Adressändringen är mottagen för kontroll.'), 'submitted address intake is not claimed applied')
  globalThis.fetch = async () => response({ ok: true, status: 'accepted', data: { facility_updated: true } })
  await element(host.render(), (node) => node.type === 'form' && text(node).includes('Anläggningsadress')).props.onSubmit(formEvent)
  assert.ok(text(host.render()).includes('Anläggningsadressen är uppdaterad.'), 'explicit applied facility fields may be displayed updated')
  globalThis.fetch = async () => response({ ok: false, status: 'rejected', data: { facility_updated: false } })
  await element(host.render(), (node) => node.type === 'form' && text(node).includes('Anläggningsadress')).props.onSubmit(formEvent)
  assert.ok(text(host.render()).includes('Adressändringen kunde inte bekräftas.'))
  globalThis.fetch = async (url, init) => { requests.push({ url, body: init.body }); return response({ ok: true, status: 'submitted' }) }
  const dateField = element(host.render(), (node) => node.type === 'input' && node.props.type === 'date')
  dateField.props.onChange({ target: { value: '2026-11-01' } })
  await element(host.render(), (node) => node.type === 'form' && text(node).includes('Flyttanmälan')).props.onSubmit(formEvent)
  assert.deepEqual(JSON.parse(requests.at(-1).body).move_out, { facility_reference: site.id,
    requested_move_out_date: '2026-11-01', reason: 'customer_requested_move_out' })
  const unlinked = hookHost(SelfService, { site: null })
  const disabledMove = element(unlinked.render(), (node) => node.type === 'form' && text(node).includes('Flyttanmälan'))
  assert.equal(element(disabledMove, (node) => node.type === 'button').props.disabled, true)
  const before = requests.length
  await disabledMove.props.onSubmit(formEvent)
  assert.equal(requests.length, before, 'unlinked moveout handler cannot invent a facility reference')
  const counts = OverviewCards({ overview: { contracts: [], invoices: [], documents: [], notifications: [],
    unavailableSections: ['invoices', 'documents', 'notifications'] } })
  assert.equal(nodes(counts).filter((node) => node.props.className?.includes('text-3xl') && text(node) === 'Ej tillgängligt').length, 3,
    'partial bundle failed reads display unavailable rather than zero business resources')

  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const timers = []
  const cleared = []
  globalThis.setTimeout = (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer }
  globalThis.clearTimeout = (timer) => { cleared.push(timer) }
  const polling = hookHost(SwitchStatusCard, { resultToken: 'opaque-receipt', initialStatus: 'pending' })
  let poll = 0
  globalThis.fetch = async () => {
    poll++
    if (poll === 1) return response({ status: 'pending', label: 'Väntar', message: 'Kontrolleras', terminal: false })
    if (poll === 2) return response(null, 503, { 'Retry-After': '90' })
    if (poll === 3) return response(null, 503)
    if (poll === 4) return response({ status: 'processing', label: 'Arbetar', message: 'Kontrolleras', terminal: false })
    return response({ status: 'completed', label: 'Klart', message: 'Bytet är klart.', terminal: true })
  }
  const settle = () => new Promise((resolve) => setImmediate(resolve))
  try {
    polling.render()
    await settle()
    assert.equal(timers.at(-1).delay, 30_000)
    await timers.at(-1).callback()
    assert.equal(timers.at(-1).delay, 90_000, 'server Retry-After is honored beyond exponential base delay')
    await timers.at(-1).callback()
    assert.equal(timers.at(-1).delay, 120_000, 'temporary failures back off instead of repeating each30seconds')
    await timers.at(-1).callback()
    assert.equal(timers.at(-1).delay, 30_000, 'real status progress resets fallback polling delay')
    const timerCount = timers.length
    await timers.at(-1).callback()
    assert.equal(timers.length, timerCount, 'terminal canonical state stops polling')
    assert.ok(text(polling.render()).includes('Bytet är klart.'))
    polling.unmount()
    assert.equal(cleared.length, 1)
  } finally { globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout }
  console.log('Actual self-service canonical payload/access/retry, partial bundle and fallback polling UI regressions passed')
} finally { globalThis.fetch = originalFetch }
