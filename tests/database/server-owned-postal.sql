-- LOCAL ONLY: behavioral regression against isolated synthetic fixtures.
-- Load fixture, run RED proof, apply migration, then run with ON_ERROR_STOP=1.
begin;
do $$ declare actual record; baseline record; begin
  select * into strict baseline from gridex_test.postal_catalog_before;
  select c.relrowsecurity,c.relforcerowsecurity,
    (select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.is_grantable)
      from pg_catalog.aclexplode(c.relacl) a where a.privilege_type='SELECT') as select_acl,
    (select jsonb_agg(to_jsonb(a) order by a.grantee,a.grantor,a.privilege_type,a.is_grantable)
      from pg_catalog.aclexplode(c.relacl) a where a.grantee='service_role'::regrole) as service_acl,
    (select jsonb_agg(jsonb_build_object('name',a.attname,
      'select_grants',(select jsonb_agg(to_jsonb(x) order by x.grantee,x.grantor,x.is_grantable)
        from pg_catalog.aclexplode(a.attacl) x where x.privilege_type='SELECT')) order by a.attnum)
      from pg_catalog.pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as column_select_acl,
    (select jsonb_agg(to_jsonb(p) order by p.polname) from pg_catalog.pg_policy p where p.polrelid=c.oid) as policies
  into strict actual from pg_catalog.pg_class c where c.oid='public.gridex_postal_code_price_area'::regclass;
  if to_jsonb(actual) is distinct from to_jsonb(baseline) then
    raise exception 'Postal SELECT/service privileges, RLS settings or policies changed';
  end if;
end $$;

-- Both a disabled support identity and an active platform admin must use the
-- guarded server. Even the legacy broad ALL policy cannot restore writes.
select set_config('request.jwt.claim.sub',md5('postal-disabled-support-user')::uuid::text,true);
set local role authenticated;
do $$ declare statement text; blocked boolean; begin
  if (select price_area from public.gridex_postal_code_price_area where postal_code='99999')<>'SE1' then
    raise exception 'Authenticated public lookup stopped working';
  end if;
  foreach statement in array array[
    $q$insert into public.gridex_postal_code_price_area(postal_code,price_area) values('88888','SE4')$q$,
    $q$update public.gridex_postal_code_price_area set price_area='SE3' where postal_code='99999'$q$,
    $q$delete from public.gridex_postal_code_price_area where postal_code='99999'$q$,
    $q$truncate public.gridex_postal_code_price_area$q$
  ] loop
    blocked:=false;
    begin execute statement; exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Disabled support browser mutation accepted: %',statement; end if;
  end loop;
end $$;
reset role;
select set_config('request.jwt.claim.sub',md5('postal-platform-user')::uuid::text,true);
set local role authenticated;
do $$ declare statement text; blocked boolean; begin
  foreach statement in array array[
    $q$insert into public.gridex_postal_code_price_area(postal_code,price_area) values('88888','SE4')$q$,
    $q$update public.gridex_postal_code_price_area set price_area='SE3' where postal_code='99999'$q$,
    $q$delete from public.gridex_postal_code_price_area where postal_code='99999'$q$,
    $q$truncate public.gridex_postal_code_price_area$q$
  ] loop
    blocked:=false;
    begin execute statement; exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Platform browser mutation accepted: %',statement; end if;
  end loop;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ declare statement text; blocked boolean; begin
  if (select price_area from public.gridex_postal_code_price_area where postal_code='99999')<>'SE1' then
    raise exception 'Anonymous public lookup stopped working';
  end if;
  foreach statement in array array[
    $q$insert into public.gridex_postal_code_price_area(postal_code,price_area) values('88888','SE4')$q$,
    $q$update public.gridex_postal_code_price_area set price_area='SE3' where postal_code='99999'$q$,
    $q$delete from public.gridex_postal_code_price_area where postal_code='99999'$q$,
    $q$truncate public.gridex_postal_code_price_area$q$
  ] loop
    blocked:=false;
    begin execute statement; exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Anonymous browser mutation accepted: %',statement; end if;
  end loop;
end $$;
reset role;
set local role service_role;
do $$ declare affected integer; begin
  insert into public.gridex_postal_code_price_area(postal_code,price_area) values('88888','SE4');
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Service postal INSERT failed'; end if;
  update public.gridex_postal_code_price_area set price_area='SE3' where postal_code='88888';
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Service postal UPDATE failed'; end if;
  delete from public.gridex_postal_code_price_area where postal_code='88888';
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Service postal DELETE failed'; end if;
end $$;
reset role;
select 'Postal ACL preserves public lookup/SELECT/service grants and policies; 12 browser mutations denied, 3 service mutations allowed' as result;
rollback;
