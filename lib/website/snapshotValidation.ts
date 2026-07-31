import type { OpsPublicContract } from '@/lib/ops/client'
import type { WebsitePricingPreview } from '@/lib/website/publicApi'

export type SnapshotValidationResult = {
  ok: boolean
  reasons: string[]
}

const MONEY_TOLERANCE = 0.01
const ORE_TOLERANCE = 0.0001

function result(reasons: string[]): SnapshotValidationResult {
  return { ok: reasons.length === 0, reasons }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value)
  return Number.isFinite(parsed) ? parsed : null
}

function readPath(root: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = root
  for (const key of path) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

function firstString(root: Record<string, unknown>, paths: string[][]): string | null {
  for (const path of paths) {
    const value = stringValue(readPath(root, path))
    if (value) return value
  }
  return null
}

function firstNumber(root: Record<string, unknown>, paths: string[][]): number | null {
  for (const path of paths) {
    const value = numberValue(readPath(root, path))
    if (value !== null) return value
  }
  return null
}

function approxEqual(a: number | null, b: number | null, tolerance: number): boolean {
  if (a === null || b === null) return false
  return Math.abs(a - b) <= tolerance
}

export function validateContractDisplaySnapshot(
  contract: OpsPublicContract,
  snapshot: Record<string, unknown> | null,
): SnapshotValidationResult {
  const reasons: string[] = []
  if (!snapshot) return result(['contract_display_snapshot saknas'])

  const offerReference = stringValue(snapshot.offer_reference)
  if (offerReference !== contract.offer_reference) {
    reasons.push('contract_display_snapshot matchar inte valt avtal')
  }

  const legal = isRecord(snapshot.legal_versions) ? snapshot.legal_versions : {}
  const submittedTerms = stringValue(legal.terms)
  if (submittedTerms && contract.terms_version && submittedTerms !== contract.terms_version) {
    reasons.push('allmänna villkor har ändrats')
  }
  const submittedTermsId = stringValue(legal.terms_version_id)
  if (submittedTermsId && contract.terms_version_id && submittedTermsId !== contract.terms_version_id) {
    reasons.push('allmänna villkors juridiska ID har ändrats')
  }

  const submittedPrivacy = stringValue(legal.privacy_policy)
  if (submittedPrivacy && contract.privacy_policy_version && submittedPrivacy !== contract.privacy_policy_version) {
    reasons.push('integritetspolicy har ändrats')
  }
  const submittedPrivacyId = stringValue(legal.privacy_policy_version_id)
  if (
    submittedPrivacyId &&
    contract.privacy_policy_version_id &&
    submittedPrivacyId !== contract.privacy_policy_version_id
  ) {
    reasons.push('integritetspolicyns juridiska ID har ändrats')
  }

  const submittedWithdrawal = stringValue(legal.withdrawal) ?? stringValue(legal.cancellation_right)
  const currentWithdrawal = contract.withdrawal_version ?? contract.cancellation_right_version ?? null
  if (submittedWithdrawal && currentWithdrawal && submittedWithdrawal !== currentWithdrawal) {
    reasons.push('ångerrättsversion har ändrats')
  }
  const submittedWithdrawalId = stringValue(legal.withdrawal_version_id)
  if (submittedWithdrawalId && contract.withdrawal_version_id && submittedWithdrawalId !== contract.withdrawal_version_id) {
    reasons.push('ångerrättens juridiska ID har ändrats')
  }

  const submittedPriceTermsId = stringValue(legal.price_terms_version_id)
  if (submittedPriceTermsId && contract.price_terms_version_id && submittedPriceTermsId !== contract.price_terms_version_id) {
    reasons.push('prisvillkorens juridiska ID har ändrats')
  }

  const submittedPowerOfAttorney = stringValue(legal.power_of_attorney)
  if (
    contract.power_of_attorney_required === true &&
    submittedPowerOfAttorney &&
    contract.power_of_attorney_version &&
    submittedPowerOfAttorney !== contract.power_of_attorney_version
  ) {
    reasons.push('fullmaktsversion har ändrats')
  }
  const submittedPowerOfAttorneyId = stringValue(legal.power_of_attorney_version_id)
  if (
    contract.power_of_attorney_required === true &&
    submittedPowerOfAttorneyId &&
    contract.power_of_attorney_version_id &&
    submittedPowerOfAttorneyId !== contract.power_of_attorney_version_id
  ) {
    reasons.push('fullmaktens juridiska ID har ändrats')
  }

  return result(reasons)
}

export function validatePricingPreviewSnapshot(params: {
  contract: OpsPublicContract
  snapshot: Record<string, unknown> | null
  livePreview: WebsitePricingPreview
  expectedPriceArea: string | null
  expectedMonthlyKwh: number | null
}): SnapshotValidationResult {
  const reasons: string[] = []
  const { contract, snapshot, livePreview, expectedPriceArea, expectedMonthlyKwh } = params

  if (!snapshot) return result(['pricing_preview_snapshot saknas'])

  const snapshotOffer = firstString(snapshot, [
    ['contract', 'offer_reference'],
    ['contract', 'offerReference'],
    ['offer_reference'],
    ['offerReference'],
  ])
  if (snapshotOffer && snapshotOffer !== contract.offer_reference) {
    reasons.push('pricing_preview_snapshot matchar inte valt avtal')
  }

  const snapshotArea = firstString(snapshot, [['price_area_code'], ['priceArea'], ['priceAreaCode'], ['price_area']])
  if (!snapshotArea || snapshotArea !== expectedPriceArea) {
    reasons.push('elområde i pricing_preview_snapshot matchar inte teckningen')
  }

  const snapshotKwh = firstNumber(snapshot, [['kwh'], ['estimated_monthly_kwh'], ['estimatedMonthlyKwh'], ['monthly_kwh'], ['monthlyKwh']])
  if (!approxEqual(snapshotKwh, expectedMonthlyKwh, 0.001)) {
    reasons.push('förbrukning i pricing_preview_snapshot matchar inte teckningen')
  }

  const liveOffer = livePreview.contract.offer_reference ?? null
  if (liveOffer && liveOffer !== contract.offer_reference) {
    reasons.push('live-preview returnerade annat avtal')
  }

  const liveArea = livePreview.price_area_code ?? livePreview.priceArea
  if (liveArea !== expectedPriceArea) {
    reasons.push('live-preview returnerade annat elområde')
  }

  const snapshotPriceOptionReference = firstString(snapshot, [
    ['price_option_reference'],
    ['priceOptionReference'],
  ])
  if (!snapshotPriceOptionReference || snapshotPriceOptionReference !== livePreview.price_option_reference) {
    reasons.push('prisalternativ i pricing_preview_snapshot matchar inte den signerade offerten')
  }

  const snapshotAreaPriceReference = firstString(snapshot, [
    ['area_price_reference'],
    ['areaPriceReference'],
  ])
  if (!snapshotAreaPriceReference || snapshotAreaPriceReference !== livePreview.area_price_reference) {
    reasons.push('områdespris i pricing_preview_snapshot matchar inte den signerade offerten')
  }

  const snapshotOre = firstNumber(snapshot, [['pricePerKwhOre'], ['price_per_kwh_ore'], ['totalOrePerKwh'], ['total_ore_per_kwh'], ['energy_price_ore_per_kwh']])
  if (!approxEqual(snapshotOre, livePreview.pricePerKwhOre, ORE_TOLERANCE)) {
    reasons.push('pris per kWh har ändrats')
  }

  const snapshotMonthly = firstNumber(snapshot, [['totalMonthlyCostSek'], ['total_monthly_cost_sek'], ['monthlyCostSek'], ['monthly_cost_sek'], ['estimatedMonthlyCostSek'], ['estimated_monthly_cost_sek']])
  if (!approxEqual(snapshotMonthly, livePreview.totalMonthlyCostSek, MONEY_TOLERANCE)) {
    reasons.push('månadskostnad har ändrats')
  }

  const liveMonthlyVat = typeof livePreview.totalMonthlyCostInclVatSek === 'number'
    ? livePreview.totalMonthlyCostInclVatSek
    : null
  if (liveMonthlyVat !== null) {
    const snapshotMonthlyVat = firstNumber(snapshot, [
      ['totalMonthlyCostInclVatSek'],
      ['total_monthly_cost_incl_vat_sek'],
      ['total_monthly_cost_inc_vat_sek'],
      ['totalMonthlyCostIncVatSek'],
      ['totalMonthlyCostWithVatSek'],
      ['total_monthly_cost_with_vat_sek'],
      ['totalMonthlyCostVatIncludedSek'],
      ['total_monthly_cost_vat_included_sek'],
      ['monthlyCostInclVatSek'],
      ['monthly_cost_incl_vat_sek'],
    ])
    if (!approxEqual(snapshotMonthlyVat, liveMonthlyVat, MONEY_TOLERANCE)) {
      reasons.push('månadskostnad inklusive moms har ändrats')
    }
  }

  return result(reasons)
}
