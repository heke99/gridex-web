import {
  isWebsitePriceArea,
  normalizeWebsitePostalCode,
  resolveWebsiteEnergyArea,
  type WebsiteEnergyResolveInput,
  type WebsiteEnergyResolution,
  type WebsitePricingPreview,
} from './publicApi'

export function energyAreaLookupKey(input: WebsiteEnergyResolveInput): string {
  return JSON.stringify([
    normalizeWebsitePostalCode(input.postal_code ?? ''),
    (input.city ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv-SE'),
    (input.address ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv-SE'),
    input.requested_start_mode ?? 'earliest_possible', input.requested_start_date ?? null,
  ])
}

function assertResolution(value: WebsiteEnergyResolution, now: number) {
  const assurance = value?.price_area_assurance
  if (
    !isWebsitePriceArea(value?.price_area_code) ||
    typeof value.resolution_id !== 'string' || !value.resolution_id.trim() ||
    typeof value.resolution_token !== 'string' || !value.resolution_token.trim() || value.resolution_token.length > 12_000 ||
    typeof value.valid_until !== 'string' || !Number.isFinite(Date.parse(value.valid_until)) || Date.parse(value.valid_until) <= now ||
    value.capabilities?.pricing_ready !== true ||
    !assurance || !['verified', 'estimated'].includes(assurance.status) ||
    assurance.price_area !== value.price_area_code || assurance.unique_price_area_count !== 1
  ) throw new Error('Elområdet kunde inte bekräftas för adressen. Kontrollera uppgifterna och försök igen.')
}

/** One instance per calculator: no address or token is shared or persisted. */
export function createEnergyAreaLookup(
  resolve = resolveWebsiteEnergyArea,
  now = Date.now,
  timeoutMs = 12_000,
) {
  let cached: { key: string; value: WebsiteEnergyResolution; expires: number } | null = null
  let active: { key: string; controller: AbortController; promise: Promise<WebsiteEnergyResolution> } | null = null
  function clear() {
    active?.controller.abort()
    active = null
    cached = null
  }
  return {
    clear,
    get(input: WebsiteEnergyResolveInput): Promise<WebsiteEnergyResolution> {
      const key = energyAreaLookupKey(input)
      if (cached?.key === key && cached.expires > now()) return Promise.resolve(cached.value)
      if (active?.key === key) return active.promise
      clear()
      const controller = new AbortController()
      const request = { key, controller, promise: null as unknown as Promise<WebsiteEnergyResolution> }
      active = request
      const timer = setTimeout(() => controller.abort(new Error('Adresskontrollen tog för lång tid. Försök igen.')), timeoutMs)
      request.promise = (async () => {
        try {
          const value = await resolve(input, { signal: controller.signal })
          if (controller.signal.aborted) throw controller.signal.reason
          assertResolution(value, now())
          if (active === request) cached = {
            key, value,
            // The Web-signed area token is capped at30 minutes even when the
            // upstream resolution lives longer. Refresh slightly before that.
            expires: Math.min(Date.parse(value.valid_until!) - 5_000, now() + 29 * 60_000),
          }
          return value
        } finally {
          clearTimeout(timer)
          if (active === request) active = null
        }
      })()
      return request.promise
    },
  }
}

export function assertQuoteMatchesArea(
  preview: WebsitePricingPreview,
  resolution: WebsiteEnergyResolution,
  offerReference: string,
) {
  if (
    preview?.priceArea !== resolution.price_area_code ||
    (preview.price_area_code != null && preview.price_area_code !== resolution.price_area_code) ||
    preview.contract?.offer_reference !== offerReference
  ) throw new Error('Priset stämmer inte med adressens elområde och valt avtal. Hämta priset igen.')
}
