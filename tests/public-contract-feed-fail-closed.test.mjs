import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const feed = read('lib/website/publicContractFeed.ts')
assert.match(feed, /snapshot\.contracts\.length > 0 && contracts\.length === 0/)
assert.match(feed, /ops_public_contracts_no_renderable_contracts/)
assert.match(feed, /blockers: blockedContracts/)

const endpoint = read('lib/website/publicContractsEndpoint.ts')
assert.match(endpoint, /ops_public_contracts_no_renderable_contracts/)
assert.match(endpoint, /UPSTREAM_CONTRACT_SCHEMA_INCOMPATIBLE/)

console.log('public-contract feed fail-closed tests passed')
