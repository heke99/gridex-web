import assert from 'node:assert/strict'
import { signupContractOptionAsOpsContract } from '../lib/website/signupContractOption.ts'

const option = {
  name: 'Canonical fixed contract',
  value: 'offer_signup_adapter',
  offerReference: 'offer_signup_adapter',
  channel: 'website',
  customerType: 'both',
  productCode: 'FIXED-12',
  type: 'fixed',
  energyDirection: 'consumption',
  productionPricing: null,
  portfolioPriceOrePerKwh: 91.25,
  priceOptions: [
    {
      price_option_reference: 'price_option_signup_adapter',
      option_code: 'standard',
      customer_name: 'Standard',
      contract_type: 'fixed',
      customer_type: 'both',
      binding_months: 12,
      notice_months: 1,
      auto_renew_enabled: false,
      renewal_term_months: null,
      default: true,
      selection_required: false,
      valid_from: null,
      valid_to: null,
      earliest_start_date: null,
      latest_start_date: null,
      area_prices: [
        {
          area_price_reference: 'area_price_signup_adapter_se3',
          price_area: 'SE3',
          energy_price_ore_per_kwh: 100,
          unit: 'ore_per_kwh',
          valid_from: null,
          valid_to: null,
        },
      ],
    },
  ],
  legalRequirements: [
    {
      requirement_code: 'terms',
      acceptance_required: true,
      document_version_id: 'terms_v1',
    },
  ],
}

const restored = signupContractOptionAsOpsContract(option)

assert.equal(restored.offer_reference, option.offerReference)
assert.equal(restored.channel, 'website')
assert.equal(restored.customer_type, 'both')
assert.equal(restored.portfolio_price_ore_per_kwh, 91.25)
assert.equal(restored.price_options[0]?.price_option_reference, 'price_option_signup_adapter')
assert.equal(restored.legal_requirements?.[0]?.requirement_code, 'terms')

console.log('signup contract option canonical adapter tests passed')
