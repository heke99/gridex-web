-- LOCAL ONLY: demonstrate the inspected pre-migration global PII bypass.
begin;
do $$ declare actor text; actual integer; begin
  foreach actor in array array['company-admin','disabled','revoked'] loop
    perform set_config('request.jwt.claim.sub',md5('pdf-'||actor)::uuid::text,true);
    execute 'set local role authenticated';
    select count(*) into actual from public.contract_agreements;
    if actual<>2 then raise exception 'Expected legacy raw-role global-read vulnerability for %',actor; end if;
    execute 'reset role';
  end loop;
end $$;
select 'RED reproduced: company-only administrator, disabled profile and revoked role can read global agreement PII through legacy ALL policy' as result;
rollback;
