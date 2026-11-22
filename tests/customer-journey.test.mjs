import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import MinaSidor from '../app/mina-sidor/page.tsx'
import ProfilePage from '../app/dashboard/profile/page.tsx'
import Dashboard from '../app/dashboard/page.tsx'
import Documents from '../app/dashboard/documents/page.tsx'
import Approvals from '../app/dashboard/approvals/page.tsx'
import Contracts from '../app/dashboard/contracts/page.tsx'
import ContractPricing from '../components/customer/ContractPricing.tsx'
import OverviewCards from '../components/dashboard/OverviewCards.tsx'
import { getCustomerPortalOverview, markCustomerNotificationsRead } from '../lib/customerPortal/service.ts'
import { normalizePortalBundle } from '../lib/ops/client/portal.ts'

let state
beforeEach(() => {
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'customer@example.invalid', email_confirmed_at: '2026-10-20T10:00:00Z', user_metadata: {} }
  state = {
    user,
    contract: { contract_reference: 'contract_synthetic_customer', contract_name: 'Syntetiskt kundavtal', contract_number: 'TEST-001', contract_type: 'fixed', status: 'signed', start_date: '2026-11-01', monthly_fee_sek: 49, invoice_fee_sek: 0, fixed_price_ore_per_kwh: 86.25, markup_ore_per_kwh: 0, price_area: 'SE2', energy_direction: 'consumption' },
    invoices: [], noContract: false, unavailable: false, identities: [],
    client: { auth: { getUser: async () => ({ data: { user: state.user } }) }, from: () => ({ select() { return this }, eq() { return this }, order() { return this }, limit() { return this }, maybeSingle: async () => ({ data: null }) }) },
    bundle: async (identity, view) => {
      state.bundleView = view
      state.identities.push(identity)
      if (state.unavailable) throw Error('Synthetic OPS outage')
      return { profile: { display_name: 'Syntetisk kund', customer_number: state.noContract ? null : 'KTEST001', ...state.opsProfile }, contracts: state.noContract ? [] : (state.contracts ?? [state.contract]), sites: [], invoices: state.invoices, documents: state.documents ?? [], legalAcceptances: state.legalAcceptances ?? [], powersOfAttorney: state.powersOfAttorney ?? [], customerStatus: null, dataQuality: null, switchStatus: null, meteringValues: [], events: [], notifications: state.notifications ?? [] }
    },
    queue: table => ({
      select(columns) { assert.equal(columns, 'status'); return this },
      eq(column, userId) {
        assert.equal(column, table === 'portal_onboarding_jobs' ? 'auth_user_id' : 'user_id')
        assert.equal(userId, state.user.id)
        return this
      },
      in(column, statuses) {
        assert.equal(column, 'status')
        assert.deepEqual(statuses, ['manual_review', 'pending', 'processing', 'retryable_failure'])
        return this
      },
      order(column, options) {
        assert.equal(column, 'status')
        assert.equal(options.ascending, true)
        return this
      },
      limit: async count => {
        assert.equal(count, 1)
        const rows = state.statuses?.[table] ?? []
        return rows === 'error'
          ? { error: new Error('Synthetic status read failure') }
          : { data: rows.toSorted().slice(0, count).map(status => ({ status })) }
      },
    }),
    resource: async (_identity, resource) => {
      const keys = { documents: 'documents', 'legal-acceptances': 'legalAcceptances', 'powers-of-attorney': 'powersOfAttorney' }
      assert.ok(keys[resource], 'Unexpected resource request')
      return { data: state[keys[resource]] ?? [] }
    },
    support: async identity => { state.identities.push(identity); return { data: [] } },
  }
  globalThis.__customerJourney = state
})

