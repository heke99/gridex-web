import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compareContractVersions } from '../lib/ops/contractCompatibility.ts'
import { stockholmValidityStatus } from '../lib/website/businessDate.ts'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const drift = compareContractVersions('2026-07-30.1', '2026-07-30.2')
assert.equal(drift.exactMatch, false)
assert.equal(drift.parseable, true)
assert.equal(drift.newerThanLocal, true)
assert.equal(compareContractVersions('2026-07-30.1', null).headerPresent, false)

const duringLastStockholmDay = new Date('2026-07-30T22:00:01.000Z')
assert.equal(
  stockholmValidityStatus({ validTo: '2026-07-31', now: duringLastStockholmDay }),
  'active',
)
assert.equal(
  stockholmValidityStatus({ validTo: '2026-07-30', now: duringLastStockholmDay }),
  'expired',
)
assert.equal(
  stockholmValidityStatus({ validFrom: '2026-02-30', now: duringLastStockholmDay }),
  'invalid',
)

const transport = read('lib/ops/transport.ts')
assert.match(transport, /logContractVersionDrift/)
assert.doesNotMatch(transport, /headers\.has\('Idempotency-Key'\)/)
assert.match(transport, /method === 'GET' \|\| method === 'HEAD'/)

const client = read('lib/ops/client.ts')
assert.match(client, /blocked_contracts/)
assert.match(client, /publicContractParseReasons/)
assert.match(client, /compatible configuration drift detected/)

assert.match(client, /document_reference/)
assert.doesNotMatch(client, /acceptance\.document_id/)

const signup = read('app/(public)/teckna-avtal/page.tsx')
assert.match(signup, /document_reference: requirement\.document_reference/)
assert.doesNotMatch(signup, /document_id: requirement\.document_id/)

const endpoint = read('lib/website/publicContractsEndpoint.ts')
assert.doesNotMatch(endpoint, /tenant_reference:/)
assert.match(endpoint, /blocked_contracts: feed\.blockedContracts/)
assert.match(endpoint, /feed\.state/)

const dto = read('lib/website/publicDtos.ts')
assert.match(dto, /price_options: priceOptions/)
assert.match(dto, /selectable_components: selectableComponents/)
assert.doesNotMatch(dto, /\.\.\.contract/)

const config = read('lib/ops/config.ts')
assert.match(config, /GRIDEX_WEBSITE_API_KEY/)
assert.match(config, /deprecated fallback/)
assert.match(config, /canonical OPS-origin/)

const health = read('app/api/internal/integrations/gridex/health/route.ts')
assert.match(health, /force_refresh/)
assert.match(health, /getAdminContext/)
assert.doesNotMatch(health, /apiKey\.value|Authorization/)

console.log('gridex runtime hardening tests passed')
