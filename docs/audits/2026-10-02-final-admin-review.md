# Final Web administration review

The continuation starts from published PR #43 head
`1e813ff34e145a848af5bc682f524a43ab1018fb`. The previous local head
`c8c4ac4` has the same tree; a new local branch preserves that history and
continues from the published parent without rewriting remote commits.

## Confirmed findings

| Finding | Impact | Correction and evidence |
| --- | --- | --- |
| The postal bulk server action had no action-time permission check. | A stale console page could invoke a global configuration write without current global authority. | Both actions check global `pricing.write` before obtaining a privileged mutation client. Runtime tests exercise the actual actions and denied paths. |
| Postal mappings allowed direct authenticated mutation under a policy that checked only the existence of an `admin_users` row. | A disabled or unrelated administrator could bypass Web guards through the Data API. | A forward ACL migration removes all browser table and column mutation grants while retaining public SELECT, policies and service writes. Apply only after reviewing native and production catalog evidence. |
| Shared legacy customer, agreement and PDF entry points accepted company-scoped grants. | Global customer information could be exposed outside the grant's company scope. | Global guards are required at each shared read/export and action-time finalization entry. |
| PDF generation changed lifecycle state, set `welcome_email_sent_at` without sending an email and ignored database/audit errors. | Operators could see false activation/delivery state or an apparent successful save after failure. | Preserve lifecycle/email state, require the current global operator, save PDF metadata and audit atomically, and use the stored path for downloads. |
| Customer detail reads fetched global directories before filtering locally. | Unrelated records were transferred and an older customer's data could disappear behind the API row cap. | Filter at the database and page only the selected customer's related records. |
| Monthly spot publish/rollback used session RPC calls although production grants EXECUTE only to the service role, and referenced absent previous-period columns. | Existing authorized actions fail in production. A plain service-client swap would lose the audit actor. | New actor-bearing, permission-checked transactional Web RPCs record the prior period in the actual snapshot column; preserve legacy signatures and ACLs. |
| Monthly spot log reads invoked a service-only helper through the session client's policy; readiness also rejected valid zero/negative spot prices. | The guarded page could fail to render or incorrectly report missing monthly prices. | Read through the service client after the global page guard and determine completeness from four finite canonical area values. The actual-page regression covers denial, read failure and signed values. |
| Legacy agreement RLS admitted any `admin` assignment regardless of company or active status. | Global PII reads and direct lifecycle writes could bypass Web authorization. | Close browser mutations and replace the unsafe read policies with active ownership or explicit global agreement permission checks; internal audit reads require global authority. |
| Opening a legacy email link changed signature state, and unknown tokens still displayed a signed success. | Link scanners could sign local records without explicit customer action; invalid links falsely claimed success. | This unused local issuer has no immutable signing material and is retired. GET only reads minimal persisted signature evidence, reports invalid/unavailable/pending states accurately, and offers the current portal/support paths. Canonical OPS signup remains authoritative. |
| The existing agreement projection trigger compared an absent enum value and read an absent BankID timestamp column. | An otherwise valid PDF path update fails inside the trigger. | A forward correction uses the actual schema and ignores unrelated PDF-only updates. Local projections do not activate canonical OPS records or infer mailbox verification from BankID. |
| Timed permission overrides used the transaction start time. | An override could expire during a write's lock wait and still authorize that write. | The pending permission functions evaluate validity at the current wall clock; native tests must prove real expiry during lock contention. |

## Existing verified production state

Read-only checks on `gridex-prod` (`ayiuxjlfazkjmmtlvhsl`, PostgreSQL 17.6)
confirmed the independently deployed migration
`20261002192814_gridex_web_server_owned_rbac`. Its assertions passed with
all nine RLS tables, 27 policies, SELECT grants and service mutation grants
preserved. The original support/RBAC, atomic pricing and global override
RPC migrations remain unapplied, as do the four newly added postal, monthly
spot, agreement PDF and projection-trigger migrations. Seven migrations
therefore require coordinated release with the replacement Web application.
No production fixtures or customer writes were used in this review.

