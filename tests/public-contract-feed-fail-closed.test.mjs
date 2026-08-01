import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const feed = read('lib/website/publicContractFeed.ts')
assert.doesNotMatch(feed, /ops_public_contracts_no_renderable_contracts/)
assert.match(feed, /feed_loaded_with_blocked_contracts/)
assert.match(feed, /source: 'website_readiness'/)
assert.match(feed, /return \{ contracts, blockedContracts, state, snapshot \}/)

const endpoint = read('lib/website/publicContractsEndpoint.ts')
assert.doesNotMatch(endpoint, /ops_public_contracts_no_renderable_contracts/)
assert.match(endpoint, /UPSTREAM_CONTRACT_SCHEMA_INCOMPATIBLE/)

console.log('public-contract feed contract-isolation tests passed')
