-- All Web RBAC/company mutations use server operations that verify the actor's
-- explicit permission before using service_role. Legacy RLS predicates permit
-- company editors to promote memberships or grant overrides, and admin.access
-- is console entry rather than authority to change permission assignments.
-- Preserve the existing SELECT grants and RLS policies; close the browser's
-- table and column mutation privileges, including operations that bypass RLS.
do $$
declare
  v_table text;
  v_columns text;
begin
  foreach v_table in array array[
    'roles', 'permissions', 'role_permissions', 'user_roles', 'user_permissions',
    'user_permission_overrides', 'admin_users', 'companies', 'company_memberships'
  ] loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on table public.%I from public, anon, authenticated',
      v_table
    );
    -- Production runs PostgreSQL 17, which introduced the MAINTAIN privilege.
    -- Retain compatibility with isolated PostgreSQL 16 migration verification.
    if current_setting('server_version_num')::integer >= 170000 then
      execute format('revoke maintain on table public.%I from public, anon, authenticated', v_table);
    end if;
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_columns
    from pg_catalog.pg_attribute a
    where a.attrelid = format('public.%I', v_table)::regclass
      and a.attnum > 0 and not a.attisdropped;
    execute format(
      'revoke insert (%s), update (%s), references (%s) on table public.%I from public, anon, authenticated',
      v_columns, v_columns, v_columns, v_table
    );
  end loop;
end;
$$;
