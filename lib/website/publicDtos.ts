import type {
  OpsLegalText,
  OpsPublicContract,
  OpsWebsiteLegalBundle,
} from '@/lib/ops/client'
import {
  isFixedContractType,
  sanitizePricingComponentsBeforeAreaResolution,
} from '@/lib/website/publicPricingVisibility'

/** Browser-safe, allowlisted representation. Never spread an OPS object here. */
export function toBrowserPublicContract(contract: OpsPublicContract) {
  const requiresArea = isFixedContractType(contract.type)
  const displaySource = contract.display_components?.length
    ? contract.display_components
    : contract.pricing_components
  const hidesHistoricalPortfolioPrice = contract.type === 'portfolio' || contract.type === 'portfolio_managed' || contract.type === 'mix' || contract.type === 'mixed'
  const components = sanitizePricingComponentsBeforeAreaResolution(
    displaySource,
    contract.type,
  ).filter((component) => {
    const code = component.component_code.toLowerCase()
    return component.website_visibility === 'visible' &&
      code !== 'invoice_fee' &&
      !(hidesHistoricalPortfolioPrice && /portfolio.*price|managed.*price|portfolj.*pris/.test(code))
  })
  return {
    offer_reference: contract.offer_reference,
    code: contract.product_code ?? null,
    name: contract.name,
    type: contract.type,
    short_description: contract.short_description ?? null,
    marketing_description: contract.marketing_description ?? null,
    badge_text: contract.badge_text ?? null,
    customer_types: contract.customer_types ?? null,
    pricing: {
      monthly_fee: contract.monthly_fee_sek,
      invoice_fee: null,
      markup: contract.markup_ore_per_kwh,
      variable_fee: contract.variable_markup_ore_per_kwh,
      fixed_price: requiresArea ? null : contract.fixed_price_ore_per_kwh,
      monthly_fixed_price: contract.monthly_fixed_price_sek,
      elcert: contract.elcert_ore_per_kwh,
      portfolio_price: null,
      vat_rate: contract.vat_rate,
      pricing_model: contract.pricing_model ?? null,
      spot_share: contract.spot_share,
      portfolio_share: contract.portfolio_share,
      visibility: contract.pricing_visibility ?? {},
      components,
      portfolio_monthly_prices: [],
    },
    binding_period_months: contract.binding_period_months ?? null,
    notice_period_days: contract.notice_period_days ?? null,
    notice_period_months: contract.notice_period_months ?? null,
    automatic_renewal: contract.automatic_renewal ?? null,
    included: contract.included ?? null,
    excluded: contract.excluded ?? null,
    start_info: contract.start_info ?? null,
    legal: {
      terms_version: contract.terms_version ?? null,
      terms_version_id: contract.terms_version_id ?? null,
      terms_url: contract.terms_url ?? null,
      privacy_policy_version: contract.privacy_policy_version ?? null,
      privacy_policy_version_id: contract.privacy_policy_version_id ?? null,
      privacy_policy_url: contract.privacy_policy_url ?? null,
      withdrawal_version: contract.withdrawal_version ?? contract.cancellation_right_version ?? null,
      withdrawal_version_id: contract.withdrawal_version_id ?? null,
      withdrawal_url: contract.withdrawal_url ?? null,
      power_of_attorney_required: contract.power_of_attorney_required === true,
      power_of_attorney_version: contract.power_of_attorney_version ?? null,
      power_of_attorney_version_id: contract.power_of_attorney_version_id ?? null,
      power_of_attorney_url: contract.power_of_attorney_url ?? null,
      price_terms_version: contract.price_terms_version ?? null,
      price_terms_version_id: contract.price_terms_version_id ?? null,
      price_terms_url: contract.price_terms_url ?? null,
      requirements: (contract.legal_requirements ?? []).map((requirement) => ({
        requirement_code: requirement.requirement_code,
        acceptance_type: requirement.acceptance_type,
        required: requirement.required,
        label: requirement.label,
        document_id: requirement.document_id,
        legal_bundle_version_document_id: requirement.legal_bundle_version_document_id,
        document_version: requirement.document_version,
        document_hash: requirement.document_hash,
        public_url: requirement.public_url,
      })),
    },
    valid_from: contract.valid_from ?? null,
    valid_to: contract.valid_to ?? null,
  }
}

export function toBrowserLegalText(text: OpsLegalText) {
  return {
    id: text.id ?? null,
    type: text.type,
    version: text.version,
    title: text.title,
    body: text.body ?? null,
    url: text.url ?? null,
    offer_reference: text.offer_reference ?? null,
    published_at: text.published_at ?? null,
  }
}

export function toBrowserLegalBundle(bundle: OpsWebsiteLegalBundle) {
  return { texts: bundle.texts.map(toBrowserLegalText) }
}
