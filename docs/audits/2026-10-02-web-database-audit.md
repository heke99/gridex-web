# Independent Web database audit — 2026-10-02

Read-only inspection of the `gridex-prod` catalog, grants, RLS, functions and advisor output identified these actual authorization defects:

| Finding | Correction in this package |
| --- | --- |
| Customer support owner reads included internal notes. Owner inserts accepted agent sender types. | Historical owners can read their own non-internal messages; customer mutations now belong to OPS. |
| `admin.access` granted global support access. Ticket owners could modify assignment and internal metadata. | Local prospect staff access requires explicit global support read/reply/manage grants; historical customer ticket writes are closed. |
| Effective permission RPC combined roles across companies and ignored disabled role/status, inactive direct grants and deny overrides. | Optional local company context requires active membership; omitted context uses global assignments only. Denials and validity windows take precedence. |
| Owners could edit their own account authorization/verification fields, including `user_status`. | Browser profile mutations are limited to account name/contact fields. Privileged status changes use guarded server operations. |
| Previously issued JWTs continued to satisfy company/platform helpers after profile disablement. | Canonical self-identity RLS helpers check the account status and active role definitions. |
| Customers could edit canonical upstream customer/tenant identifiers used to construct OPS headers. | Browser customer projections are read-only; canonical updates synchronize through the server after OPS accepts the change. |
| Anonymous enquiry inserted its ticket and message separately. Retries were not idempotent. | A service-only transaction creates both records, serializes request IDs and rejects mismatched payload replay. |
| Public enquiry attempted an unchecked insert into nonexistent `system_emails`. | No false delivery acknowledgement or unused outbox is introduced. Ticket persistence is separate from email transport. |
| Role assignment used `ON CONFLICT(user_id,role)` although production has no matching unique constraint, causing `42P10`. Existing company assignments could also be selected as if global. | Guarded server actions resolve the registered role, select only global assignments, update by primary-key `id`, or insert a missing global assignment. Revoke leaves company assignments unchanged. |
| Company editors could promote their own membership role or grant scoped overrides directly through the Data API. All nine authorization/company tables retained broad browser mutation ACLs. | A separate ACL-only migration revokes every table and column mutation privilege from PUBLIC, anon and authenticated while preserving SELECT, all existing RLS policies and service operations. |
| A global override upsert in `user_permissions` could convert an existing company grant into a global grant because its primary key omits `company_id`. A legacy global deny could also defeat a later allow. | A service-only global override RPC checks current global `rbac.write`, serializes decisions by target/canonical permission, supersedes only global legacy/history rows and leaves every company row unchanged. |

The existing arbitrary-user authorization RPCs were already service-only. The migration preserves that boundary. In particular, `gridex_get_user_permission_overrides(uuid)` retains its existing `TABLE(permission_key text, effect text)` return shape; the new scoped overload returns the validity fields separately. `tests/database/independent-web-function-preflight.sql` checks every replaced/new RPC return shape against the current catalog before `CREATE OR REPLACE`. The private self-only RLS helpers are not exposed through the Data API. No user metadata authorizes an operation.

The read-only role-index inspection confirmed `user_roles_pkey(id)` and the active-only expression indexes `user_roles_active_unique_role_text_idx` on `(user_id, COALESCE(company_id, zero_uuid), lower(role))` and `user_roles_active_unique_role_id_idx` on the same user/company scope plus `role_id`. Their predicates require active status and active assignment. There is no plain `UNIQUE(user_id,role)`. The corrected caller therefore does not use that conflict target. It deterministically reuses a matching global assignment, including inactive history, and updates both `status` and `is_active`. A concurrent grant can legitimately hit the inspected active unique indexes with `23505`; the caller refetches once and uses the resulting global row. Revoke does not create an inactive placeholder or change another company's same-role row. This preserves the existing schema and needs no additional migration. Concurrent grants are protected by the existing indexes; grant/revoke requests are separate operations, so their result follows the successful database writes rather than a new serializable transaction guarantee.

`tests/rbac-role-assignment-runtime.test.mjs` runs the actual create-user and role-assignment actions against an isolated fixture implementing those inspected index rules. It first reproduces the former `42P10`, then verifies grant, revoke, reactivation, canonical support-role creation, retained company assignments, and concurrent grants resolving to one active global assignment. The test is included in `npm run test:independent-tenant` and passes on Node 22. This runtime fixture is distinct from the native SQL migration tests and performs no production writes.

