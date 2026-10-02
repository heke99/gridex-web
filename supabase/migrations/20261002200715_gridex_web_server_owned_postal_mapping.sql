-- Global postal-to-price-area changes belong to Web server actions that verify
-- current global pricing.write before using service_role. The legacy ALL RLS
-- policy checks only presence in admin_users and cannot enforce that boundary.
-- Preserve public reads, service operations and every existing policy.
do $$
declare
  v_columns text;
begin
  revoke insert, update, delete, truncate, references, trigger
    on table public.gridex_postal_code_price_area from public, anon, authenticated;
  -- PostgreSQL 17 adds MAINTAIN; isolated PostgreSQL 16 tests omit that token.
  if current_setting('server_version_num')::integer >= 170000 then
    execute 'revoke maintain on table public.gridex_postal_code_price_area from public, anon, authenticated';
  end if;
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.gridex_postal_code_price_area'::regclass
    and a.attnum > 0 and not a.attisdropped;
  execute format(
    'revoke insert (%s), update (%s), references (%s) on table public.gridex_postal_code_price_area from public, anon, authenticated',
    v_columns, v_columns, v_columns
  );
end;
$$;
