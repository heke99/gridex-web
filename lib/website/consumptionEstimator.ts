export const WEBSITE_CONSUMPTION_PROFILE_VERSION = 1 as const

export const HOUSING_TYPES = [
  'apartment',
  'row_house',
  'semi_detached',
  'villa',
  'holiday_home',
  'other',
] as const

export const HEATING_TYPES = [
  'direct_electric',
  'air_heat_pump',
  'ground_source_heat_pump',
  'district_heating',
  'wood_or_pellets',
  'other',
  'unknown',
] as const

export const CONSUMPTION_EXTRAS = [
  'electric_vehicle',
  'pool',
  'spa',
  'sauna',
  'air_conditioning',
  'heated_garage',
  'solar_panels',
  'home_battery',
] as const

export type WebsiteHousingType = (typeof HOUSING_TYPES)[number]
export type WebsiteHeatingType = (typeof HEATING_TYPES)[number]
export type WebsiteConsumptionExtra = (typeof CONSUMPTION_EXTRAS)[number]

export type WebsiteConsumptionProfile = {
  version: typeof WEBSITE_CONSUMPTION_PROFILE_VERSION
  source: 'customer_entered' | 'estimated'
  annual_kwh: number
  monthly_kwh: number
  suggested_annual_kwh?: number
  customer_adjusted?: boolean
  housing_type?: WebsiteHousingType
  area_sqm?: number
  heating_type?: WebsiteHeatingType
  household_size?: number
  extras?: WebsiteConsumptionExtra[]
}

export type WebsiteConsumptionEstimateInput = {
  housingType: WebsiteHousingType
  areaSqm: number
  heatingType: WebsiteHeatingType
  householdSize: number
  extras?: WebsiteConsumptionExtra[]
}

const MIN_ANNUAL_KWH = 100
const MAX_ANNUAL_KWH = 2_400_000

const HOUSING_BASE: Record<WebsiteHousingType, { fixed: number; perSqm: number; perPerson: number }> = {
  apartment: { fixed: 900, perSqm: 22, perPerson: 350 },
  row_house: { fixed: 1_300, perSqm: 26, perPerson: 400 },
  semi_detached: { fixed: 1_400, perSqm: 27, perPerson: 400 },
  villa: { fixed: 1_600, perSqm: 29, perPerson: 450 },
  holiday_home: { fixed: 500, perSqm: 14, perPerson: 200 },
  other: { fixed: 1_100, perSqm: 24, perPerson: 350 },
}

const HEATING_PER_SQM: Record<WebsiteHeatingType, number> = {
  direct_electric: 90,
  air_heat_pump: 38,
  ground_source_heat_pump: 25,
  district_heating: 0,
  wood_or_pellets: 8,
  other: 20,
  unknown: 30,
}

const EXTRA_KWH: Record<WebsiteConsumptionExtra, number> = {
  electric_vehicle: 3_000,
  pool: 2_500,
  spa: 1_800,
  sauna: 500,
  air_conditioning: 500,
  heated_garage: 2_000,
  solar_panels: 0,
  home_battery: 0,
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function rounded(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function validAnnualConsumptionKwh(value: unknown): number | null {
  const parsed = finiteNumber(value)
  if (parsed === null || parsed < MIN_ANNUAL_KWH || parsed > MAX_ANNUAL_KWH) return null
  return rounded(parsed)
}

export function annualToMonthlyKwh(annualKwh: number): number {
  return rounded(annualKwh / 12)
}

export function monthlyToAnnualKwh(monthlyKwh: number): number {
  return Math.round(monthlyKwh * 12)
}

export function estimateAnnualConsumptionKwh(input: WebsiteConsumptionEstimateInput): number {
  const areaSqm = Math.min(2_000, Math.max(10, Math.round(input.areaSqm)))
  const householdSize = Math.min(20, Math.max(1, Math.round(input.householdSize)))
  const housing = HOUSING_BASE[input.housingType]
  const heatingFactor =
    input.housingType === 'apartment' && input.heatingType === 'unknown'
      ? 8
      : HEATING_PER_SQM[input.heatingType]

  let estimate =
    housing.fixed +
    areaSqm * housing.perSqm +
    householdSize * housing.perPerson +
    areaSqm * heatingFactor

  for (const extra of new Set(input.extras ?? [])) estimate += EXTRA_KWH[extra]

  // Solar production affects purchased grid electricity rather than the home's gross use.
  // Keep the estimate conservative and never reduce it by more than 3,500 kWh/year.
  if ((input.extras ?? []).includes('solar_panels')) {
    estimate -= Math.min(3_500, estimate * 0.18)
  }

  return Math.max(500, Math.round(estimate / 100) * 100)
}

function isHousingType(value: unknown): value is WebsiteHousingType {
  return typeof value === 'string' && (HOUSING_TYPES as readonly string[]).includes(value)
}

function isHeatingType(value: unknown): value is WebsiteHeatingType {
  return typeof value === 'string' && (HEATING_TYPES as readonly string[]).includes(value)
}

function normalizeExtras(value: unknown): WebsiteConsumptionExtra[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(
    (item): item is WebsiteConsumptionExtra =>
      typeof item === 'string' && (CONSUMPTION_EXTRAS as readonly string[]).includes(item),
  ))].sort()
}

