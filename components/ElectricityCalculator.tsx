"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PriceResultCard from "@/components/PriceResultCard";
import {
  buildCustomerEnteredConsumptionProfile,
  buildEstimatedConsumptionProfile,
  consumptionProfileMatchesMonthlyKwh,
  estimateAnnualConsumptionKwh,
  normalizeWebsiteConsumptionProfile,
  validAnnualConsumptionKwh,
  type WebsiteConsumptionExtra,
  type WebsiteConsumptionProfile,
  type WebsiteHeatingType,
  type WebsiteHousingType,
} from "@/lib/website/consumptionEstimator";
import {
  normalizeWebsitePostalCode,
  previewWebsitePricing,
  resolveWebsiteEnergyArea,
  type WebsiteEnergyResolution,
  type WebsitePriceArea,
  type WebsitePricingPreview,
  type WebsitePricingQuoteContext,
} from "@/lib/website/publicApi";
import {
  contractSupportsCustomerType,
  type WebsiteCustomerType,
} from "@/lib/website/customerType";

export type ContractOption = {
  name: string;
  value: string;
  offerReference: string;
  type: string;
  monthlyFeeSek?: number | null;
  invoiceFeeSek?: number | null;
  markupOrePerKwh?: number | null;
  variableMarkupOrePerKwh?: number | null;
  fixedPriceOrePerKwh?: number | null;
  monthlyFixedPriceSek?: number | null;
  elcertOrePerKwh?: number | null;
  portfolioPriceOrePerKwh?: number | null;
  vatRate?: number | null;
  pricingModel?: string | null;
  spotShare?: number | null;
  portfolioShare?: number | null;
  customerTypes?: string[] | null;
};

type Props = {
  contracts?: ContractOption[];
  initialSelectedValue?: string;
  selectedValue?: string;
  onSelectedValueChange?: (value: string) => void;
  onPricingPreviewChange?: (preview: WebsitePricingPreview | null) => void;
  onEnergyResolutionChange?: (
    resolution: WebsiteEnergyResolution | null,
  ) => void;
  onEstimatedMonthlyKwhChange?: (kwh: number | null) => void;
  onConsumptionProfileChange?: (profile: WebsiteConsumptionProfile | null) => void;
  onQuoteContextChange?: (context: WebsitePricingQuoteContext | null) => void;
  initialPricingPreview?: WebsitePricingPreview | null;
  initialQuoteContext?: WebsitePricingQuoteContext | null;
  customerType?: WebsiteCustomerType;
  onCustomerTypeChange?: (value: WebsiteCustomerType) => void;
  showCustomerTypeSelector?: boolean;
  persistCheckoutContext?: boolean;
  onContinue?: () => void;
  resetSignal?: number;
};

type ConsumptionMode = "known" | "estimate" | null;

const HOUSING_OPTIONS: Array<{ value: WebsiteHousingType; label: string }> = [
  { value: "apartment", label: "Lägenhet" },
  { value: "row_house", label: "Radhus" },
  { value: "semi_detached", label: "Parhus" },
  { value: "villa", label: "Villa" },
  { value: "holiday_home", label: "Fritidshus" },
  { value: "other", label: "Annat boende" },
];

const HEATING_OPTIONS: Array<{ value: WebsiteHeatingType; label: string }> = [
  { value: "direct_electric", label: "Direktverkande el" },
  { value: "air_heat_pump", label: "Luftvärmepump" },
  { value: "ground_source_heat_pump", label: "Berg- eller jordvärme" },
  { value: "district_heating", label: "Fjärrvärme" },
  { value: "wood_or_pellets", label: "Ved eller pellets" },
  { value: "other", label: "Annan uppvärmning" },
  { value: "unknown", label: "Vet inte" },
];

const EXTRA_OPTIONS: Array<{ value: WebsiteConsumptionExtra; label: string }> = [
  { value: "electric_vehicle", label: "Elbil" },
  { value: "pool", label: "Pool" },
  { value: "spa", label: "Spabad" },
  { value: "sauna", label: "Bastu" },
  { value: "air_conditioning", label: "Luftkonditionering" },
  { value: "heated_garage", label: "Uppvärmt garage" },
  { value: "solar_panels", label: "Solceller" },
  { value: "home_battery", label: "Hemmabatteri" },
];

