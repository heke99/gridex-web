-- Read-only deployed trigger/schema assertions. No production test writes.
do $$ declare fn regprocedure:='public.gridex_sync_portal_from_agreement()'::regprocedure;
  fn_record record; trigger_record record; relation text;
begin
  select prorettype,prosecdef,proconfig into strict fn_record from pg_proc where oid=fn;
  if fn_record.prorettype<>'trigger'::regtype or not fn_record.prosecdef
    or not fn_record.proconfig @> array['search_path=""']::text[] then
    raise exception 'Agreement projection trigger signature/security/search_path changed';
  end if;
  select tgfoid,tgtype,tgenabled into strict trigger_record from pg_trigger
    where tgrelid='public.contract_agreements'::regclass and tgname='trg_gridex_sync_portal_from_agreement';
  if trigger_record.tgfoid<>fn or trigger_record.tgtype<>21 or trigger_record.tgenabled<>'O' then
    raise exception 'Agreement AFTER INSERT/UPDATE row trigger binding changed';
  end if;
  if exists(select 1 from pg_enum where enumtypid='public.agreement_status'::regtype and enumlabel='finalized')
    or exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='contract_agreements' and column_name='bankid_signed_at') then
    raise exception 'Regression fixture/schema no longer represents actual production defect';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='contract_agreements' and column_name='bankid_completed_at' and data_type='timestamp with time zone') then
    raise exception 'Actual BankID completion column is missing';
  end if;
  foreach relation in array array['customer_profiles','customer_delivery_points','customer_contract_portal_links'] loop
    if not exists(select 1 from information_schema.columns where table_schema='public'
      and table_name=relation and column_name='canonical_ops_id' and data_type='text')
      or not exists(select 1 from information_schema.columns where table_schema='public'
      and table_name=relation and column_name='upstream_revision' and data_type='bigint')
      or not exists(select 1 from information_schema.columns where table_schema='public'
      and table_name=relation and column_name='upstream_version' and data_type='text') then
      raise exception 'Canonical projection identifier/revision/version types changed: %',relation;
    end if;
  end loop;
end $$;
select 'Agreement projection deployed trigger binding and exact signature/canonical schema verified' as result;
