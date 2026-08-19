import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readOpsClientImplementation } from './ops-client-source.mjs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const client = readOpsClientImplementation()
assert.match(client, /cache:\s*'no-store'/)
assert.match(client, /readWebsitePublicContractSnapshot/)
assert.match(client, /storeWebsitePublicContractSnapshot/)
assert.match(client, /retained last-known-good snapshot/)
assert.match(client, /platform_schema_not_ready/)
assert.match(client, /integration context unavailable; trying API-key-bound snapshot/)
assert.match(client, /integrationContextSnapshotFallbackEligible/)
assert.match(client, /ops_public_contracts_all_blocked/)
assert.match(client, /ops_public_contracts_empty_unverified/)
assert.match(client, /ops_public_contracts_empty_verification_unavailable/)
assert.match(client, /if \(persistenceResult && !persistenceResult\.stored\)/)
assert.match(client, /const allBlocked = parsed\.contracts\.length === 0 && parsed\.blockedContracts\.length > 0/)
assert.doesNotMatch(
  client.slice(client.indexOf('export async function fetchOpsPublicContractsSnapshot'), client.indexOf('export async function fetchOpsPublicContracts(')),
  /force-cache|revalidateSeconds:\s*60/,
)

const store = read('lib/website/publicContractSnapshotStore.ts')
assert.match(store, /website_public_contract_snapshots/)
assert.match(store, /store_website_public_contract_snapshot_v2/)
assert.match(store, /organizationReference\?: string \| null/)
assert.match(store, /expected\.organizationReference && row\.organization_reference !== expected\.organizationReference/)

const migration = read('supabase/migrations/20260802223000_public_contract_canonical_empty_proof.sql')
assert.match(migration, /pg_advisory_xact_lock/)
assert.match(migration, /feed_state = 'canonical_empty'/)
assert.match(migration, /p_empty_feed_authorization/)
assert.match(migration, /canonical_public_contract_delivery_readiness_v/)
assert.match(migration, /publication_validity_ended/)
assert.match(migration, /canonical_no_visible_contracts/)
assert.match(migration, /p_upstream_count <> p_accepted_count \+ p_blocked_count/)
assert.match(migration, /already bound to another tenant or customer type/)
assert.match(migration, /drop function if exists public\.store_website_public_contract_snapshot/)
assert.match(migration, /grant execute .*service_role/s)
assert.doesNotMatch(migration, /grant execute on function[\s\S]*?\) to anon;/)
assert.doesNotMatch(migration, /grant execute on function[\s\S]*?\) to authenticated;/)

const sharedSchema = read('supabase/migrations/20260803102000_public_contract_snapshot_portable_schema.sql')
assert.match(sharedSchema, /create table if not exists public\.ops_publication_state/)
assert.match(sharedSchema, /create table if not exists public\.website_public_contract_snapshots/)
assert.match(sharedSchema, /to_regclass\('public\.contract_publication_revisions'\)/)
assert.match(sharedSchema, /dynamic sql/i)
assert.match(sharedSchema, /grant select, insert, update on public\.website_public_contract_snapshots to service_role/)
assert.doesNotMatch(sharedSchema, /grant .*website_public_contract_snapshots.* to (anon|authenticated)/)

const sharedRpc = read('supabase/migrations/20260803102100_public_contract_snapshot_portable_rpc.sql')
assert.match(sharedRpc, /coalesce\(p_snapshot -> 'empty_feed_authorization', 'null'::jsonb\)/)
assert.match(sharedRpc, /v_has_shared_canonical_source/)
assert.match(sharedRpc, /rejected_ahead_of_canonical_publication_state/)
assert.match(sharedRpc, /rejected_older_than_local_publication_state/)
assert.match(sharedRpc, /to_regclass\('public\.contract_publication_revisions'\)/)
assert.match(sharedRpc, /authenticated and schema-validated/)
assert.match(sharedRpc, /grant execute .*service_role/s)
assert.doesNotMatch(sharedRpc, /grant execute on function[\s\S]*?\) to anon;/)
assert.doesNotMatch(sharedRpc, /grant execute on function[\s\S]*?\) to authenticated;/)

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
