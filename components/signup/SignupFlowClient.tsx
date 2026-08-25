"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import ElectricityCalculator from "@/components/ElectricityCalculator";
import type { SignupSubmissionState } from "@/components/signup/CustomerApplicationForm";
import {
  buildPublicContractDisplay,
  type PublicContractDisplay,
} from "@/lib/website/publicContractDisplay";
import {
  contractSupportsCustomerType,
  type WebsiteCustomerType,
} from "@/lib/website/customerType";
import {
  signupContractOptionAsOpsContract,
  type SignupContractOption,
} from "@/lib/website/signupContractOption";
import type {
  WebsiteEnergyResolution,
  WebsitePricingPreview,
  WebsitePricingQuoteContext,
} from "@/lib/website/publicApi";

const CustomerApplicationForm = dynamic(
  () => import("@/components/signup/CustomerApplicationForm"),
  {
    loading: () => (
      <div
        className="min-h-40 rounded-2xl border border-white/10 bg-white/[0.02]"
        aria-hidden="true"
      />
    ),
  },
);

type Props = {
  contracts: SignupContractOption[];
  initialSelectedValue: string;
  initialCustomerType?: WebsiteCustomerType;
  authenticatedEmail?: string | null;
  authenticationRequired?: boolean;
  authenticationReturnPath?: string;
  canSubmit: boolean;
  utm: { utm_source?: string; utm_medium?: string; utm_campaign?: string };
  action: (state: SignupSubmissionState, formData: FormData) => Promise<SignupSubmissionState>;
  initialPricingPreview?: WebsitePricingPreview | null;
  initialQuoteContext?: WebsitePricingQuoteContext | null;
};

export default function SignupFlowClient({
  contracts,
  initialSelectedValue,
  initialCustomerType = "private",
  authenticatedEmail,
  authenticationRequired = false,
  authenticationReturnPath = '/teckna-avtal',
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
  const [quoteContext, setQuoteContext] = useState<WebsitePricingQuoteContext | null>(initialQuoteContext);
  const [lastQuoteContext, setLastQuoteContext] = useState<WebsitePricingQuoteContext | null>(initialQuoteContext);
  const [calculatorResetSignal, setCalculatorResetSignal] = useState(0);

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.value === selectedValue) ?? null,
    [contracts, selectedValue],
  );
  const contractDisplay: PublicContractDisplay | null = useMemo(
    () => selectedContract ? buildPublicContractDisplay(signupContractOptionAsOpsContract(selectedContract)) : null,
    [selectedContract],
  );
  const applicationPricingPreview = useMemo(() => {
    const source = pricingPreview ?? lastPricingPreview;
    if (!source) return null;

    // `is_binding` verifies the canonical checkout quote. It must not be shown as
    // a promise that a variable/spot market price is frozen for future invoices.
    // Keep the exact canonical preview when the form serializes its audit snapshot.
    const displayPreview = { ...source, is_binding: undefined };
    Object.defineProperty(displayPreview, 'toJSON', {
      value: () => source,
      enumerable: false,
    });
    return displayPreview;
  }, [lastPricingPreview, pricingPreview]);

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
        onQuoteContextChange={updateQuoteContext}
        initialPricingPreview={initialPricingPreview}
        initialQuoteContext={initialQuoteContext}
        onContinue={pricingPreview && quoteContext ? continueToDetails : undefined}
        resetSignal={calculatorResetSignal}
      />

      {lastPricingPreview && lastQuoteContext && selectedContract ? (
        <section id="teckna-kunduppgifter" className="scroll-mt-24 rounded-3xl border border-white/10 bg-gray-950 p-6 md:p-10">
          <div className="mb-8 max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Prisindikation klar</div>
            <h2 className="mt-3 text-2xl font-bold text-white md:text-3xl">Slutför teckningen</h2>
            <p className="mt-3 text-gray-400">Fyll i kunduppgifterna, granska de publicerade dokumenten och teckna.</p>
          </div>
          <CustomerApplicationForm
            key={`${customerType}:${selectedValue}:${(quoteContext ?? lastQuoteContext).quote_attempt_id}`}
            contracts={contracts}
            selectedValue={selectedValue}
            customerType={customerType}
            authenticatedEmail={authenticatedEmail}
            authenticationRequired={authenticationRequired}
            authenticationReturnPath={authenticationReturnPath}
            canSubmit={canSubmit}
            utm={utm}
            action={action}
            energyResolution={energyResolution}
            pricingPreview={applicationPricingPreview}
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
