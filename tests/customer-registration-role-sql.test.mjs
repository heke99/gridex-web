import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/20261020104944_customer_registration_default_role.sql', import.meta.url), 'utf8')
// This is the exact faulty production definition, including its search_path.
const legacy = `CREATE OR REPLACE FUNCTION public.assign_default_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
begin
  insert into user_roles (user_id, role)
  values (new.id, 'staff');
  return new;
end;
$function$
`
const staff = '11111111-1111-4111-8111-111111111111'
const customer = '22222222-2222-4222-8222-222222222222'
test('actual migration makes native signup customer-only, ignores supplied roles and preserves existing staff', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create schema extensions;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
      create table public.user_profiles(id uuid primary key references auth.users(id),user_id uuid,email text);
      create table public.user_roles(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),role text not null);`)
    await db.exec(legacy)
    await db.exec(`create trigger on_user_profile_created after insert on public.user_profiles for each row execute function public.assign_default_role();
      create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='public' as $$
        begin insert into public.user_profiles(id,user_id,email) values(new.id,new.id,new.email);return new;end $$;
      create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
      insert into auth.users(id,email) values('${staff}','staff@example.invalid');`)
    const before = (await db.query('select * from user_roles where user_id=$1', [staff])).rows
    await db.exec(migration)
    await db.query('insert into auth.users values($1,$2,$3::jsonb)', [customer, 'customer@example.invalid', JSON.stringify({ role: 'super_admin', staff: true, roles: ['staff', 'admin'] })])
    assert.deepEqual((await db.query('select role from user_roles where user_id=$1', [customer])).rows, [{ role: 'customer' }])
    assert.deepEqual((await db.query('select * from user_roles where user_id=$1', [staff])).rows, before)
    assert.equal((await db.query('select count(*)::int n from user_roles')).rows[0].n, 2)
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query("select has_function_privilege($1,'public.assign_default_role()','execute') allowed", [role])).rows[0].allowed, false)
    }
    assert.equal((await db.query("select proconfig from pg_proc where oid='public.assign_default_role()'::regprocedure")).rows[0].proconfig[0], 'search_path=""')
  } finally { await db.close() }
})
test('migration refuses to overwrite an unexpected concurrent role-trigger change', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon;create role authenticated;create table public.user_profiles(id uuid,user_id uuid);
      create function public.assign_default_role() returns trigger language plpgsql as $$begin return new;end $$;`)
    await assert.rejects(db.exec(migration), /Default role source changed/)
    await db.exec('rollback')
  } finally { await db.close() }
})
