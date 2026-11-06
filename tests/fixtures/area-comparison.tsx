'use client'
import { useState } from 'react'
import ElectricityCalculator, { type ContractOption } from '@/components/ElectricityCalculator'
import type { WebsitePricingPreview, WebsitePricingQuoteContext, WebsiteEnergyResolution } from '@/lib/website/publicApi'

const contracts: ContractOption[] = [
  { name: 'Syntetiskt fastpris', value: 'offer_area_fixed', offerReference: 'offer_area_fixed', type: 'fixed', customerTypes: ['private', 'business'] },
  { name: 'Syntetiskt månadspris', value: 'offer_area_variable', offerReference: 'offer_area_variable', type: 'variable_monthly', customerTypes: ['private', 'business'] },
]
const originalContext: WebsitePricingQuoteContext = {
  postal_code: '11122', city: 'Teststad', address: 'Återställd gata 1', price_area_code: 'SE3',
  resolution_id: 'resolution_original', resolution_token: 'synthetic-original-area-token',
  estimated_monthly_kwh: 100, annual_consumption_kwh: 1200,
  consumption_profile: { version: 1, source: 'customer_entered', annual_kwh: 1200, monthly_kwh: 100 },
  price_option_reference: 'option_area', invoice_delivery_method: 'e_invoice', selected_component_references: [],
  site_count: 1, requested_start_mode: 'earliest_possible', requested_start_date: null,
  quote_attempt_id: '11111111-1111-4111-8111-111111111111',
}
const originalPreview: WebsitePricingPreview = {
  contract: { name: contracts[0].name, slug: contracts[0].value, offer_reference: contracts[0].offerReference, contractType: 'fixed' },
  resolution_id: originalContext.resolution_id!, energy_direction: 'consumption', production_pricing: null,
  start_date: '2026-12-01', requested_start_mode: 'earliest_possible', customer_type: 'private',
  priceArea: 'SE3', price_area_code: 'SE3', kwh: 100, pricePerKwhOre: 100, totalMonthlyCostSek: 149,
  totalMonthlyCostInclVatSek: 186.25, valid_until: '2026-10-01T00:00:00Z',
  price_option_reference: 'option_area', area_price_reference: 'area_price_original', invoice_delivery_method: 'e_invoice',
  selected_component_references: [], site_count: 1, pricing_token: 'synthetic-original-price-token',
  settlement: { model: 'fixed_price', customer_accepts: 'fixed_energy_price', energy_price_locked_at_signup: true,
    uses_actual_metered_consumption: true, market_data_role: 'not_applicable', settlement_resolution: 'fixed' },
}

function Fixture({ restored = false }: { restored?: boolean }) {
  const [result, setResult] = useState<WebsitePricingPreview | null>(restored ? originalPreview : null)
  const [resolution, setResolution] = useState<WebsiteEnergyResolution | null>(null)
  const [context, setContext] = useState<WebsitePricingQuoteContext | null>(restored ? originalContext : null)
  return <>
    <ElectricityCalculator contracts={contracts} showCustomerTypeSelector persistCheckoutContext
      initialPricingPreview={restored ? originalPreview : null} initialQuoteContext={restored ? originalContext : null}
      onPricingPreviewChange={setResult} onEnergyResolutionChange={setResolution} onQuoteContextChange={setContext} />
    <pre hidden data-testid="area-fixture-state">{JSON.stringify({ result, resolution, context })}</pre>
  </>
}
export default function AreaComparison() { return <Fixture /> }
export function RestoredComparison() { return <Fixture restored /> }
