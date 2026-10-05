# Independent invitation addition — source verification

Status: **code and offline portal checks PASS; production activation blocked**.
This is an addendum to the preserved original receipt, not hosted acceptance.

The portal now has its own `/auth/invitation` page and explicit acceptance
Server Action. It verifies its fixed Prod Auth identity, completes the first
password update, then calls the separately versioned onboarding API with a
fresh signed proof and stable idempotency key. GET creates no tenant access.
URL credentials are captured in uncontrolled hidden fields and removed from
the URL; a form retry uses the established verified host-only Auth session.

| Executed check | Result |
| --- | --- |
| Signed client, verified Auth, server actions, independent callback | 56 tests PASS, including 8 callback tests |
| Chromium on real Next pages | 17 checks PASS; zero browser errors |
| Scoped strict TypeScript | PASS |
| Scoped ESLint including tests and fixtures | PASS, zero warnings |
| Production support build without credentials | PASS; 11 dynamic routes including the error route |
| Existing website contract preflight | PASS against published 2026-10-04.1 |
| Existing website TypeScript and complete launch tests after contract sync | PASS |

The browser additionally covers invitation GET fragment capture/removal and an
invalid invitation with no acceptance form. It does not cover a real email or
native onboarding POST. The eight action tests cover verified fragment/session
handling, hash/code links, wrong project, a failed first password with no API
request, malformed acceptance and stable-key retry with fresh proofs.

The initial website CI contract mismatch was repaired by syncing the managed
contracts and generated types to the actual published immutable release, then
updating the existing release-version fixture. Original historical fixtures
and the frozen Staff contract were preserved. Website production build passed
on the original portal CI commit; the synchronized final version requires its
own remote CI build (local marketing Turbopack cannot bind a worker port in the
managed sandbox). The independent support webpack build passed locally.

All accounts, RSA keys and boundary records in these tests are synthetic.
Auth and successful API response attestation require `ayiuxjlfazkjmmtlvhsl`.
No Prod rows, configuration, migration, provider/client, real email or domain
assignment were changed. A verified Gridex Prod company/admin, native schema
prerequisites, real API runtime readiness and registered Auth callback remain
required. The editable password metadata is an advisory UI hint only.

Safe evidence and source bindings: [manifest](onboarding-evidence-20261005/manifest.json).
