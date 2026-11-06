'use client'

import { useCallback, useState } from 'react'
import CustomerApplicationForm, { type SignupSubmissionState } from '@/components/signup/CustomerApplicationForm'
import { normalizePublicContractApiPayload } from '@/lib/website/publicContractContract'
import type { SignupContractOption } from '@/lib/website/signupContractOption'
import type { WebsitePricingPreview, WebsitePricingQuoteContext } from '@/lib/website/publicApi'
import raw from './public-contracts.ops-2026-10-04.1.json'

const canonical = normalizePublicContractApiPayload(raw.data[0])!
const option: SignupContractOption = {
  name: canonical.name, value: canonical.offer_reference, offerReference: canonical.offer_reference,
  type: canonical.type, channel: canonical.channel, customerType: canonical.customer_type,
  energyDirection: canonical.energy_direction, productionPricing: canonical.production_pricing,
  monthlyFeeSek: canonical.monthly_fee_sek, markupOrePerKwh: canonical.markup_ore_per_kwh,
  priceOptions: canonical.price_options, legal: canonical.legal, pricingComponents: canonical.pricing_components,
}
const quote: WebsitePricingQuoteContext = {
  postal_code: '11122', city: 'Teststad', address: 'Syntetisk gata 1', price_area_code: 'SE3',
  estimated_monthly_kwh: 100, annual_consumption_kwh: 1200,
  price_option_reference: 'canonical_example', invoice_delivery_method: 'e_invoice',
  selected_component_references: [], site_count: 1, requested_start_mode: 'earliest_possible',
  requested_start_date: null, quote_attempt_id: '11111111-1111-4111-8111-111111111111',
  resolution_id: 'resolution_synthetic', resolution_token: 'synthetic-local-area-evidence',
}
const preview: WebsitePricingPreview = {
  contract: { offer_reference: option.offerReference, slug: option.offerReference, name: option.name, contractType: 'spot_monthly' },
  pricing_token: 'synthetic-local-price-evidence', pricing_snapshot_reference: 'snapshot_synthetic',
  priceArea: 'SE3', price_area_code: 'SE3', kwh: 100, totalMonthlyCostInclVatSek: 184.5,
  energy_direction: 'consumption', production_pricing: null,
  resolution_id: 'resolution_synthetic', start_date: '2026-11-01', requested_start_mode: 'earliest_possible',
  customer_type: 'private', pricePerKwhOre: 100, totalMonthlyCostSek: 147.6, valid_until: '2026-11-01T00:00:00Z',
  price_option_reference: quote.price_option_reference, area_price_reference: null,
  invoice_delivery_method: quote.invoice_delivery_method, selected_component_references: [], site_count: 1,
  settlement: { model: 'market_monthly', customer_accepts: 'pricing_model', energy_price_locked_at_signup: false,
    uses_actual_metered_consumption: true, market_data_role: 'indicative_preview_only', settlement_resolution: 'month' },
}

export default function CustomerCheckoutFixture() {
  const [customerType, setCustomerType] = useState<'private' | 'business'>('private')
  const [attempts, setAttempts] = useState<Record<string, FormDataEntryValue>[]>([])
  const [newLegalVersion, setNewLegalVersion] = useState(false)
  const bundleVersion = '00000000-0000-4000-8000-000000000003'
  const selected = newLegalVersion ? { ...option, legal: {
    ...option.legal, legal_bundle_version_id: bundleVersion,
    module_versions: option.legal.module_versions.map(module => ({ ...module, legal_bundle_version_id: bundleVersion })),
    customer_documents: option.legal.customer_documents.map(document => ({ ...document,
      legal_bundle_version_id: bundleVersion, document_version: 'synthetic-revised-version', document_hash: 'd'.repeat(64),
    })),
  } } : option
  const submit = useCallback(async (_state: SignupSubmissionState, data: FormData): Promise<SignupSubmissionState> => {
    setAttempts(previous => [...previous, Object.fromEntries(data.entries())])
    await new Promise(resolve => setTimeout(resolve, 300))
    return { errorMessage: 'Syntetiskt avbrott. Försök igen med samma uppgifter.', step: 1 }
  }, [])
  return <>
    <button onClick={() => setCustomerType('private')}>Prova privatkund</button>
    <button onClick={() => setCustomerType('business')}>Prova företagskund</button>
    <button onClick={() => setNewLegalVersion(true)}>Prova nya villkor</button>
    <CustomerApplicationForm key={customerType} contracts={[selected]} selectedValue={option.value} customerType={customerType}
      canSubmit authenticatedEmail="customer@example.invalid" utm={{}} quoteContext={quote} pricingPreview={{ ...preview, customer_type: customerType }}
      onEditQuote={() => { throw Error('Unexpected quote refresh') }}
      action={submit} />
    <pre data-testid="captured-submissions">{JSON.stringify(attempts)}</pre>
  </>
}
