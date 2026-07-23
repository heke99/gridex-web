import type { PublicPricingComponent } from '@/lib/website/publicContractContract'

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function isFixedContractType(type: unknown): boolean {
  return normalizeToken(type) === 'fixed'
}

export function isFixedEnergyPriceComponent(component: PublicPricingComponent): boolean {
  const search = normalizeToken([
    component.component_code,
    component.name,
    component.unit,
    component.calculation_base,
  ].filter(Boolean).join(' '))

  const explicitCodes = new Set([
    'fixed_price',
    'fixed_price_ore_per_kwh',
    'fixed_energy_price',
    'fixed_kwh_price',
    'fastpris',
    'fast_elpris',
    'fast_kwh_pris',
  ])
  const code = normalizeToken(component.component_code)
  if (explicitCodes.has(code)) return true

  const hasFixedMarker = /(^|_)(fixed|fast)(_|$)/.test(search)
  const hasPriceMarker = /(^|_)(price|pris)(_|$)/.test(search)
  const hasEnergyMarker = /(^|_)(kwh|mwh|energy|el|ore)(_|$)/.test(search)
  return hasFixedMarker && hasPriceMarker && hasEnergyMarker
}

/**
 * Removes area-dependent fixed-price amounts before the customer's SE area is
 * verified. This must be used for every object that can cross the server/client
 * boundary or be rendered before area resolution.
 */
export function sanitizePricingComponentsBeforeAreaResolution(
  components: PublicPricingComponent[] | null | undefined,
  contractType: unknown,
): PublicPricingComponent[] {
  const source = components ?? []
  if (!isFixedContractType(contractType)) return source.map((component) => ({ ...component }))
  return source
    .filter((component) => !isFixedEnergyPriceComponent(component))
    .map((component) => ({ ...component }))
}
