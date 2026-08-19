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
  if (next !== source) {
    await writeFile(path, next)
    console.log(`updated ${path}`)
    changed += 1
  }
}
console.log(`updated ${changed} files`)
