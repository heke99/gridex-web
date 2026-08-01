import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const client = read('lib/ops/client.ts')
assert.match(client, /cache:\s*'no-store'/)
assert.match(client, /readWebsitePublicContractSnapshot/)
assert.match(client, /storeWebsitePublicContractSnapshot/)
assert.match(client, /rejected_empty_without_verified_unpublish|retained last-known-good snapshot/)
assert.match(client, /ops_public_contracts_all_blocked/)
assert.match(client, /ops_public_contracts_empty_unverified/)
assert.match(client, /ops_public_contracts_empty_verification_unavailable/)
assert.match(client, /if \(persistenceResult && !persistenceResult\.stored\)/)
assert.match(client, /if \(parsed\.contracts\.length === 0 && parsed\.blockedContracts\.length > 0\)/)
assert.doesNotMatch(
  client.slice(client.indexOf('export async function fetchOpsPublicContractsSnapshot'), client.indexOf('export async function fetchOpsPublicContracts(')),
  /force-cache|revalidateSeconds:\s*60/,
)

const store = read('lib/website/publicContractSnapshotStore.ts')
assert.match(store, /website_public_contract_snapshots/)
assert.match(store, /store_website_public_contract_snapshot/)

const migration = read('supabase/migrations/20260801133000_public_contract_last_known_good.sql')
assert.match(migration, /pg_advisory_xact_lock/)
assert.match(migration, /rejected_empty_without_verified_unpublish/)
assert.match(migration, /v_publication_revision = p_publication_revision/)
assert.match(migration, /publication_reason/)
assert.match(migration, /all_contracts_unpublished/)
assert.doesNotMatch(migration, /v_normalized_reason ~ '\(unpublish/)
assert.match(migration, /already bound to another tenant or customer type/)
assert.match(migration, /p_upstream_count = 0/)
assert.match(migration, /if v_candidate_empty and not v_empty_authorized then/)
assert.match(migration, /enable row level security/)
assert.match(migration, /grant execute .*service_role/s)

const webhook = read('lib/webhooks/publicationChanged.ts')
assert.match(webhook, /revalidateTag\(WEBSITE_PUBLIC_CONTRACTS_CACHE_TAG, 'max'\)/)
assert.match(webhook, /WEBSITE_PUBLIC_CONTRACT_PATHS/)
assert.match(webhook, /result\.result === 'duplicate'/)
assert.match(webhook, /cache revalidation failed after durable apply/)

const health = read('app/api/internal/integrations/gridex/health/route.ts')
assert.match(health, /durable_public_contract_cache/)
assert.match(health, /inspectWebsitePublicContractSnapshotStore/)

const endpoint = read('lib/website/publicContractsEndpoint.ts')
assert.match(endpoint, /'Cache-Control': 'no-store, max-age=0'/)

console.log('public-contract cache durability tests passed')
