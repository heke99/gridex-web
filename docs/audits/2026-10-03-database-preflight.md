# Gridex Web production database preflight — 2026-10-03

The two new migration sources have compatible prerequisites in the live Web
database. This is a read-only catalog check, not production deployment or live
customer/support verification. The inspected Web project is
`ayiuxjlfazkjmmtlvhsl`, PostgreSQL `17.6`. All production inspection used the
Supabase plugin's `execute_sql`; no DDL, data writes, synthetic identities,
customer values or secret values were requested.

| Candidate source | SHA-256 at inspection |
|---|---|
| `20261003175858_gridex_web_stable_webhook_identity.sql` | `ae8416053a2207a6d0f2bd2dd299c05931b8fed91d05fc5b5fcfad1c73e6b47c` |
| `20261003180510_gridex_web_global_rbac_directory.sql` | `0007c9b9a6453dfbfa13e087a3ebcc48f4b719bc9fb4e51acd8f00bfa5f7de44` |

## Stable webhook ownership migration

The existing `apply_ops_domain_event_v2` signature has the same 18 named and
typed arguments, 11 defaults, and result table as the replacement:
`result text`, `cache_invalidated boolean`, `stored_revision bigint`,
`notification_created boolean`. The current function allows service invocation
and denies anon/authenticated invocation; the replacement preserves that
boundary and sets an empty search path.

Every inspected ownership, event, invoice and notification column has the
expected type. In particular, the added lookup assumptions are present:
`customer_profiles.canonical_ops_id` is `text`, `metadata` is `jsonb`, and
`external_identity_ref`, `billing_customer_ref`, `portal_identity_id`,
`customer_number` and `external_customer_id` are `text`.

The live notification index supports the replacement's exact conflict target:
`UNIQUE (ops_event_id) WHERE ops_event_id IS NOT NULL`. The event table's unique
event, delivery and event/delivery indexes are valid and ready. Its organization
reference constraint uses the same organization identifier pattern as the
replacement's argument check.

All live required insert columns without defaults are supplied by the source:
event `event_id`/`event_type`, and notification `title`/`body`. The source omits
no additional required notification/event column. The only non-internal trigger
on the three mutated projection tables is the invoice timestamp trigger
`trg_customer_invoices_updated_at`, using `set_current_timestamp_updated_at`.
This catalog observation does not constitute a behavioral trigger test.

## Global RBAC directory migration

The required profile, role, assignment, permission, override, membership and
company columns are present with matching types. `service_role` has public
schema usage, SELECT on every dependency table, and BYPASSRLS. The native
directory source uses SECURITY INVOKER and verifies the actor's current global
`rbac.write` before reading the directory.

The new directory RPC, private `assigned_roles(uuid,uuid)` resolver and
`gridex_get_user_permissions(uuid,uuid)` overload are currently absent from
production, as expected for the pending package. The directory migration must
follow `20261002173716_independent_web_rbac_and_public_support.sql`, which creates
the resolver and overload and supplies the needed private-schema/service
function grants. Applying the directory alone would leave missing dependencies.
The existing one-argument role/permission RPC result types match the pending
replacement declarations.

Across both migrations and their authorization dependencies, 108 required
column/type pairs were checked: zero missing or mismatched pairs. No production
catalog prerequisite blocker was found. Existing native fixtures supply the
canonical ownership columns before the webhook tests; these observations do
not replace the PostgreSQL 16/17 native CI and concurrency gates or the
coordinated application/database deployment.
