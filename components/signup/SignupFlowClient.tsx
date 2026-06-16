'use client'

import { useMemo, useState } from 'react'
import ElectricityCalculator from '@/components/ElectricityCalculator'
import CustomerApplicationForm, { type SignupContractOption } from '@/components/signup/CustomerApplicationForm'
import { buildPublicContractDisplay, type PublicContractDisplay } from '@/lib/website/publicContractDisplay'
import type { WebsiteEnergyResolution, WebsitePricingPreview } from '@/lib/website/publicApi'

type UTMParams = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

type Props = {
  contracts: SignupContractOption[]
  initialSelectedValue: string
  canSubmit: boolean
  utm: UTMParams
  action: (formData: FormData) => void | Promise<void>
}

function optionAsOpsContract(contract: SignupContractOption) {
  return {
    offer_reference: contract.offerReference,
    contract_id: contract.contractId ?? null,
    price_plan_id: contract.pricePlanId,
    price_plan_version_id: contract.pricePlanVersionId,
    product_code: contract.productCode,
    name: contract.name,
    type: contract.type,
    monthly_fee_sek: contract.monthlyFeeSek ?? null,
    invoice_fee_sek: contract.invoiceFeeSek ?? null,
    markup_ore_per_kwh: contract.markupOrePerKwh ?? null,
    variable_markup_ore_per_kwh: contract.variableMarkupOrePerKwh ?? null,
    fixed_price_ore_per_kwh: contract.fixedPriceOrePerKwh ?? null,
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
    is_public: true,
    is_active: true,
  }
}

export default function SignupFlowClient({ contracts, initialSelectedValue, canSubmit, utm, action }: Props) {
  const initialValue = contracts.some((contract) => contract.value === initialSelectedValue)
    ? initialSelectedValue
    : (contracts[0]?.value ?? '')

  const [selectedValue, setSelectedValue] = useState(initialValue)
  const [pricingPreview, setPricingPreview] = useState<WebsitePricingPreview | null>(null)
  const [energyResolution, setEnergyResolution] = useState<WebsiteEnergyResolution | null>(null)
  const [estimatedMonthlyKwh, setEstimatedMonthlyKwh] = useState(2000)

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.value === selectedValue) ?? null,
    [contracts, selectedValue],
  )

  const contractDisplay: PublicContractDisplay | null = useMemo(
    () => (selectedContract ? buildPublicContractDisplay(optionAsOpsContract(selectedContract)) : null),
    [selectedContract],
  )

  function updateSelectedValue(value: string) {
    setSelectedValue(value)
    setPricingPreview(null)
  }

  return (
    <div className="space-y-14">
      <ElectricityCalculator
        contracts={contracts}
        selectedValue={selectedValue}
        onSelectedValueChange={updateSelectedValue}
        onPricingPreviewChange={setPricingPreview}
        onEnergyResolutionChange={setEnergyResolution}
        onEstimatedMonthlyKwhChange={setEstimatedMonthlyKwh}
      />

      <section className="rounded-3xl border border-white/10 bg-gray-950 p-8 md:p-10">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-bold text-white md:text-3xl">Starta din ansökan</h2>
          <p className="mt-3 text-gray-400">Uppgifterna används för att behandla ansökan, verifiera anläggningen och återkomma med nästa steg. Du kan granska allt innan något skickas.</p>
        </div>

        <CustomerApplicationForm
          contracts={contracts}
          selectedValue={selectedValue}
          onSelectedValueChange={updateSelectedValue}
          canSubmit={canSubmit}
          utm={utm}
          action={action}
          energyResolution={energyResolution}
          pricingPreview={pricingPreview}
          estimatedMonthlyKwh={estimatedMonthlyKwh}
          contractDisplay={contractDisplay}
        />
      </section>
    </div>
  )
}
