create index if not exists idx_integration_sync_jobs_invoice_receipt
  on public.integration_sync_jobs (provider_key, entity_id, created_at desc, id desc)
  where entity_type = 'invoice' and direction = 'inbound' and status = 'success';

create function public.gridex_import_invoice(
  p_provider text,
  p_reference text,
  p_customer jsonb,
  p_contract jsonb,
  p_fields jsonb,
  p_payload jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile public.customer_profiles;
  v_candidate public.customer_profiles;
  v_invoice public.customer_invoices;
  v_patch public.customer_invoices;
  v_contract uuid;
  v_job uuid;
  v_previous_payload jsonb;
  v_receipt jsonb;
  v_lock text;
begin
  -- Serialize imports on shared identities and invoice references, including first inserts.
  for v_lock in
    select distinct value
    from unnest(array[
      'invoice:' || jsonb_build_array(p_provider, p_reference)::text,
      'user:' || (p_customer->>'user_id'),
      'billing:' || (p_customer->>'billing_customer_ref'),
      'contract:' || (p_customer->>'contract_customer_ref'),
      'identity:' || (p_customer->>'external_identity_ref'),
      'email:' || (p_customer->>'email')
    ]) as locks(value)
    where value is not null
    order by value
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_lock, 394108));
  end loop;

  for v_candidate in
    select cp.* from public.customer_profiles as cp
    where cp.user_id = (p_customer->>'user_id')::uuid
       or cp.billing_customer_ref = p_customer->>'billing_customer_ref'
       or cp.contract_customer_ref = p_customer->>'contract_customer_ref'
       or cp.external_identity_ref = p_customer->>'external_identity_ref'
       or lower(cp.email) = p_customer->>'email'
    order by cp.user_id
    limit 2
    for update
  loop
    if v_profile.user_id is not null then
      raise exception using errcode = 'P0409', message = 'Invoice customer references are ambiguous';
    end if;
    v_profile := v_candidate;
  end loop;

  if v_profile.user_id is null then
    raise exception using errcode = 'P0002', message = 'Invoice customer could not be matched';
  end if;

  if (p_customer ? 'user_id' and v_profile.user_id <> (p_customer->>'user_id')::uuid)
    or (p_customer ? 'billing_customer_ref' and v_profile.billing_customer_ref <> p_customer->>'billing_customer_ref')
    or (p_customer ? 'contract_customer_ref' and v_profile.contract_customer_ref <> p_customer->>'contract_customer_ref')
    or (p_customer ? 'external_identity_ref' and v_profile.external_identity_ref <> p_customer->>'external_identity_ref')
    or (p_customer ? 'email' and v_profile.email is not null and lower(v_profile.email) <> p_customer->>'email') then
    raise exception using errcode = 'P0409', message = 'Invoice customer references disagree';
  end if;

  select i.* into v_invoice
  from public.customer_invoices as i
  where i.provider_key = p_provider and i.external_invoice_ref = p_reference
  for update;

  if v_invoice.id is not null and v_invoice.user_id <> v_profile.user_id then
    raise exception using errcode = 'P0409', message = 'Invoice is already bound to another customer';
  end if;

  if v_invoice.id is not null then
    select job.payload, job.response_payload into v_previous_payload, v_receipt
    from public.integration_sync_jobs as job
    where job.provider_key = p_provider
      and job.entity_id = p_reference
      and job.entity_type = 'invoice'
      and job.direction = 'inbound'
      and job.status = 'success'
    order by job.created_at desc, job.id desc
    limit 1;
    if v_previous_payload = p_payload
      and v_receipt->>'invoiceId' = v_invoice.id::text
      and v_receipt->>'userId' = v_invoice.user_id::text then
      return v_receipt;
    end if;
  end if;

  if p_contract <> '{}'::jsonb then
    select link.id into v_contract
    from public.customer_contract_portal_links as link
    where link.user_id = v_profile.user_id
      and (not (p_contract ? 'id') or link.id = (p_contract->>'id')::uuid)
      and (not (p_contract ? 'billing_contract_ref') or link.billing_contract_ref = p_contract->>'billing_contract_ref')
      and (not (p_contract ? 'contract_external_ref') or link.contract_external_ref = p_contract->>'contract_external_ref')
    order by link.created_at desc, link.id
    limit 1
    for share;
    if v_contract is null then
      raise exception using errcode = 'P0409', message = 'Invoice contract references disagree';
    end if;
    p_fields := p_fields || jsonb_build_object('portal_contract_id', v_contract);
  end if;

  if v_invoice.id is null then
    if not (p_fields ? 'total_amount') then
      raise exception using errcode = 'P0400', message = 'Missing totalAmount';
    end if;
    v_invoice.currency_code := 'SEK';
    v_invoice.status := 'issued';
    v_invoice.vat_amount := 0;
    v_invoice.line_items := '[]'::jsonb;
  end if;

  -- An absent key keeps its previous value; a present null clears a nullable field.
  v_patch := jsonb_populate_record(v_invoice, p_fields);
  v_patch.raw_payload := coalesce(v_invoice.raw_payload, '{}'::jsonb) || p_payload;

  if v_invoice.id is null then
    insert into public.customer_invoices (
      user_id, provider_key, external_invoice_ref,
      portal_contract_id, invoice_number, currency_code, invoice_period_start, invoice_period_end,
      issued_at, due_at, paid_at, status, total_amount, vat_amount, ocr_number,
      payment_reference, pdf_url, pdf_storage_path, line_items, raw_payload
    ) values (
      v_profile.user_id, p_provider, p_reference,
      v_patch.portal_contract_id, v_patch.invoice_number, v_patch.currency_code, v_patch.invoice_period_start, v_patch.invoice_period_end,
      v_patch.issued_at, v_patch.due_at, v_patch.paid_at, v_patch.status, v_patch.total_amount, v_patch.vat_amount, v_patch.ocr_number,
      v_patch.payment_reference, v_patch.pdf_url, v_patch.pdf_storage_path, v_patch.line_items, v_patch.raw_payload
    ) returning * into v_invoice;
  else
    update public.customer_invoices set
      portal_contract_id = v_patch.portal_contract_id,
      invoice_number = v_patch.invoice_number,
      currency_code = v_patch.currency_code,
      invoice_period_start = v_patch.invoice_period_start,
      invoice_period_end = v_patch.invoice_period_end,
      issued_at = v_patch.issued_at,
      due_at = v_patch.due_at,
      paid_at = v_patch.paid_at,
      status = v_patch.status,
      total_amount = v_patch.total_amount,
      vat_amount = v_patch.vat_amount,
      ocr_number = v_patch.ocr_number,
      payment_reference = v_patch.payment_reference,
      pdf_url = v_patch.pdf_url,
      pdf_storage_path = v_patch.pdf_storage_path,
      line_items = v_patch.line_items,
      raw_payload = v_patch.raw_payload
    where id = v_invoice.id
    returning * into v_invoice;
  end if;

  update public.customer_profiles set
    onboarding_state = 'verified',
    metadata = metadata || jsonb_build_object('source', 'invoice_import', 'provider_key', p_provider),
    email = coalesce(p_customer->>'email', email),
    email_verified_at = case when p_customer ? 'email' then now() else email_verified_at end,
    first_name = coalesce(p_customer->>'first_name', first_name),
    last_name = coalesce(p_customer->>'last_name', last_name),
    full_name = coalesce(p_customer->>'full_name', full_name),
    phone = coalesce(p_customer->>'phone', phone),
    billing_customer_ref = coalesce(p_customer->>'billing_customer_ref', billing_customer_ref),
    contract_customer_ref = coalesce(p_customer->>'contract_customer_ref', contract_customer_ref),
    external_identity_ref = coalesce(p_customer->>'external_identity_ref', external_identity_ref)
  where user_id = v_profile.user_id;

  v_job := gen_random_uuid();
  v_receipt := jsonb_build_object(
    'invoiceId', v_invoice.id, 'userId', v_invoice.user_id, 'syncJobId', v_job, 'status', v_invoice.status
  );

  insert into public.integration_sync_jobs (
    id, provider_key, entity_type, entity_id, direction, status, payload, idempotency_key, response_payload, created_at
  ) values (
    v_job, p_provider, 'invoice', p_reference, 'inbound', 'success', p_payload,
    p_provider || ':invoice:' || p_reference, v_receipt, clock_timestamp()
  );

  return v_receipt;
end;
$$;

revoke execute on function public.gridex_import_invoice(text, text, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.gridex_import_invoice(text, text, jsonb, jsonb, jsonb, jsonb)
  to service_role;