for (const [name, page] of [['Mina sidor', MinaSidor], ['Översikt', Dashboard], ['Mina avtal', Contracts]]) {
  test(`${name}: actual OPS mapping reaches the page with original prices, zero fees and area`, async () => {
    const html = renderToStaticMarkup(await page({}))
    for (const value of ['Dina avtalspriser', '86,25', 'öre/kWh', '49 kr/mån', '0 kr/faktura', 'SE2']) assert.ok(html.includes(value), value)
    assert.ok(state.identities.every(identity => identity.userId === state.user.id))
    assert.equal(state.identities.length, name === 'Mina avtal' ? 1 : 2)
    assert.equal(html.includes('inkl. moms'), false, 'the portal contract does not establish a VAT basis')
  })
}

test('variable contract shows its fees and settlement wording without a fabricated fixed energy price', async () => {
  state.contract.contract_type = 'variable_monthly'
  state.contract.fixed_price_ore_per_kwh = null
  state.contract.markup_ore_per_kwh = 3.5
  const html = renderToStaticMarkup(await Contracts())
  assert.ok(html.includes('3,5 öre/kWh'))
  assert.ok(html.includes('faktureringsperioden enligt avtalet'))
  assert.equal(html.includes('Fast energipris'), false)
})

test('missing contract prices remain missing and negative recorded values are preserved', async () => {
  state.contract.monthly_fee_sek = null
  state.contract.markup_ore_per_kwh = -1.75
  const overview = await getCustomerPortalOverview()
  const html = renderToStaticMarkup(ContractPricing({ contract: overview.contracts[0] }))
  assert.ok(html.includes('Uppgift saknas'))
  assert.match(html, /[−-]1,75 öre\/kWh/)
  assert.equal(html.includes('0 kr/mån'), false)
})

test('empty account offers signup and existing-customer linking; privacy links use the request workflow', async () => {
  state.noContract = true
  const html = renderToStaticMarkup(await MinaSidor({}))
  for (const href of ['/teckna-avtal', '/aktivera-kundkonto', '/dashboard/privacy', '/dashboard/support']) assert.ok(html.includes(`href="${href}"`), href)
  assert.match(html, /href="\/dashboard\/privacy"[^>]*>[\s\S]*?Begär datautdrag/)
  assert.equal(html.includes('Dina avtalspriser'), false)
})

test('malformed OPS dates cannot crash either portal entry, and timestamps use Swedish calendar days', async () => {
  state.contract.start_date = 'not-a-date'
  state.invoices = [{ invoice_reference: 'invoice_synthetic', status: 'issued', issued_at: 'not-a-date' }]
  assert.ok(renderToStaticMarkup(await MinaSidor({})).includes('Mina sidor'))
  const overview = await getCustomerPortalOverview()
  assert.ok(renderToStaticMarkup(OverviewCards({ overview })).includes('Senaste fakturadatum: —'))
  state.invoices[0].issued_at = '2026-10-20T22:30:00Z'
  const fresh = await getCustomerPortalOverview()
  assert.ok(renderToStaticMarkup(OverviewCards({ overview: fresh })).includes('2026-10-21'))
})

test('expired session and unavailable OPS never become a successful empty customer portal', async () => {
  state.unavailable = true
  await assert.rejects(MinaSidor({}), /Synthetic OPS outage/)
  state.user = null
  await assert.rejects(MinaSidor({}), /REDIRECT:\/login/)
})

test('Mina avtal distinguishes contract lifecycle statuses in the same view', async () => {
  const cases = [['signed', 'Signerat'], ['active', 'Aktivt'], ['terminated', 'Uppsagt'], ['cancelled', 'Avbrutet']]
  state.contracts = cases.map(([status]) => ({
    ...state.contract,
    contract_reference: `contract_${status}`,
    contract_name: `Avtal ${status}`,
    status,
  }))
  const html = renderToStaticMarkup(await Contracts())
  for (const [status, label] of cases) {
    assert.match(html, new RegExp(`Avtal ${status}</h2><p[^>]*>Status: <span[^>]*>${label}</span>`))
  }
})