The initial native PostgreSQL 16 verification uses a fixture derived from the inspected production columns and the exact existing production function definitions in `tests/database/independent-web-existing-functions.sql`, without production data. The original four migrations were replayed together into a fresh database with the actual pricing trigger definitions. Behavioral tests cover tenant isolation, disabled assignments/memberships/profile, role-ID resolution, timed global denials, confidential notes, sender spoofing, console-only restrictions, global prospect scope, browser identity tampering, RPC grants, repeat submissions, mismatched replay and a forced second-write failure. Twelve concurrent identical contact requests produced one ticket, one message and the same returned UUID.

The pricing package closes public draft/future/inactive price disclosure, permits draft prices only with global `pricing.read`, and permits inactive product metadata with `contracts.read`. It closes table and column browser mutations and uses service-only invoker RPCs for atomic draft replacement and publication/unpublication with audit. Existing finite signed price components remain supported. Failure injection verifies that rejected row inserts and audit writes preserve the previous draft/publication. Three real concurrency scenarios passed: publication before draft save rejects the late save, draft save before publication publishes the saved rows, and two publishers serialize to one active version with both audit records. Both read-only deployment assertion scripts and the return-shape preflight passed on the combined final native candidate.

The RBAC fixture additionally preserves the exact 27 inspected policies, table grants, company constraints and service-only `gridex_can` ACL in `server-owned-rbac-fixture.sql`. The RED test reproduces company-owner role promotion and scoped override grants. Precision: console-only direct grants already fail with `42501` because `gridex_can` is service-only; the fixture does not invent a successful console exploit. GREEN tests preserve every SELECT/table-column grant and policy definition, reject 108 browser DML attempts across the nine tables and allow 27 real service mutations. PostgreSQL 17's MAINTAIN privilege is also removed by a version-aware branch; native PostgreSQL 16 does not implement that privilege.

The fourth migration's behavioral tests verify canonical permission aliases, global deny/allow transitions, unchanged company records, invalid inputs and unauthorized actors, retained history, and complete rollback if the final INSERT fails. Twelve real concurrent setters produced exactly one active global decision and twelve retained history records. A waiting setter rechecked its actor after the lock and rejected an actor whose role was revoked during the wait. The RPC has service-only EXECUTE and a locked empty search path. SECURITY DEFINER is required to validate the target in `auth.users`, because the live service role cannot SELECT that table; no Auth grant is broadened. Exact production Auth/profile trigger definitions are captured in `docs/audits/2026-10-02-web-rbac-before.sql`. The only affected trigger write, `assign_default_role` inserting `user_roles`, is SECURITY DEFINER owned by postgres and retains its INSERT privilege. The invoker identity trigger only edits NEW.

`tests/database/independent-web-fixture.sql`, the existing-function fixture and `pricing-fixture.sql` are **local-only**. The behavioral SQL suites create synthetic identities and roll back their test writes. The final return-shape preflight was also run read-only against production and returned zero incompatibilities. Keep all schema/fixture rehearsal in the isolated native database; the Supabase connector requires `apply_migration` for production DDL, so production rehearsal through `execute_sql` with rollback is not a deployment requirement or an approved path. The inspected production insert triggers only synchronize profiles/default roles; they do not perform external delivery. On 2026-10-02, root applied only the independently deployable ACL closure to `gridex-prod` through `apply_migration`, with successful migration history version `20261002192814` and name `gridex_web_server_owned_rbac`. Its exact deployment assertions passed. Pre/post snapshots retained all nine SELECT/RLS table settings, all 27 policy definitions and service INSERT/UPDATE/DELETE grants. No production data rows or synthetic fixtures were written. The original two migrations and global setter remain unapplied.

The original RBAC/support and pricing migrations, plus the new global override RPC, remain held until the new Web deployment, server environment and domain access are confirmed. They must be coordinated with the replacement Web version. The separate pure ACL closure has been applied independently through `apply_migration`: inspection of baseline commit `9ae3736` found no company/membership/override browser writers; its session-client writes to roles, permissions, role_permissions and user_roles already fail under SELECT-only RLS, and user_permissions writes already fail the service-only helper ACL. Existing functioning user/role creation paths use service clients and retain their privileges. The ACL migration changes no data, functions, SELECT grants or policies. Root performed the sole production mutation and recorded its actual migration-history version; no production write was performed by the database agent.

