import type { OpsPublicContract, OpsWebsitePricingPreview } from '@/lib/ops/client'
import { buildPublicContractDisplay } from '@/lib/website/publicContractDisplay'

export type SnapshotValidationResult = {
  ok: boolean
  reasons: string[]
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

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

function canonicalize(value: unknown): JsonValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map((item) => canonicalize(item))
  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, JsonValue>>((acc, key) => {
        acc[key] = canonicalize(value[key])
        return acc
      }, {})
  }
  return String(value)
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
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

  const expected = buildPublicContractDisplay(contract)
  if (!expected.ready) {
    reasons.push('valt avtal är inte publiceringsklart')
  }

  const version = stringValue(snapshot.price_plan_version_id)
  if (version !== contract.price_plan_version_id) {
    reasons.push('contract_display_snapshot matchar inte vald prisversion')
  }

  const pricePlanId = stringValue(snapshot.price_plan_id)
  if (pricePlanId !== contract.price_plan_id) {
    reasons.push('contract_display_snapshot matchar inte vald prisplan')
  }

  const productCode = stringValue(snapshot.product_code)
  if (productCode !== contract.product_code) {
    reasons.push('contract_display_snapshot matchar inte produktkod')
  }

  const legal = isRecord(snapshot.legal_versions) ? snapshot.legal_versions : {}
  if (stringValue(legal.terms) !== (contract.terms_version ?? null)) {
    reasons.push('allmänna villkor har ändrats')
  }
  if (stringValue(legal.privacy_policy) !== (contract.privacy_policy_version ?? null)) {
    reasons.push('integritetspolicy har ändrats')
  }
  if (stringValue(legal.cancellation_right) !== (contract.cancellation_right_version ?? null)) {
    reasons.push('ångerrättsversion har ändrats')
  }
  if (stringValue(legal.power_of_attorney) !== (contract.power_of_attorney_version ?? null)) {
    reasons.push('fullmaktsversion har ändrats')
  }

  if (canonicalJson(snapshot) !== canonicalJson(expected.snapshot)) {
    reasons.push('visat avtalssnapshot matchar inte aktuellt publicerat avtal')
  }

  return result(reasons)
}

export function validatePricingPreviewSnapshot(params: {
  contract: OpsPublicContract
  snapshot: Record<string, unknown> | null
  livePreview: OpsWebsitePricingPreview
  expectedPriceArea: string | null
  expectedMonthlyKwh: number | null
}): SnapshotValidationResult {
  const reasons: string[] = []
  const { contract, snapshot, livePreview, expectedPriceArea, expectedMonthlyKwh } = params

  if (!snapshot) return result(['pricing_preview_snapshot saknas'])

  const snapshotVersion = firstString(snapshot, [
    ['contract', 'price_plan_version_id'],
    ['contract', 'pricePlanVersionId'],
    ['price_plan_version_id'],
    ['pricePlanVersionId'],
  ])
  if (snapshotVersion !== contract.price_plan_version_id) {
    reasons.push('pricing_preview_snapshot matchar inte vald prisversion')
  }

  const snapshotPlanId = firstString(snapshot, [
    ['contract', 'price_plan_id'],
    ['contract', 'pricePlanId'],
    ['price_plan_id'],
    ['pricePlanId'],
  ])
  if (snapshotPlanId && snapshotPlanId !== contract.price_plan_id) {
    reasons.push('pricing_preview_snapshot matchar inte vald prisplan')
  }

  const snapshotProduct = firstString(snapshot, [
    ['contract', 'product_code'],
    ['contract', 'productCode'],
    ['product_code'],
    ['productCode'],
  ])
  if (snapshotProduct && snapshotProduct !== contract.product_code) {
    reasons.push('pricing_preview_snapshot matchar inte produktkod')
  }

  const snapshotArea = firstString(snapshot, [['price_area_code'], ['priceArea']])
  if (!snapshotArea || snapshotArea !== expectedPriceArea) {
    reasons.push('elområde i pricing_preview_snapshot matchar inte ansökan')
  }

  const snapshotKwh = firstNumber(snapshot, [['kwh'], ['estimated_monthly_kwh'], ['estimatedMonthlyKwh']])
  if (!approxEqual(snapshotKwh, expectedMonthlyKwh, 0.001)) {
    reasons.push('förbrukning i pricing_preview_snapshot matchar inte ansökan')
  }

  const liveVersion = livePreview.contract.price_plan_version_id ?? null
  if (liveVersion && liveVersion !== contract.price_plan_version_id) {
    reasons.push('live-preview returnerade annan prisversion')
  }

  const liveArea = livePreview.price_area_code ?? livePreview.priceArea
  if (liveArea !== expectedPriceArea) {
    reasons.push('live-preview returnerade annat elområde')
  }

  const snapshotOre = firstNumber(snapshot, [['pricePerKwhOre'], ['price_per_kwh_ore']])
  if (!approxEqual(snapshotOre, livePreview.pricePerKwhOre, ORE_TOLERANCE)) {
    reasons.push('pris per kWh har ändrats')
  }

  const snapshotMonthly = firstNumber(snapshot, [['totalMonthlyCostSek'], ['total_monthly_cost_sek']])
  if (!approxEqual(snapshotMonthly, livePreview.totalMonthlyCostSek, MONEY_TOLERANCE)) {
    reasons.push('månadskostnad har ändrats')
  }

  const liveMonthlyVat = typeof livePreview.totalMonthlyCostInclVatSek === 'number'
    ? livePreview.totalMonthlyCostInclVatSek
    : null
  if (liveMonthlyVat !== null) {
    const snapshotMonthlyVat = firstNumber(snapshot, [
      ['totalMonthlyCostInclVatSek'],
      ['total_monthly_cost_inc_vat_sek'],
    ])
    if (!approxEqual(snapshotMonthlyVat, liveMonthlyVat, MONEY_TOLERANCE)) {
      reasons.push('månadskostnad inklusive moms har ändrats')
    }
  }

  return result(reasons)
}
