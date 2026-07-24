export type WebsiteVisibility = 'visible' | 'summary_only' | 'hidden'

export type PublicAreaPricing = {
  price_area_code: 'SE1' | 'SE2' | 'SE3' | 'SE4'
  fixed_price_ore_per_kwh: number
  vat_included: boolean | null
  vat_rate: number | null
}

export type PublicLegalRequirement = {
  requirement_code: string
  acceptance_type: string
  required: boolean
  label: string
  document_id: string | null
  legal_bundle_version_document_id: string | null
  document_version: string | null
  document_hash: string | null
  public_url: string | null
}

export type PublicContractApiShape = {
  offer_reference: string
  product_code: string | null
  name: string
  contract_type: string
  type: string
  customer_types: string[] | null
  price_areas: Array<'SE1' | 'SE2' | 'SE3' | 'SE4'>
  area_pricing: PublicAreaPricing[]
  pricing_visibility: Record<string, boolean>
  pricing_components: PublicPricingComponent[]
  calculation_components: PublicPricingComponent[]
  display_components: PublicPricingComponent[]
  summary_components: PublicPricingComponent[]
  legal_requirements: PublicLegalRequirement[]
  portfolio_monthly_prices: PublicPortfolioMonthlyPrice[]
  monthly_fee_sek: number | null
  invoice_fee_sek: number | null
  markup_ore_per_kwh: number | null
  variable_markup_ore_per_kwh: number | null
  fixed_price_ore_per_kwh: number | null
  monthly_fixed_price_sek: number | null
  elcert_ore_per_kwh: number | null
  portfolio_price_ore_per_kwh: number | null
  vat_rate: number | null
  pricing_model: string | null
  spot_share: number | null
  portfolio_share: number | null
  binding_months: number | null
  notice_months: number | null
  automatic_renewal: boolean | null
  valid_from: string | null
  valid_to: string | null
  terms_version: string | null
  terms_version_id: string | null
  terms_url: string | null
  privacy_policy_version: string | null
  privacy_policy_version_id: string | null
  privacy_policy_url: string | null
  withdrawal_version: string | null
  withdrawal_version_id: string | null
  withdrawal_url: string | null
  power_of_attorney_required: boolean | null
  power_of_attorney_version: string | null
  power_of_attorney_version_id: string | null
  power_of_attorney_url: string | null
  price_terms_version: string | null
  price_terms_version_id: string | null
  price_terms_url: string | null
}

export type PublicPricingComponent = {
  component_code: string
  name: string
  amount: number
  currency: string | null
  unit: string
  calculation_inclusion: 'included' | 'excluded'
  website_visibility: WebsiteVisibility
  /** Compatibility projection. Never use this to represent summary_only. */
  website_card_visible: boolean
  calculation_base: string | null
  vat_included: boolean | null
  vat_rate: number | null
  billing_interval_months?: number | null
  invoices_per_year?: number | null
}

export type CanonicalPublishedPricingKey =
  | 'monthly_fee_sek'
  | 'invoice_fee_sek'
  | 'markup_ore_per_kwh'
  | 'variable_markup_ore_per_kwh'
  | 'elcert_ore_per_kwh'
  | 'fixed_price_ore_per_kwh'
  | 'monthly_fixed_price_sek'
  | 'portfolio_price_ore_per_kwh'
  | 'spot_share'
  | 'portfolio_share'
  | 'vat_rate'

