import { readFile, writeFile } from 'node:fs/promises'

const codeFiles = [
  'lib/ops/client/core.ts',
  'lib/ops/client/types.ts',
  'lib/ops/client/website.ts',
  'lib/website/publicContractSnapshotStore.ts',
  'lib/webhooks/opsWebhook.ts',
  'lib/webhooks/publicationChanged.ts',
  'lib/webhooks/retry.ts',
  'app/webhooks/gridex/route.ts',
  'app/api/internal/integrations/gridex/health/route.ts',
]

const testFiles = [
  'tests/website-api-runtime.contract.test.mjs',
  'tests/api-contract-regressions-20260801.test.mjs',
  'tests/ops-webhook.test.mjs',
  'tests/ops-webhook-runtime.test.mjs',
  'tests/publication-webhook.test.mjs',
  'tests/public-contract-cache.test.mjs',
  'tests/public-contract-failure-visibility.test.mjs',
]

async function update(path, transform) {
  let source
  try {
    source = await readFile(path, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
  const next = transform(source)
  if (next === source) return false
  await writeFile(path, next)
  console.log(`updated ${path}`)
  return true
}

function canonicalizeExternalIdentity(source) {
  return source
    .replaceAll('opsTenantCacheKey', 'opsOrganizationCacheKey')
    .replaceAll('tenantReferenceFromPayload', 'organizationReferenceFromPayload')
    .replaceAll('assertTenantReference', 'assertOrganizationReference')
    .replaceAll('verifiedTenantReference', 'verifiedOrganizationReference')
    .replaceAll('tenantReference', 'organizationReference')
    .replaceAll('TenantReference', 'OrganizationReference')
    .replaceAll('tenant_reference', 'organization_reference')
    .replaceAll('ops_tenant_binding_unverified', 'ops_organization_binding_unverified')
    .replaceAll('ops_tenant_mismatch', 'ops_organization_mismatch')
    .replaceAll('expected_tenant_reference', 'expected_organization_reference')
    .replaceAll('received_tenant_reference', 'received_organization_reference')
    .replaceAll('tenant-bindningen', 'organisationsbindningen')
    .replaceAll('fel tenant', 'fel organisation')
    .replaceAll('complete_tenant_website_ready', 'complete_integration_ready')
    .replaceAll('completeTenantWebsiteReady', 'completeIntegrationReady')
    .replaceAll('missing_website_checkout_scopes', 'missing_website_scopes')
    .replaceAll('missingWebsiteCheckoutScopes', 'missingWebsiteScopes')
    .replaceAll('recommended_missing_scopes', 'missing_recommended_scopes')
    .replaceAll('recommendedMissingScopes', 'missingRecommendedScopes')
    .replaceAll('required_website_checkout_scopes', 'required_website_scopes')
    .replaceAll('requiredWebsiteCheckoutScopes', 'requiredWebsiteScopes')
}

for (const path of codeFiles) {
  await update(path, (input) => {
    let source = canonicalizeExternalIdentity(input)

    if (path === 'lib/ops/client/core.ts') {
      source = source
        .replace(/^\s*const tenantIdEnvironmentRequired = .*\n/m, '')
        .replace(/^\s*const companyIdEnvironmentRequired = .*\n/m, '')
        .replace(/^\s*company_id: pickFromRecords\([^\n]*\),\n/m, '')
        .replace(/^\s*tenant_id_environment_required: false,\n/m, '')
        .replace(/^\s*company_id_environment_required: false,\n/m, '')
        .replace('website_openapi_url: websiteOpenapiUrl', 'openapi_url: websiteOpenapiUrl')
        .replace(/^\s*missing_complete_tenant_website_scopes: completeMissing,\n/m, '')
        .replace(/^\s*if \(tenantIdEnvironmentRequired !== false \|\| companyIdEnvironmentRequired !== false\) \{\n\s*integrationWarnings\.push\(\{\n\s*code: 'tenant_environment_requirement_drift',\n\s*tenant_id_environment_required: tenantIdEnvironmentRequired,\n\s*company_id_environment_required: companyIdEnvironmentRequired,\n\s*\}\)\n\s*\}\n/m, '')
    }

    if (path === 'lib/ops/client/types.ts') {
      source = source
        .replace(/^\s*company_id\?: string \| null;\n/m, '')
        .replace(/^\s*tenant_id_environment_required: false;\n/m, '')
        .replace(/^\s*company_id_environment_required: false;\n/m, '')
        .replaceAll('website_openapi_url: string;', 'openapi_url: string;')
        .replace(/^\s*missing_complete_tenant_website_scopes: string\[\];\n/mg, '')
    }

    if (path === 'lib/website/publicContractSnapshotStore.ts') {
      source = source
        .replace("rpc('store_website_public_contract_snapshot',", "rpc('store_website_public_contract_snapshot_v2',")
    }

    if (path === 'app/webhooks/gridex/route.ts') {
      source = source
        .replace("rpc('apply_ops_publication_event',", "rpc('apply_ops_publication_event_v2',")
    }

    return source
  })
}

for (const path of testFiles) {
  await update(path, (input) => {
    let source = canonicalizeExternalIdentity(input)
      .replaceAll('TENANT_REFERENCE', 'ORGANIZATION_REFERENCE')
      .replaceAll("'tenant_runtime_test'", "'organization_runtime_test_0123456789'")
      .replace(/^\s*tenant_id_environment_required: false,\n/mg, '')
      .replace(/^\s*company_id_environment_required: false,\n/mg, '')
    return source
  })
}

console.log('Canonical organization reference cutover applied.')
