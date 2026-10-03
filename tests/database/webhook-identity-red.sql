-- LOCAL ONLY: reproduce the historical email-only correlation before the forward migration.
begin;
insert into auth.users(id,email) values(md5('webhook-red')::uuid,'reused-mailbox@example.test');
insert into public.customer_profiles(user_id,email,external_customer_id,customer_number)
values(md5('webhook-red')::uuid,'reused-mailbox@example.test','known-customer','C-KNOWN');
insert into public.customer_invoices(user_id,external_invoice_ref) values(md5('webhook-red')::uuid,'same-invoice-reference');
do $$ declare applied record; begin
  select * into strict applied from public.apply_ops_domain_event_v2(
    p_event_id=>'historical-email-only',p_delivery_id=>'historical-email-delivery',p_event_type=>'invoice.paid',
    p_organization_reference=>'organization_abcdefghijklmnopqrst',p_created_at=>now(),
    p_payload_hash=>'red-hash',p_payload=>'{}',p_external_customer_id=>'unknown-other-customer',
    p_customer_email=>'reused-mailbox@example.test',p_related_entity_type=>'invoice',p_related_entity_id=>'same-invoice-reference',
    p_notification_title=>'Paid',p_notification_body=>'Payment received'
  );
  if applied.result<>'applied' or not exists(select 1 from public.customer_invoices where status='paid')
    or not exists(select 1 from public.customer_notifications where user_id=md5('webhook-red')::uuid) then
    raise exception 'Historical email-only webhook defect did not reproduce';
  end if;
  raise notice 'RED reproduced: unrelated stable identity applied invoice/notification through email-only discovery';
end $$;
rollback;