test('Mina avtal displays recorded end date and a Swedish withdrawal deadline', async () => {
  const withoutDates = renderToStaticMarkup(await Contracts())
  assert.doesNotMatch(withoutDates, /Slutdatum|Ångerfrist/)
  state.contract.end_date = '2026-10-25'
  state.contract.withdrawal_deadline_at = '2026-10-24T22:30:00Z'
  const html = renderToStaticMarkup(await Contracts())
  assert.match(html, /Slutdatum<\/div><div[^>]*>2026-10-25<\/div>/)
  assert.match(html, /Ångerfrist<\/div><div[^>]*>2026-10-25<\/div>/)
})

test('Mina avtal shows the recorded variable fee independently of markup', async () => {
  state.contract.markup_ore_per_kwh = 3
  state.contract.variable_fee_ore_per_kwh = 7
  const html = renderToStaticMarkup(await Contracts())
  assert.match(html, /Påslag<\/dt><dd[^>]*>3 öre\/kWh/)
  assert.match(html, /Rörlig avgift<\/dt><dd[^>]*>7 öre\/kWh/)

  state.contract.markup_ore_per_kwh = null
  const feeOnly = renderToStaticMarkup(await Contracts())
  assert.match(feeOnly, /Påslag<\/dt><dd[^>]*>Uppgift saknas/)
  assert.match(feeOnly, /Rörlig avgift<\/dt><dd[^>]*>7 öre\/kWh/)
})

test('the two portal pages show the recorded power-of-attorney status and dates', async () => {
  for (const [status, label] of [['signed', 'Signerad'], ['revoked', 'Återkallad'], ['expired', 'Utgången']]) {
    state.powersOfAttorney = [{
      power_of_attorney_reference: 'power_of_attorney_synthetic',
      status,
      signed_at: '2026-12-12',
      valid_to: '2027-03-14',
      revoked_at: status === 'revoked' ? '2027-01-01' : null,
    }]
    for (const page of [MinaSidor, Approvals]) {
      const html = renderToStaticMarkup(await page({}))
      assert.match(html, new RegExp(`>${page === MinaSidor ? 'Status: ' : ''}${label}<`))
      assert.match(html, /Giltig till:? 2027-03-14/)
      if (status === 'revoked') assert.match(html, /Återkallad:? 2027-01-01/)
    }
  }
})

test('Mina sidor displays each signed power-of-attorney purpose and labels the legacy scope', async () => {
  const poa = {
    power_of_attorney_reference: 'power_of_attorney_fixture',
    status: 'signed',
    scope: 'supplier_switch',
    scopes: ['supplier_switch', 'facility_information_lookup'],
  }
  state.powersOfAttorney = [poa]
  assert.match(renderToStaticMarkup(await MinaSidor({})), /Omfattning: Leverantörsbyte, Inhämtning av anläggningsuppgifter/)
  delete poa.scopes
  assert.match(renderToStaticMarkup(await MinaSidor({})), /Omfattning: Leverantörsbyte</)
})

test('published documents show availability of the file separately from publication', async () => {
  state.documents = [
    { document_reference: 'document_missing', title: 'Utan fillänk', status: 'published' },
    { document_reference: 'document_ready', title: 'Med fillänk', status: 'published', secure_url: 'https://files.example.test/ready.pdf' },
  ]
  const html = renderToStaticMarkup(await Documents({ searchParams: Promise.resolve({}) }))
  assert.match(html, /Dokumentet är publicerat men går inte att öppna här/)
  assert.equal((html.match(/Öppna dokument/g) ?? []).length, 1)
  assert.match(html, /href="https:\/\/files\.example\.test\/ready\.pdf"/)
})

