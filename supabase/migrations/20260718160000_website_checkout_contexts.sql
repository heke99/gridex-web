begin;

create table if not exists public.website_checkout_contexts (
  token_hash text primary key,
  public_context jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint website_checkout_contexts_expiry_check check (expires_at > created_at)
);

create index if not exists website_checkout_contexts_expires_at_idx
  on public.website_checkout_contexts (expires_at);

alter table public.website_checkout_contexts enable row level security;
revoke all on public.website_checkout_contexts from anon, authenticated;

comment on table public.website_checkout_contexts is
  'Short-lived server-only checkout handoff. Tokens are stored hashed; address data never appears in the URL.';

commit;
