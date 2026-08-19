import { readFile, writeFile } from 'node:fs/promises'

const targets = [
  'lib/ops/client/application.ts',
  'lib/ops/portalReadiness.ts',
  'lib/ops/readiness.ts',
  'tests/website-api-runtime.contract.test.mjs',
  'tests/api-contract-regressions-20260801.test.mjs',
]

const replacements = [
  ['verifiedTenantReference', 'verifiedOrganizationReference'],
  ['complete_tenant_website_ready', 'complete_integration_ready'],
  ['completeTenantWebsiteReady', 'completeIntegrationReady'],
  ['missing_website_checkout_scopes', 'missing_website_scopes'],
  ['missingWebsiteCheckoutScopes', 'missingWebsiteScopes'],
  ['recommended_missing_scopes', 'missing_recommended_scopes'],
  ['recommendedMissingScopes', 'missingRecommendedScopes'],
  ["'tenant_ready'", "'organization_binding_ready'"],
  ['tenant_ready:', 'organization_binding_ready:'],
  ["'tenant_verified'", "'organization_verified'"],
  ["'tenant_unverified'", "'organization_unverified'"],
  ['Tenantidentiteten härleds och verifieras från API-nyckeln.', 'Organisationsidentiteten härleds och verifieras från serverns API-nyckel.'],
]

let changed = 0
for (const path of targets) {
  let source
  try {
    source = await readFile(path, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') continue
    throw error
  }
  let next = source
  for (const [from, to] of replacements) next = next.replaceAll(from, to)

  if (path === 'lib/ops/readiness.ts') {
    next = next
      .replace(/^\s*\| 'tenant_isolation_ready'\n/m, '')
      .replace(/^\s*const tenantIsolationVerified =\n\s*process\.env\.GRIDEX_TWO_TENANT_ISOLATION_VERIFIED === 'true'\n/m, '')
      .replace(/\n    tenant_isolation_ready: check\([\s\S]*?\n    \),\n    full_api_compatibility_ready:/m, '\n    full_api_compatibility_ready:')
      .replace(/^\s*'tenant_isolation_ready',\n/m, '')
  }

  if (next !== source) {
    await writeFile(path, next)
    console.log(`updated ${path}`)
    changed += 1
  }
}
console.log(`updated ${changed} files`)