function normalizeContractType(
  type: string,
): WebsitePricingPreview["contract"]["contractType"] {
  if (type === "fixed") return "fixed";
  if (type === "monthly_fixed" || type === "fixed_monthly")
    return "monthly_fixed";
  if (type === "portfolio" || type === "portfolio_managed")
    return "portfolio_managed";
  if (type === "mix" || type === "mixed") return "mix";
  return "spot_hourly";
}

function customerSafeError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Kunde inte hämta pris just nu.";
  if (
    /NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|redirect/i.test(message) ||
    /<!doctype|<html|text\/html/i.test(message)
  ) {
    return "Priset kunde inte hämtas just nu. Kontrollera uppgifterna och försök igen.";
  }
  if (/Tjänsten kunde inte slutföra åtgärden just nu/i.test(message)) {
    return "Elområdet hittades, men priset kunde inte hämtas för det valda avtalet. Försök igen eller kontakta kundservice om felet kvarstår.";
  }
  return message || "Kunde inte hämta pris just nu.";
}

function areaLabel(area: WebsitePriceArea | null) {
  return area ? `Elområde: ${area}` : "Ange adress för att räkna pris";
}

function inputNumber(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function restoredProfile(
  initialQuoteContext: WebsitePricingQuoteContext | null,
  initialPricingPreview: WebsitePricingPreview | null,
): WebsiteConsumptionProfile | null {
  const normalized = normalizeWebsiteConsumptionProfile(
    initialQuoteContext?.consumption_profile,
  );
  if (normalized) return normalized;
  if (initialPricingPreview?.kwh && initialPricingPreview.kwh > 0) {
    return buildCustomerEnteredConsumptionProfile(
      Math.round(initialPricingPreview.kwh * 12),
    );
  }
  return null;
}

export default function ElectricityCalculator({
  contracts = [],
  initialSelectedValue = "",
  selectedValue: controlledSelectedValue,
  onSelectedValueChange,
  onPricingPreviewChange,
  onEnergyResolutionChange,
  onEstimatedMonthlyKwhChange,
  onConsumptionProfileChange,
  onQuoteContextChange,
  initialPricingPreview = null,
  initialQuoteContext = null,
  customerType: controlledCustomerType,
  onCustomerTypeChange,
  showCustomerTypeSelector = false,
  persistCheckoutContext = false,
  onContinue,
  resetSignal = 0,
}: Props) {
  const initialValue = contracts.some(
    (contract) => contract.value === initialSelectedValue,
  )
    ? initialSelectedValue
    : (contracts[0]?.value ?? "");
  const initialConsumptionProfile = useMemo(
    () => restoredProfile(initialQuoteContext, initialPricingPreview),
    [initialPricingPreview, initialQuoteContext],
  );
  const [postalCode, setPostalCode] = useState(initialQuoteContext?.postal_code ?? "");
  const [city, setCity] = useState(initialQuoteContext?.city ?? "");
  const [address, setAddress] = useState(initialQuoteContext?.address ?? "");
  const [consumptionMode, setConsumptionMode] = useState<ConsumptionMode>(
    initialConsumptionProfile?.source === "estimated"
      ? "estimate"
      : initialConsumptionProfile
        ? "known"
        : null,
  );
  const [annualKwhInput, setAnnualKwhInput] = useState(
    initialConsumptionProfile?.source === "customer_entered"
      ? String(initialConsumptionProfile.annual_kwh)
      : "",
  );
  const [housingType, setHousingType] = useState<WebsiteHousingType | "">(
    initialConsumptionProfile?.housing_type ?? "",
  );
  const [areaSqmInput, setAreaSqmInput] = useState(
    initialConsumptionProfile?.area_sqm ? String(initialConsumptionProfile.area_sqm) : "",
  );
  const [heatingType, setHeatingType] = useState<WebsiteHeatingType | "">(
    initialConsumptionProfile?.heating_type ?? "",
  );
  const [householdSizeInput, setHouseholdSizeInput] = useState(
    initialConsumptionProfile?.household_size
      ? String(initialConsumptionProfile.household_size)
      : "",
  );
  const [extras, setExtras] = useState<WebsiteConsumptionExtra[]>(
    initialConsumptionProfile?.extras ?? [],
  );
  const [estimatedAnnualOverride, setEstimatedAnnualOverride] = useState<string | null>(
    initialConsumptionProfile?.source === "estimated" &&
      initialConsumptionProfile.customer_adjusted
      ? String(initialConsumptionProfile.annual_kwh)
      : null,
  );
  const [internalSelectedValue, setInternalSelectedValue] = useState(initialValue);
  const [internalCustomerType, setInternalCustomerType] = useState<WebsiteCustomerType>("private");
  const [resolution, setResolutionState] = useState<WebsiteEnergyResolution | null>(
    initialQuoteContext
      ? {
          status: "restored_verified_quote",
          price_area_code: initialQuoteContext.price_area_code,
          confidence: 1,
          source: "server_checkout_context",
        }
      : null,
  );
  const [result, setResultState] = useState<WebsitePricingPreview | null>(
    initialPricingPreview,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [continueHref, setContinueHref] = useState<string | null>(null);

  const customerType = controlledCustomerType ?? internalCustomerType;
  const availableContracts = useMemo(
    () =>
      contracts.filter((contract) =>
        contractSupportsCustomerType(contract.customerTypes, customerType),
      ),
    [contracts, customerType],
  );
  const selectedValue = controlledSelectedValue ?? internalSelectedValue;
  const selectedContract = useMemo(
    () =>
      availableContracts.find((contract) => contract.value === selectedValue) ?? null,
    [availableContracts, selectedValue],
  );
  const effectiveArea = resolution?.price_area_code ?? null;
  const hasContracts = availableContracts.length > 0;
  const effectiveConsumptionMode: ConsumptionMode =
    customerType === "company" ? "known" : consumptionMode;

  const suggestedAnnualKwh = useMemo(() => {
    if (
      effectiveConsumptionMode !== "estimate" ||
      !housingType ||
      !heatingType
    ) return null;
    const areaSqm = inputNumber(areaSqmInput);
    const householdSize = inputNumber(householdSizeInput);
    if (
      areaSqm === null ||
      areaSqm < 10 ||
      areaSqm > 2_000 ||
      householdSize === null ||
      householdSize < 1 ||
      householdSize > 20
    ) return null;
    return estimateAnnualConsumptionKwh({
      housingType,
      areaSqm,
      heatingType,
      householdSize,
      extras,
    });
  }, [
    areaSqmInput,
    effectiveConsumptionMode,
    extras,
    heatingType,
    householdSizeInput,
    housingType,
  ]);

  const consumptionProfile = useMemo<WebsiteConsumptionProfile | null>(() => {
    try {
      if (effectiveConsumptionMode === "known") {
        const annual = validAnnualConsumptionKwh(annualKwhInput);
        return annual === null ? null : buildCustomerEnteredConsumptionProfile(annual);
      }
      if (
        effectiveConsumptionMode !== "estimate" ||
        suggestedAnnualKwh === null ||
        !housingType ||
        !heatingType
      ) return null;
      const areaSqm = inputNumber(areaSqmInput);
      const householdSize = inputNumber(householdSizeInput);
      const annual =
        estimatedAnnualOverride === null
          ? suggestedAnnualKwh
          : validAnnualConsumptionKwh(estimatedAnnualOverride);
      if (areaSqm === null || householdSize === null || annual === null) return null;
      return buildEstimatedConsumptionProfile({
        housingType,
        areaSqm,
        heatingType,
        householdSize,
        extras,
        annualKwh: annual,
      });
    } catch {
      return null;
    }
  }, [
    annualKwhInput,
    areaSqmInput,
    effectiveConsumptionMode,
    estimatedAnnualOverride,
    extras,
    heatingType,
    householdSizeInput,
    housingType,
    suggestedAnnualKwh,
  ]);
  const monthlyKwh = consumptionProfile?.monthly_kwh ?? null;

  useEffect(() => {
    if (!persistCheckoutContext) return;
    const savedType = window.sessionStorage.getItem("gridex_checkout_customer_type");
    let savedProfile: WebsiteConsumptionProfile | null = null;
    try {
      savedProfile = normalizeWebsiteConsumptionProfile(
        JSON.parse(window.sessionStorage.getItem("gridex_checkout_consumption_profile") ?? "null"),
      );
    } catch {
      window.sessionStorage.removeItem("gridex_checkout_consumption_profile");
    }
    if (
      !controlledCustomerType &&
      (savedType === "private" || savedType === "company")
    ) {
      setInternalCustomerType(savedType);
      onCustomerTypeChange?.(savedType);
    }
    if (!initialConsumptionProfile && savedProfile) {
      if (savedProfile.source === "customer_entered") {
        setConsumptionMode("known");
        setAnnualKwhInput(String(savedProfile.annual_kwh));
      } else {
        setConsumptionMode("estimate");
        setHousingType(savedProfile.housing_type ?? "");
        setAreaSqmInput(savedProfile.area_sqm ? String(savedProfile.area_sqm) : "");
        setHeatingType(savedProfile.heating_type ?? "");
        setHouseholdSizeInput(
          savedProfile.household_size ? String(savedProfile.household_size) : "",
        );
        setExtras(savedProfile.extras ?? []);
        setEstimatedAnnualOverride(
          savedProfile.customer_adjusted ? String(savedProfile.annual_kwh) : null,
        );
      }
    }
  }, [
    controlledCustomerType,
    initialConsumptionProfile,
    onCustomerTypeChange,
    persistCheckoutContext,
  ]);

  useEffect(() => {
    onEstimatedMonthlyKwhChange?.(monthlyKwh);
    onConsumptionProfileChange?.(consumptionProfile);
    if (!persistCheckoutContext) return;
    if (consumptionProfile) {
      window.sessionStorage.setItem(
        "gridex_checkout_consumption_profile",
        JSON.stringify(consumptionProfile),
      );
      window.sessionStorage.setItem(
        "gridex_checkout_monthly_kwh",
        String(consumptionProfile.monthly_kwh),
      );
    } else {
      window.sessionStorage.removeItem("gridex_checkout_consumption_profile");
      window.sessionStorage.removeItem("gridex_checkout_monthly_kwh");
    }
  }, [
    consumptionProfile,
    monthlyKwh,
    onConsumptionProfileChange,
    onEstimatedMonthlyKwhChange,
    persistCheckoutContext,
  ]);

  const setSelectedValue = useCallback(
    (value: string) => {
      setInternalSelectedValue(value);
      onSelectedValueChange?.(value);
      setResultState(null);
      onPricingPreviewChange?.(null);
      onQuoteContextChange?.(null);
      setContinueHref(null);
    }, [onPricingPreviewChange, onQuoteContextChange, onSelectedValueChange],
  );

  useEffect(() => {
    if (selectedContract || availableContracts.length === 0) return;
    setSelectedValue(availableContracts[0].value);
  }, [availableContracts, selectedContract, setSelectedValue]);

  useEffect(() => {
    if (!result?.quote_expires_at) return;
    const expiresAt = Date.parse(result.quote_expires_at);
    if (!Number.isFinite(expiresAt)) return;
    const invalidate = () => {
      setResultState(null);
      onPricingPreviewChange?.(null);
      onQuoteContextChange?.(null);
      setContinueHref(null);
      setError("Uppgifterna behöver verifieras igen innan du fortsätter.");
    };
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      invalidate();
      return;
    }
    const timeout = window.setTimeout(
      invalidate,
      Math.min(delay, 2_147_000_000),
    );
    return () => window.clearTimeout(timeout);
  }, [onPricingPreviewChange, onQuoteContextChange, result?.quote_expires_at]);

  useEffect(() => {
    if (resetSignal <= 0) return;
    setResultState(null);
    setContinueHref(null);
    setError(null);
  }, [resetSignal]);

  function setResolution(value: WebsiteEnergyResolution | null) {
    setResolutionState(value);
    onEnergyResolutionChange?.(value);
  }

  function setResult(value: WebsitePricingPreview | null) {
    setResultState(value);
    onPricingPreviewChange?.(value);
  }

  function clearQuote() {
    setResult(null);
    onQuoteContextChange?.(null);
    setContinueHref(null);
    setError(null);
  }

  function setCustomerType(value: WebsiteCustomerType) {
    setInternalCustomerType(value);
    onCustomerTypeChange?.(value);
    if (persistCheckoutContext)
      window.sessionStorage.setItem("gridex_checkout_customer_type", value);
    clearQuote();
  }

  function changeConsumptionMode(value: Exclude<ConsumptionMode, null>) {
    setConsumptionMode(value);
    clearQuote();
  }

  function updateEstimateInput(setter: (value: string) => void, value: string) {
    setter(value);
    setEstimatedAnnualOverride(null);
    clearQuote();
  }

  function toggleExtra(value: WebsiteConsumptionExtra) {
    setExtras((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
    setEstimatedAnnualOverride(null);
    clearQuote();
  }

  async function resolveArea(): Promise<WebsitePriceArea> {
    const normalizedPostalCode = normalizeWebsitePostalCode(postalCode);
    if (
      !/^\d{5}$/.test(normalizedPostalCode) ||
      !city.trim() ||
      !address.trim()
    ) {
      throw new Error(
        "Ange adress, ort och ett svenskt postnummer med 5 siffror innan du räknar pris.",
      );
    }

    const resolved = await resolveWebsiteEnergyArea({
      postal_code: normalizedPostalCode,
      city: city.trim(),
      address: address.trim(),
      street: address.trim(),
    });
    setResolution(resolved);
    if (!resolved.price_area_code) {
      throw new Error(
        resolved.customer_message ||
          "Vi kunde inte fastställa elområdet automatiskt. Kontrollera adressen eller kontakta kundservice.",
      );
    }
    return resolved.price_area_code;
  }

  async function calculate() {
    if (!selectedContract)
      return setError("Välj ett avtal för att räkna pris.");
    if (!consumptionProfile || !monthlyKwh)
      return setError(
        customerType === "company"
          ? "Ange företagets uppskattade årsförbrukning innan du räknar pris."
          : "Ange din årsförbrukning eller fyll i bostadsuppgifterna för att få en uppskattning.",
      );
    const normalizedPostalCode = normalizeWebsitePostalCode(postalCode);
    if (
      !/^\d{5}$/.test(normalizedPostalCode) ||
      !city.trim() ||
      !address.trim()
    ) {
      return setError(
        "Ange adress, ort och ett svenskt postnummer med 5 siffror innan du räknar pris.",
      );
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resolvedArea = await resolveArea();
      const preview = await previewWebsitePricing({
        offer_reference: selectedContract.offerReference,
        price_area_code: resolvedArea,
        postal_code: normalizedPostalCode,
        city: city.trim(),
        address: address.trim(),
        estimated_monthly_kwh: monthlyKwh,
      });
      if (!consumptionProfileMatchesMonthlyKwh(consumptionProfile, preview.kwh)) {
        throw new Error("Prisberäkningen returnerade en annan förbrukning än den du godkände.");
      }
      const verifiedPreview = {
        ...preview,
        contract: {
          ...preview.contract,
          contractType: normalizeContractType(preview.contract.contractType),
          offer_reference:
            preview.contract.offer_reference ?? selectedContract.offerReference,
        },
      } satisfies WebsitePricingPreview;
      const nextQuoteContext = {
        postal_code: normalizedPostalCode,
        city: city.trim(),
        address: address.trim(),
        price_area_code: resolvedArea,
        estimated_monthly_kwh: monthlyKwh,
        consumption_profile: consumptionProfile,
      } satisfies WebsitePricingQuoteContext;
      onQuoteContextChange?.(nextQuoteContext);

      if (persistCheckoutContext && preview.quote_token) {
        const contextResponse = await fetch("/api/v1/website/checkout-context", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            customer_type: customerType,
            offer_reference: selectedContract.offerReference,
            quote_token: preview.quote_token,
            ...nextQuoteContext,
          }),
        });
        const contextData = (await contextResponse.json().catch(() => null)) as {
          checkout_token?: string;
          error?: string;
        } | null;
        if (!contextResponse.ok || !contextData?.checkout_token) {
          throw new Error(
            contextData?.error ||
              "Priset är beräknat men kunde inte föras vidare. Försök igen.",
          );
        }
        setContinueHref(
          `/teckna-avtal?checkout=${encodeURIComponent(contextData.checkout_token)}`,
        );
      }
      setResult(verifiedPreview);
    } catch (err) {
      setError(customerSafeError(err));
    } finally {
      setLoading(false);
    }
  }

  const postalCodeHelpId = "calculator-postal-code-help";
  const calculationStatusId = "calculator-status";
  const displayedEstimatedAnnual =
    estimatedAnnualOverride ??
    (suggestedAnnualKwh === null ? "" : String(suggestedAnnualKwh));

  return (
    <section
      id="rakna-elpris"
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-6 md:p-10"
    >
      <div className="pointer-events-none absolute -top-24 right-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-[100px]" />
      <div className="relative space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
              Adress → elområde → förbrukning → pris
            </div>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
              Räkna ditt elpris
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60 md:text-base">
              Välj om du känner till din årsförbrukning eller vill ha hjälp att uppskatta den. Samma godkända uppgifter används när du tecknar.
            </p>
          </div>
          <div
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300"
            aria-live="polite"
          >
            {areaLabel(effectiveArea)}
          </div>
        </div>

        {!hasContracts ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            Det finns inga aktuella elavtal att räkna på just nu.
          </div>
        ) : null}

        {showCustomerTypeSelector ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-white/80">
              Vem ska teckna avtalet?
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["private", "company"] as const).map((value) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-2xl border p-4 text-sm font-semibold transition ${customerType === value ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-white/5 text-gray-300"}`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="calculator_customer_type"
                    value={value}
                    checked={customerType === value}
                    onChange={() => setCustomerType(value)}
                  />
                  {value === "private" ? "Privatkund" : "Företag"}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="calculator-postal-code" className="text-sm font-medium text-white/80">
              Postnummer
            </label>
            <input
              id="calculator-postal-code"
              placeholder="Till exempel 21120"
              inputMode="numeric"
              value={postalCode}
              onChange={(event) => {
                setPostalCode(event.target.value);
                setResolution(null);
                clearQuote();
              }}
              aria-describedby={postalCodeHelpId}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30"
            />
            <p id={postalCodeHelpId} className="text-xs text-white/40">
              Används tillsammans med adress och ort för att fastställa rätt elområde.
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="calculator-city" className="text-sm font-medium text-white/80">
              Ort
            </label>
            <input
              id="calculator-city"
              placeholder="Till exempel Malmö"
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setResolution(null);
                clearQuote();
              }}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="calculator-address" className="text-sm font-medium text-white/80">
              Adress
            </label>
            <input
              id="calculator-address"
              placeholder="Gata och nummer"
              value={address}
              onChange={(event) => {
                setAddress(event.target.value);
                setResolution(null);
                clearQuote();
              }}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
            <div className="font-medium text-white">Elområdet verifieras automatiskt</div>
            <p className="mt-2 text-xs leading-5 text-gray-400">
              För teckningen används alltid det elområde som servern fastställer från adressen.
            </p>
          </div>
        </div>

        <section className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <div>
            <h3 className="text-xl font-semibold text-white">Din förbrukning</h3>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Ingen standardförbrukning används. Du anger själv ett värde eller godkänner en uppskattning.
            </p>
          </div>

          {customerType === "private" ? (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-white/80">Hur vill du ange förbrukningen?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["known", "Jag känner till årsförbrukningen"],
                  ["estimate", "Hjälp mig uppskatta"],
                ] as const).map(([value, label]) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-2xl border p-4 text-sm font-semibold transition ${consumptionMode === value ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-black/20 text-gray-300"}`}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="calculator_consumption_mode"
                      checked={consumptionMode === value}
                      onChange={() => changeConsumptionMode(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {effectiveConsumptionMode === "known" ? (
            <div className="max-w-xl space-y-2">
              <label htmlFor="calculator-annual-kwh" className="text-sm font-medium text-white/80">
                {customerType === "company" ? "Uppskattad årsförbrukning" : "Årsförbrukning"} (kWh/år)
              </label>
              <input
                id="calculator-annual-kwh"
                type="number"
                value={annualKwhInput}
                min={100}
                max={2400000}
                placeholder="Till exempel 5000"
                onChange={(event) => {
                  setAnnualKwhInput(event.target.value);
                  clearQuote();
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30"
              />
              <p className="text-xs leading-5 text-white/40">
                Du hittar normalt årsförbrukningen på din senaste el- eller nätfaktura.
              </p>
              {consumptionProfile ? (
                <p className="text-sm font-medium text-cyan-200">
                  Motsvarar cirka {consumptionProfile.monthly_kwh.toLocaleString("sv-SE", { maximumFractionDigits: 0 })} kWh per månad.
                </p>
              ) : null}
            </div>
          ) : null}

          {effectiveConsumptionMode === "estimate" ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="calculator-housing-type" className="text-sm font-medium text-white/80">Bostadstyp</label>
                  <select
                    id="calculator-housing-type"
                    value={housingType}
                    onChange={(event) => {
                      setHousingType(event.target.value as WebsiteHousingType | "");
                      setEstimatedAnnualOverride(null);
                      clearQuote();
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30"
                  >
                    <option value="">Välj bostadstyp</option>
                    {HOUSING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="calculator-area-sqm" className="text-sm font-medium text-white/80">Bostadsyta (m²)</label>
                  <input
                    id="calculator-area-sqm"
                    type="number"
                    min={10}
                    max={2000}
                    value={areaSqmInput}
                    placeholder="Till exempel 85"
                    onChange={(event) => updateEstimateInput(setAreaSqmInput, event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none placeholder:text-white/30 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="calculator-heating-type" className="text-sm font-medium text-white/80">Uppvärmning</label>
                  <select
                    id="calculator-heating-type"
                    value={heatingType}
                    onChange={(event) => {
                      setHeatingType(event.target.value as WebsiteHeatingType | "");
                      setEstimatedAnnualOverride(null);
                      clearQuote();
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30"
                  >
                    <option value="">Välj uppvärmning</option>
                    {HEATING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="calculator-household-size" className="text-sm font-medium text-white/80">Personer i hushållet</label>
                  <input
                    id="calculator-household-size"
                    type="number"
                    min={1}
                    max={20}
                    value={householdSizeInput}
                    placeholder="Till exempel 2"
                    onChange={(event) => updateEstimateInput(setHouseholdSizeInput, event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none placeholder:text-white/30 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30"
                  />
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-white/80">Större elanvändare (valfritt)</legend>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {EXTRA_OPTIONS.map((option) => (
                    <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={extras.includes(option.value)}
                        onChange={() => toggleExtra(option.value)}
                        className="h-4 w-4 accent-cyan-400"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {suggestedAnnualKwh !== null ? (
                <div className="grid gap-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-5 md:grid-cols-[1fr_240px] md:items-end">
                  <div>
                    <div className="text-sm font-semibold text-cyan-100">Ungefärlig årsförbrukning</div>
                    <p className="mt-2 text-sm leading-6 text-cyan-50/75">
                      Modellen föreslår {suggestedAnnualKwh.toLocaleString("sv-SE")} kWh/år. Kontrollera och justera värdet innan du räknar pris.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="calculator-estimated-annual-kwh" className="text-xs font-medium text-cyan-100">Godkänd förbrukning (kWh/år)</label>
                    <input
                      id="calculator-estimated-annual-kwh"
                      type="number"
                      min={100}
                      max={2400000}
                      value={displayedEstimatedAnnual}
                      onChange={(event) => {
                        setEstimatedAnnualOverride(event.target.value);
                        clearQuote();
                      }}
                      className="w-full rounded-xl border border-cyan-300/20 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-300/60"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-gray-400">
                  Välj bostadstyp, storlek, uppvärmning och antal personer för att få en uppskattning.
                </div>
              )}
            </div>
          ) : null}
        </section>

        <div className="space-y-2">
          <label htmlFor="calculator-contract" className="text-sm font-medium text-white/80">Elavtal</label>
          <select
            id="calculator-contract"
            value={selectedValue}
            onChange={(event) => setSelectedValue(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30"
          >
            <option value="">Välj avtal</option>
            {availableContracts.map((contract) => (
              <option key={contract.value} value={contract.value}>{contract.name}</option>
            ))}
          </select>
        </div>

        {resolution?.price_area_code ? (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-100">
            Elområde: {resolution.price_area_code}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
          <button
            type="button"
            onClick={calculate}
            disabled={loading || !hasContracts}
            className="w-full rounded-2xl bg-cyan-500 py-4 font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
          >
            {loading ? "Beräknar..." : "Hämta pris"}
          </button>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300">
            Kalkylen använder valt avtal, verifierat elområde och den förbrukning du har angett eller godkänt. Rörligt pris följer marknaden enligt den valda avtalsmodellen.
          </div>
        </div>
        <div id={calculationStatusId} aria-live="polite">
          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          ) : null}
        </div>
        {result ? (
          <div className="pt-2" aria-live="polite">
            <PriceResultCard
              data={result}
              updatedAt={new Date()}
              continueHref={continueHref ?? undefined}
              onSelect={onContinue}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/40">
            Fyll i adress, förbrukning och valt avtal. Sedan kan du hämta en prisberäkning.
          </div>
        )}
      </div>
    </section>
  );
}
