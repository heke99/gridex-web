"use client";

import { useCallback, useMemo, useState } from "react";
import ElectricityCalculator from "@/components/ElectricityCalculator";
import CustomerApplicationForm, {
  type SignupContractOption,
  type SignupSubmissionState,
} from "@/components/signup/CustomerApplicationForm";
import {
  buildPublicContractDisplay,
  type PublicContractDisplay,
} from "@/lib/website/publicContractDisplay";
import {
  contractSupportsCustomerType,
  type WebsiteCustomerType,
} from "@/lib/website/customerType";
import type { OpsPublicContract } from "@/lib/ops/client";
import type {
  WebsiteEnergyResolution,
  WebsitePricingPreview,
  WebsitePricingQuoteContext,
} from "@/lib/website/publicApi";

type Props = {
  contracts: SignupContractOption[];
  initialSelectedValue: string;
  initialCustomerType?: WebsiteCustomerType;
  authenticatedEmail?: string | null;
  canSubmit: boolean;
  utm: { utm_source?: string; utm_medium?: string; utm_campaign?: string };
  action: (state: SignupSubmissionState, formData: FormData) => Promise<SignupSubmissionState>;
  initialPricingPreview?: WebsitePricingPreview | null;
  initialQuoteContext?: WebsitePricingQuoteContext | null;
};

function optionAsOpsContract(contract: SignupContractOption): OpsPublicContract {
  return {
    offer_reference: contract.offerReference,
    product_code: contract.productCode ?? null,
    name: contract.name,
    type: contract.type,
    energy_direction: contract.energyDirection,
    production_pricing: contract.productionPricing,
    monthly_fee_sek: contract.monthlyFeeSek ?? null,
    invoice_fee_sek: contract.invoiceFeeSek ?? null,
    markup_ore_per_kwh: contract.markupOrePerKwh ?? null,
    variable_markup_ore_per_kwh: contract.variableMarkupOrePerKwh ?? null,
    fixed_price_ore_per_kwh: contract.fixedPriceOrePerKwh ?? null,
    monthly_fixed_price_sek: contract.monthlyFixedPriceSek ?? null,
    elcert_ore_per_kwh: contract.elcertOrePerKwh ?? null,
    portfolio_price_ore_per_kwh: null,
    vat_rate: contract.vatRate ?? null,
    pricing_model: contract.pricingModel ?? null,
    spot_share: contract.spotShare ?? null,
    portfolio_share: contract.portfolioShare ?? null,
    pricing_visibility: contract.pricingVisibility ?? {},
    pricing_components: contract.pricingComponents ?? [],
    valid_from: contract.validFrom ?? null,
    valid_to: contract.validTo ?? null,
    binding_period_months: contract.bindingPeriodMonths ?? null,
    notice_period_days: contract.noticePeriodDays ?? null,
    notice_period_months: contract.noticePeriodMonths ?? null,
    automatic_renewal: contract.automaticRenewal ?? null,
    included: contract.included ?? null,
    excluded: contract.excluded ?? null,
    start_info: contract.startInfo ?? null,
    customer_types: contract.customerTypes ?? null,
    terms_version: contract.termsVersion ?? null,
    terms_version_id: contract.termsVersionId ?? null,
    terms_url: contract.termsUrl ?? null,
    privacy_policy_version: contract.privacyPolicyVersion ?? null,
    privacy_policy_version_id: contract.privacyPolicyVersionId ?? null,
    privacy_policy_url: contract.privacyPolicyUrl ?? null,
    cancellation_right_version: contract.cancellationRightVersion ?? null,
    withdrawal_version_id: contract.withdrawalVersionId ?? null,
    withdrawal_url: contract.withdrawalUrl ?? null,
    power_of_attorney_version: contract.powerOfAttorneyVersion ?? null,
    power_of_attorney_version_id: contract.powerOfAttorneyVersionId ?? null,
    power_of_attorney_url: contract.powerOfAttorneyUrl ?? null,
    power_of_attorney_required: contract.powerOfAttorneyRequired ?? false,
    price_terms_version: contract.priceTermsVersion ?? null,
    price_terms_version_id: contract.priceTermsVersionId ?? null,
    price_terms_url: contract.priceTermsUrl ?? null,
  };
}