function normalizedComponentToken(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function componentSearchText(component: PublicPricingComponent): string {
  return normalizedComponentToken(
    [component.component_code, component.name, component.unit, component.calculation_base]
      .filter(Boolean)
      .join(' '),
  )
}

function componentUnitKind(unitValue: unknown): 'invoice' | 'month' | 'energy' | 'percent' | 'other' {
  const rawUnit = String(unitValue ?? '').trim().toLowerCase()
  const unit = normalizedComponentToken(unitValue)
  if (/invoice|faktur|billing|bill|avi/.test(unit)) return 'invoice'
  if (/month|monthly|manad|manadsvis/.test(unit)) return 'month'
  if (/kwh|mwh|energy/.test(unit)) return 'energy'
  if (rawUnit.includes('%') || /percent|percentage|procent|pct/.test(unit)) return 'percent'
  return 'other'
}

const EXACT_COMPONENT_CODES: Record<CanonicalPublishedPricingKey, Set<string>> = {
  monthly_fee_sek: new Set([
    'monthly_fee',
    'monthlyfee',
    'manadsavgift',
    'subscription_fee',
    'subscription',
    'abonnemangsavgift',
    'base_fee',
    'fixed_fee',
    'administration_fee_monthly',
  ]),
  invoice_fee_sek: new Set([
    'invoice_fee',
    'invoicefee',
    'fakturaavgift',
    'faktureringsavgift',
    'billing_fee',
    'bill_fee',
    'paper_invoice_fee',
    'paper_billing_fee',
    'aviavgift',
    'administration_fee_invoice',
  ]),
  markup_ore_per_kwh: new Set([
    'markup',
    'supplier_markup',
    'supplier_margin',
    'energy_markup',
    'paslag',
    'elhandelspaslag',
    'management_fee',
  ]),
  variable_markup_ore_per_kwh: new Set([
    'variable_fee',
    'variable_markup',
    'variable_charge',
    'rorlig_avgift',
    'energy_fee',
    'kwh_fee',
  ]),
  elcert_ore_per_kwh: new Set([
    'elcert',
    'elcert_fee',
    'electricity_certificate',
    'electricity_certificate_fee',
    'certifikatavgift',
  ]),
  fixed_price_ore_per_kwh: new Set([
    'fixed_price',
    'fixed_kwh_price',
    'fixed_energy_price',
    'fastpris',
    'fast_elpris',
    'price_per_kwh',
  ]),
  monthly_fixed_price_sek: new Set([
    'monthly_fixed',
    'fixed_monthly',
    'monthly_fixed_price',
    'monthly_price',
    'fast_manadspris',
  ]),
  portfolio_price_ore_per_kwh: new Set([
    'portfolio_price',
    'managed_price',
    'portfoljpris',
    'portfolio_energy_price',
  ]),
  spot_share: new Set(['spot_share', 'variable_share', 'rorlig_andel']),
  portfolio_share: new Set(['portfolio_share', 'managed_share', 'portfoljandel']),
  vat_rate: new Set(['vat', 'vat_rate', 'moms', 'momssats']),
}

function componentMatchScore(
  component: PublicPricingComponent,
  key: CanonicalPublishedPricingKey,
): number {
  const code = normalizedComponentToken(component.component_code)
  const textValue = componentSearchText(component)
  const unitKind = componentUnitKind(component.unit)
  let score = EXACT_COMPONENT_CODES[key].has(code) ? 100 : 0

  switch (key) {
    case 'invoice_fee_sek':
      if (/invoice|faktur|billing|paper_bill|paper_invoice|aviavgift/.test(textValue)) score = Math.max(score, 90)
      if (unitKind === 'invoice') score = Math.max(score, 80)
      return score
    case 'monthly_fixed_price_sek':
      if (/monthly_fixed|fixed_monthly|monthly_price|manadspris|fast_manadspris/.test(textValue)) {
        score = Math.max(score, 90)
      }
      return unitKind === 'month' ? score : 0
    case 'monthly_fee_sek':
      if (/monthly_fee|manadsavgift|subscription|abonnemang|grundavgift|fast_avgift/.test(textValue)) {
        score = Math.max(score, 90)
      }
      if (/monthly_fixed|fixed_monthly|monthly_price|manadspris|fast_manadspris/.test(textValue)) return 0
      if (unitKind === 'month') score = Math.max(score, 75)
      return score
    case 'elcert_ore_per_kwh':
      if (/elcert|electricity_certificate|certifikat/.test(textValue)) score = Math.max(score, 90)
      return unitKind === 'energy' ? score : 0
    case 'portfolio_price_ore_per_kwh':
      if (/portfolio_price|managed_price|portfoljpris|portfolj_pris|forvaltat_pris/.test(textValue)) score = Math.max(score, 90)
      return unitKind === 'energy' ? score : 0
    case 'variable_markup_ore_per_kwh':
      if (/variable_fee|variable_markup|variable_charge|rorlig_avgift|energy_fee|kwh_fee|balansavgift/.test(textValue)) {
        score = Math.max(score, 90)
      }
      return unitKind === 'energy' ? score : 0
    case 'markup_ore_per_kwh':
      if (/markup|supplier_margin|energy_markup|paslag|marginal|forvaltningsavgift|handelsavgift/.test(textValue)) {
        score = Math.max(score, 90)
      }
      if (/variable_fee|variable_markup|rorlig_avgift|elcert|portfolio_price|fixed_price|fastpris/.test(textValue)) return 0
      return unitKind === 'energy' ? score : 0
    case 'fixed_price_ore_per_kwh':
      if (/fixed_price|fixed_kwh|fastpris|fast_pris|fast_elpris|fixed_energy_price|energy_price|energipris|elpris/.test(textValue)) {
        score = Math.max(score, 90)
      }
      return unitKind === 'energy' ? score : 0
    case 'spot_share':
      if (/spot_share|variable_share|rorlig_andel|spotandel/.test(textValue)) score = Math.max(score, 90)
      return unitKind === 'percent' || score >= 90 ? score : 0
    case 'portfolio_share':
      if (/portfolio_share|managed_share|portfoljandel|portfolio_andel/.test(textValue)) score = Math.max(score, 90)
      return unitKind === 'percent' || score >= 90 ? score : 0
    case 'vat_rate':
      if (/vat|moms|momssats/.test(textValue)) score = Math.max(score, 90)
      return unitKind === 'percent' || score >= 90 ? score : 0
  }
}

/**
 * Resolves the same visible OPS component that the public contract card renders.
 * Exact component codes win, then semantic aliases, then unambiguous units such
 * as SEK per invoice or SEK per month. Zero is a valid published amount.
 */
export function publishedPricingComponentAmount(
  components: readonly PublicPricingComponent[] | null | undefined,
  key: CanonicalPublishedPricingKey,
): number | null {
  let best: { score: number; index: number; amount: number } | null = null

  for (const [index, component] of (components ?? []).entries()) {
    if (component.website_card_visible === false || !Number.isFinite(component.amount)) continue
    const score = componentMatchScore(component, key)
    if (score <= 0) continue
    if (!best || score > best.score || (score === best.score && index < best.index)) {
      best = { score, index, amount: component.amount }
    }
  }

  return best?.amount ?? null
}

export function calculationPricingComponentAmount(
  components: readonly PublicPricingComponent[] | null | undefined,
  key: CanonicalPublishedPricingKey,
): number | null {
  let best: { score: number; index: number; amount: number } | null = null
  for (const [index, component] of (components ?? []).entries()) {
    if (component.calculation_inclusion === 'excluded' || !Number.isFinite(component.amount)) continue
    const score = componentMatchScore(component, key)
    if (score <= 0) continue
    if (!best || score > best.score || (score === best.score && index < best.index)) {
      best = { score, index, amount: component.amount }
    }
  }
  return best?.amount ?? null
}

export function publishedPricingComponentDiagnostics(
  components: readonly PublicPricingComponent[] | null | undefined,
): Array<{ code: string; name: string; amount: number; unit: string; visible: boolean }> {
  return (components ?? []).map((component) => ({
    code: component.component_code,
    name: component.name,
    amount: component.amount,
    unit: component.unit,
    visible: component.website_card_visible,
  }))
}

export type PublicPortfolioMonthlyPrice = {
  year: number
  month: number
  price_area_code: string
  amount: number
  unit: string
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value)
  return Number.isFinite(parsed) ? parsed : null
}

function boolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1 || value === '1') return true
  if (value === 'false' || value === 0 || value === '0') return false
  return null
}

function amount(value: unknown, seen = new Set<unknown>()): number | null {
  const direct = number(value)
  if (direct !== null) return direct
  const row = record(value)
  if (!row || seen.has(value)) return null
  seen.add(value)

  for (const key of [
    'amount',
    'value',
    'price',
    'rate',
    'sek',
    'ore',
    'amount_sek',
    'amountSek',
    'amount_ore',
    'amountOre',
  ]) {
    const nested = amount(row[key], seen)
    if (nested !== null) return nested
  }
  return null
}

function typeList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const values = value.map(text).filter((item): item is string => Boolean(item))
    return values.length ? values : null
  }

  const single = text(value)
  return single ? [single] : null
}

function normalizedCustomerTypes(row: Record<string, unknown>): string[] | null {
  const canonical = typeList(row.customer_types ?? row.customerTypes)
  if (canonical?.length) return canonical

  const singular = text(row.customer_type ?? row.customerType)?.toLowerCase()
  if (singular === 'both') return ['private', 'business']
  return singular ? [singular] : null
}

function normalizedShare(value: unknown): number | null {
  const parsed = number(value)
  if (parsed === null) return null
  return parsed > 1 ? parsed / 100 : parsed
}

