const portalOrigin = 'https://mina-sidor-demo.gridex.se'
const apiBase = 'https://demo.gridex.se/api/v1'

export function elklartDemoEnabled(): boolean {
  return process.env.ELKLART_DEMO_ENABLED === 'true'
}

export function demoOpsApiBase(): string {
  const configuredPortal = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
  const configuredApi = process.env.GRIDEX_OPS_API_URL?.trim().replace(/\/+$/, '')
  const localRuntime = process.env.ELKLART_DEMO_LOCAL_RUNTIME === 'true'
    && process.env.NODE_ENV === 'development'
    && !process.env.VERCEL_ENV
    && ((configuredPortal === 'http://localhost:3001' && configuredApi === 'http://localhost:3000/api/v1')
      || (configuredPortal === 'https://localhost:3001' && configuredApi === 'https://localhost:3000/api/v1'))
  if (localRuntime) return configuredApi!
  if (configuredPortal !== portalOrigin || configuredApi !== apiBase) {
    throw new Error('Elklart-demot kräver egna konfigurerade adresser för kundportalen och OPS.')
  }
  return apiBase
}

export function customerPortalBrand(defaultName: string): string {
  return elklartDemoEnabled() ? 'Elklart · Demo' : defaultName
}
