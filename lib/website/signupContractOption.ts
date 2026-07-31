import type { OpsContractType, OpsPublicContract } from "@/lib/ops/client";
import type {
  PublicContractPriceOption,
  PublicEnergyDirection,
  PublicLegalRequirement,
  PublicPricingComponent,
  PublicProductionPricing,
} from "@/lib/website/publicContractContract";

export type SignupContractOption = {
  name: string;
  value: string;
  offerReference: string;
  channel: OpsPublicContract["channel"];
  customerType: OpsPublicContract["customer_type"];
  productCode?: string | null;
  type: OpsContractType;
  energyDirection: PublicEnergyDirection;
  productionPricing: PublicProductionPricing | null;
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
  pricingVisibility?: Record<string, boolean>;
  pricingComponents?: PublicPricingComponent[];
  priceOptions?: PublicContractPriceOption[];
  validFrom?: string | null;
  validTo?: string | null;
  bindingPeriodMonths?: number | null;
  noticePeriodDays?: number | null;
  noticePeriodMonths?: number | null;
  automaticRenewal?: boolean | null;
  included?: string[] | string | null;
  excluded?: string[] | string | null;
  startInfo?: string | null;
  customerTypes?: string[] | null;
  termsVersion?: string | null;
  termsVersionId?: string | null;
  termsUrl?: string | null;
  privacyPolicyVersion?: string | null;
  privacyPolicyVersionId?: string | null;
  privacyPolicyUrl?: string | null;
  cancellationRightVersion?: string | null;
  withdrawalVersionId?: string | null;
  withdrawalUrl?: string | null;
  powerOfAttorneyVersion?: string | null;
  powerOfAttorneyVersionId?: string | null;
  powerOfAttorneyUrl?: string | null;
  powerOfAttorneyRequired?: boolean | null;
  priceTermsVersion?: string | null;
  priceTermsVersionId?: string | null;
  priceTermsUrl?: string | null;
  legalRequirements?: PublicLegalRequirement[];
};

/**
 * Restores the canonical public-contract shape from the signup presentation DTO.
 * Canonical routing fields must be preserved explicitly; they must never be
 * inferred from the currently selected form customer type.
 */
export function signupContractOptionAsOpsContract(
  contract: SignupContractOption,
): OpsPublicContract {
  return {
    offer_reference: contract.offerReference,
    channel: contract.channel,
    customer_type: contract.customerType,
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
    portfolio_price_ore_per_kwh: contract.portfolioPriceOrePerKwh ?? null,
    vat_rate: contract.vatRate ?? null,
    pricing_model: contract.pricingModel ?? null,
    spot_share: contract.spotShare ?? null,
    portfolio_share: contract.portfolioShare ?? null,
    pricing_visibility: contract.pricingVisibility ?? {},
    pricing_components: contract.pricingComponents ?? [],
    price_options: contract.priceOptions ?? [],
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
    legal_requirements: contract.legalRequirements ?? [],
  };
}