function pricingVisibility(value: unknown): Record<string, boolean> {
  const row = record(value)
  if (!row) return {}
  return Object.fromEntries(
    Object.entries(row).flatMap(([key, raw]) => {
      const visible = boolean(raw)
      return visible === null ? [] : [[key, visible]]
    }),
  )
}

function websiteVisibility(value: unknown, fallback: WebsiteVisibility): WebsiteVisibility {
  const normalized = text(value)?.toLowerCase()
  if (normalized === 'visible' || normalized === 'summary_only' || normalized === 'hidden') return normalized
  const legacy = boolean(value)
  if (legacy === true) return 'visible'
  if (legacy === false) return 'hidden'
  return fallback
}

function pricingComponents(
  value: unknown,
  fallbackVisibility: WebsiteVisibility = 'hidden',
): PublicPricingComponent[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = record(item)
    if (!row) return []
    const explicitCode = text(row.component_code ?? row.componentCode ?? row.code ?? row.key ?? row.type)
    const componentName = text(row.name ?? row.label ?? row.title ?? row.description ?? explicitCode)
    const componentCode = explicitCode ?? componentName
    const componentAmount = amount(row.amount ?? row.value ?? row.price ?? row.rate)
    const amountRow = record(row.amount) ?? record(row.value) ?? record(row.price)
    const unit = text(
      row.unit ?? row.unit_code ?? row.unitCode ?? row.unit_type ?? row.unitType ??
      amountRow?.unit ?? amountRow?.unit_code ?? amountRow?.unitCode,
    )
    if (!componentCode || !componentName || componentAmount === null) return []
    const visibility = websiteVisibility(
      row.website_visibility ?? row.websiteVisibility ?? row.website_card_visible ??
      row.websiteCardVisible ?? row.visible_on_website ?? row.visibleOnWebsite ??
      row.show_on_website ?? row.showOnWebsite ?? row.visible,
      fallbackVisibility,
    )
    const inclusion = text(row.calculation_inclusion ?? row.calculationInclusion)?.toLowerCase() === 'excluded'
      ? 'excluded' as const
      : 'included' as const
    return [{
      component_code: componentCode,
      name: componentName,
      amount: componentAmount,
      currency: text(row.currency ?? amountRow?.currency),
      unit: unit ?? '',
      calculation_inclusion: inclusion,
      website_visibility: visibility,
      website_card_visible: visibility === 'visible',
      calculation_base: text(row.calculation_base ?? row.calculationBase ?? row.base ?? row.applies_to ?? row.appliesTo),
      vat_included: boolean(row.vat_included ?? row.vatIncluded ?? amountRow?.vat_included ?? amountRow?.vatIncluded),
      vat_rate: number(row.vat_rate ?? row.vatRate ?? amountRow?.vat_rate ?? amountRow?.vatRate),
      billing_interval_months: number(row.billing_interval_months ?? row.billingIntervalMonths),
      invoices_per_year: number(row.invoices_per_year ?? row.invoicesPerYear),
    }]
  })
}

