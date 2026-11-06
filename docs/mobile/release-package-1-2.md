# Gridex mobile packages1–2 — release evidence

Date:2026-11-06. Source before this packet:235e05b44f33cdce164654e095f950efdcbbc360.
Scope: public Gridex mobile API activation; consumption UI and portable provider
contract. Same Web repo/Supabase Auth/database. No OPS/database changes, customer
records, signing flow or store installation are included in this packet.

## Two separate self-reviews

1. **Security/data review:** traced bearer verification through Supabase getUser,
   confirmed-email check, subject-bound RLS customer_profiles lookup and existing
   tenant OPS assertions. Request customer/tenant overrides are rejected. Account
   writes remain field-whitelisted with canonical acceptance/readback checks.
   Consumption review found OPS has no delivery-period guard or authoritative
   facility delivery-window DTO. Gridex fails closed before reading values. The
   portable adapter requires trusted scoped windows, excludes crossing intervals
   and rejects duplicate/overlapping revisions. Synthetic two-identity tests and
   actual Gridex-route tests assert these boundaries. No identified open leak in
   these new paths; live customer isolation remains unverified.
2. **UI/integration/export review:** traced tab→account→consumption, logout,
   background,401 and stale facility responses. Found and corrected the missing
   explicit Metro watch folder for the shared pure provider module. Found and
   replaced UTC calendar-day selection with Stockholm boundaries; both DST
   transitions have behavior tests. Exports include only reviewed sources and
   neutral configuration. Actual isolated-export typecheck and Android/iOS Hermes
   bundling pass. Charts group by interval start day and label partial fetches;
   gaps are never treated as zero. These are self-reviews, not independent reviews
   or a physical-device qualification.

## Verification matrix

| Check | Result | Evidence / scope |
| --- | --- | --- |
| mobile:verify | PASS | actual route/hook/component code with synthetic Auth/providers; root/native types and lint |
| New consumption behavior tests | PASS |6 server/provider,4 native UI/parser/DST,2 hook lifecycle |
| Strict live api:preflight | PASS | exact docs/wire revisions, hashes, immutable URLs, migrations and compatibility; does not prove delivery rights |
| test:launch | PASS | existing commercial/signup/OPS integration regressions |
| test:customer-support | PASS | customer support integration regressions |
| test:audit-hardening | PASS | SQL/RLS/runtime/outbox/readiness regressions |
| Root production build | PASS | Next16.4.5, includes consumption route |
| Gridex Android + iOS exports | PASS | Hermes bundles; not signed device binaries |
| Fresh OPS-free extracted app | PASS | offline clean install, types, Android/iOS Hermes exports |
| Built local HTTP guard matrix | PASS |30 read/write/query/auth checks against actual production server |
| Production HTTP guard matrix | PENDING | must be checked after exact-source deployment |
| Real customer login/read/write | BLOCKED | no customer account/session provisioned; no private credentials requested again |
| Gridex live consumption | BLOCKED | authoritative delivery-window API absent; authenticated route deliberately503 |

## Release verdict

Automated implementation checks pass. Full packages1–2 must NOT be called done:
real customer/provider readback is unverified and Gridex live consumption remains
blocked by the upstream delivery authorization contract. Production API guard
activation can be released separately, without enabling unverified meter access.
No real customer mutation has been made. Package3 signing/switching and package4
signed app/store distribution remain separate.
