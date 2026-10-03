-- Read-only deployment assertions; no customer rows are inspected.
do $$
begin
  if has_table_privilege('authenticated','public.customer_profiles','INSERT')
    or has_table_privilege('authenticated','public.customer_profiles','UPDATE')
    or has_table_privilege('anon','public.customer_profiles','SELECT') then
    raise exception 'Canonical customer projection has unexpected browser privileges';
  end if;
  if has_column_privilege('authenticated','public.user_profiles','user_status','UPDATE')
    or has_column_privilege('authenticated','public.user_profiles','bankid_verified','UPDATE')
    or has_column_privilege('authenticated','public.user_profiles','must_change_password','UPDATE') then
    raise exception 'Account authorization/verification fields remain browser-writable';
  end if;
  if not has_column_privilege('authenticated','public.user_profiles','full_name','UPDATE') then
    raise exception 'Own account name editing was removed';
  end if;
  if has_function_privilege('authenticated','public.gridex_get_user_permissions(uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','gridex_web_private.assigned_roles(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','gridex_web_private.assigned_roles(uuid,uuid)','EXECUTE')
    or not has_function_privilege('service_role','gridex_web_private.assigned_roles(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.gridex_get_user_roles(uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.gridex_create_public_support_contact(uuid,text,text,text,text,text,text,text)','EXECUTE')
    or not has_function_privilege('service_role','public.gridex_create_public_support_contact(uuid,text,text,text,text,text,text,text)','EXECUTE') then
    raise exception 'Privileged RPC caller grants do not match the server boundary';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='customer_support_messages'
    and policyname='customer_support_messages_history_select' and lower(qual) like '%not is_internal_note%')
    or exists(select 1 from pg_policies where schemaname='public' and tablename in('customer_support_tickets','customer_support_messages')
      and policyname in('customer_support_tickets_owner_all','customer_support_messages_owner_insert','customer_support_messages_admin_select')) then
    raise exception 'Legacy support exposure remains enabled';
  end if;
end $$;
select 'Independent Web security deployment metadata passed' as result;