test('approvals only link to the referenced document at the accepted version', async () => {
  state.legalAcceptances = [{
    acceptance_reference: 'acceptance_fixture', type: 'terms',
    document_reference: 'document_accepted', document_version: 'v1',
  }]
  state.documents = [
    { document_reference: 'document_accepted', version: 'v1', secure_url: 'https://files.example.test/accepted.pdf' },
    { document_reference: 'document_other', version: 'v1', secure_url: 'https://files.example.test/other.pdf' },
  ]
  const available = renderToStaticMarkup(await Approvals())
  assert.match(available, /Dokumentreferens document_accepted/)
  assert.match(available, /href="https:\/\/files\.example\.test\/accepted\.pdf"/)
  assert.doesNotMatch(available, /other\.pdf/)
  state.documents[0].version = 'v2'
  const unavailable = renderToStaticMarkup(await Approvals())
  assert.match(unavailable, /Begär en kopia från kundtjänst/)
  assert.doesNotMatch(unavailable, /Öppna godkänt dokument|accepted\.pdf/)

  state.legalAcceptances[0].document_reference = 'legal_document_fixture'
  const legalReferenceOnly = renderToStaticMarkup(await Approvals())
  assert.match(legalReferenceOnly, /Dokumentreferens legal_document_fixture/)
  assert.match(legalReferenceOnly, /Begär en kopia från kundtjänst/)
  assert.doesNotMatch(legalReferenceOnly, /Öppna godkänt dokument/)
})

test('Mina avtal requests only its bundle projection and skips support entirely', async () => {
  let supportCalls = 0
  state.support = async () => { supportCalls++; throw Error('Support unavailable') }
  const html = renderToStaticMarkup(await Contracts())
  assert.match(html, /Syntetiskt kundavtal/)
  assert.equal(state.bundleView, 'contracts')
  assert.equal(supportCalls, 0)
  await getCustomerPortalOverview()
  assert.equal(supportCalls, 1)
  assert.equal(state.bundleView, undefined)
})

test('Mina sidor verifies Auth once per request and keeps sequential customer identities separate', async () => {
  let authCalls = 0
  state.client.auth.getUser = async () => {
    authCalls++
    return { data: { user: state.user } }
  }
  const firstId = state.user.id
  await MinaSidor({})
  assert.equal(authCalls, 1)
  assert.deepEqual(state.identities.map(identity => identity.userId), [firstId, firstId])

  const secondId = '22222222-2222-4222-8222-222222222222'
  state.user = { ...state.user, id: secondId, email: 'second@example.invalid' }
  state.identities = []
  await MinaSidor({})
  assert.equal(authCalls, 2)
  assert.deepEqual(state.identities.map(identity => identity.userId), [secondId, secondId])

  state.user = null
  state.identities = []
  await assert.rejects(MinaSidor({}), /REDIRECT:\/login/)
  assert.equal(authCalls, 3)
  assert.deepEqual(state.identities, [])
})

test('approvals reads only three relevant sections in parallel under one verified customer identity', async () => {
  let authReads = 0
  let profileReads = 0
  const calls = []
  const originalAuth = state.client.auth.getUser
  const originalFrom = state.client.from
  state.client.auth.getUser = async () => { authReads++; return originalAuth() }
  state.client.from = table => {
    if (table === 'customer_profiles') profileReads++
    return originalFrom(table)
  }
  state.bundle = () => { throw Error('Bundle must not be read even for customers with many metering values') }
  state.support = () => { throw Error('Support cases must not be read') }
  let release
  const gate = new Promise(resolve => { release = resolve })
  let sectionsStarted
  const started = new Promise(resolve => { sectionsStarted = resolve })
  state.resource = async (identity, resource, id, query) => {
    calls.push({ identity, resource, id, limit: query.get('limit'), cursor: query.get('cursor') })
    if (calls.length === 3) sectionsStarted()
    await gate
    if (resource === 'legal-acceptances') return { data: [{ acceptance_reference: 'acceptance_paged', document_reference: 'document_paged', document_version: 'v1' }] }
    if (resource === 'documents' && !query.has('cursor')) return { data: [], page: { has_more: true, next_cursor: 'next-documents' } }
    if (resource === 'documents') return { data: [{ document_reference: 'document_paged', version: 'v1', secure_url: 'https://files.example.test/paged.pdf' }] }
    return { data: [] }
  }
  const page = Approvals()
  await started
  assert.deepEqual(calls.map(call => call.resource), ['legal-acceptances', 'powers-of-attorney', 'documents'])
  assert.equal(authReads, 1)
  assert.equal(profileReads, 1)
  release()
  const html = renderToStaticMarkup(await page)
  assert.match(html, /https:\/\/files\.example\.test\/paged\.pdf/)
  assert.equal(calls.length, 4)
  assert.equal(calls[3].cursor, 'next-documents')
  assert.ok(calls.every(call => call.identity === calls[0].identity && call.identity.userId === state.user.id && call.limit === '100'))
})

