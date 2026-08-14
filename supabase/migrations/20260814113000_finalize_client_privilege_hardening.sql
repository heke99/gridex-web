-- Finalize client privilege hardening discovered during the production security audit.
-- 2026-08-14
--
-- The distributed limiter is a server-side primitive. Browser roles do not need
-- direct RPC access; application server code uses the privileged backend path.
revoke execute on function public.consume_distributed_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_distributed_rate_limit(text, integer, integer)
  to service_role;

-- Read models must expose read-only privileges only. security_invoker was
-- enabled in the previous hardening migration so underlying RLS/grants are
-- evaluated as the caller.
revoke all on public.customer_portal_overview_v1 from public, anon, authenticated;
revoke all on public.customer_contract_status_v1 from public, anon, authenticated;
grant select on public.customer_portal_overview_v1 to authenticated, service_role;
grant select on public.customer_contract_status_v1 to authenticated, service_role;
