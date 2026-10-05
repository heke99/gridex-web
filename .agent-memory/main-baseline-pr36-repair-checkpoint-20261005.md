# Main baseline: PR36 existing Auth onboarding repair

Bounded source lane owned by staff_api_flow_completion on 2026-10-05. Root registered claim36 in comments 5998740473 and 5998799079; root retains final review/publication/merge and deployment-readiness ownership. Other source owners retain active Web43/Web45 and OPS work. Those trees/branches were not edited.

Isolated worktree: `/workspace/gridex-web-pr36-main-baseline-repair-20261005`; branch `codex/pr36-main-baseline-repair-20261005`, created from current origin/main `ff950425b6922df88817f840dc5a395cbceab8eb`. Original PR36 head `4165840ac982e782214114acdc6a4e254913b551`, onboarding blob `f412422eb23d0ed9d895d2dceb0c6df013bcf1fa`, was freshly fetched read-only.

## Behavior

Main already has an explicit signed-result portal claim. The thank-you page carries encrypted checkout proof through login to /auth/portal-claim. The repair uses that flow. It sends no automatic recovery email and creates no unused reset token. The existing user-requested forgot-password UI remains the email action.

An invite collision parks a pending, unbound job with null next_attempt_at and no retry-budget consumption. Repeated checkout/worker calls leave it waiting. Its existing-account message retains the current claim CTA. Email/login discovery alone cannot bind an unbound job; exact signed checkout, accepted submission, onboarding row, stable customer identifiers and authenticated account must agree.

Known profile conflicts cannot be hidden by one matching identifier or a matching Auth UUID. Resume processes only IDs already validated by its caller and uses conditional state/binding updates. Stored authenticatedUserId is not fresh email confirmation. Processing writes include exact status, attempt, lock timestamp and Auth binding; signed-claim and worker paths recheck ownership after provider/profile/API awaits and before canonical sync or each local projection. Confirmed-account projections are written only after canonical owner acceptance. Existing profiles use a stable-identity snapshot in the UPDATE predicates; an absent profile uses ON CONFLICT DO NOTHING, never overwriting a concurrent profile.

## Owned files

- lib/customerPortal/onboarding.ts
- lib/customerPortal/onboardingResume.ts
- lib/customerPortal/portalClaim.ts
- new lib/customerPortal/stableIdentity.ts
- tests/auth-onboarding-hardening.test.mjs
- new tests/portal-existing-auth-onboarding-runtime.test.mjs
- package.json test registration
- this new checkpoint

Shared TypeScript loader was not edited. No UI, route, SQL/migration, private environment/configuration, CI workflow or lockfile changed.

## Instructions and setup

Read repository TDD, auth/interface and code-review skills, support AGENTS Next rule, installed Next authentication/server-action/route-handler guides, Customer identity/facility and Web API guides before implementation. Applied TDD/code-review and Supabase guidance; freshly fetched/scanned current Supabase changelog/Auth documentation.

Node22.23.3 uses the supplied existing binary. Exact locked npm ci installed 399 packages only in the new worktree, using dedicated /tmp/gridex-pr36-npm-cache, HUSKY=0 and disabled lifecycle scripts. Project has no lifecycle scripts; lock marks only unrs-resolver with an install script. Package-lock remains unchanged. No private environment or provider credentials were read.

## Evidence so far

- Main launch-readiness guard PASS before source changes.
- Immutable original PR36 source overlay: expected automatic reset-email policy RED reproduced. Initial overlay failed to replace named fs exports and is not promoted as evidence; corrected URL handling and syncBuiltinESMExports reproduced the actual guard.
- Before production edits: actual main-module runtime suite, 16 tests, 5 PASS / 11 expected RED for repeat-invite budget, profile conflicts, stale completion, stale confirmation and callback candidate expansion.
- Initial repaired suite: 16 PASS. Expanded real claim-route/replay/identity coverage: 19 PASS.
- Existing auth-onboarding-hardening PASS; TypeScript typecheck PASS; initial whitespace check PASS.
- Initial full ordinary suite and scoped lint passed. Three additional Auth-binding race tests reproduced 3 RED / 19 PASS, then passed after conditional binding guards were added.

The finite tests execute real onboarding/resume/signed-claim and claim-route code. Only provider/API/encrypted-result persistence boundaries use in-memory fixtures; outbound fetch throws. This is offline evidence, not provider/native/browser/hosted acceptance. No email, scope, migration, environment, domain or deployment action occurred.

## PR45 handoff, source untouched

Customer-card line27 already passes the selected reference. New-case only fetches first50 general-search rows and selects the reference if present. Web45 owner should call the same scoped getCustomer API for search.customer, include/deduplicate that exact row, retain it while searching, and verify a selected customer outside the first50 rows. No PR45 source changed here.

## Remaining owner gates