test('approval opens the verified older OPS version and rejects untrusted link paths', async () => {
  const path = '/legal/test-company/general-consumer-terms/00000000-0000-4000-8000-000000000012'
  state.legalAcceptances = [
    { acceptance_reference: 'acceptance_old', document_reference: 'legal_document_old', document_version: 'v1', verified_document_path: path },
    { acceptance_reference: 'acceptance_unverified', document_reference: 'legal_document_unverified', document_version: 'v2', verified_document_path: '//foreign.example/legal' },
  ]
  const html = renderToStaticMarkup(await Approvals())
  assert.match(html, new RegExp(`href="https://[^/" ]+${path}"`))
  assert.doesNotMatch(html, /href="[^"]*foreign\.example/)
  assert.match(html, /Begär en kopia från kundtjänst/)
})

test('Mina sidor distinguishes empty queues, pending retries, manual review and unavailable reads', async () => {
  state.noContract = true
  for (const [statuses, expected] of [
    [{}, 'Koppla ditt kundkonto'],
    [{ auth_profile_sync_jobs: ['retryable_failure'] }, 'Systemet försöker automatiskt igen'],
    [{ portal_onboarding_jobs: [...Array(5000).fill('pending'), 'manual_review'] }, 'behöver granskas av kundservice'],
    [{ auth_profile_sync_jobs: 'error' }, 'Kopplingens status kan inte visas just nu'],
  ]) {
    state.statuses = statuses
    const html = renderToStaticMarkup(await MinaSidor({}))
    assert.ok(html.includes(expected))
    if (expected !== 'Systemet försöker automatiskt igen') assert.doesNotMatch(html, /Systemet försöker automatiskt igen/)
  }
})

test('Mina sidor shows the linking outcome and confirms access from OPS only', async () => {
  const render = async portal_link => renderToStaticMarkup(await MinaSidor({ searchParams: Promise.resolve({ portal_link }) }))
  const success = /Din kundåtkomst är verifierad/
  assert.match(await render('completed'), success)
  assert.doesNotMatch(await render(['completed', 'invalid']), success)
  const invalid = await render('invalid')
  assert.match(invalid, /Kopplingslänken kunde inte verifieras/)
  assert.match(invalid, /href="\/aktivera-kundkonto"/)
  const review = await render('review')
  assert.match(review, /Kopplingsförsöket behöver granskas/)
  assert.match(review, /href="\/kundservice"/)
  assert.match(await render('pending'), /Kopplingen är ännu inte bekräftad/)

  state.noContract = true
  state.client.from = () => ({
    select() { return this }, eq() { return this },
    maybeSingle: async () => ({ data: { user_id: state.user.id, customer_number: 'LOCAL-ONLY' } }),
  })
  assert.match(await render('completed'), /Kundåtkomsten kunde inte bekräftas/)
  assert.doesNotMatch(await render('completed'), success)
  state.unavailable = true
  const outage = await render('completed')
  assert.match(outage, /Kunduppgifterna kan inte hämtas just nu/)
  assert.doesNotMatch(outage, success)
  assert.match(await render('invalid'), /Kopplingslänken kunde inte verifieras/)
  state.user = null
  await assert.rejects(() => render('completed'), /REDIRECT:\/login/)
})

