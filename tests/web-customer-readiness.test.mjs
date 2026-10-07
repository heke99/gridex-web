import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const tables = ['customer_profiles','customer_delivery_points','customer_notifications','customer_contracts','auth_profile_sync_jobs','public_support_receipts']
await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;')
for (const table of tables) await db.exec(`create table ${table}(id uuid); alter table ${table} enable row level security; grant all on ${table} to service_role;`)
const functions = [
 ['gridex_my_permissions_v1()', 'text[]', "array[]::text[]"],
 ['gridex_my_has_permission_v1(text)', 'boolean', 'false'],
 ['gridex_my_log_login_v1()', 'boolean', 'true'],
 ['gridex_enqueue_auth_profile_v1(uuid,text)', 'jsonb', "'{}'::jsonb"],
 ['gridex_commit_auth_profile_v1(uuid,integer,timestamptz)', 'boolean', 'true'],
 ['gridex_create_public_inquiry_v1(uuid,text,text,text,text,text,text,text,text,text)', 'uuid', 'null::uuid'],
 ['gridex_claim_public_receipts_v1(integer)', 'jsonb', "'[]'::jsonb"],
]
for (const [signature,type,value] of functions) {
 await db.exec(`create function ${signature} returns ${type} language sql as $$select ${value}$$; revoke all on function ${signature} from public; grant execute on function ${signature} to service_role;`)
 if (signature.startsWith('gridex_my_')) await db.exec(`grant execute on function ${signature} to authenticated;`)
}
await db.exec(await readFile(new URL('../supabase/migrations/20261007095931_web_customer_release_readiness.sql',import.meta.url),'utf8'))
const readiness = async () => (await db.query('select gridex_web_customer_readiness_v1() result')).rows[0].result
await db.exec('set role service_role')
assert.deepEqual(await readiness(), {ready:true, missing:[], schema_revision:'2026-10-07-web-customer-1'})
// No local pricing or staff/upstream schema exists in this fixture.
await db.exec('reset role; grant update(id) on customer_profiles to authenticated; set role service_role;')
assert.ok((await readiness()).missing.includes('client_write_grants:customer_profiles'))
await db.exec('reset role; revoke update(id) on customer_profiles from authenticated; alter table public_support_receipts disable row level security; set role service_role;')
assert.ok((await readiness()).missing.includes('rls:public_support_receipts'))
await db.exec('reset role; alter table public_support_receipts enable row level security; grant execute on function gridex_claim_public_receipts_v1(integer) to authenticated; set role service_role;')
assert.ok((await readiness()).missing.some(value=>value.startsWith('client_execute:')))
await db.exec('reset role; revoke execute on function gridex_claim_public_receipts_v1(integer) from authenticated; grant execute on function gridex_claim_public_receipts_v1(integer) to anon; set role service_role;')
assert.ok((await readiness()).missing.some(value=>value.startsWith('anon_execute:')))
await db.exec('reset role; revoke execute on function gridex_claim_public_receipts_v1(integer) from anon; drop function gridex_claim_public_receipts_v1(integer); set role service_role;')
assert.ok((await readiness()).missing.some(value=>value.startsWith('function:')))
await db.exec('reset role; set role authenticated')
await assert.rejects(readiness, /permission denied/)
await db.exec('reset role; set role anon')
await assert.rejects(readiness, /permission denied/)
await db.close()
console.log('Web-only readiness: missing dependencies, RLS, column grants and RPC isolation verified')
