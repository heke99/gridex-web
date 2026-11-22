begin;

create table public.website_application_result_history (
  token_hash text primary key,
  result_id uuid not null references public.website_application_results(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  public_result jsonb not null,
  expires_at timestamptz not null
);

create index website_application_result_history_result_idx on public.website_application_result_history (result_id);
create index website_application_result_history_expiry_idx on public.website_application_result_history (expires_at, token_hash);

alter table public.website_application_result_history enable row level security;
revoke all on public.website_application_result_history from public, anon, authenticated, service_role;
grant select on public.website_application_result_history to service_role;

create function public.gridex_preserve_website_result_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.token_hash = new.token_hash then
      return null;
    end if;
    if old.expires_at > statement_timestamp() then
      insert into public.website_application_result_history (token_hash, result_id, user_id, public_result, expires_at)
      values (old.token_hash, old.id, old.user_id, old.public_result, old.expires_at)
      on conflict (token_hash) do nothing;
    end if;
  end if;

  -- Reuse issuance traffic for bounded cleanup. Concurrent issuers need not
  -- wait on archived links already being removed by another transaction.
  delete from public.website_application_result_history
  where token_hash in (
    select token_hash
    from public.website_application_result_history
    where expires_at <= statement_timestamp()
    order by expires_at, token_hash
    limit 50
    for update skip locked
  );
  return null;
end;
$$;

revoke execute on function public.gridex_preserve_website_result_link() from public, anon, authenticated, service_role;

create trigger gridex_preserve_website_result_link
  after insert or update of token_hash on public.website_application_results
  for each row execute function public.gridex_preserve_website_result_link();

create view public.website_application_result_links with (security_invoker = true) as
select token_hash, public_result, expires_at, submission_attempt_id, user_id
from public.website_application_results
union all
select history.token_hash, history.public_result, history.expires_at, current.submission_attempt_id, history.user_id
from public.website_application_result_history as history
join public.website_application_results as current on current.id = history.result_id
where not exists (
  select from public.website_application_results as active where active.token_hash = history.token_hash
);

revoke all on public.website_application_result_links from public, anon, authenticated, service_role;
grant select on public.website_application_result_links to service_role;

commit;