test('an existing customer sees separate login and OPS contact addresses without onboarding jobs', async () => {
  state.user = { ...state.user, email: 'new-login@example.invalid' }
  state.opsProfile = { email: 'existing-contact@example.invalid' }
  state.statuses = {}
  const html = renderToStaticMarkup(await MinaSidor({}))
  assert.match(html, /E-post för inloggning<[^>]+><[^>]+>new-login@example\.invalid/)
  assert.match(html, /Kontaktadress i kundsystemet<[^>]+><[^>]+>existing-contact@example\.invalid/)
  assert.doesNotMatch(html, /Kopplingen till alla uppgifter/)
})

test('profile reload reads canonical name, phone and language after a failed local projection', async () => {
  state.client.from = () => ({
    select() { return this }, eq() { return this },
    maybeSingle: async () => ({ data: { user_id: state.user.id, first_name: 'Tidigare', phone: '0700000000', language_code: 'sv' } }),
  })
  state.resource = async (identity, resource) => {
    assert.equal(identity.userId, state.user.id)
    assert.equal(resource, 'me')
    return { data: { first_name: 'Sparat', phone: '+46701234567', language_code: 'en' } }
  }
  const html = renderToStaticMarkup(await ProfilePage({ searchParams: Promise.resolve({ status: 'profile-local-sync-failed' }) }))
  assert.match(html, /value="Sparat"/)
  assert.match(html, /value="\+46701234567"/)
  assert.match(html, /<option[^>]*value="en"[^>]*selected/)
  assert.match(html, /Ändringen sparades i kundsystemet/)
  assert.doesNotMatch(html, /value="Tidigare"/)
})

test('Mina sidor uses updated personal names even while the stored OPS display name is stale', async () => {
  state.opsProfile = {
    customer_type: 'private',
    first_name: 'Uppdaterat',
    last_name: 'Namn',
    display_name: 'Gammalt Namn',
  }
  const personal = renderToStaticMarkup(await MinaSidor({}))
  assert.match(personal, /Uppdaterat Namn/)
  assert.doesNotMatch(personal, /Gammalt Namn/)

  state.opsProfile = { ...state.opsProfile, customer_type: 'business', company_name: 'Syntetiskt Företag AB', display_name: 'Affärsnamn' }
  const overview = await getCustomerPortalOverview()
  assert.equal(overview.profile.company_name, 'Syntetiskt Företag AB')
  assert.equal(overview.profile.full_name, 'Affärsnamn')
})

test('document list failures preserve the fullmakt section and show a retry instead of an empty list', async () => {
  state.resource = async () => { throw new Error('Synthetic document query outage') }
  state.archiveText = 'Verifierat fullmaktsarkiv'
  const cursor = 'opaque-archive-cursor'
  const html = renderToStaticMarkup(await Documents({ searchParams: Promise.resolve({ poa_cursor: cursor }) }))
  assert.match(html, /Verifierat fullmaktsarkiv/)
  assert.match(html, /Dokumenten kunde inte hämtas just nu/)
  assert.match(html, /href="\/dashboard\/documents\?poa_cursor=opaque-archive-cursor"/)
  assert.doesNotMatch(html, /Inga dokument finns/)
  assert.equal(state.archiveCursor, cursor)
})