## Release boundary

Production Web remains at `9ae37362d05e4338701f1571df3b7b5f3762329a`.
At review start, PR #43's published parent `1e813ff` has a READY Vercel
preview. The expanded revision requires its own deployment/CI checks;
production
environment, OPS credential scopes, Auth redirects, support DNS/TLS and
authenticated live tenant tests still require verification. The Vercel
connector does not expose domain/environment mutations; the web panel is
behind sign-in. A selected passkey action did not establish an authenticated
session in a fresh target-page check. No domain change or Web promotion has
been performed.

## Application verification

On Node 22.23.3, the full `npm test`, full ESLint, TypeScript and production
build passed on the frozen application changes. The release gate also runs
the actual postal actions, global agreement/PDF actions, historical-path
downloads, scoped customer pagination, monthly spot RPC callers and page,
and the retired email page. Denial paths are exercised before privileged access;
database/storage errors remain distinct from missing records. The customer
detail fixture retrieves 620 agreements, 510 documents and 1,240 acceptances
only for the selected user, including records beyond the default row cap.
These are query-volume/correctness proofs, not production latency measurements.

The old launch check named the former scoped guard. It now checks the global
guard, while the actual-action regression independently proves global scope
and operation authority. It does not weaken authorization for test success.

## Final native database verification

The identical frozen SQL/test package passed on actual PostgreSQL 16.15 and
17.6. Its selected-source SHA256 is
`5d7af0639119bdf31e674461e893da17ac88926931f4e694543f453a4c1f4161`.
Each run executes eight forward migrations, nine metadata/preflight files,
eight rollback behavior files and six real multi-session programs. The
PostgreSQL 17 run exercises MAINTAIN revocation directly. Real lock waits
prove post-wait role revocation and timed permission expiry. Five timed
expiry paths first reproduce the old transaction-clock failure, restore the
exact candidate helper, then reject the same expired grant with unchanged
data/audit. The paths are monthly save, publish, rollback, agreement PDF
and global permission override.

The projection regressions reproduce both live trigger schema defects,
verify PDF-only updates do not change projections/lifecycle, preserve
canonical OPS identities and confirmed mailbox state, retain names when
nullable agreement names are absent, and roll back a forced projection
failure. Both runs refuse a second replay against the now-populated database.
The checked-in CI runs the same guarded harness and pinned PostgreSQL images.
Full migration hashes and the sole already-applied production ACL are recorded
in `2026-10-02-web-database-audit.md`.


## OPS release and Web API synchronization

OPS identity PR #454 merged at
`766fdd423344ef1c93938372d212cc234ec24b28`. The closed support-detail and
release-manifest schema corrections shipped as immutable API release
`2026-10-02.4` in PR #461, merged at
`472d703e7580fdaa49374f4d7aa202da74751057`. Published `.2`/`.3` archive bytes
are preserved, and the minimum tenant version remains `2026-10-02.3`.
The `.4` candidate passed exact-head native replay, quality/build, browser
and full E2E gates; its composition with the concurrent PR #462 tenant
scope guard passed 85 affected tests plus TypeScript and API release gates.

Vercel production deployment `dpl_7Wo7qw819H3Acsu2qqHcBCJdfLU3` is READY
for that exact merge commit and serves `app.gridex.se`. Web `api:sync` fetched
the live release manifest and both immutable specifications, verified their
raw SHA256 digests, regenerated both type sets and matched version `.4`
throughout. The local compatibility report contains no upstream contract
gaps. Authenticated customer/support/tenant behavior still requires the
post-cutover live tests described in the deployment guide.

Two historical snapshot tests incorrectly assumed the minimum supported
tenant version always equals the newest release. They now require a valid
floor at or below the release and exact agreement with both published
manifest schemas and the generated contract constant. Release/runtime
version equality and raw specification hash checks remain unchanged.