function pricingComponentSource(
  row: Record<string, unknown>,
  pricing: Record<string, unknown>,
): unknown {
  return (
    pricing.components ??
    pricing.pricing_components ??
    pricing.pricingComponents ??
    pricing.price_components ??
    pricing.priceComponents ??
    pricing.fees ??
    pricing.charges ??
    row.pricing_components ??
    row.pricingComponents ??
    row.price_components ??
    row.priceComponents ??
    row.components
  )
}

function portfolioMonthlyPrices(value: unknown): PublicPortfolioMonthlyPrice[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = record(item)
    if (!row) return []
    const year = number(row.year)
    const month = number(row.month)
    const priceAreaCode = text(row.price_area_code ?? row.priceAreaCode ?? row.price_area)
    const price = amount(row.price ?? row.amount ?? row.portfolio_price)
    const unit = text(record(row.price)?.unit ?? row.unit) ?? 'ore_per_kwh'
    if (
      year === null ||
      month === null ||
      month < 1 ||
      month > 12 ||
      !priceAreaCode ||
      price === null
    ) return []
    return [{
      year,
      month,
      price_area_code: priceAreaCode.toUpperCase(),
      amount: price,
      unit,
    }]
  })
}

function normalizedPriceAreas(value: unknown): Array<'SE1' | 'SE2' | 'SE3' | 'SE4'> {
  if (!Array.isArray(value)) return []
  const allowed = new Set(['SE1', 'SE2', 'SE3', 'SE4'])
  return [...new Set(value.map((item) => text(item)?.toUpperCase()).filter((item): item is 'SE1' | 'SE2' | 'SE3' | 'SE4' => Boolean(item && allowed.has(item))))]
}

function areaPricing(value: unknown): PublicAreaPricing[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = record(item)
    if (!row) return []
    const priceAreaCode = text(row.price_area_code ?? row.priceAreaCode ?? row.price_area)?.toUpperCase()
    if (!priceAreaCode || !['SE1', 'SE2', 'SE3', 'SE4'].includes(priceAreaCode)) return []
    const fixed = record(row.fixed_price ?? row.fixedPrice)
    const fixedAmount = amount(fixed ?? row.fixed_price_ore_per_kwh ?? row.fixedPriceOrePerKwh ?? row.price)
    if (fixedAmount === null) return []
    return [{
      price_area_code: priceAreaCode as PublicAreaPricing['price_area_code'],
      fixed_price_ore_per_kwh: fixedAmount,
      vat_included: boolean(fixed?.vat_included ?? fixed?.vatIncluded ?? row.vat_included ?? row.vatIncluded),
      vat_rate: number(fixed?.vat_rate ?? fixed?.vatRate ?? row.vat_rate ?? row.vatRate),
    }]
  })
}