test('document API preserves OPS continuation and rejects duplicate cursor before lookup', async () => {
  const { GET } = await import('../app/api/web/customer/documents/route.ts')
  const cursors = []
  state.resource = async (identity, resource, _id, query) => {
    assert.equal(resource, 'documents')
    assert.equal(identity.userId, state.user.id)
    const cursor = query?.get('cursor') ?? null
    cursors.push(cursor)
    return {
      data: [{ document_reference: cursor ? 'document_two' : 'document_one' }],
      page: { has_more: !cursor, next_cursor: cursor ? null : 'opaque+next/cursor' },
    }
  }
  const url = 'https://gridex.example.test/api/web/customer/documents'
  const first = await GET(new Request(url))
  assert.equal(first.status, 200)
  assert.equal(first.headers.get('cache-control'), 'private, no-store')
  const initial = await first.json()
  assert.deepEqual(initial.page, { hasMore: true, nextCursor: 'opaque+next/cursor' })
  const second = await GET(new Request(`${url}?${new URLSearchParams({ cursor: initial.page.nextCursor })}`))
  assert.equal(second.status, 200)
  const continuation = await second.json()
  assert.deepEqual(continuation.page, { hasMore: false, nextCursor: null })
  assert.equal(continuation.data[0].document_reference, 'document_two')
  assert.equal((await GET(new Request(url + '?cursor=one&cursor=two'))).status, 400)
  assert.deepEqual(cursors, [null, 'opaque+next/cursor'])
})

test('partial OPS bundle distinguishes unavailable documents and notifications from successful empty lists', async () => {
  let unavailable = ['documents', 'notifications', 'documents', 'unknown_internal']
  state.bundle = async () => normalizePortalBundle({
    data: {
      profile: { display_name: 'Syntetisk kund', customer_number: 'KTEST001' },
      contracts: [state.contract],
      documents: [],
      notifications: [],
      bundle_status: { status: 'partial', complete: true, unavailable_sections: unavailable },
    },
  })
  const response = await getCustomerPortalOverview()
  assert.deepEqual(response.unavailableSections, ['documents', 'notifications'])
  assert.equal(response.authoritative, false)
  assert.equal(response.dataFreshness, 'partial')
  const overview = renderToStaticMarkup(await Dashboard())
  assert.match(overview, /Meddelanden kunde inte hämtas just nu/)
  assert.doesNotMatch(overview, /Inga meddelanden ännu/)
  assert.match(overview, /Syntetiskt kundavtal/)
  const customer = renderToStaticMarkup(await MinaSidor({}))
  assert.match(customer, /Dokument kunde inte hämtas just nu/)
  assert.doesNotMatch(customer, /Inga dokument visas ännu/)

  unavailable = ['documents']
  assert.match(renderToStaticMarkup(await Dashboard()), /Inga meddelanden ännu/)
})

test('only the displayed unread notification can be marked read', async () => {
  const newest = { notification_reference: 'latest_notification', title: 'Senaste', is_read: true }
  const older = { notification_reference: 'older_notification', title: 'Äldre', is_read: false }
  state.notifications = [newest, older]
  const alreadyRead = renderToStaticMarkup(await Dashboard())
  assert.match(alreadyRead, /Senaste/)
  assert.doesNotMatch(alreadyRead, /Äldre|Markera som läst/)
  newest.is_read = false
  const unread = renderToStaticMarkup(await Dashboard())
  assert.match(unread, /Senaste/)
  assert.match(unread, /Markera som läst/)
})

test('reading an OPS notification confirms only the authoritative store', async () => {
  const calls = []
  state.readNotifications = async (identity, request) => { calls.push({ identity, request }) }
  state.queue = () => { throw Error('Unexpected local service query') }
  const result = await markCustomerNotificationsRead({
    notificationIds: ['notification_abcdefghijklmnopqrstuvwx'], operationId: 'read-operation-test',
  })
  assert.deepEqual(result, { ok: true, opsSynced: true, localSynced: false, queued: false })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].identity.userId, state.user.id)
  assert.deepEqual(calls[0].request, {
    notificationIds: ['notification_abcdefghijklmnopqrstuvwx'], operationId: 'read-operation-test',
  })
})
