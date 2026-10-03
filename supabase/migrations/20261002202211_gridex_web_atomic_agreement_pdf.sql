-- PDF generation is a global, server-owned document operation. It cannot mark
-- an agreement signed/activated or claim that an email was delivered.
-- Requires the global permission/self-identity helpers from independent Web RBAC.
create or replace function public.gridex_web_record_agreement_pdf(
  p_actor_id uuid,p_agreement_id uuid,p_pdf_path text
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_previous_path text;
begin
  if p_actor_id is null or p_agreement_id is null then
    raise exception using errcode='22023',message='Actor and agreement are required';
  end if;
  select contract_pdf_path into v_previous_path from public.contract_agreements
    where id=p_agreement_id for update;
  -- Re-read the global grant after acquiring the agreement lock, including
  -- revocations that committed while this operation waited for the lock.
  if not coalesce('agreements.write'=any(public.gridex_get_user_permissions(p_actor_id,null::uuid)),false) then
    raise exception using errcode='42501',message='Global agreements.write is required';
  end if;
  if not found then
    raise exception using errcode='22023',message='Agreement not found';
  end if;
  if p_pdf_path is null or length(p_pdf_path)>1024
    or p_pdf_path !~ '^[A-Za-z0-9._/-]+$'
    or p_pdf_path ~ '(^/|/$|//|(^|/)\.{1,2}(/|$))'
    or (p_pdf_path is distinct from v_previous_path and p_pdf_path<>p_agreement_id::text||'.pdf') then
    raise exception using errcode='22023',message='Invalid agreement PDF path';
  end if;
  update public.contract_agreements set contract_pdf_path=p_pdf_path where id=p_agreement_id;
  insert into public.contract_agreement_audit(agreement_id,action,performed_by,metadata)
  values(p_agreement_id,'pdf_generated',p_actor_id,
    jsonb_build_object('pdf_path',p_pdf_path,'previous_pdf_path',v_previous_path));
  return jsonb_build_object('agreement_id',p_agreement_id,'pdf_path',p_pdf_path);
end;
$$;
revoke all on function public.gridex_web_record_agreement_pdf(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.gridex_web_record_agreement_pdf(uuid,uuid,text) to service_role;

-- The old role-name ALL policy ignored company scope, revoked assignments and
-- disabled accounts. Customer history remains available only to its active
-- owner; global directory/export access requires the actual global grant.
drop policy if exists admin_full_access_agreements on public.contract_agreements;
drop policy if exists user_can_read_own_agreements on public.contract_agreements;
drop policy if exists "users can read own agreements" on public.contract_agreements;
create policy gridex_web_agreements_read on public.contract_agreements
for select to authenticated using (
  (select gridex_web_private.active_user()) and (
    user_id=(select auth.uid())
    or (select gridex_web_private.can('agreements.read'))
    or (select gridex_web_private.can('agreements.write'))
    or (select gridex_web_private.can('agreements.export'))
  )
);

-- Internal agreement audit metadata has never had a customer-owner read grant.
-- Console entry alone must not expose it or permit forged audit entries.
drop policy if exists contract_agreement_audit_admin_insert on public.contract_agreement_audit;
drop policy if exists contract_agreement_audit_admin_read on public.contract_agreement_audit;
create policy gridex_web_agreement_audit_read on public.contract_agreement_audit
for select to authenticated using (
  (select gridex_web_private.active_user()) and (
    (select gridex_web_private.can('agreements.read'))
    or (select gridex_web_private.can('agreements.write'))
  )
);

-- Server paths own these writes. Preserve SELECT privileges, RLS settings and
-- service-role grants, including relation and column grants.
do $$ declare v_table text; v_columns text; begin
  foreach v_table in array array['contract_agreements','contract_agreement_audit'] loop
    execute format('revoke insert,update,delete,truncate,references,trigger on table public.%I from public,anon,authenticated',v_table);
    if current_setting('server_version_num')::integer>=170000 then
      execute format('revoke maintain on table public.%I from public,anon,authenticated',v_table);
    end if;
    select string_agg(quote_ident(a.attname),', ' order by a.attnum) into v_columns
      from pg_catalog.pg_attribute a where a.attrelid=format('public.%I',v_table)::regclass
      and a.attnum>0 and not a.attisdropped;
    execute format('revoke insert (%s),update (%s),references (%s) on table public.%I from public,anon,authenticated',
      v_columns,v_columns,v_columns,v_table);
  end loop;
end $$;
