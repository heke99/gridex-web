begin;

-- Contract 2026-08-02.1 makes valid_until canonical and required for both
-- quote creation and quote validation. Legacy rows are retained for audit, but
-- they may never be reactivated as orderable quotes.
update public.website_pricing_snapshots
   set status = 'expired',
       ops_quote_validation_status = 'invalid'
 where valid_until is null
   and status = 'issued'
   and ops_application_id is null
   and ops_contract_id is null;

-- NOT VALID preserves historical audit rows while still enforcing the
-- constraints for every new or updated snapshot immediately.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.website_pricing_snapshots'::regclass
       and conname = 'website_pricing_snapshots_valid_until_required_chk'
  ) then
    alter table public.website_pricing_snapshots
      add constraint website_pricing_snapshots_valid_until_required_chk
      check (valid_until is not null) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.website_pricing_snapshots'::regclass
       and conname = 'website_pricing_snapshots_ops_valid_until_required_chk'
  ) then
    alter table public.website_pricing_snapshots
      add constraint website_pricing_snapshots_ops_valid_until_required_chk
      check (ops_quote_valid_until is not null) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.website_pricing_snapshots'::regclass
       and conname = 'website_pricing_snapshots_valid_after_issue_chk'
  ) then
    alter table public.website_pricing_snapshots
      add constraint website_pricing_snapshots_valid_after_issue_chk
      check (valid_until > issued_at) not valid;
  end if;
end;
$$;

comment on column public.website_pricing_snapshots.valid_until is
  'Canonical OPS quote expiry. Required for all snapshots created under contract 2026-08-02.1 or later.';
comment on column public.website_pricing_snapshots.ops_quote_valid_until is
  'Exact canonical valid_until returned by OPS and signed into the website quote token.';
comment on column public.website_pricing_snapshots.status is
  'issued quotes are usable only before valid_until and after successful canonical OPS validation; used, expired and revoked are terminal states.';

-- The previous backfill could reactivate expired rows and conflicts with the
-- current canonical contract. Keep its audit table, but remove the executable.
drop function if exists public.run_non_expiring_quote_backfill(boolean, uuid);

commit;
