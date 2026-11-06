# Mobile live Auth and isolation verification — 2026-11-07

## Verdict

RED for full packages 1–2 acceptance: real Auth/session and unlinked-customer isolation are verified, but populated OPS-linked customer flows and physical-device qualification remain blocked. This is not a full product release approval.

## Execution identity

Gridex Web main: `b3478a0ffff2bf172a973b77dff9b55df55a48eb`.
Native source tested locally has exactly tree `a30b048db57afebbc47e6db668b3902a9f4f6d89`, matching main. Production HTTP target was `https://gridex.se`, deployment `dpl_3zHRj3GSEoz8s7BMkZh3rBbgfp9r`, source `35b2946b96876b5369a383265ea15bf42606d33c`. The new native session fix changes no server routes. Database: existing Gridex Web `gridex-prod`.

Two isolated accounts were created explicitly for this user-authorized test in the existing Auth project. Because the connected administration interface did not expose Auth create-user and existing Vercel sensitive values were unavailable, these fixtures were provisioned transactionally in the inspected Auth schema with email/password identities and bcrypt hashes. Email confirmation was set only for the two synthetic `example.invalid` identities. This does NOT verify ordinary registration, email delivery or clicking a confirmation email. No global Auth settings, roles, real customers or OPS records were changed.

## Results

| Scenario | Result | Evidence |
| --- | --- | --- |
| Password sign-in and confirmed subject for two accounts | PASS | Real Auth responses, subject equality |
| Own profile read | PASS | Real per-user RLS REST read |
| Other test account's profile read | PASS | Empty scoped response |
| Other test account's profile update | PASS | HTTP 403; independent SQL confirms no forbidden write persisted |
| Contracts, sites and invoices for unlinked accounts | PASS, empty-account scope | Actual mobile API 200 with explicitly empty own arrays and private/no-store |
| Caller-supplied customer override | PASS | Actual mobile API 400, private/no-store |
| Refresh, global logout and refresh rejection afterward | PASS | Real Auth 200 / 204 / 400 |
| Native account hook sign-in and canonical read | PASS | Actual hook, SDK and production mobile HTTP |
| Background clears private rows | PASS | Hook state readback |
| Foreground revalidates and rereads | PASS | Actual refresh and production HTTP |
| Remount restores saved session | PASS | Real SDK with chunked storage adapter |
| Logout clears rows and stored session | PASS | Hook and storage readback |
| Profile API for unlinked customer | BLOCKED feature | HTTP 503, no personal payload; this is only a successful fail-closed check |
| Populated contract, facility switching, invoice/document/support readback | BLOCKED | Test identities have no authoritative OPS customer relationship |
| Native installed UI and OS SecureStore | NOT RUN | No iOS/Android device/emulator/runtime available |
| Signed installable app | NOT RUN | Hermes export is not a signed installable build |
| Browser authenticated journey | NOT RUN | Local Chromium download produced invalid archives. Cloud browser login UI rendered, but secure credential interface cannot autonomously consume the generated fixture credentials |

The API matrix has 26 passing Auth/RLS/HTTP guard assertions. Six separate native-session assertions pass. Neither count upgrades the blocked business/device flows. The SecureStore port used in native execution was an in-memory map behind the actual chunked storage adapter; hook remount is not physical OS process termination.

The first HTTP run used an incorrect oracle: it expected unavailable responses for all unlinked resources and did not accept HTTP 403 for rejected RLS writes. Source inspection confirmed the established unlinked-resource normalization. The corrected run explicitly asserts empty arrays and treats 403 as denial; it passed 26/26. No application guard was changed to obtain these results.

## Reproduction

Use two newly provisioned isolated test identities. Keep secrets outside the repository in permission-restricted files. Config JSON requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; accounts JSON is an array of two objects with `id`, `email` and `password`. Test emails must start with `gridex-mobile-e2e-` and end with `@example.invalid`.

```sh
python scripts/verify-mobile-live-auth.py --config /private/config.json --accounts /private/accounts.json --report /private/auth-report.json
node --experimental-strip-types --experimental-loader ./tests/mobile-live-account-loader.mjs tests/mobile-live-account.mjs --config /private/config.json --accounts /private/accounts.json --report /private/native-report.json
```

The HTTP verifier makes only isolated profile-denial probes, bounded reads, and Auth operations. It never creates an application, contract, consent, supplier switch or real support message. The live native runner is opt-in and is not added to ordinary offline CI. Do not run these two commands concurrently with the same identities: global logout can invalidate the other run's refresh token.

## Reviews, quality and cleanup

Two self-reviews checked actual-versus-synthetic boundaries, credential/output handling, RLS outcomes, source/deployment identity and cleanup. Native runner and loader syntax checks and scoped ESLint pass; Python syntax and CLI checks pass. Previous application verification is not represented as a new full-suite execution.

All live runs finished. A guarded transaction removed exactly the two marked unlinked fixture users after logout. Independent post-delete counts: zero test users, zero test customer profiles and zero test sessions. Test credentials are excluded from reports and repository. No OPS code, database, release or contract was changed.

## Remaining prerequisites

A qualified OPS-linked synthetic customer with its own authoritative agreements/facilities/documents is still needed to exercise populated customer journeys. Do not link fixtures to a real customer's records or invent delivery rights. Consumption remains behind the published upstream delivery/query contract requirement. An installed development build on an available native device/emulator is needed for actual SecureStore and visual mobile journey qualification. No GREEN verdict is justified until these P0 flows are exercised.
