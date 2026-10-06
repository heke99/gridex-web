import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const db = new PGlite()
const alice='11111111-1111-4111-8111-111111111111', bob='22222222-2222-4222-8222-222222222222'
await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; grant usage on schema public,auth to authenticated,service_role;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table public.customer_profiles(user_id uuid primary key,email text,email_verified_at timestamptz,onboarding_state text,external_customer_id text);
 create table public.user_profiles(id uuid primary key,user_id uuid,email text check(email not like 'invalid%'));
 create table public.customer_delivery_points(id uuid,user_id uuid);
 create table public.customer_notifications(id uuid,user_id uuid);
 create table public.customer_contracts(id uuid,user_id uuid,status text);
 create table public.auth_profile_sync_jobs(user_id uuid primary key,email text,otp_type text,status text,attempt_count int default 0,max_attempts int default 10,next_attempt_at timestamptz,last_error text,locked_at timestamptz,completed_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
 create function public.gridex_get_user_permissions(p_user_id uuid) returns text[] language sql as $$select array[p_user_id::text]$$;
 create function public.gridex_has_permission(p_user_id uuid,p_permission text) returns boolean language sql as $$select p_user_id='${alice}'::uuid and p_permission='admin.access'$$;
 create table public.audit_log(user_id uuid);
 create function public.gridex_log_customer_login(p_user_id uuid) returns void language sql as $$insert into public.audit_log values(p_user_id)$$;
 grant all on all tables in schema public to anon,authenticated,service_role;
 grant update(external_customer_id) on public.customer_profiles to authenticated;
 alter table public.customer_profiles enable row level security;
 create policy owner_select on public.customer_profiles for select to authenticated using(auth.uid()=user_id);
 create policy unsafe_owner_write on public.customer_profiles for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
 insert into auth.users values('${alice}','new@example.invalid',now()),('${bob}','bob@example.invalid',now());
 insert into public.customer_profiles(user_id,email,external_customer_id) values('${alice}','old@example.invalid','customer-alice'),('${bob}','bob@example.invalid','customer-bob');
`)
await db.exec(await readFile(new URL('../supabase/migrations/20261006204008_customer_portal_audit_hardening.sql',import.meta.url),'utf8'))
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false);`)
assert.equal((await db.query('select * from customer_profiles')).rows.length,1)
for(const sql of [`update customer_profiles set external_customer_id='forged' where user_id='${alice}'`,`insert into customer_contracts values(gen_random_uuid(),'${alice}','signed')`,`delete from customer_notifications`,`update customer_delivery_points set user_id='${bob}'`]) await assert.rejects(()=>db.exec(sql),/permission denied/)
assert.deepEqual((await db.query('select gridex_my_permissions_v1() as permissions')).rows[0].permissions,[alice])
assert.equal((await db.query("select gridex_my_has_permission_v1('admin.access') as allowed")).rows[0].allowed,true)
await db.exec('select gridex_my_log_login_v1();')
await assert.rejects(()=>db.exec(`select gridex_enqueue_auth_profile_v1('${alice}','email');`),/permission denied/)
await db.exec(`select set_config('request.jwt.claim.sub','${bob}',false);`)
assert.equal((await db.query("select gridex_my_has_permission_v1('admin.access') as allowed")).rows[0].allowed,false)
await db.exec('reset role;')
assert.equal((await db.query('select * from audit_log')).rows[0].user_id,alice)
await db.exec(`set role service_role; select gridex_enqueue_auth_profile_v1('${alice}','email_change'); update auth_profile_sync_jobs set status='processing',attempt_count=1,locked_at='2026-10-06T20:00:00Z'; reset role; update auth.users set email='latest@example.invalid' where id='${alice}'; set role service_role; select gridex_enqueue_auth_profile_v1('${alice}','email_change');`)
assert.equal((await db.query('select * from auth_profile_sync_jobs')).rows[0].email,'latest@example.invalid')
assert.equal((await db.query(`select gridex_commit_auth_profile_v1('${alice}',1,'2026-10-06T20:00:00Z') as committed`)).rows[0].committed,true)
assert.equal((await db.query(`select email from customer_profiles where user_id='${alice}'`)).rows[0].email,'latest@example.invalid')
assert.equal((await db.query(`select gridex_commit_auth_profile_v1('${alice}',1,'2026-10-06T20:00:00Z') as committed`)).rows[0].committed,false)
await db.exec(`reset role; update auth.users set email='invalid@example.invalid' where id='${alice}'; set role service_role; select gridex_enqueue_auth_profile_v1('${alice}','email_change'); update auth_profile_sync_jobs set status='processing',attempt_count=2,locked_at='2026-10-06T20:01:00Z';`)
await assert.rejects(()=>db.exec(`select gridex_commit_auth_profile_v1('${alice}',2,'2026-10-06T20:01:00Z')`),/check constraint/)
assert.equal((await db.query(`select email from customer_profiles where user_id='${alice}'`)).rows[0].email,'latest@example.invalid')
assert.equal((await db.query('select status from auth_profile_sync_jobs')).rows[0].status,'processing')
await db.exec(`reset role;
 create table public.admin_users(user_id uuid,role text,is_active boolean);
 create table contract_pricing_versions(id uuid primary key,contract_id uuid,version_number int,valid_from date,status text,is_published boolean,published_at timestamptz);
 create unique index contract_pricing_versions_one_published_per_contract on contract_pricing_versions(contract_id) where is_published;
 create unique index one_live_version_per_contract on contract_pricing_versions(contract_id) where is_published;
 create unique index one_published_version_per_contract on contract_pricing_versions(contract_id) where is_published;
 create table contract_area_pricing(id uuid default gen_random_uuid(),pricing_version_id uuid,price_area text,price_per_kwh_ore numeric,markup_ore numeric,monthly_fee_sek numeric check(monthly_fee_sek>=0),variable_fee_ore numeric,elcert_ore numeric,unique(pricing_version_id,price_area));
 create unique index contract_area_pricing_unique_area on contract_area_pricing(pricing_version_id,price_area);
 create unique index contract_area_pricing_unique_version_area on contract_area_pricing(pricing_version_id,price_area);
 create table pricing_version_audit(contract_id uuid,version_id uuid,action text,performed_by uuid,reason text);
 create table customer_support_tickets(id uuid primary key default gen_random_uuid(),user_id uuid,subject text,description text,category text,priority text,status text,metadata jsonb,assigned_user_id uuid,portal_contract_id uuid);
 create table customer_support_messages(id uuid default gen_random_uuid(),ticket_id uuid,sender_user_id uuid,sender_type text,body text check(body<>'force-rollback'));
 grant all on all tables in schema public to service_role;
`)
for (const name of ['20261006205014_legacy_pricing_atomic_writes.sql','20261006205027_public_support_durable_receipts.sql','20261006205350_audited_web_indexes.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'))
const contract='33333333-3333-4333-8333-333333333333', version='44444444-4444-4444-8444-444444444444'
await db.exec(`insert into contract_pricing_versions values('${version}','${contract}',1,current_date,'draft',false,null,null,null);`)
const rows=['SE1','SE2','SE3','SE4'].map(price_area=>({price_area,price_per_kwh_ore:100,markup_ore:2,monthly_fee_sek:49,variable_fee_ore:0,elcert_ore:0}))
await db.query('select gridex_save_pricing_rows_v1($1,$2,$3::jsonb)',[version,alice,JSON.stringify(rows)])
await assert.rejects(()=>db.query('select gridex_save_pricing_rows_v1($1,$2,$3::jsonb)',[version,alice,JSON.stringify(rows.map(r=>({...r,monthly_fee_sek:-1})))]),/check constraint/)
assert.equal((await db.query('select count(*)::int as n from contract_area_pricing')).rows[0].n,4)
assert.equal((await db.query('select min(monthly_fee_sek)::int as fee from contract_area_pricing')).rows[0].fee,49)
await db.query('select gridex_publish_pricing_v1($1,$2,$3,$4)',[contract,version,alice,'test publish'])
await assert.rejects(()=>db.query('select gridex_save_pricing_rows_v1($1,$2,$3::jsonb)',[version,alice,JSON.stringify(rows)]),/immutable/)
await assert.rejects(()=>db.query('select gridex_publish_pricing_v1($1,$2,$3,$4)',[contract,bob,alice,'bad version']),/no rows/)
assert.equal((await db.query('select is_published from contract_pricing_versions')).rows[0].is_published,true)
assert.equal((await db.query("select to_regclass('one_live_version_per_contract') as duplicate,to_regclass('contract_area_pricing_pricing_version_id_price_area_key') as constraint_index")).rows[0].duplicate,null)
await db.query('select gridex_publish_pricing_v1($1,$2,$3,$4)',[contract,null,alice,'unpublish'])
await assert.rejects(()=>db.query('select gridex_save_pricing_rows_v1($1,$2,$3::jsonb)',[version,alice,JSON.stringify(rows)]),/immutable/)
const clone=(await db.query('select gridex_create_pricing_version_v1($1,$2,$3,$4,$5) as id',[contract,alice,null,version,'clone test'])).rows[0].id
assert.equal((await db.query('select count(*)::int as n from contract_area_pricing where pricing_version_id=$1',[clone])).rows[0].n,4)
assert.equal((await db.query('select status from contract_pricing_versions where id=$1',[clone])).rows[0].status,'draft')
await assert.rejects(()=>db.query('select gridex_create_pricing_version_v1($1,$2,$3,$4,$5)',[contract,alice,null,bob,'invalid clone']),/no rows/)
assert.equal((await db.query('select count(*)::int as n from contract_pricing_versions')).rows[0].n,2)
const operation='55555555-5555-4555-8555-555555555555'
const intake=[operation,'hash','Testkund','customer@example.invalid',null,'general','Testärende','test body',null,null]
const call='select gridex_create_public_inquiry_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as ticket'
const ticket=(await db.query(call,intake)).rows[0].ticket
assert.equal((await db.query(call,intake)).rows[0].ticket,ticket)
await assert.rejects(()=>db.query(call,[operation,'different',...intake.slice(2)]),/idempotency_conflict/)
assert.equal((await db.query('select count(*)::int as n from customer_support_tickets')).rows[0].n,1)
await assert.rejects(()=>db.query(call,['66666666-6666-4666-8666-666666666666','rollback',...intake.slice(2,7),'force-rollback',null,null]),/check constraint/)
assert.equal((await db.query('select count(*)::int as n from customer_support_tickets')).rows[0].n,1)
const claimed=(await db.query('select * from gridex_claim_public_receipts_v1(25)')).rows
assert.equal(claimed.length,1)
assert.equal((await db.query('select * from gridex_claim_public_receipts_v1(25)')).rows.length,0)
await db.exec("update public_support_receipts set locked_at=now()-interval '16 minutes'")
const reclaimed=(await db.query('select * from gridex_claim_public_receipts_v1(25)')).rows[0]
assert.notEqual(reclaimed.claim_token,claimed[0].claim_token)
assert.equal((await db.query("update public_support_receipts set status='sent' where operation_id=$1 and claim_token=$2 returning operation_id",[operation,claimed[0].claim_token])).rows.length,0)
await db.exec(await readFile(new URL('../supabase/migrations/20261006210639_audited_release_preflight.sql',import.meta.url),'utf8'))
const readiness=(await db.query('select gridex_web_audit_readiness_v1() as result')).rows[0].result
assert.equal(readiness.ready,false)
assert.deepEqual(readiness.missing.sort(), ['function:public.gridex_support_claim_staff_delivery_v1(jsonb)','function:public.gridex_support_complete_staff_delivery_v1(jsonb)','function:public.gridex_support_existing_invitation_subject_v1(text)','table:support_private.staff_invitation_deliveries'].sort())
assert.ok(!readiness.missing.some(value=>value.startsWith('client_write_grants:')))
await db.exec('set role authenticated')
await assert.rejects(()=>db.query('select gridex_web_audit_readiness_v1()'),/permission denied/)
await db.close()
console.log('Pricing, support receipt transactions, duplicate-index checks and queue ownership passed')
console.log('Audit SQL regressions passed: customer isolation, forged writes denied, scoped permissions, current Auth email, fencing and atomic rollback')