Root reviews/publishes/merges the final repair. PR43 remaining assertion, broader account/outbox/RBAC and native-forward work still needs source-owner integration and combined-source qualification. Production-connected marketing merge stays gated by root Customer-readiness/deployment-hold work. No live-readiness claim follows from this repair.

## Independent later-await correction

The initial 22-case source freeze was superseded after ops_packet_pr_merge_review independently reproduced three RED finite contrasts: claim loss after its final profile read, concurrent conflicting profile insertion, and worker claim replacement during the canonical API await. All three were rerun unchanged and reproduced locally before source corrections. Publication remained held.

Added five owner regression cases first: 22 PASS / 5 RED. The correction uses one conditional profile writer for signed claims and workers: read stable identity, check processing ownership after that read, UPDATE with the exact original nullable stable columns or INSERT with conflict-ignore and a returned-row check. A changed/inserted conflicting profile cannot be overwritten, and a missing returned row stops later projections. Worker completion and failure CAS now include Auth binding and track only their own successful binding change. Each contract/delivery-point write has an ownership fence. Confirmed-account workers defer all local projections until canonical sync succeeds.

Three provider/profile-await-to-sync tests then reproduced 3 RED / 28 PASS and passed after adding the last pre-sync fence. One discovery-to-invite test reproduced 1 RED / 31 PASS and passed after the pre-invite fence. Final focused suite: 32 PASS, zero failures. The finite query models SQL IS NULL and ON CONFLICT DO NOTHING return/no-write behavior; these changes describe the actual adapter semantics, not relaxed assertions.

Important limit: separate PostgREST reads and projection writes do not form a database transaction. Exact profile predicates prevent stable-identity overwrite within that write, but processing-token reads cannot atomically lock job/profile/contract/delivery rows together. Arbitrary replacement between a successful ownership read and a later SQL statement remains a database/RPC integration concern. This bounded source-only repair is not native concurrency proof or certification of PR43's broader atomic work.

Corrected source freeze shared with the independent reviewer: onboarding SHA256 2e54a7370e89a9d1add1ae00d98d84de0ea5f612220b3dfdca6506db8ef984e8; portalClaim abad42adf0957eeab98359b04ccaf86970934cf9b550244faaa96cea24d37a5a; stableIdentity e237dac6a10232cd267ca4b9ba1b87c9de3c50d39f89a214337b98a27f2b2d8c; runtime tests 2dd5290955cc5ff0b72e72b1b4534d24cf9c7f413f3c42f371b945f427d77787. Remaining source/package files preserve their prior freeze. Documentation was completed afterward.

Independent requalification: ops_packet_pr_merge_review confirmed the exact corrected freeze, 32/32 real-module/actual-route scenarios and all three original policy contrasts PASS in a new faithful DO NOTHING/SQL-null harness. The old 3-RED harness/hash remains preserved. Late lost claim produces zero local writes, concurrent foreign profile remains unchanged with blocked result, and stale worker produces zero verified writes. Reviewer gave GO only for this bounded source repair; native atomic multi-table and fresh build/CI remain excluded. No source changed after that independent freeze.

## Final corrected local qualification — 2026-10-05

- Final Node22 npm test: PASS; includes all 32 focused runtime/actual claim-route scenarios and the complete ordinary launch suite. The reset-email policy guard remains enabled and passes.
- Final corrected-source TypeScript typecheck: PASS.
- Existing auth-onboarding-hardening: PASS.
- Final corrected-source scoped eslint of all changed TS/test files with max-warnings=0: PASS.
- Full npm run lint: PASS, zero errors and only two unchanged pricingQuote.ts unused-variable warnings outside this lane.
- npm run verify:delivery: PASS; frozen local OpenAPI drift, 38 immutable migrations, zero static contract gaps, API hardening checks. Empty environment-blocker output is not hosted verification.
- Standard production build: NOT QUALIFIED locally. Default Turbopack cannot fetch Google fonts in the restricted network. Its supported offline font fixture then hits sandbox port-binding denial. Alternative offline webpack run fails inside Next16.3 TypeScript --showConfig parsing; direct tsc --showConfig produces valid JSON and typecheck passes. Independent reviewer subsequently reproduced the exact Next TypeScript configuration read failing with sandbox subprocess EPERM/status0/empty stdout, then parsing correctly under a narrowly approved execution exception. No source/dependency/config workaround was committed. Root must obtain an actual fresh current-source build/CI PASS before merging.
- No private project/client/provider inventory, key, token, signed assertion or deployment target is included here.

No commit, remote publication, branch update, merge or hosted change has been performed by this lane. Root owns publication and actual current-head qualification. Final exact eight-file ownership, unchanged baseline lockfile, whitespace and no auto-reset/token-code checks: PASS. Original main/review worktrees remained clean in the final local observation.