The read-only `server-owned-rbac-preflight.sql` confirmed the unchanged production baseline before and after ACL application: nine tables, nine RLS-enabled tables, nine SELECT grants for each anon/authenticated/service role, 27 unchanged policies and 13 SELECT policies. `server-owned-rbac-deployment-assertions.sql` passed after that closure, and the policy/SELECT snapshot remained identical. At coordinated Web deployment, apply any unapplied original RBAC/support migration, pricing migration and global setter in dependency order; the pure ACL closure is safe either before or after them. Run all four deployment assertion scripts after the full package. This Web package must not be applied to the OPS database.

Advisor output contains broader inherited findings: 22 no-policy tables, six intentionally authenticated self-identity SECURITY DEFINER helpers, 60 unindexed foreign keys, 537 duplicate permissive-policy combinations, and 194 unused indexes. These counts are not equivalent to defects in the Web flow. Internal service-only tables remain closed; helper grants needed by RLS remain intentional. The migration adds six targeted indexes for support foreign keys, the prospect queue and permission relations. Broader duplicate-policy/index cleanup needs a separate workload/schema review.

Leaked-password protection remains an Auth configuration advisory, outside this SQL migration.

The pricing schema inspection also found nonexistent `created_by`/`published_by` fields in version create/clone/publish callers and a date-valued `valid_from`. Caller corrections belong to the pricing/RBAC package. The database pricing package covers draft replacement/publication transaction boundaries; it does not publish canonical OPS Website API data. Local pricing/contracts controls represent local history/control, with OPS remaining the publication authority.

Initial verified SQL files and deployment status, before the continuation's wall-clock correction to the unapplied RBAC/support migration:

| Migration | SHA256 | Production status |
| --- | --- | --- |
| `20261002173716_independent_web_rbac_and_public_support.sql` | `e56fa01e00f46395eb2b6a225a80b95bb90a26ed232f4c37a8c43f9bbe45533c` | Held for coordinated Web deployment |
| `20261002175651_gridex_web_atomic_pricing.sql` | `1a80900ab3ecd2e69f602b36bd503ccf0f2bbc1073af6ab98542f4e4e800b0ff` | Held for coordinated Web deployment |
| `20261002192814_gridex_web_server_owned_rbac.sql` | `015366fe2ea75c5f02ab179792581ffe362f59ee96d5e3a87b9f86519def2a9a` | Applied 2026-10-02; history `20261002192814` |
| `20261002192011_gridex_web_global_permission_override.sql` | `bdb6eed911d41fed68f444502636870fa21d25c0542cbb18d0ae60ec32c09efe` | Held for coordinated Web deployment |

Production application journal — 2026-10-02:

| Evidence | Observed result |
| --- | --- |
| Target | Web project `gridex-prod`, project ID `ayiuxjlfazkjmmtlvhsl`; OPS database untouched |
| Operation | Root invoked Supabase `apply_migration` for `gridex_web_server_owned_rbac`; result `success: true` |
| Recorded history version | `20261002192814`; source filename renamed to that exact version, byte-identical SHA256 above |
| Mutation scope | Nine-table browser mutation ACL revocation only; no row writes, no function or policy changes |
| Post-application assertion | `server-owned-rbac-deployment-assertions.sql` passed, including PostgreSQL 17 MAINTAIN and column mutation checks |
| Pre/post catalog comparison | All nine SELECT/RLS settings and all 27 policy definitions identical; anon/authenticated/service SELECT counts each remain nine; service INSERT/UPDATE/DELETE retained |
| Still held | Original RBAC/support migration, atomic pricing migration and global override RPC pending coordinated Web deployment |

This journal records root's successful production operation and read-only verification in this session. The database agent performed no production mutation.


## Continuation: expanded coordinated release

The final administration review adds the postal, monthly spot, agreement PDF
and agreement projection-trigger corrections described in
`docs/audits/2026-10-02-final-admin-review.md`. The pending RBAC/support helper
also uses a captured `clock_timestamp()` rather than transaction-start `now()`
for override validity. Its time-sensitive wrappers and private permission
helper are VOLATILE so they do not promise statement-stable authorization.
The applied RBAC ACL migration is byte-identical to its original evidence.

