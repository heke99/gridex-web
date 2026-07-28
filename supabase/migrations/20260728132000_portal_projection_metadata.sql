begin;

do $$
declare
  projection_table text;
begin
  foreach projection_table in array array[
    'customer_profiles',
    'customer_delivery_points',
    'customer_contract_portal_links',
    'customer_invoices',
    'customer_documents',
    'customer_legal_acceptances',
    'customer_notifications'
  ]
  loop
    if to_regclass('public.' || projection_table) is not null then
      execute format(
        'alter table public.%I
           add column if not exists canonical_ops_id text,
           add column if not exists source text not null default ''legacy'',
           add column if not exists tenant_reference text,
           add column if not exists upstream_revision bigint,
           add column if not exists upstream_version text,
           add column if not exists synced_at timestamptz,
           add column if not exists last_event_id text,
           add column if not exists projection_status text not null default ''legacy_unverified''',
        projection_table
      );
      execute format(
        'create unique index if not exists %I on public.%I(tenant_reference, canonical_ops_id)
         where tenant_reference is not null and canonical_ops_id is not null',
        projection_table || '_tenant_ops_id_uidx',
        projection_table
      );
      execute format(
        'create index if not exists %I on public.%I(tenant_reference, projection_status, synced_at desc)',
        projection_table || '_projection_state_idx',
        projection_table
      );
    end if;
  end loop;
end
$$;

comment on column public.customer_invoices.canonical_ops_id is
  'Opaque canonical invoice ID from GET /api/v1/customer/invoices; never invoice number, OCR or storage path.';

commit;
