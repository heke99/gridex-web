'use client'

import { useMemo, useState } from 'react'
import ElectricityCalculator from '@/components/ElectricityCalculator'
import CustomerApplicationForm, { type SignupContractOption, type SignupSubmissionState } from '@/components/signup/CustomerApplicationForm'
import { buildPublicContractDisplay, type PublicContractDisplay } from '@/lib/website/publicContractDisplay'
import { validateWebsitePricingQuote, type WebsiteEnergyResolution, type WebsitePricingPreview, type WebsitePricingQuoteContext } from '@/lib/website/publicApi'

type UTMParams = { utm_source?: string; utm_medium?: string; utm_campaign?: string }
type Props = { contracts: SignupContractOption[]; initialSelectedValue: string; canSubmit: boolean; utm: UTMParams; action: (state: SignupSubmissionState, formData: FormData) => Promise<SignupSubmissionState>; initialPricingPreview?: WebsitePricingPreview | null }

function optionAsOpsContract(contract: SignupContractOption) {
  return {
    offer_reference: contract.offerReference,
    product_code: contract.productCode ?? null,
    name: contract.name,
    type: contract.type,
    monthly_fee_sek: contract.monthlyFeeSek ?? null,
    invoice_fee_sek: contract.invoiceFeeSek ?? null,
    markup_ore_per_kwh: contract.markupOrePerKwh ?? null,
    variable_markup_ore_per_kwh: contract.variableMarkupOrePerKwh ?? null,
    fixed_price_ore_per_kwh: contract.fixedPriceOrePerKwh ?? null,
    monthly_fixed_price_sek: contract.monthlyFixedPriceSek ?? null,
    elcert_ore_per_kwh: contract.elcertOrePerKwh ?? null,
    portfolio_price_ore_per_kwh: contract.portfolioPriceOrePerKwh ?? null,
    vat_rate: contract.vatRate ?? null,
    pricing_model: contract.pricingModel ?? null,
    spot_share: contract.spotShare ?? null,
    portfolio_share: contract.portfolioShare ?? null,
    valid_from: contract.validFrom ?? null,
    valid_to: contract.validTo ?? null,
    binding_period_months: contract.bindingPeriodMonths ?? null,
    notice_period_days: contract.noticePeriodDays ?? null,
    included: contract.included ?? null,
    excluded: contract.excluded ?? null,
    start_info: contract.startInfo ?? null,
    customer_types: contract.customerTypes ?? null,
    terms_version: contract.termsVersion ?? null,
    privacy_policy_version: contract.privacyPolicyVersion ?? null,
    cancellation_right_version: contract.cancellationRightVersion ?? null,
    power_of_attorney_version: contract.powerOfAttorneyVersion ?? null,
    power_of_attorney_required: contract.powerOfAttorneyRequired ?? false,
    price_terms_version: contract.priceTermsVersion ?? null,
  }
}

export default function SignupFlowClient({ contracts, initialSelectedValue, canSubmit, utm, action, initialPricingPreview = null }: Props) {
  const initialValue = contracts.some((contract) => contract.value === initialSelectedValue) ? initialSelectedValue : ''
  const [selectedValue, setSelectedValue] = useState(initialValue)
  const [pricingPreview, setPricingPreview] = useState<WebsitePricingPreview | null>(initialPricingPreview)
  const [energyResolution, setEnergyResolution] = useState<WebsiteEnergyResolution | null>(null)
  const [estimatedMonthlyKwh, setEstimatedMonthlyKwh] = useState<number | null>(initialPricingPreview?.kwh ?? null)
  const [quoteContext, setQuoteContext] = useState<WebsitePricingQuoteContext | null>(null)

  const selectedContract = useMemo(() => contracts.find((contract) => contract.value === selectedValue) ?? null, [contracts, selectedValue])
  const contractDisplay: PublicContractDisplay | null = useMemo(() => selectedContract ? buildPublicContractDisplay(optionAsOpsContract(selectedContract)) : null, [selectedContract])

  function updateSelectedValue(value: string) {
    setSelectedValue(value)
    setPricingPreview(null)
  }

  return <div className="space-y-14">
    <ElectricityCalculator contracts={contracts} selectedValue={selectedValue} onSelectedValueChange={updateSelectedValue} onPricingPreviewChange={setPricingPreview} onEnergyResolutionChange={setEnergyResolution} onEstimatedMonthlyKwhChange={setEstimatedMonthlyKwh} onQuoteContextChange={setQuoteContext} initialPricingPreview={initialPricingPreview} />
    <section className="rounded-3xl border border-white/10 bg-gray-950 p-8 md:p-10">
      <div className="mb-8 max-w-2xl"><h2 className="text-2xl font-bold text-white md:text-3xl">Teckna ditt elavtal</h2><p className="mt-3 text-gray-400">Prisberäkningen måste stämma med din slutliga adress och förbrukning. Du kan granska allt innan du tecknar.</p></div>
      <CustomerApplicationForm contracts={contracts} selectedValue={selectedValue} onSelectedValueChange={updateSelectedValue} canSubmit={canSubmit} utm={utm} action={action} energyResolution={energyResolution} pricingPreview={pricingPreview} estimatedMonthlyKwh={estimatedMonthlyKwh} contractDisplay={contractDisplay} quoteContext={quoteContext} validatePricingQuote={async (input) => validateWebsitePricingQuote({ quote_token: input.quoteToken, quote_source: input.quoteSource, offer_reference: input.offerReference, price_area_code: input.priceAreaCode as 'SE1' | 'SE2' | 'SE3' | 'SE4', estimated_monthly_kwh: input.estimatedMonthlyKwh, postal_code: input.postalCode, city: input.city, address: input.address })} />
    </section>
  </div>
}
