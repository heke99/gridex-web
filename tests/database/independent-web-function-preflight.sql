-- Read-only return-shape compatibility check before CREATE OR REPLACE.
-- Absence of a new function is expected. Existing signatures must stay compatible.
with expected(signature,returns) as (values
 ('public.gridex_get_user_roles(uuid)','TABLE(role_key text, key text, code text, name text)'),
 ('public.gridex_get_user_roles(uuid,uuid)','TABLE(role_key text, key text, code text, name text)'),
 ('public.gridex_get_user_permissions(uuid)','text[]'),
 ('public.gridex_get_user_permissions(uuid,uuid)','text[]'),
 ('public.gridex_get_user_permission_overrides(uuid)','TABLE(permission_key text, effect text)'),
 ('public.gridex_get_user_permission_overrides(uuid,uuid)','TABLE(permission_key text, effect text, valid_from timestamp with time zone, valid_to timestamp with time zone, is_active boolean)'),
 ('public.gridex_user_is_platform_admin()','boolean'),
 ('public.gridex_user_company_ids()','SETOF uuid'),
 ('public.gridex_can_write_company(uuid)','boolean'),
 ('public.gridex_user_has_role_key(text)','boolean'),
 ('public.gridex_create_public_support_contact(uuid,text,text,text,text,text,text,text)','uuid'),
 ('public.gridex_web_save_draft_pricing(uuid,jsonb)','jsonb'),
 ('public.gridex_web_publish_pricing(uuid,uuid,uuid,text)','jsonb')
) select signature,expected.returns as expected,pg_get_function_result(to_regprocedure(signature)) as actual
from expected where to_regprocedure(signature) is not null
and pg_get_function_result(to_regprocedure(signature)) is distinct from expected.returns;
