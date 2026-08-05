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
  const selectableComponents = (contract.pricing_components ?? [])
    .filter((component) =>
      component.selection_policy === 'customer_optional' &&
      component.website_visibility !== 'hidden' &&
      Boolean(component.component_reference),
    )
    .map((component) => ({
      component_reference: component.component_reference as string,
      component_code: component.component_code,
      name: component.name,
      amount: component.amount,
      currency: component.currency,
      unit: component.unit,
      lifecycle: component.lifecycle,
      vat_included: component.vat_included,
      vat_rate: component.vat_rate,
    }))
  const priceOptions = (contract.price_options ?? []).map((option) => ({
    price_option_reference: option.price_option_reference,
    code: option.option_code,
    label: option.customer_name ?? option.option_code ?? contract.name,
    price_type: option.price_type,
    contract_type: option.contract_type,
    customer_type: option.customer_type,
    is_default: option.is_default,
    default: option.is_default,
    resolution: option.resolution,
    currency: option.currency,
    unit: option.unit,
    fixed_price: option.fixed_price,
    markup: option.markup,
    monthly_fee: option.monthly_fee,
    selection_required: option.selection_required,
    valid_from: option.valid_from,
    valid_to: option.valid_to,
    earliest_start_date: option.earliest_start_date,
    latest_start_date: option.latest_start_date,
    binding_months: option.binding_months,
    notice_months: option.notice_months,
    auto_renew_enabled: option.auto_renew_enabled,
    renewal_term_months: option.renewal_term_months,
    area_prices: option.area_prices,
  }))
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
    energy_direction: contract.energy_direction,
    production_pricing: contract.production_pricing,
    short_description: contract.short_description ?? null,
    marketing_description: contract.marketing_description ?? null,
    badge_text: contract.badge_text ?? null,
    customer_types: contract.customer_types ?? null,
    price_options: priceOptions,
    selectable_components: selectableComponents,
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
      // The OPS parser blocks contracts without a canonical legal block. These
      // fallbacks only keep this allowlist mapper safe for legacy in-process
      // callers and never manufacture legal identities or versions.
      legal_bundle_reference: contract.legal?.legal_bundle_reference ?? null,
      legal_bundle_version_id: contract.legal?.legal_bundle_version_id ?? null,
      immutable: contract.legal?.immutable ?? false,
      module_versions: (contract.legal?.module_versions ?? []).map((module) => ({
        id: module.id,
        legal_bundle_version_id: module.legal_bundle_version_id,
        document_reference: module.document_reference,
        module_key: module.module_key,
        version: module.version,
        title: module.title,
        published_at: module.published_at,
        content_sha256: module.content_sha256,
        origin: module.origin,
        url: module.url,
      })),
      customer_documents: (contract.legal?.customer_documents ?? contract.legal_requirements ?? []).map((requirement) => ({
        requirement_code: requirement.requirement_code,
        document_type: requirement.document_type,
        title: requirement.label,
        description: requirement.description,
        required: requirement.required,
        acceptance_mode: requirement.acceptance_mode,
        document_reference: requirement.document_reference,
        document_version: requirement.document_version,
        document_hash: requirement.document_hash,
        document_url: requirement.public_url,
        legal_bundle_version_id: requirement.legal_bundle_version_id,
        module_keys: requirement.module_keys,
        source_document_ids: requirement.source_document_ids,
        primary_document_id: requirement.primary_document_id,
        sort_order: requirement.sort_order,
      })),
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
      requirements: (contract.legal?.customer_documents ?? contract.legal_requirements ?? []).map((requirement) => ({
        requirement_code: requirement.requirement_code,
        document_type: requirement.document_type,
        acceptance_mode: requirement.acceptance_mode,
        required: requirement.required,
        label: requirement.label,
        description: requirement.description,
        document_reference: requirement.document_reference,
        document_version: requirement.document_version,
        document_hash: requirement.document_hash,
        public_url: requirement.public_url,
        legal_bundle_version_id: requirement.legal_bundle_version_id,
        module_keys: requirement.module_keys,
        source_document_ids: requirement.source_document_ids,
        primary_document_id: requirement.primary_document_id,
        sort_order: requirement.sort_order,
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
  const texts = bundle.texts.map(toBrowserLegalText)
  return {
    offer_reference: bundle.offer_reference,
    bundle_version: bundle.bundle_version,
    complete: bundle.complete,
    missing_types: bundle.missing_types,
    supported_by_application_contract:
      bundle.complete &&
      bundle.requirements.length >= 1 &&
      bundle.requirements.length <= 3,
    requirements: bundle.requirements.map((requirement) => {
      return {
        requirement_code: requirement.requirement_code,
        document_type: requirement.document_type,
        acceptance_mode: requirement.acceptance_mode,
        required: requirement.required,
        label: requirement.title,
        description: requirement.description,
        document_reference: requirement.document_reference,
        document_version: requirement.document_version,
        document_hash: requirement.document_hash,
        public_url: requirement.document_url,
        legal_bundle_version_id: requirement.legal_bundle_version_id,
        module_keys: requirement.module_keys,
        source_document_ids: requirement.source_document_ids,
        primary_document_id: requirement.primary_document_id,
        sort_order: requirement.sort_order,
        bundle_version: bundle.bundle_version,
      }
    }),
    texts,
  }
}
