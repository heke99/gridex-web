import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const compatibilitySource = readFileSync(new URL('../lib/ops/schemaCompatibility.ts', import.meta.url), 'utf8')
const contractSource = readFileSync(new URL('../lib/ops/contract.ts', import.meta.url), 'utf8')
const websiteOpenApi = JSON.parse(
  readFileSync(new URL('../docs/openapi/website-integration-v1.json', import.meta.url), 'utf8'),
)

assert.ok(compatibilitySource.includes("instancePath === '/contract_schema_version'"))
assert.ok(compatibilitySource.includes("instancePath === '/contract_version'"))
assert.ok(compatibilitySource.includes('versionOnly'))

const contractVersionMatch = contractSource.match(
  /GRIDEX_API_CONTRACT_VERSION = '([^']+)' as const/,
)
assert.ok(contractVersionMatch, 'Gridex Web must expose a canonical local OPS contract version')
const localContractVersion = contractVersionMatch[1]

assert.equal(websiteOpenApi.info.version, localContractVersion)
assert.equal(websiteOpenApi['x-contract-schema-version'], localContractVersion)

const integrationContext = websiteOpenApi.components.schemas.IntegrationContext
assert.ok(integrationContext.required.includes('contract_version'))
assert.equal(
  integrationContext.properties.contract_version.const,
  localContractVersion,
  'integration/context must validate the same OPS release that Gridex Web declares locally',
)

const integrationContextResponse =
  websiteOpenApi.paths['/api/v1/integration/context'].get.responses['200']
    .content['application/json'].schema
assert.equal(
  integrationContextResponse.properties.data.$ref,
  '#/components/schemas/IntegrationContext',
)
assert.notEqual(
  integrationContextResponse.additionalProperties,
  false,
  'integration/context must continue accepting canonical envelope metadata such as request_id and contract_schema_version',
)

console.log(`Forward contract version compatibility tests passed (${localContractVersion})`)
