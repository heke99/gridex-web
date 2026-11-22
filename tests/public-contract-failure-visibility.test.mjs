import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as customerType from '../lib/website/customerType.ts'
import { lockedLegalDocumentLinks } from '../lib/website/lockedLegalDocumentLinks.ts'
import * as checkoutAddress from '../lib/website/checkoutAddress.ts'
import { invoiceContactErrors } from '../lib/website/invoiceContact.ts'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const home = read('app/(public)/page.tsx')
assert.match(home, /let contractsLoadError: string \| null = null/)
assert.match(home, /contractsLoadError = `Elavtalen kunde inte hämtas just nu\. Supportreferens:/)
assert.match(home, /feed_loaded_with_blocked_contracts/)
assert.match(home, /Publicerade elavtal kan inte visas just nu\. Supportreferens:/)
assert.match(home, /contractsLoadError=\{contractsLoadError\}/)

const contractsPage = read('app/(public)/elavtal/page.tsx')
assert.match(contractsPage, /let blockedFeed = false/)
assert.match(contractsPage, /Supportreferens:/)
assert.match(contractsPage, /!loadError && !blockedFeed && !stale && cards.length === 0/)

const calculator = read('components/ElectricityCalculator.tsx')
assert.match(calculator, /contractsLoadError\?: string \| null/)
assert.match(calculator, /contractsLoadError = null/)
assert.match(calculator, /contractsLoadError \?\? "Det finns inga aktuella elavtal/)

const items = [
  { offer_reference: 'private-offer', customer_types: ['household'], name: 'Privat' },
  {
    offer_reference: 'business-offer', customer_types: ['company'], name: 'Företag', energy_direction: 'production',
    price_options: [{ option_id: 'region-price' }], pricing_components: [{ component_key: 'spot' }],
  },
  { offer_reference: 'both-offer', customer_types: ['both'], name: 'Båda' },
]
const cards = items.map(contract => ({
  contract,
  display: { onlineReady: true, headline: contract.name, rows: [], ctaHref: `/teckna-avtal?offer=${contract.offer_reference}` },
}))

function loadPage(file, liveSignupEnabled, { checkoutContext, loadFeed, liveContracts = [] } = {}) {
  const mod = { exports: {} }
  const jsx = (type, props) => ({ type, props })
  const modules = {
    'node:crypto': { randomUUID },
    react: { Suspense: 'Suspense' },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/link': { default: 'a' },
    'next/navigation': { redirect: url => { throw new Error(url) } },
    'next/headers': { headers: async () => new Headers() },
    '@/components/ElectricityCalculator': { default: 'ElectricityCalculator' },
    '@/components/signup/SignupFlowClient': { default: 'SignupFlowClient' },
    '@/components/seo/FaqJsonLd': { default: 'FaqJsonLd' },
    '@/components/faq/FaqList': { default: 'FaqList' },
    '@/lib/ops/client': {
      getOpsClientStatus: () => ({ configured: true, liveSignupEnabled }), isOpsError: () => false,
      fetchOpsPublicContractsSnapshot: async () => ({ contracts: liveContracts }),
    },
    '@/lib/ops/config': { getGridexApiBaseUrl: () => 'https://ops.example.invalid/api/v1' },
    '@/lib/security/rateLimit': { checkRateLimit: async () => ({ allowed: true }) },
    '@/lib/website/lockedLegalDocumentLinks': { lockedLegalDocumentLinks },
    '@/lib/website/checkoutAddress': checkoutAddress,
    '@/lib/website/invoiceContact': { invoiceContactErrors },
    '@/lib/website/publicContractDisplay': { isPublicContractReady: () => true },
    '@/lib/website/requestedStart': { PAST_REQUESTED_START_MESSAGE: 'Startdatumet har passerat', parseRequestedStartSelection: ({ requestedDate }) => requestedDate === '2000-01-01' ? ({ ok: false, code: 'requested_start_date_past' }) : ({ ok: true, value: { mode: 'earliest_possible' } }) },
    '@/lib/website/signupValidation': { digitsOnly: value => value.replace(/\D/g, ''), normalizePhoneToE164: () => null },
    '@/lib/website/customerType': customerType,
    '@/lib/website/publicContractFeed': {
      loadWebsitePublicContractFeed: loadFeed ?? (async () => ({ contracts: items, cards, state: 'feed_loaded_with_contracts', snapshot: { stale: false } })),
      logWebsitePublicContractFeedError: () => {},
    },
    '@/lib/website/checkoutContextStore': { readWebsiteCheckoutContext: async () => checkoutContext },
    '@/lib/website/publicPricingVisibility': { sanitizePricingComponentsBeforeAreaResolution: () => [] },
    '@/lib/supabase/server': { createSupabaseServerActionClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) },
    '@/lib/content/faq': { faqByIds: () => [], checkoutFaqItems: [] },
  }
  const compiled = ts.transpileModule(read(file), {
    fileName: file,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  runInNewContext(compiled, { require: name => modules[name] ?? {}, module: mod, exports: mod.exports, URL })
  return mod.exports.default
}

function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten)
  if (!node || typeof node !== 'object') return []
  if (typeof node.type === 'function') return flatten(node.type(node.props))
  return [node, ...flatten(node.props?.children)]
}

async function renderCatalogue(page) {
  const shell = await page()
  const boundary = shell.props.children.find(node => node.type === 'Suspense')
  assert.ok(shell.props.children.some(node => node.type === 'section'))
  assert.equal(boundary.props.fallback.props.role, 'status')
  const catalogue = boundary.props.children
  return flatten(await catalogue.type(catalogue.props))
}

const catalog = 'app/(public)/elavtal/page.tsx'
const open = await renderCatalogue(loadPage(catalog, true))
const paused = await renderCatalogue(loadPage(catalog, false))
assert.ok(open.some(node => node.props?.href === '/teckna-avtal?offer=business-offer'))
assert.ok(!paused.some(node => node.props?.href?.startsWith('/teckna-avtal')))
const catalogLabels = open.filter(node => node.type === 'p' && node.props?.children?.[0]?.startsWith?.('För '))
assert.deepEqual(catalogLabels.map(node => node.props.children.join('')), [
  'För privatkunder.', 'För företag.', 'För privatkunder och företag.',
])
assert.ok(open.some(node => node.props?.children === 'Aktuellt'))

const internalMarker = 'synthetic-internal-catalogue-metadata'
const publicOnly = await renderCatalogue(loadPage(catalog, true, {
  loadFeed: async () => ({
    state: 'feed_loaded_with_contracts',
    contracts: items,
    cards: [{ ...cards[0], contract: { ...items[0], internalNote: internalMarker } }],
    snapshot: { stale: false, upstream_request_id: internalMarker },
  }),
}))
assert.ok(publicOnly.some(node => node.props?.children === items[0].name))
for (const node of publicOnly) {
  const { children, ...attributes } = node.props ?? {}
  assert.ok(!JSON.stringify(attributes).includes(internalMarker))
  const text = [children].flat().filter(child => typeof child === 'string').join('')
  assert.ok(!text.includes(internalMarker))
}

for (const [contracts, availableCards] of [[items, cards], [[], []]]) {
  const staleCatalog = loadPage(catalog, true, {
    loadFeed: async () => ({ contracts, cards: availableCards, snapshot: { stale: true } }),
  })
  const visible = await renderCatalogue(staleCatalog)
  assert.ok(visible.some(node => node.props?.children === 'Vi kan inte bekräfta aktuella elavtal just nu.'))
  assert.ok(!visible.some(node => ['Aktuellt', 'Inga elavtal finns att visa just nu'].includes(node.props?.children)))
  assert.ok(!visible.some(node => node.props?.href?.startsWith('/teckna-avtal')))
  assert.equal(visible.filter(node => node.type === 'article').length, availableCards.length)
}
const expiredCatalog = loadPage(catalog, true, { loadFeed: async () => { throw new Error('Expired snapshot') } })
const expired = await renderCatalogue(expiredCatalog)
assert.ok(expired.some(node => node.props?.children === 'Avtalen kan inte laddas just nu'))
assert.ok(!expired.some(node => node.type === 'article' || node.props?.href?.startsWith('/teckna-avtal')))

let releaseHomeFeed
let homeFeedLoads = 0
const pendingHomeFeed = new Promise(resolve => { releaseHomeFeed = resolve })
const homePage = loadPage('app/(public)/page.tsx', true, { loadFeed: () => { homeFeedLoads++; return pendingHomeFeed } })()
assert.equal(homeFeedLoads, 0)
const homeBoundary = homePage.props.children.find(node => node.type === 'Suspense')
assert.equal(homeBoundary.props.fallback.props.id, 'rakna-elpris')
const renderHomeCalculator = homeBoundary.props.children.type()
assert.equal(homeFeedLoads, 1)
assert.ok(flatten(homePage.props.children.filter(node => node !== homeBoundary)).some(node => node.type === 'h1'))
releaseHomeFeed({ contracts: items, state: 'feed_loaded_with_contracts' })
const homeCalculator = await renderHomeCalculator
assert.equal(homeCalculator.type, 'ElectricityCalculator')
assert.deepEqual(JSON.parse(JSON.stringify(homeCalculator.props.contracts[1])), {
  name: 'Företag', value: 'business-offer', offerReference: 'business-offer',
  energyDirection: 'production', customerTypes: ['company'],
})

const signupFile = 'app/(public)/teckna-avtal/page.tsx'
const signup = loadPage(signupFile, true)
const findSignupFlow = page => flatten(page).find(node => node.type === 'SignupFlowClient')
for (const [offer, expected] of [['private-offer', 'private'], ['business-offer', 'business'], ['both-offer', 'private']]) {
  const flow = findSignupFlow(await signup({ searchParams: Promise.resolve({ offer }) }))
  assert.equal(flow.props.initialSelectedValue, offer)
  assert.equal(flow.props.initialCustomerType, expected)
  assert.equal(flow.props.legalDocumentOrigin, 'https://ops.example.invalid')
  assert.ok(flow.props.contracts.every(contract => !Object.hasOwn(contract, 'priceOptions')))
}

const quoteContext = { quoteReference: 'previous-quote' }
const checkoutRequest = { searchParams: Promise.resolve({ checkout: 'saved-checkout' }) }
for (const customerType of ['private', 'business']) {
  const restoreSignup = loadPage(signupFile, true, {
    checkoutContext: { selectedOffer: 'business-offer', customerType, quoteContext },
  })
  const restoredPage = await restoreSignup(checkoutRequest)
  const restoredFlow = findSignupFlow(restoredPage)
  assert.equal(restoredFlow.props.initialCustomerType, 'business')
  assert.equal(restoredFlow.props.initialQuoteContext, customerType === 'business' ? quoteContext : null)
  if (customerType === 'private') {
    assert.match(JSON.stringify(restoredPage), /Det valda avtalet kunde inte verifieras automatiskt/)
  }
}

let invalidLinkFeedLoads = 0
const invalidLinkSignup = loadPage(signupFile, true, { loadFeed: async () => { invalidLinkFeedLoads++ } })
for (const searchParams of [{ offer: ['private-offer', 'business-offer'] }, { checkout: ['first', 'second'] }]) {
  await assert.rejects(invalidLinkSignup({ searchParams: Promise.resolve(searchParams) }), {
    message: '/teckna-avtal?error=invalid_link',
  })
}
assert.equal(invalidLinkFeedLoads, 0)
const retryPage = await signup({ searchParams: Promise.resolve({ error: 'invalid_link' }) })
assert.match(JSON.stringify(retryPage), /Teckningslänken innehåller flera värden/)
assert.ok(findSignupFlow(retryPage).props.contracts.length > 0)
const defaultFlow = findSignupFlow(await signup({}))
assert.equal(defaultFlow.props.initialSelectedValue, 'private-offer')
const oldOptions = defaultFlow.props.contracts.map((contract, i) => ({
  ...contract, priceOptions: items[i].price_options ?? [],
}))
const bytesRemoved = Buffer.byteLength(JSON.stringify(oldOptions)) - Buffer.byteLength(JSON.stringify(defaultFlow.props.contracts))
assert.ok(bytesRemoved > 0)

const lockedBundle = '00000000-0000-4000-8000-000000000007'
const lockedModule = '00000000-0000-4000-8000-000000000008'
const powerOfAttorney = {
  requirement_code: 'power_of_attorney', document_type: 'power_of_attorney', acceptance_mode: 'accept', required: true,
  label: 'Fullmakt', description: 'Obligatorisk fullmakt', document_reference: 'locked-reference', document_version: 'v1',
  document_hash: 'a'.repeat(64), legal_bundle_version_id: lockedBundle, module_keys: ['power_of_attorney'],
  source_document_ids: [lockedModule], primary_document_id: lockedModule, public_url: null,
}
const guarded = loadPage(signupFile, true, { liveContracts: [{ ...items[0], power_of_attorney_required: true, legal: {
  immutable: true, legal_bundle_version_id: lockedBundle, legal_bundle_reference: 'tenant-locked-reference',
  customer_documents: [powerOfAttorney], module_versions: [{
    id: lockedModule, module_key: 'power_of_attorney', legal_bundle_version_id: lockedBundle, url: null,
  }],
} }] })
const guardedFlow = findSignupFlow(await guarded({}))
const explicitConsent = new FormData()
explicitConsent.set('selected_offer', 'private-offer')
explicitConsent.set('customer_type', 'private')
explicitConsent.set('legal_bundle_version', lockedBundle)
explicitConsent.set('legal_acceptance:power_of_attorney', 'on')
const stopped = await guardedFlow.props.action({}, explicitConsent)
assert.equal(stopped.step, 1)
assert.match(stopped.fieldErrors.legal, /Fullmakten för den här avtalsversionen går inte att öppna/)

console.log(`public-contract visibility and signup tests passed (${bytesRemoved} fewer JSON bytes in synthetic client payload)`)

for (const [separateEmail, separateAddress] of [[true, false], [false, true], [true, true]]) {
  const fields = new FormData()
  for (const [key, value] of explicitConsent) fields.set(key, value)
  fields.set('separate_invoice_email', separateEmail ? 'on' : '')
  fields.set('separate_billing_address', separateAddress ? 'on' : '')
  const incomplete = await guardedFlow.props.action({}, fields)
  assert.deepEqual(Object.keys(incomplete.fieldErrors).sort(), [
    ...(separateEmail ? ['invoice_email'] : []),
    ...(separateAddress ? ['billing_street', 'billing_postal_code', 'billing_city', 'billing_country'] : []),
  ].sort())
  if (separateEmail) fields.set('invoice_email', 'invoice@example.invalid')
  if (separateAddress) {
    fields.set('billing_street', 'Testgatan 1')
    fields.set('billing_postal_code', '111 22')
    fields.set('billing_city', 'Teststad')
    fields.set('billing_country', 'SE')
  }
  const acceptedFields = await guardedFlow.props.action({}, fields)
  assert.match(acceptedFields.fieldErrors.legal, /Fullmakten/)
}

const expiredStartPage = await loadPage(signupFile, true, {
  checkoutContext: { selectedOffer: 'private-offer', customerType: 'private',
    quoteContext: { requested_start_mode: 'specific_date', requested_start_date: '2000-01-01' },
    pricingPreview: { pricing_token: 'expired-start-quote' },
  },
})(checkoutRequest)
assert.match(JSON.stringify(expiredStartPage), /Startdatumet har passerat/)
assert.equal(findSignupFlow(expiredStartPage).props.initialPricingPreview, null)

const outdatedConsent = new FormData()
for (const [key, value] of explicitConsent) outdatedConsent.set(key, value)
outdatedConsent.set('legal_bundle_version', '00000000-0000-4000-8000-000000000009')
const legalConflict = await guardedFlow.props.action({}, outdatedConsent)
assert.equal(legalConflict.legalRefresh.contract.offerReference, 'private-offer')
assert.equal(legalConflict.legalRefresh.contract.legal.legal_bundle_version_id, lockedBundle)

const legalModule = { exports: {} }
const legalCalls = []
let legalRateAllowed = false
const legalModules = {
  'next/server': { NextResponse: Response },
  '@/lib/security/rateLimit': {
    clientIpFromHeaders: () => 'test',
    checkRateLimit: async () => {
      legalCalls.push('quota')
      return { allowed: legalRateAllowed }
    },
  },
  '@/lib/ops/client': {
    getOpsClientStatus: () => ({ configured: true }),
    fetchOpsWebsiteLegalBundle: async reference => {
      legalCalls.push(reference)
      return { offer_reference: reference }
    },
  },
  '@/lib/website/publicDtos': { toBrowserLegalBundle: data => data },
}
const legalPath = 'app/api/checkout/legal-bundle/route.ts'
const legalCode = ts.transpileModule(read(legalPath), {
  fileName: legalPath,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
runInNewContext(legalCode, {
  require: name => legalModules[name],
  module: legalModule,
  exports: legalModule.exports,
  URL,
  crypto: { randomUUID },
})
const legalRequest = query => legalModule.exports.GET(new Request(`https://example.test/legal-bundle${query}`))
for (const query of ['', '?offer_reference=%20', '?offer_reference=first&offer_reference=second', `?offer_reference=${'a'.repeat(181)}`]) {
  const response = await legalRequest(query)
  assert.equal(response.status, 400)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
}
assert.deepEqual(legalCalls, [])
assert.equal((await legalRequest('?offer_reference=valid')).status, 429)
assert.deepEqual(legalCalls, ['quota'])
legalRateAllowed = true
const legalResponse = await legalRequest('?offer_reference=%20valid%20')
assert.equal(legalResponse.status, 200)
assert.deepEqual(await legalResponse.json(), { data: { offer_reference: 'valid' } })
assert.deepEqual(legalCalls, ['quota', 'quota', 'valid'])
