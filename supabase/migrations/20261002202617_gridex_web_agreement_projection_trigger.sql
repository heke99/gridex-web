-- Correct the existing local agreement projection trigger against the inspected
-- production enum/columns. PDF metadata is not a customer/signature event and
-- must not rewrite portal projections. OPS remains the canonical authority.
create or replace function public.gridex_sync_portal_from_agreement()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_signed_at timestamptz; v_verified boolean;
begin
  if new.user_id is null then return new; end if;
  if tg_op='UPDATE' then
    if row(new.user_id,new.email,new.first_name,new.last_name,new.phone,new.facility_id,
      new.address,new.postal_code,new.city,new.apartment,new.move_in_date,new.contract_slug,
      new.status,new.email_signed_at,new.bankid_completed_at)
      is not distinct from row(old.user_id,old.email,old.first_name,old.last_name,old.phone,old.facility_id,
        old.address,old.postal_code,old.city,old.apartment,old.move_in_date,old.contract_slug,
        old.status,old.email_signed_at,old.bankid_completed_at) then
      return new;
    end if;
  end if;
  v_signed_at:=coalesce(new.email_signed_at,new.bankid_completed_at);
  v_verified:=new.status::text in('email_signed','bankid_signed','activated') and v_signed_at is not null;

  -- Agreement consent is not evidence of mailbox confirmation. Leave any
  -- persisted email_verified_at untouched; trusted Auth confirmation owns it.
  insert into public.customer_profiles(user_id,email,first_name,last_name,full_name,phone,onboarding_state,metadata)
  values(new.user_id,new.email,new.first_name,new.last_name,nullif(concat_ws(' ',new.first_name,new.last_name),''),new.phone,
    case when v_verified then 'verified' else 'pending_verification' end,
    jsonb_build_object('source','contract_agreements','agreement_id',new.id))
  on conflict(user_id) do update set
    email=excluded.email,
    first_name=coalesce(excluded.first_name,customer_profiles.first_name),
    last_name=coalesce(excluded.last_name,customer_profiles.last_name),
    full_name=coalesce(excluded.full_name,customer_profiles.full_name),phone=coalesce(excluded.phone,customer_profiles.phone),
    onboarding_state=case when customer_profiles.onboarding_state='verified' then customer_profiles.onboarding_state
      else excluded.onboarding_state end,
    metadata=customer_profiles.metadata||excluded.metadata
  where customer_profiles.source='legacy' and customer_profiles.tenant_reference is null
    and customer_profiles.canonical_ops_id is null and customer_profiles.external_customer_id is null
    and customer_profiles.portal_identity_id is null
    and coalesce(customer_profiles.metadata->>'source','') not in('verified_checkout_portal_claim','ops_application_onboarding');

  insert into public.customer_delivery_points(user_id,facility_id,address,postal_code,city,apartment,move_in_date,is_primary,metadata)
  values(new.user_id,new.facility_id,new.address,new.postal_code,new.city,new.apartment,new.move_in_date,true,
    jsonb_build_object('agreement_id',new.id))
  on conflict(user_id,facility_id) do update set
    address=excluded.address,postal_code=excluded.postal_code,city=excluded.city,apartment=excluded.apartment,
    move_in_date=coalesce(excluded.move_in_date,customer_delivery_points.move_in_date),
    is_primary=customer_delivery_points.is_primary or excluded.is_primary,
    metadata=customer_delivery_points.metadata||excluded.metadata
  where customer_delivery_points.source='legacy' and customer_delivery_points.tenant_reference is null
    and customer_delivery_points.canonical_ops_id is null
    and coalesce(customer_delivery_points.metadata->>'source','') not in('verified_checkout_portal_claim','ops_application_onboarding');

  insert into public.customer_contract_portal_links(user_id,agreement_id,contract_slug,status,signed_at,metadata)
  values(new.user_id,new.id,new.contract_slug,new.status::text,v_signed_at,jsonb_build_object('source','contract_agreements'))
  on conflict(agreement_id) do update set
    contract_slug=excluded.contract_slug,status=excluded.status,
    signed_at=coalesce(excluded.signed_at,customer_contract_portal_links.signed_at),
    metadata=customer_contract_portal_links.metadata||excluded.metadata
  where customer_contract_portal_links.source='legacy' and customer_contract_portal_links.tenant_reference is null
    and customer_contract_portal_links.canonical_ops_id is null
    and coalesce(customer_contract_portal_links.contract_provider_key,'')<>'ops'
    and coalesce(customer_contract_portal_links.metadata->>'source','') not in('verified_checkout_portal_claim','ops_application_onboarding');
  return new;
end;
$$;