Read-only production preflight during the continuation still reports only
`20261002192814` from this eight-migration package applied. The existing
nine-table RBAC ACL assertions pass, RPC return-shape incompatibilities are
empty, and the postal catalog fingerprint remains
`f42e4dc03685f3ccf4d14a952611316b`. Postal browser mutation grants, including
PostgreSQL 17 MAINTAIN, remain present until coordinated deployment. The new
agreement trigger is based on the inspected live enum and
`bankid_completed_at` column. Nullable names preserve an existing full name;
`facility_id` is NOT NULL in both live agreement and delivery-point tables.

Current frozen migration sources (the manifest contains 46 files):

| Migration | SHA256 | Production status |
| --- | --- | --- |
| `20261002173716_independent_web_rbac_and_public_support.sql` | `acadd5562c56eb26c6815094003935783c16c6934c7dea91c4135fd132ae7866` | Held for coordinated Web deployment |
| `20261002175651_gridex_web_atomic_pricing.sql` | `1a80900ab3ecd2e69f602b36bd503ccf0f2bbc1073af6ab98542f4e4e800b0ff` | Held for coordinated Web deployment |
| `20261002192011_gridex_web_global_permission_override.sql` | `bdb6eed911d41fed68f444502636870fa21d25c0542cbb18d0ae60ec32c09efe` | Held for coordinated Web deployment |
| `20261002192814_gridex_web_server_owned_rbac.sql` | `015366fe2ea75c5f02ab179792581ffe362f59ee96d5e3a87b9f86519def2a9a` | Applied; do not reapply |
| `20261002200715_gridex_web_server_owned_postal_mapping.sql` | `50f76da2dad54fd88d447d79da8a36d801d76008b1c24c2331cb81a5fe73fc2a` | Held for coordinated Web deployment |
| `20261002201624_gridex_web_atomic_monthly_spot.sql` | `8c5e317e4cf300bb728bb7dc7e9512fc95e2148e30ab394eaa6a9ae70b0d2a98` | Held for coordinated Web deployment |
| `20261002202211_gridex_web_atomic_agreement_pdf.sql` | `965a30d995a90aeb375e1dca5fa516ed0fe7b67f1b0e6fd07244b2a719baa2c4` | Held for coordinated Web deployment |
| `20261002202617_gridex_web_agreement_projection_trigger.sql` | `87cde33e3ac6e9225d035f6b3c6ecfad7cdeb9a5f4fa31299dcbb950bc2a01fe` | Held for coordinated Web deployment |


Apply only the seven unapplied migrations to the Web project, in filename
order, together with the replacement Web application. Do not apply the
already-recorded ACL migration a second time or apply this package to OPS.
The new postal/monthly/agreement ACLs close baseline session-client operations;
they must not be deployed ahead of their replacement server flows. Run the
nine metadata assertion/preflight files listed in the native runner after
coordinated activation. Production DDL uses only `apply_migration`.

The checked-in native runner and CI matrix use dedicated empty disposable
PostgreSQL 16.15 and 17.6 databases. The runner requires an explicit safety
flag, localhost, fixed port/database and expected server version, refuses a
populated database, logs a hash of the selected fixture/migration/test sources,
and rejects source changes during a run. No production data or credentials
are part of those fixtures.


Final frozen native verification passed on actual PostgreSQL 16.15 and 17.6
with the same selected-source SHA256
`5d7af0639119bdf31e674461e893da17ac88926931f4e694543f453a4c1f4161`.
Each run verifies eight forward migrations, nine assertion/preflight files,
eight rollback behavior files and six multi-session programs. Five actual
lock-wait scenarios reproduce transaction-clock expiry errors in RED,
restore the exact candidate function, then deny the expired grant in GREEN:
monthly save, publish, rollback, agreement PDF and global override. Data and
audit snapshots remain unchanged. Both runs also verify populated-database
refusal, and PostgreSQL 17 directly verifies MAINTAIN removal. These local
results qualify the frozen migration package; they do not apply it to
production or substitute for authenticated tenant tests after cutover.
