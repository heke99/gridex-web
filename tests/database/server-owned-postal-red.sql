-- LOCAL ONLY: reproduce the real baseline bypass before the ACL migration.
begin;
select set_config('request.jwt.claim.sub',md5('postal-disabled-support-user')::uuid::text,true);
set local role authenticated;
do $$ declare affected integer; begin
  insert into public.gridex_postal_code_price_area(postal_code,price_area) values('88888','SE4');
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Baseline disabled support user could not insert'; end if;
  update public.gridex_postal_code_price_area set price_area='SE3' where postal_code='99999';
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Baseline disabled support user could not edit global mapping'; end if;
  delete from public.gridex_postal_code_price_area where postal_code='88888';
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Baseline disabled support user could not delete'; end if;
end $$;
reset role;
select 'RED: disabled support admin could insert/update/delete global postal mapping' as result;
rollback;
