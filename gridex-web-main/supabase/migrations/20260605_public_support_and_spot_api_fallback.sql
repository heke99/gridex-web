-- Public support form + spot API fallback readiness.
-- Allows unauthenticated website support tickets to be stored without forcing a portal user.

do $$
begin
  if to_regclass('public.customer_support_tickets') is not null then
    execute 'alter table public.customer_support_tickets alter column user_id drop not null';

    execute $idx$
      create index if not exists idx_customer_support_tickets_public_email
      on public.customer_support_tickets ((metadata->>'customer_email'))
      where user_id is null
    $idx$;

    execute $idx$
      create index if not exists idx_customer_support_tickets_public_source
      on public.customer_support_tickets ((metadata->>'source'), created_at desc)
      where user_id is null
    $idx$;
  end if;
end $$;

-- Let support/admin users read and answer public tickets in the admin support queue.
do $$
begin
  if to_regprocedure('public.gridex_has_permission(uuid,text)') is not null
     and to_regclass('public.customer_support_tickets') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'customer_support_tickets'
        and policyname = 'customer_support_tickets_admin_select'
    ) then
      execute $policy$
        create policy customer_support_tickets_admin_select
        on public.customer_support_tickets
        for select
        using (
          public.gridex_has_permission(auth.uid(), 'support_tickets.manage')
          or public.gridex_has_permission(auth.uid(), 'admin.access')
        )
      $policy$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'customer_support_tickets'
        and policyname = 'customer_support_tickets_admin_update'
    ) then
      execute $policy$
        create policy customer_support_tickets_admin_update
        on public.customer_support_tickets
        for update
        using (
          public.gridex_has_permission(auth.uid(), 'support_tickets.manage')
          or public.gridex_has_permission(auth.uid(), 'admin.access')
        )
        with check (
          public.gridex_has_permission(auth.uid(), 'support_tickets.manage')
          or public.gridex_has_permission(auth.uid(), 'admin.access')
        )
      $policy$;
    end if;
  end if;

  if to_regprocedure('public.gridex_has_permission(uuid,text)') is not null
     and to_regclass('public.customer_support_messages') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'customer_support_messages'
        and policyname = 'customer_support_messages_admin_select'
    ) then
      execute $policy$
        create policy customer_support_messages_admin_select
        on public.customer_support_messages
        for select
        using (
          public.gridex_has_permission(auth.uid(), 'support_tickets.manage')
          or public.gridex_has_permission(auth.uid(), 'admin.access')
        )
      $policy$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'customer_support_messages'
        and policyname = 'customer_support_messages_admin_insert'
    ) then
      execute $policy$
        create policy customer_support_messages_admin_insert
        on public.customer_support_messages
        for insert
        with check (
          public.gridex_has_permission(auth.uid(), 'support_tickets.manage')
          or public.gridex_has_permission(auth.uid(), 'admin.access')
        )
      $policy$;
    end if;
  end if;
end $$;
