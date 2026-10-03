-- LOCAL ONLY: exact live production trigger/function captured read-only 2026-10-02.
CREATE OR REPLACE FUNCTION public.gridex_sync_portal_from_agreement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.customer_profiles (
    user_id,
    email,
    first_name,
    last_name,
    full_name,
    phone,
    onboarding_state,
    email_verified_at,
    metadata
  ) values (
    new.user_id,
    new.email,
    new.first_name,
    new.last_name,
    concat_ws(' ', new.first_name, new.last_name),
    new.phone,
    case when new.status in ('finalized', 'email_signed', 'bankid_signed') then 'verified' else 'pending_verification' end,
    case when new.status in ('finalized', 'email_signed', 'bankid_signed') then timezone('utc', now()) else null end,
    jsonb_build_object('source', 'contract_agreements', 'agreement_id', new.id)
  )
  on conflict (user_id) do update set
    email = excluded.email,
    first_name = coalesce(excluded.first_name, customer_profiles.first_name),
    last_name = coalesce(excluded.last_name, customer_profiles.last_name),
    full_name = coalesce(excluded.full_name, customer_profiles.full_name),
    phone = coalesce(excluded.phone, customer_profiles.phone),
    onboarding_state = case
      when customer_profiles.onboarding_state = 'verified' then customer_profiles.onboarding_state
      else excluded.onboarding_state
    end,
    email_verified_at = coalesce(customer_profiles.email_verified_at, excluded.email_verified_at),
    metadata = customer_profiles.metadata || excluded.metadata;

  insert into public.customer_delivery_points (
    user_id,
    facility_id,
    address,
    postal_code,
    city,
    apartment,
    move_in_date,
    is_primary,
    metadata
  ) values (
    new.user_id,
    new.facility_id,
    new.address,
    new.postal_code,
    new.city,
    new.apartment,
    new.move_in_date,
    true,
    jsonb_build_object('agreement_id', new.id)
  )
  on conflict (user_id, facility_id) do update set
    address = excluded.address,
    postal_code = excluded.postal_code,
    city = excluded.city,
    apartment = excluded.apartment,
    move_in_date = coalesce(excluded.move_in_date, customer_delivery_points.move_in_date),
    is_primary = customer_delivery_points.is_primary or excluded.is_primary,
    metadata = customer_delivery_points.metadata || excluded.metadata;

  insert into public.customer_contract_portal_links (
    user_id,
    agreement_id,
    contract_slug,
    status,
    signed_at,
    metadata
  ) values (
    new.user_id,
    new.id,
    new.contract_slug,
    new.status,
    coalesce(new.email_signed_at, new.bankid_signed_at),
    jsonb_build_object('source', 'contract_agreements')
  )
  on conflict (agreement_id) do update set
    contract_slug = excluded.contract_slug,
    status = excluded.status,
    signed_at = coalesce(excluded.signed_at, customer_contract_portal_links.signed_at),
    metadata = customer_contract_portal_links.metadata || excluded.metadata;

  return new;
end;
$function$
;
CREATE TRIGGER trg_gridex_sync_portal_from_agreement AFTER INSERT OR UPDATE ON public.contract_agreements FOR EACH ROW EXECUTE FUNCTION gridex_sync_portal_from_agreement();

