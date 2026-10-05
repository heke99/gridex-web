# Support selected-customer case prefill repair — 2026-10-05

Root approved the exact four-path claim in Web45 comment 6000011623. Source owner: staff_api_flow_completion; root/SC047 retain independent review, publication, current-main integration and deployment qualification.

Isolated worktree: /workspace/gridex-web-support-selected-customer-case-20261005. Branch: codex/support-selected-customer-case-20261005. Immutable parent: ac1c6ca09bcc49cae519e14c5d6550c63c8117d3.

## Concrete issue and resulting behavior

The customer-card new-case link already supplies the opaque customer reference. The new-case page searched only the first 50 customers and selected that reference only when present there. Its separate GET search form also discarded the reference, so a linked customer outside the first page or outside a later search lost the default.

The page now obtains a selected customer through the same requireSupportSession-bound signed Staff client's getCustomer method. It adds that verified detail row to the options and removes its duplicate from the search rows. The select defaults to the verified response reference. The GET search form carries that same verified reference in a hidden customer input, preserving the explicit server selection when another query is submitted.

Malformed references fail at the existing client validator; inaccessible/not-found references and foreign staff fail at existing tenant/Auth/API boundaries. The page never creates a customer row from query parameters, supplies a company override, bypasses detail authorization or issues a write. API errors remain errors, rather than falling back to a fabricated selected option.

## Exact owned files

- apps/support/app/(workspace)/cases/new/page.tsx
- tests/support-actions.test.mjs
- tests/support-ui-loader.mjs
- new .agent-memory/support-selected-customer-case-checkpoint-20261005.md

No package registration, shared TypeScript loader, fixture source, Auth, binding, assertion, provider, SDK/contract, SQL/migration, environment/configuration, workflow or hosting file changed.

## Instructions and setup

Read apps/support/AGENTS.md and the installed Next16.3.0 page/searchParams, fetching, authorization and forms guides before code writes. Applied the repository TDD workflow and existing API boundary conventions.

No installed dependency tree available in the Web worktrees matched this parent's exact lock. Necessary Node22.23.3 isolated npm ci installed 404 locked packages, using dedicated /tmp/gridex-selected-customer-case-npm-cache, HUSKY=0, ignore-scripts and no audit/fund. Root/support packages have no lifecycle scripts; the lock marks only optional fsevents and unrs-resolver installers. Package and lock remain byte-identical to the parent; no shared hooks or provider credentials were read.

## RED/GREEN evidence

The support-only loader now transpiles only apps/support TSX with the installed TypeScript automatic React JSX transform and resolves NextLink's concrete Node entrypoint. It retains the existing request-local framework seams. Actual page, Auth/session, binding resolution, signed Staff API client, schema validation and response attestation execute unchanged.

The finite search adapter substitutes only a schema-valid synthetic 50-row search DTO after the fixture has checked actual RSA/actor/company authorization. Canonical detail lookup is served by the unchanged fixture and client. No outbound production endpoint is reachable through that fixture.

Before the production page edit: 28 actual page/action tests, 24 PASS / 4 expected RED. The four failures demonstrated a missing selected customer beyond 50, loss of its GET search parameter, silently accepted inaccessible reference, and silently accepted malformed reference. All 21 prior action tests and three new protection/control cases passed.

After the minimal page fix: 28 PASS / zero failures. Seven new scenarios cover six requested categories: outside-first50 selection, subsequent query preservation, selected-row deduplication, ordinary no-selection behavior, valid inaccessible plus malformed reference denials, and foreign staff denial. They inspect the actual page's React element output and verify admitted customer reads use the actual signed actor/company and no write commands.

Final local qualification on the frozen source:

- npm run test:support: PASS, 128 tests / 128 PASS / zero failures across all nine TAP suites.
- npm run typecheck:support and npm run typecheck: PASS.
- Scoped eslint for the exact page and two changed test files, max-warnings=0: PASS.
- npm run verify:delivery: PASS, local contract2026-10-04.1, 39 immutable migrations, no static contract gaps and hardening checks.
- Production file-size guard and git diff --check: PASS.

Source freeze SHA256:

- Page: 904b1442cf7cd558d2dbb65491f9195a6808eb6ad9836ba98320947246e04514
- Action/page tests: af0b1fac556d2b7af00ad7991ff719dcc42d96d32576ff81c8a3ee24bbb49fa8
- Support-only loader: 8215d137f04409f8d445521986842fcc0b73d6a32eacc998717906d534165fc2
- Unchanged parent lock: a53d09f701c2ceb1302b61837cd04d318cdfccc4cd6726d7e8374a1b45edb6e4

## Remaining owner gates and limits

Root/SC047 independent review must precede publication. This result needs normal current-main integration after the Web47 union and fresh integrated-head CI/build/browser evidence. No force push, published-branch rebase or SDK duplication is authorized in this lane.

The new regressions execute real server page output and synthetic signed boundaries; they are not a browser DOM/click result or live tenant readiness proof. The existing browser flow remains a later integration/CI check. Empty static environment-blocker output does not verify actual scopes, enrollment, provider assertions or deployment. No private project/provider/client inventory is recorded here.

At the first review freeze, this lane had performed no local commit, push, PR, remote comment, hosted change or deployment. The three source files remained frozen while root/SC047 reviewed them.


## Local integration chronology

2026-10-05 18:03 UTC: root reported independent SC047 GO, 28/28 actual page/action tests and all four review hashes matching. Root explicitly authorized committing exactly the four claimed paths locally, followed by a normal merge of current Web main 1dfcc2a8b86e87207f58c34187d6eec2a724e1c3 into this own branch. No published history rewrite or external write is authorized. Pre-integration comparison found no overlap in the three source/test paths, and main preserves the exact locked dependency hash.

2026-10-05 18:04 UTC: local source commit 5c27635ec097452527baf79a595b6a7baf3519f7 contains exactly the four claimed paths. Normal --no-ff merge c3f14282d58ae49247357d3b374bb9c9ee27d7a7 incorporates current main 1dfcc2a8b86e87207f58c34187d6eec2a724e1c3 and preserves both histories. The merge was conflict-free and imported only the existing root deployment-hold document plus vercel.json; no application/test source changed.

Post-merge actual page/action suite: 28/28 PASS, zero failures. Comparison against exact current main: only the four claimed paths differ. Original three reviewed source hashes match unchanged. Main deployment-hold configuration, package and lock are byte-identical to main; both main and the local source commit are verified ancestors. Integrated diff whitespace passes and the worktree is clean before this authorized chronology update. Root owns push/PR, fresh integrated-head CI/build/browser qualification and eventual merge; this lane performed no external write or hosted action.