export function buildCustomerEnteredConsumptionProfile(annualKwh: number): WebsiteConsumptionProfile {
  const normalizedAnnual = validAnnualConsumptionKwh(annualKwh)
  if (normalizedAnnual === null) throw new Error('Ogiltig årsförbrukning.')
  return {
    version: WEBSITE_CONSUMPTION_PROFILE_VERSION,
    source: 'customer_entered',
    annual_kwh: normalizedAnnual,
    monthly_kwh: annualToMonthlyKwh(normalizedAnnual),
  }
}

export function buildEstimatedConsumptionProfile(input: WebsiteConsumptionEstimateInput & {
  annualKwh?: number | null
}): WebsiteConsumptionProfile {
  const suggestedAnnual = estimateAnnualConsumptionKwh(input)
  const annual = validAnnualConsumptionKwh(input.annualKwh ?? suggestedAnnual)
  if (annual === null) throw new Error('Ogiltig uppskattad årsförbrukning.')
  const extras = normalizeExtras(input.extras)
  return {
    version: WEBSITE_CONSUMPTION_PROFILE_VERSION,
    source: 'estimated',
    annual_kwh: annual,
    monthly_kwh: annualToMonthlyKwh(annual),
    suggested_annual_kwh: suggestedAnnual,
    customer_adjusted: Math.abs(annual - suggestedAnnual) > 0.01,
    housing_type: input.housingType,
    area_sqm: Math.round(input.areaSqm),
    heating_type: input.heatingType,
    household_size: Math.round(input.householdSize),
    extras,
  }
}

export function normalizeWebsiteConsumptionProfile(value: unknown): WebsiteConsumptionProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (row.version !== WEBSITE_CONSUMPTION_PROFILE_VERSION) return null
  const annual = validAnnualConsumptionKwh(row.annual_kwh)
  const monthly = finiteNumber(row.monthly_kwh)
  if (annual === null || monthly === null || Math.abs(annualToMonthlyKwh(annual) - monthly) > 0.011) return null

  if (row.source === 'customer_entered') return buildCustomerEnteredConsumptionProfile(annual)
  if (row.source !== 'estimated') return null

  if (!isHousingType(row.housing_type) || !isHeatingType(row.heating_type)) return null
  const areaSqm = finiteNumber(row.area_sqm)
  const householdSize = finiteNumber(row.household_size)
  if (
    areaSqm === null || areaSqm < 10 || areaSqm > 2_000 ||
    householdSize === null || householdSize < 1 || householdSize > 20
  ) return null

  const normalized = buildEstimatedConsumptionProfile({
    housingType: row.housing_type,
    areaSqm,
    heatingType: row.heating_type,
    householdSize,
    extras: normalizeExtras(row.extras),
    annualKwh: annual,
  })
  const claimedSuggested = finiteNumber(row.suggested_annual_kwh)
  if (claimedSuggested !== null && Math.abs(claimedSuggested - normalized.suggested_annual_kwh!) > 0.01) return null
  return normalized
}

export function consumptionProfileMatchesMonthlyKwh(
  profile: WebsiteConsumptionProfile | null | undefined,
  monthlyKwh: number,
): boolean {
  return Boolean(profile && Number.isFinite(monthlyKwh) && Math.abs(profile.monthly_kwh - monthlyKwh) <= 0.011)
}