function legalRequirements(row: Record<string, unknown>, legal: Record<string, unknown>): PublicLegalRequirement[] {
  const source = legal.requirements ?? legal.legal_requirements ?? row.legal_requirements
  if (Array.isArray(source)) {
    return source.flatMap((item) => {
      const requirement = record(item)
      if (!requirement) return []
      const code = text(requirement.requirement_code ?? requirement.requirementCode ?? requirement.code)
      const label = text(requirement.label ?? requirement.title ?? requirement.name)
      if (!code || !label) return []
      return [{
        requirement_code: code,
        acceptance_type: text(requirement.acceptance_type ?? requirement.acceptanceType) ?? 'checkbox',
        required: boolean(requirement.required) !== false,
        label,
        document_id: text(requirement.document_id ?? requirement.documentId),
        legal_bundle_version_document_id: text(requirement.legal_bundle_version_document_id ?? requirement.legalBundleVersionDocumentId),
        document_version: text(requirement.document_version ?? requirement.documentVersion ?? requirement.version),
        document_hash: text(requirement.document_hash ?? requirement.documentHash ?? requirement.sha256),
        public_url: text(requirement.public_url ?? requirement.publicUrl ?? requirement.url),
      }]
    })
  }

  const make = (code: string, label: string, version: unknown, documentId: unknown, url: unknown, required = true): PublicLegalRequirement | null => {
    const normalizedVersion = text(version)
    const normalizedId = text(documentId)
    const normalizedUrl = text(url)
    if (!normalizedVersion && !normalizedId && !normalizedUrl) return null
    return {
      requirement_code: code,
      acceptance_type: 'checkbox',
      required,
      label,
      document_id: normalizedId,
      legal_bundle_version_document_id: normalizedId,
      document_version: normalizedVersion,
      document_hash: null,
      public_url: normalizedUrl,
    }
  }
  return [
    make('terms', 'Jag godkänner allmänna villkor.', legal.terms_version ?? row.terms_version, legal.terms_version_id ?? row.terms_version_id, legal.terms_url ?? row.terms_url),
    make('price_terms', 'Jag godkänner prisvillkoren för valt avtal.', legal.price_terms_version ?? row.price_terms_version, legal.price_terms_version_id ?? row.price_terms_version_id, legal.price_terms_url ?? row.price_terms_url),
    make('withdrawal', 'Jag har tagit del av informationen om ångerrätt.', legal.withdrawal_version ?? legal.cancellation_right_version ?? row.withdrawal_version, legal.withdrawal_version_id ?? legal.cancellation_right_version_id ?? row.withdrawal_version_id, legal.withdrawal_url ?? legal.cancellation_right_url ?? row.withdrawal_url),
    make('privacy_policy', 'Jag har tagit del av integritetspolicyn.', legal.privacy_policy_version ?? row.privacy_policy_version, legal.privacy_policy_version_id ?? row.privacy_policy_version_id, legal.privacy_policy_url ?? row.privacy_policy_url),
    make('power_of_attorney', 'Jag godkänner fullmakten för anläggningsuppslag och leverantörsbyte.', legal.power_of_attorney_version ?? row.power_of_attorney_version, legal.power_of_attorney_version_id ?? row.power_of_attorney_version_id, legal.power_of_attorney_url ?? row.power_of_attorney_url, boolean(legal.power_of_attorney_required ?? row.power_of_attorney_required) === true),
  ].filter((item): item is PublicLegalRequirement => Boolean(item))
}

/**
 * Normalizes the documented public-contract DTO. It intentionally does not
 * require, expose or derive OPS-internal price-plan identifiers.
 */
