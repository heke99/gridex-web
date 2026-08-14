-- Optimize RLS auth function evaluation without changing authorization semantics.
-- 2026-08-14
--
-- Supabase's planner can evaluate auth.uid()/auth.jwt()/auth.role() once per
-- statement when wrapped in a scalar SELECT. The current public policies all
-- use uncached calls, which may be re-evaluated per row.
do $$
declare
  r record;
  v_using text;
  v_check text;
  v_sql text;
begin
  for r in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      p.polname as policy_name,
      pg_get_expr(p.polqual, p.polrelid) as using_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and (
        coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ 'auth\.(uid|jwt|role)\(\)'
        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ 'auth\.(uid|jwt|role)\(\)'
      )
  loop
    v_using := r.using_expr;
    v_check := r.check_expr;

    if v_using is not null then
      v_using := replace(v_using, 'auth.uid()', '(select auth.uid())');
      v_using := replace(v_using, 'auth.jwt()', '(select auth.jwt())');
      v_using := replace(v_using, 'auth.role()', '(select auth.role())');
    end if;

    if v_check is not null then
      v_check := replace(v_check, 'auth.uid()', '(select auth.uid())');
      v_check := replace(v_check, 'auth.jwt()', '(select auth.jwt())');
      v_check := replace(v_check, 'auth.role()', '(select auth.role())');
    end if;

    v_sql := format('alter policy %I on %I.%I', r.policy_name, r.schema_name, r.table_name);
    if v_using is not null then
      v_sql := v_sql || format(' using (%s)', v_using);
    end if;
    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;

    execute v_sql;
  end loop;
end
$$;
