import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import MinaSidor from '../app/mina-sidor/page.tsx'
import Dashboard from '../app/dashboard/page.tsx'
import Contracts from '../app/dashboard/contracts/page.tsx'
import ContractPricing from '../components/customer/ContractPricing.tsx'
import OverviewCards from '../components/dashboard/OverviewCards.tsx'
import { getCustomerPortalOverview } from '../lib/customerPortal/service.ts'

let state
beforeEach(() => {
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'customer@example.invalid', email_confirmed_at: '2026-10-20T10:00:00Z', user_metadata: {} }
  state = {
    user,
    contract: { contract_reference: 'contract_synthetic_customer', contract_name: 'Syntetiskt kundavtal', contract_number: 'TEST-001', contract_type: 'fixed', status: 'signed', start_date: '2026-11-01', monthly_fee_sek: 49, invoice_fee_sek: 0, fixed_price_ore_per_kwh: 86.25, markup_ore_per_kwh: 0, price_area: 'SE2', energy_direction: 'consumption' },
    invoices: [], noContract: false, unavailable: false, identities: [],
    client: { auth: { getUser: async () => ({ data: { user: state.user } }) }, from: () => ({ select() { return this }, eq() { return this }, order() { return this }, limit() { return this }, maybeSingle: async () => ({ data: null }) }) },
    bundle: async identity => {
      state.identities.push(identity)
      if (state.unavailable) throw Error('Synthetic OPS outage')
      return { profile: { display_name: 'Syntetisk kund', customer_number: state.noContract ? null : 'KTEST001' }, contracts: state.noContract ? [] : [state.contract], sites: [], invoices: state.invoices, documents: [], legalAcceptances: [], powersOfAttorney: [], customerStatus: null, dataQuality: null, switchStatus: null, meteringValues: [], events: [], notifications: [] }
    },
    support: async identity => { state.identities.push(identity); return { data: [] } },
  }
  globalThis.__customerJourney = state
})

for (const [name, page] of [['Mina sidor', MinaSidor], ['Översikt', Dashboard], ['Mina avtal', Contracts]]) {
  test(`${name}: actual OPS mapping reaches the page with original prices, zero fees and area`, async () => {
    const html = renderToStaticMarkup(await page())
    for (const value of ['Dina avtalspriser', '86,25', 'öre/kWh', '49 kr/mån', '0 kr/faktura', 'SE2']) assert.ok(html.includes(value), value)
    assert.ok(state.identities.every(identity => identity.userId === state.user.id))
    assert.equal(state.identities.length, 2)
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
  const html = renderToStaticMarkup(await MinaSidor())
  for (const href of ['/teckna-avtal', '/aktivera-kundkonto', '/dashboard/privacy', '/dashboard/support']) assert.ok(html.includes(`href="${href}"`), href)
  assert.match(html, /href="\/dashboard\/privacy"[^>]*>[\s\S]*?Begär datautdrag/)
  assert.equal(html.includes('Dina avtalspriser'), false)
})

test('malformed OPS dates cannot crash either portal entry, and timestamps use Swedish calendar days', async () => {
  state.contract.start_date = 'not-a-date'
  state.invoices = [{ invoice_reference: 'invoice_synthetic', status: 'issued', issued_at: 'not-a-date' }]
  assert.ok(renderToStaticMarkup(await MinaSidor()).includes('Mina sidor'))
  const overview = await getCustomerPortalOverview()
  assert.ok(renderToStaticMarkup(OverviewCards({ overview })).includes('Senaste fakturadatum: —'))
  state.invoices[0].issued_at = '2026-10-20T22:30:00Z'
  const fresh = await getCustomerPortalOverview()
  assert.ok(renderToStaticMarkup(OverviewCards({ overview: fresh })).includes('2026-10-21'))
})

test('expired session and unavailable OPS never become a successful empty customer portal', async () => {
  state.unavailable = true
  await assert.rejects(MinaSidor(), /Synthetic OPS outage/)
  state.user = null
  await assert.rejects(MinaSidor(), /REDIRECT:\/login/)
})