export function normalizePublicContractApiPayload(value: unknown): PublicContractApiShape | null {
  const row = record(value)
  if (!row) return null

  const pricing = record(row.pricing) ?? {}
  const legal = record(row.legal) ?? {}
  const offerReference = text(row.offer_reference ?? row.offerReference)
  const productCode = text(row.code ?? row.product_code ?? row.productCode)
  const name = text(row.name)
  const type = text(row.contract_type ?? row.contractType ?? row.type)

  if (!offerReference || !name || !type) return null

  const canonicalCalculation = pricingComponents(pricing.calculation_components ?? pricing.calculationComponents, 'hidden')
  const legacyComponents = pricingComponents(pricingComponentSource(row, pricing), 'hidden')
  const calculationComponents = canonicalCalculation.length ? canonicalCalculation : legacyComponents
  const displayComponents = pricingComponents(pricing.display_components ?? pricing.displayComponents, 'visible')
  const summaryComponents = pricingComponents(pricing.summary_components ?? pricing.summaryComponents, 'summary_only')
  const components = calculationComponents
  const componentAmount = (key: CanonicalPublishedPricingKey): number | null =>
    calculationPricingComponentAmount(components, key)

  return {
    offer_reference: offerReference,
    product_code: productCode,
    name,
    contract_type: type,
    type,
    customer_types: normalizedCustomerTypes(row),
    price_areas: normalizedPriceAreas(row.price_areas ?? row.priceAreas),
    area_pricing: areaPricing(row.area_pricing ?? row.areaPricing ?? pricing.area_pricing ?? pricing.areaPricing),
    pricing_visibility: pricingVisibility(pricing.visibility),
    pricing_components: components,
    calculation_components: calculationComponents,
    display_components: displayComponents,
    summary_components: summaryComponents,
    legal_requirements: legalRequirements(row, legal),
    portfolio_monthly_prices: portfolioMonthlyPrices(
      pricing.portfolio_monthly_prices ?? pricing.portfolioMonthlyPrices,
    ),
    monthly_fee_sek: componentAmount('monthly_fee_sek') ?? amount(pricing.monthly_fee ?? pricing.monthlyFee ?? row.monthly_fee_sek),
    invoice_fee_sek: componentAmount('invoice_fee_sek') ?? amount(pricing.invoice_fee ?? pricing.invoiceFee ?? row.invoice_fee_sek),
    markup_ore_per_kwh: componentAmount('markup_ore_per_kwh') ?? amount(pricing.markup ?? pricing.markup_ore_per_kwh ?? row.markup_ore_per_kwh),
    variable_markup_ore_per_kwh: componentAmount('variable_markup_ore_per_kwh') ?? amount(
      pricing.variable_markup ?? pricing.variable_fee ?? pricing.variable_markup_ore_per_kwh ?? row.variable_markup_ore_per_kwh,
    ),
    fixed_price_ore_per_kwh: componentAmount('fixed_price_ore_per_kwh') ?? amount(pricing.fixed_price ?? pricing.fixed_price_ore_per_kwh ?? row.fixed_price_ore_per_kwh),
    monthly_fixed_price_sek: componentAmount('monthly_fixed_price_sek') ?? amount(
      pricing.monthly_fixed_price ??
        pricing.monthlyFixedPrice ??
        pricing.monthly_price ??
        pricing.monthlyPrice ??
        row.monthly_fixed_price_sek ??
        row.monthlyFixedPriceSek ??
        row.monthly_price_sek,
    ),
    elcert_ore_per_kwh: componentAmount('elcert_ore_per_kwh') ?? amount(pricing.elcert ?? pricing.elcert_ore_per_kwh ?? row.elcert_ore_per_kwh),
    portfolio_price_ore_per_kwh: componentAmount('portfolio_price_ore_per_kwh') ?? amount(
      pricing.portfolio_price ??
        pricing.portfolioPrice ??
        pricing.portfolio_price_ore_per_kwh ??
        row.portfolio_price_ore_per_kwh,
    ),
    vat_rate: componentAmount('vat_rate') ?? number(pricing.vat_rate ?? pricing.vatRate ?? row.vat_rate ?? row.vatRate),
    pricing_model: text(pricing.pricing_model ?? pricing.pricingModel ?? row.pricing_model ?? row.pricingModel),
    spot_share: normalizedShare(componentAmount('spot_share')) ?? normalizedShare(pricing.spot_share ?? pricing.spotShare ?? row.spot_share),
    portfolio_share: normalizedShare(componentAmount('portfolio_share')) ?? normalizedShare(pricing.portfolio_share ?? pricing.portfolioShare ?? row.portfolio_share),
    binding_months: number(row.binding_months ?? row.bindingMonths ?? row.binding_period_months ?? row.bindingPeriodMonths),
    notice_months: number(row.notice_months ?? row.noticeMonths ?? row.notice_period_months ?? row.noticePeriodMonths),
    automatic_renewal: boolean(row.automatic_renewal ?? row.automaticRenewal),
    valid_from: text(row.valid_from ?? row.validFrom),
    valid_to: text(row.valid_to ?? row.validTo),
    terms_version: text(legal.terms_version ?? legal.termsVersion ?? row.terms_version),
    terms_version_id: text(legal.terms_version_id ?? legal.termsVersionId ?? row.terms_version_id ?? row.termsVersionId),
    terms_url: text(legal.terms_url ?? legal.termsUrl ?? row.terms_url ?? row.termsUrl),
    privacy_policy_version: text(legal.privacy_policy_version ?? legal.privacyPolicyVersion ?? row.privacy_policy_version),
    privacy_policy_version_id: text(
      legal.privacy_policy_version_id ??
        legal.privacyPolicyVersionId ??
        row.privacy_policy_version_id ??
        row.privacyPolicyVersionId,
    ),
    privacy_policy_url: text(
      legal.privacy_policy_url ?? legal.privacyPolicyUrl ?? row.privacy_policy_url ?? row.privacyPolicyUrl,
    ),
    withdrawal_version: text(
      legal.withdrawal_version ?? legal.withdrawalVersion ?? legal.cancellation_right_version ?? row.withdrawal_version,
    ),
    withdrawal_version_id: text(
      legal.withdrawal_version_id ??
        legal.withdrawalVersionId ??
        legal.cancellation_right_version_id ??
        legal.cancellationRightVersionId ??
        row.withdrawal_version_id ??
        row.withdrawalVersionId ??
        row.cancellation_right_version_id ??
        row.cancellationRightVersionId,
    ),
    withdrawal_url: text(
      legal.withdrawal_url ??
        legal.withdrawalUrl ??
        legal.cancellation_right_url ??
        legal.cancellationRightUrl ??
        row.withdrawal_url ??
        row.withdrawalUrl ??
        row.cancellation_right_url ??
        row.cancellationRightUrl,
    ),
    power_of_attorney_required: boolean(
      legal.power_of_attorney_required ?? legal.powerOfAttorneyRequired ?? row.power_of_attorney_required,
    ),
    power_of_attorney_version: text(
      legal.power_of_attorney_version ??
        legal.powerOfAttorneyVersion ??
        legal.power_of_attorney_text_version ??
        legal.powerOfAttorneyTextVersion ??
        legal.power_of_attorney_legal_text_version ??
        legal.powerOfAttorneyLegalTextVersion ??
        legal.poa_version ??
        legal.poaVersion ??
        row.power_of_attorney_version ??
        row.powerOfAttorneyVersion ??
        row.power_of_attorney_text_version ??
        row.powerOfAttorneyTextVersion ??
        row.power_of_attorney_legal_text_version ??
        row.powerOfAttorneyLegalTextVersion ??
        row.poa_version ??
        row.poaVersion,
    ),
    power_of_attorney_version_id: text(
      legal.power_of_attorney_version_id ??
        legal.powerOfAttorneyVersionId ??
        legal.power_of_attorney_text_version_id ??
        legal.powerOfAttorneyTextVersionId ??
        legal.power_of_attorney_legal_text_version_id ??
        legal.powerOfAttorneyLegalTextVersionId ??
        legal.poa_version_id ??
        legal.poaVersionId ??
        row.power_of_attorney_version_id ??
        row.powerOfAttorneyVersionId ??
        row.power_of_attorney_text_version_id ??
        row.powerOfAttorneyTextVersionId ??
        row.power_of_attorney_legal_text_version_id ??
        row.powerOfAttorneyLegalTextVersionId ??
        row.poa_version_id ??
        row.poaVersionId,
    ),
    power_of_attorney_url: text(
      legal.power_of_attorney_url ??
        legal.powerOfAttorneyUrl ??
        legal.power_of_attorney_text_url ??
        legal.powerOfAttorneyTextUrl ??
        legal.poa_url ??
        legal.poaUrl ??
        row.power_of_attorney_url ??
        row.powerOfAttorneyUrl ??
        row.power_of_attorney_text_url ??
        row.powerOfAttorneyTextUrl ??
        row.poa_url ??
        row.poaUrl,
    ),
    price_terms_version: text(legal.price_terms_version ?? legal.priceTermsVersion ?? row.price_terms_version),
    price_terms_version_id: text(
      legal.price_terms_version_id ?? legal.priceTermsVersionId ?? row.price_terms_version_id ?? row.priceTermsVersionId,
    ),
    price_terms_url: text(legal.price_terms_url ?? legal.priceTermsUrl ?? row.price_terms_url ?? row.priceTermsUrl),
  }
}
