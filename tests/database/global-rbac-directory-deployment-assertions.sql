-- Read-only catalog assertions; no account rows or contact details are read.
do $$ begin
 if has_function_privilege('anon','public.gridex_web_list_global_rbac_users(uuid,text,uuid,boolean,integer,integer)','EXECUTE')
   or has_function_privilege('authenticated','public.gridex_web_list_global_rbac_users(uuid,text,uuid,boolean,integer,integer)','EXECUTE')
   or not has_function_privilege('service_role','public.gridex_web_list_global_rbac_users(uuid,text,uuid,boolean,integer,integer)','EXECUTE')
   or (select prosecdef from pg_proc where oid='public.gridex_web_list_global_rbac_users(uuid,text,uuid,boolean,integer,integer)'::regprocedure)
 then raise exception 'Global RBAC directory is not a service-only invoker RPC'; end if;
 if not exists(select 1 from pg_proc p where p.oid='public.gridex_web_list_global_rbac_users(uuid,text,uuid,boolean,integer,integer)'::regprocedure
   and 'search_path=""'=any(p.proconfig))
 then raise exception 'Global RBAC directory lacks a fixed empty search path'; end if;
end $$;
select 'Global RBAC directory service-only invoker metadata passed' as result;
