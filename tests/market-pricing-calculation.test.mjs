import assert from 'node:assert/strict'
import { buildLocalWebsitePricingPreview } from '../lib/website/localPricingPreview.ts'

const originalFetch = globalThis.fetch

function quarterEntries(values, date) {
  return Array.from({ length: 96 }, (_, index) => {
    const value = values[index % values.length]
    const startMinute = index * 15
    const endMinute = startMinute + 15
    const iso = (minutes) => {
      const hour = Math.floor(minutes / 60)
      const minute = minutes % 60
      return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+02:00`
    }
    return {
      SEK_per_kWh: value,
      time_start: iso(startMinute),
      time_end: iso(endMinute),
    }
  })
}

function contract(overrides = {}) {
  return {
    offer_reference: 'OFFER-1',
    name: 'Gridex avtal',
    type: 'variable_spot',
    markup_ore_per_kwh: 5,
    variable_markup_ore_per_kwh: 1,
    elcert_ore_per_kwh: 2,
    monthly_fee_sek: 49,
    invoice_fee_sek: 0,
    vat_rate: 0.25,
    ...overrides,
  }
}

try {
  let fetchCalls = 0
  globalThis.fetch = async (url) => {
    fetchCalls += 1
    const value = String(url)
    const date = value.match(/\/(\d{2}-\d{2})_SE3\.json$/)?.[1]
    const data = date === '07-01'
      ? quarterEntries([1, 1, 1, 1], '2026-07-01')
      : date === '07-02'
        ? quarterEntries([0, 0, 0, 0], '2026-07-02')
        : date === '07-20'
          ? quarterEntries([1, 2, -1, 0], '2026-07-20')
          : []
    return {
      status: data.length ? 200 : 404,
      ok: Boolean(data.length),
      async json() { return data },
    }
  }

  const monthly = await buildLocalWebsitePricingPreview({
    contract: contract({ name: 'Rörligt månadspris' }),
    priceAreaCode: 'SE3',
    estimatedMonthlyKwh: 100,
    now: new Date('2026-07-02T10:00:00+02:00'),
  })
  assert.equal(monthly.contract.contractType, 'spot_monthly')
  assert.equal(monthly.pricePerKwhOre, 58)
  assert.equal(monthly.totalMonthlyCostSek, 107)
  assert.equal(monthly.totalMonthlyCostInclVatSek, 133.75)
  assert.equal(monthly.specification?.basis?.type, 'elprisetjustnu_spot')
  assert.equal(monthly.specification?.basis?.pricingModel, 'monthly')
  assert.equal(monthly.raw?.source, 'elprisetjustnu_api')

  const componentOnlyMonthly = await buildLocalWebsitePricingPreview({
    contract: contract({
      name: 'Komponentbaserat månadspris',
      markup_ore_per_kwh: null,
      variable_markup_ore_per_kwh: null,
      elcert_ore_per_kwh: null,
      monthly_fee_sek: null,
      invoice_fee_sek: null,
      pricing_components: [
        { component_code: 'supplier_markup', name: 'Påslag', amount: 5, unit: 'ore_per_kwh', website_card_visible: true, calculation_base: 'energy' },
        { component_code: 'variable_fee', name: 'Rörlig avgift', amount: 1, unit: 'ore_per_kwh', website_card_visible: true, calculation_base: 'energy' },
        { component_code: 'electricity_certificate', name: 'Elcertifikat', amount: 2, unit: 'ore_per_kwh', website_card_visible: true, calculation_base: 'energy' },
        { component_code: 'monthly_fee', name: 'Månadsavgift', amount: 49, unit: 'month', website_card_visible: true, calculation_base: null },
        { component_code: 'paper_invoice_fee', name: 'Fakturaavgift', amount: 0, unit: 'invoice', website_card_visible: true, calculation_base: null },
      ],
    }),
    priceAreaCode: 'SE3',
    estimatedMonthlyKwh: 100,
    now: new Date('2026-07-02T10:00:00+02:00'),
  })
  assert.equal(componentOnlyMonthly.totalMonthlyCostSek, 107)
  assert.equal(componentOnlyMonthly.specification?.fees?.markupOre, 5)
  assert.equal(componentOnlyMonthly.specification?.fees?.monthlyFeeSek, 49)
  assert.equal(componentOnlyMonthly.specification?.fees?.invoiceFeeSek, 0)

  const synonymMonthly = await buildLocalWebsitePricingPreview({
    contract: contract({
      name: 'Synonymbaserat månadspris',
      markup_ore_per_kwh: null,
      monthly_fee_sek: null,
      invoice_fee_sek: null,
      pricing_components: [
        { component_code: 'charge_markup', name: 'Elhandelspåslag', amount: 5, unit: 'öre/kWh', website_card_visible: true, calculation_base: 'energy' },
        { component_code: 'charge_month', name: 'Fast avgift', amount: 49, unit: 'SEK/månad', website_card_visible: true, calculation_base: null },
        { component_code: 'charge_invoice', name: 'Faktureringsavgift', amount: 19, unit: 'SEK', website_card_visible: true, calculation_base: null },
      ],
    }),
    priceAreaCode: 'SE3',
    estimatedMonthlyKwh: 100,
    now: new Date('2026-07-02T10:00:00+02:00'),
  })
  assert.equal(synonymMonthly.specification?.fees?.markupOre, 5)
  assert.equal(synonymMonthly.specification?.fees?.monthlyFeeSek, 49)
  assert.equal(synonymMonthly.specification?.fees?.invoiceFeeSek, 19)
  assert.equal(synonymMonthly.totalMonthlyCostSek, 107)

  const hourly = await buildLocalWebsitePricingPreview({
    contract: contract({ type: 'spot_hourly', name: 'Timpris' }),
    priceAreaCode: 'SE3',
    estimatedMonthlyKwh: 100,
    now: new Date('2026-07-20T10:00:00+02:00'),
  })
  assert.equal(hourly.contract.contractType, 'spot_hourly')
  assert.equal(hourly.pricePerKwhOre, 58)
  assert.equal(hourly.specification?.basis?.pricingModel, 'hourly')
  assert.equal(hourly.specification?.basis?.intervalMinutes, 60)
  assert.equal(hourly.specification?.basis?.samples, 24)
  assert.equal(hourly.specification?.basis?.sourceIntervalMinutes, 15)
  assert.equal(hourly.specification?.basis?.sourceSamples, 96)

  const quarterly = await buildLocalWebsitePricingPreview({
    contract: contract({ type: 'spot_quarterly', name: 'Kvartspris' }),
    priceAreaCode: 'SE3',
    estimatedMonthlyKwh: 100,
    now: new Date('2026-07-20T10:00:00+02:00'),
  })
  assert.equal(quarterly.contract.contractType, 'spot_quarterly')
  assert.equal(quarterly.pricePerKwhOre, 58)
  assert.equal(quarterly.specification?.basis?.pricingModel, 'quarterly')
  assert.equal(quarterly.specification?.basis?.intervalMinutes, 15)
  assert.equal(quarterly.specification?.basis?.samples, 96)
  assert.equal(quarterly.specification?.basis?.sourceIntervalMinutes, 15)
  assert.equal(quarterly.specification?.basis?.sourceSamples, 96)

  const callsBeforeFixed = fetchCalls
  const fixed = await buildLocalWebsitePricingPreview({
    contract: contract({
      type: 'fixed',
      name: 'Fastpris',
      fixed_price_ore_per_kwh: 80,
      markup_ore_per_kwh: 999,
    }),
    priceAreaCode: 'SE3',
    estimatedMonthlyKwh: 100,
    now: new Date('2026-07-20T10:00:00+02:00'),
  })
  assert.equal(fetchCalls, callsBeforeFixed, 'fixed-price calculation must never call Elprisetjustnu')
  assert.equal(fixed.contract.contractType, 'fixed')
  assert.equal(fixed.pricePerKwhOre, 83)
  assert.equal(fixed.totalMonthlyCostSek, 132)
  assert.equal(fixed.totalMonthlyCostInclVatSek, 165)
  assert.equal(fixed.specification?.basis?.type, 'fixed_price')
  assert.equal(fixed.specification?.basis?.fixedPriceOre, 80)
  assert.equal(fixed.raw?.source, 'ops_public_contract')
} finally {
  globalThis.fetch = originalFetch
}

console.log('market pricing calculation tests passed')
