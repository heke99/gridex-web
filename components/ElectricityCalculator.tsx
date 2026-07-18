"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PriceResultCard from "@/components/PriceResultCard";
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

function validKwh(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 200000
    ? parsed
    : null;
}

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
    return "Priset kunde inte hämtas just nu. Kontrollera uppgifterna och försök igen om en stund.";
  }
  return message || "Kunde inte hämta pris just nu.";
}

function areaLabel(area: WebsitePriceArea | null) {
  return area ? `Elområde: ${area}` : "Ange adress för att räkna pris";
}

export default function ElectricityCalculator({
  contracts = [],
  initialSelectedValue = "",
  selectedValue: controlledSelectedValue,
  onSelectedValueChange,
  onPricingPreviewChange,
  onEnergyResolutionChange,
  onEstimatedMonthlyKwhChange,
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
  const [postalCode, setPostalCode] = useState(initialQuoteContext?.postal_code ?? "");
  const [city, setCity] = useState(initialQuoteContext?.city ?? "");
  const [address, setAddress] = useState(initialQuoteContext?.address ?? "");
  const [kwhInput, setKwhInput] = useState(
    String(initialPricingPreview?.kwh ?? 2000),
  );
  const [internalSelectedValue, setInternalSelectedValue] =
    useState(initialValue);
  const [internalCustomerType, setInternalCustomerType] = useState<WebsiteCustomerType>('private');
  const [resolution, setResolutionState] =
    useState<WebsiteEnergyResolution | null>(
      initialQuoteContext
        ? {
            status: 'restored_verified_quote',
            price_area_code: initialQuoteContext.price_area_code,
            confidence: 1,
            source: 'server_checkout_context',
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
    () => contracts.filter((contract) => contractSupportsCustomerType(contract.customerTypes, customerType)),
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
  const monthlyKwh = validKwh(kwhInput);

  useEffect(() => {
    if (!persistCheckoutContext) return
    const savedType = window.sessionStorage.getItem('gridex_checkout_customer_type')
    const savedKwh = window.sessionStorage.getItem('gridex_checkout_monthly_kwh')
    if (!controlledCustomerType && (savedType === 'private' || savedType === 'company')) {
      setInternalCustomerType(savedType)
      onCustomerTypeChange?.(savedType)
    }
    if (!initialPricingPreview && savedKwh && validKwh(savedKwh)) setKwhInput(savedKwh)
  }, [controlledCustomerType, initialPricingPreview, onCustomerTypeChange, persistCheckoutContext])

  const setSelectedValue = useCallback((value: string) => {
    setInternalSelectedValue(value);
    onSelectedValueChange?.(value);
    setResultState(null);
    onPricingPreviewChange?.(null);
  }, [onPricingPreviewChange, onSelectedValueChange]);

  useEffect(() => {
    if (selectedContract || availableContracts.length === 0) return
    setSelectedValue(availableContracts[0].value)
  }, [availableContracts, selectedContract, setSelectedValue])

  useEffect(() => {
    if (!result?.quote_expires_at) return
    const expiresAt = Date.parse(result.quote_expires_at)
    if (!Number.isFinite(expiresAt)) return
    const invalidate = () => {
      setResultState(null)
      onPricingPreviewChange?.(null)
      onQuoteContextChange?.(null)
      setContinueHref(null)
      setError('Prisberäkningen har gått ut. Hämta ett nytt pris för att fortsätta.')
    }
    const delay = expiresAt - Date.now()
    if (delay <= 0) {
      invalidate()
      return
    }
    const timeout = window.setTimeout(invalidate, Math.min(delay, 2_147_000_000))
    return () => window.clearTimeout(timeout)
  }, [onPricingPreviewChange, onQuoteContextChange, result?.quote_expires_at])

  useEffect(() => {
    if (resetSignal <= 0) return
    setResultState(null)
    setContinueHref(null)
    setError(null)
  }, [resetSignal])

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
    setInternalCustomerType(value)
    onCustomerTypeChange?.(value)
    if (persistCheckoutContext) window.sessionStorage.setItem('gridex_checkout_customer_type', value)
    clearQuote()
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
    if (!monthlyKwh)
      return setError("Ange en månadsförbrukning mellan 1 och 200 000 kWh.");
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
        postal_code: normalizeWebsitePostalCode(postalCode),
        city: city.trim(),
        address: address.trim(),
        estimated_monthly_kwh: monthlyKwh,
      });
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
      } satisfies WebsitePricingQuoteContext;
      onQuoteContextChange?.(nextQuoteContext);

      if (persistCheckoutContext && preview.quote_token) {
        const contextResponse = await fetch('/api/v1/website/checkout-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            customer_type: customerType,
            offer_reference: selectedContract.offerReference,
            quote_token: preview.quote_token,
            ...nextQuoteContext,
          }),
        })
        const contextData = await contextResponse.json().catch(() => null) as { checkout_token?: string; error?: string } | null
        if (!contextResponse.ok || !contextData?.checkout_token) {
          throw new Error(contextData?.error || 'Priset är beräknat men kunde inte föras vidare. Försök igen.')
        }
        setContinueHref(`/teckna-avtal?checkout=${encodeURIComponent(contextData.checkout_token)}`)
      }
      setResult(verifiedPreview);
    } catch (err) {
      setError(customerSafeError(err));
    } finally {
      setLoading(false);
    }
  }

  function updateKwh(value: string) {
    setKwhInput(value);
    const next = validKwh(value);
    onEstimatedMonthlyKwhChange?.(next);
    if (persistCheckoutContext && next) window.sessionStorage.setItem('gridex_checkout_monthly_kwh', String(next))
    clearQuote();
  }

  const postalCodeHelpId = "calculator-postal-code-help";
  const calculationStatusId = "calculator-status";

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
              Adress → elområde → prisberäkning
            </div>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
              Räkna ditt elpris
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60 md:text-base">
              Priset hämtas från det valda publicerade avtalet. Prisberäkningen
              säkras för avtal, elområde, adress och månadsförbrukning innan den
              kan användas i teckning.
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
            <legend className="text-sm font-medium text-white/80">Vem ska teckna avtalet?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['private', 'company'] as const).map((value) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-2xl border p-4 text-sm font-semibold transition ${customerType === value ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/5 text-gray-300'}`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="calculator_customer_type"
                    value={value}
                    checked={customerType === value}
                    onChange={() => setCustomerType(value)}
                  />
                  {value === 'private' ? 'Privatkund' : 'Företag'}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="calculator-postal-code"
              className="text-sm font-medium text-white/80"
            >
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
              Används tillsammans med adress och ort för att fastställa rätt
              elområde.
            </p>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="calculator-city"
              className="text-sm font-medium text-white/80"
            >
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
            <label
              htmlFor="calculator-address"
              className="text-sm font-medium text-white/80"
            >
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
              För bindande pris används alltid elområdet som servern fastställer från adressen. Om adressen inte kan verifieras hjälper kundservice dig.
            </p>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="calculator-kwh"
              className="text-sm font-medium text-white/80"
            >
              Förbrukning (kWh / månad)
            </label>
            <input
              id="calculator-kwh"
              type="number"
              value={kwhInput}
              min={1}
              max={200000}
              onChange={(event) => updateKwh(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30"
            />
            <p className="text-xs text-white/40">
              Ange uppskattad månadsförbrukning. Ett exakt kWh-värde krävs för
              en prisberäkning.
            </p>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="calculator-contract"
              className="text-sm font-medium text-white/80"
            >
              Elavtal
            </label>
            <select
              id="calculator-contract"
              value={selectedValue}
              onChange={(event) => setSelectedValue(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-white outline-none transition focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/30"
            >
              <option value="">Välj avtal</option>
              {availableContracts.map((contract) => (
                <option key={contract.value} value={contract.value}>
                  {contract.name}
                </option>
              ))}
            </select>
          </div>
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
            Prisberäkningen baseras på valt avtal, elområde och uppskattad
            förbrukning. Rörligt pris följer marknaden och kan ändras över tid.
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
            Fyll i adress, ort, postnummer, förbrukning och valt avtal. Sedan
            kan du hämta en prisberäkning.
          </div>
        )}
      </div>
    </section>
  );
}
