import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const pairs = JSON.parse(await readFile(new URL('./fixtures/audit-ui/duplicate-policies.json', import.meta.url), 'utf8'))
const migration = await readFile(new URL('../supabase/migrations/20261006214901_audited_duplicate_policies.sql', import.meta.url), 'utf8')
const db = new PGlite()
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222'
const ca = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', cb = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const tables = [...new Set(pairs.map(p => p.table))]
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
    grant usage on schema auth to anon,authenticated,service_role;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function gridex_user_is_platform_admin() returns boolean language sql stable as $$select current_setting('test.actor',true)='admin'$$;
    create function gridex_can_read_company(c uuid) returns boolean language sql stable as $$select c='${ca}'::uuid and current_setting('test.actor',true) in ('staff_read','staff_write')$$;
    create function gridex_can_write_company(c uuid) returns boolean language sql stable as $$select c='${ca}'::uuid and current_setting('test.actor',true)='staff_write'$$;`)
  for (const table of tables) {
    await db.exec(`create table public.${table}(id int primary key,user_id uuid,company_id uuid,value int default 0);
      alter table public.${table} enable row level security;
      grant select,insert,update on public.${table} to anon,authenticated,service_role;
      insert into public.${table}(id,user_id,company_id) values (1,'${a}','${ca}'),(2,'${b}','${cb}'),(3,'${a}',null),(4,'${b}',null);`)
  }
  const commands = { r: 'select', a: 'insert', w: 'update', d: 'delete', '*': 'all' }
  for (const p of pairs) for (const name of [p.keep,p.drop]) {
    await db.exec(`create policy "${name}" on public.${p.table} for ${commands[p.command]} to public ${p.using ? `using (${p.using})` : ''} ${p.check ? `with check (${p.check})` : ''};`)
  }
  const snapshot = async () => {
    const out = []
    for (const table of tables) for (const actor of ['anon','customer_a','customer_b','staff_read','staff_write','admin','service']) {
      const role = actor==='anon'?'anon':actor==='service'?'service_role':'authenticated'
      const uid = actor==='customer_a'?a:actor==='customer_b'?b:''
      for (const operation of ['read','insert_a','insert_b','insert_null','update']) {
        await db.exec(`begin; set local role ${role}; select set_config('test.uid','${uid}',true); select set_config('test.actor','${actor}',true);`)
        try {
          const query = operation==='read'?`select id from public.${table} order by id`:
            operation==='update'?`update public.${table} set value=1 returning id`:
              `insert into public.${table}(id,user_id,company_id) values(5,'${a}',${operation==='insert_null'?'null':`'${operation==='insert_a'?ca:cb}'`}) returning id`
          const result = await db.query(query)
          out.push([table,actor,operation,result.rows.map(r=>r.id).sort()])
        } catch (e) { out.push([table,actor,operation,e.code]) }
        finally { await db.exec('rollback') }
      }
    }
    return out
  }
  const before = await snapshot()
  assert.deepEqual(before.find(r=>r[0]==='contract_agreements'&&r[1]==='customer_a'&&r[2]==='read')[3],[1,3])
  assert.deepEqual(before.find(r=>r[0]==='contract_agreements'&&r[1]==='customer_b'&&r[2]==='read')[3],[2,4])
  assert.deepEqual(before.find(r=>r[0]==='audit_logs'&&r[1]==='staff_read'&&r[2]==='read')[3],[1])
  assert.deepEqual(before.find(r=>r[0]==='contract_agreements'&&r[1]==='anon'&&r[2]==='read')[3],[])
  await db.exec(migration)
  const after = await snapshot()
  assert.deepEqual(after,before)
  assert.equal((await db.query('select count(*)::int n from pg_policy')).rows[0].n,54)
  await db.exec(migration)
  assert.deepEqual(await snapshot(),before)
  // Catalog drift, a different role or restrictive policy must prevent removal.
  const p = pairs[0]
  await db.exec(`create policy ${p.drop} on public.${p.table} for insert to public with check (false);`)
  await db.exec(migration)
  assert.equal((await db.query('select count(*)::int n from pg_policy where polname=$1',[p.drop])).rows[0].n,1)
  await db.exec(`drop policy ${p.drop} on public.${p.table}; create policy ${p.drop} on public.${p.table} for insert to authenticated with check (${p.check});`)
  await db.exec(migration)
  assert.equal((await db.query('select count(*)::int n from pg_policy where polname=$1',[p.drop])).rows[0].n,1)
  await db.exec(`drop policy ${p.keep} on public.${p.table}; drop policy ${p.drop} on public.${p.table};
    create policy ${p.keep} on public.${p.table} as restrictive for insert to public with check (${p.check});
    create policy ${p.drop} on public.${p.table} as restrictive for insert to public with check (${p.check});`)
  await db.exec(migration)
  assert.equal((await db.query('select count(*)::int n from pg_policy where polname=$1',[p.drop])).rows[0].n,1)
  console.log(`Policy deduplication preserved ${before.length} access outcomes across ${tables.length} tables and seven actors; drift, roles and restrictive policies remain protected`)
} finally { await db.close() }