export default function SignupFlowClient({
  contracts,
  initialSelectedValue,
  initialCustomerType = "private",
  authenticatedEmail,
  canSubmit,
  utm,
  action,
  initialPricingPreview = null,
  initialQuoteContext = null,
}: Props) {
  const [customerType, setCustomerType] = useState<WebsiteCustomerType>(initialCustomerType);
  const initialValue = contracts.some((contract) => contract.value === initialSelectedValue)
    ? initialSelectedValue
    : "";
  const [selectedValue, setSelectedValue] = useState(initialValue);
  const [pricingPreview, setPricingPreview] = useState<WebsitePricingPreview | null>(initialPricingPreview);
  const [lastPricingPreview, setLastPricingPreview] = useState<WebsitePricingPreview | null>(initialPricingPreview);
  const [energyResolution, setEnergyResolution] = useState<WebsiteEnergyResolution | null>(
    initialQuoteContext
      ? { status: 'restored_verified_quote', price_area_code: initialQuoteContext.price_area_code, confidence: 1, source: 'server_checkout_context' }
      : null,
  );
  const [estimatedMonthlyKwh, setEstimatedMonthlyKwh] = useState<number | null>(
    initialQuoteContext?.estimated_monthly_kwh ?? initialPricingPreview?.kwh ?? null,
  );
  const [quoteContext, setQuoteContext] = useState<WebsitePricingQuoteContext | null>(initialQuoteContext);
  const [lastQuoteContext, setLastQuoteContext] = useState<WebsitePricingQuoteContext | null>(initialQuoteContext);
  const [calculatorResetSignal, setCalculatorResetSignal] = useState(0);

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.value === selectedValue) ?? null,
    [contracts, selectedValue],
  );
  const contractDisplay: PublicContractDisplay | null = useMemo(
    () => selectedContract ? buildPublicContractDisplay(optionAsOpsContract(selectedContract)) : null,
    [selectedContract],
  );

  function updateCustomerType(value: WebsiteCustomerType) {
    setCustomerType(value);
    const stillSupported = contracts.some(
      (contract) => contract.value === selectedValue && contractSupportsCustomerType(contract.customerTypes, value),
    );
    if (!stillSupported) {
      const next = contracts.find((contract) => contractSupportsCustomerType(contract.customerTypes, value));
      setSelectedValue(next?.value ?? "");
    }
    setPricingPreview(null);
    setQuoteContext(null);
    setLastPricingPreview(null);
    setLastQuoteContext(null);
  }

  function updateSelectedValue(value: string) {
    setSelectedValue(value);
    setPricingPreview(null);
    setQuoteContext(null);
    setLastPricingPreview(null);
    setLastQuoteContext(null);
  }

  const editQuote = useCallback(() => {
    setPricingPreview(null);
    setQuoteContext(null);
    setCalculatorResetSignal((value) => value + 1);
    document.getElementById('rakna-elpris')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  function updatePricingPreview(value: WebsitePricingPreview | null) {
    setPricingPreview(value);
    if (value) setLastPricingPreview(value);
  }

  function updateQuoteContext(value: WebsitePricingQuoteContext | null) {
    setQuoteContext(value);
    if (value) setLastQuoteContext(value);
  }

  function continueToDetails() {
    document.getElementById('teckna-kunduppgifter')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="space-y-10">
      <ElectricityCalculator
        contracts={contracts}
        selectedValue={selectedValue}
        onSelectedValueChange={updateSelectedValue}
        customerType={customerType}
        onCustomerTypeChange={updateCustomerType}
        showCustomerTypeSelector
        onPricingPreviewChange={updatePricingPreview}
        onEnergyResolutionChange={setEnergyResolution}
        onEstimatedMonthlyKwhChange={setEstimatedMonthlyKwh}
        onQuoteContextChange={updateQuoteContext}
        initialPricingPreview={initialPricingPreview}
        initialQuoteContext={initialQuoteContext}
        onContinue={pricingPreview && quoteContext ? continueToDetails : undefined}
        resetSignal={calculatorResetSignal}
      />

      {lastPricingPreview && lastQuoteContext && selectedContract ? (
        <section id="teckna-kunduppgifter" className="scroll-mt-24 rounded-3xl border border-white/10 bg-gray-950 p-6 md:p-10">
          <div className="mb-8 max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Pris verifierat</div>
            <h2 className="mt-3 text-2xl font-bold text-white md:text-3xl">Slutför teckningen</h2>
            <p className="mt-3 text-gray-400">Fyll i kunduppgifterna, granska de publicerade dokumenten och teckna.</p>
          </div>
          <CustomerApplicationForm
            key={`${customerType}:${selectedValue}`}
            contracts={contracts}
            selectedValue={selectedValue}
            customerType={customerType}
            authenticatedEmail={authenticatedEmail}
            canSubmit={canSubmit}
            utm={utm}
            action={action}
            energyResolution={energyResolution}
            pricingPreview={pricingPreview ?? lastPricingPreview}
            estimatedMonthlyKwh={estimatedMonthlyKwh}
            contractDisplay={contractDisplay}
            quoteContext={quoteContext ?? lastQuoteContext}
            quoteValid={Boolean(pricingPreview && quoteContext)}
            onEditQuote={editQuote}
          />
        </section>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-400">
          Börja med kundtyp, adress, energimängd och avtal ovan. Kunduppgifterna öppnas först när priset är verifierat.
        </div>
      )}
    </div>
  );
}
