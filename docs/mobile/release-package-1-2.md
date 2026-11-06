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
| Production HTTP guard matrix | PASS |30/30 on public gridex.se; private/no-store,401/400, no authenticated mutations |
| Real customer login/read/write | BLOCKED | no customer account/session provisioned; no private credentials requested again |
| Gridex live consumption | BLOCKED | authoritative delivery-window API absent; authenticated route deliberately503 |

## Release verdict

Automated implementation checks pass. Full packages1–2 must NOT be called done:
real customer/provider readback is unverified and Gridex live consumption remains
blocked by the upstream delivery authorization contract. Production API guard
activation is released, without enabling unverified meter access.
No real customer mutation has been made. Package3 signing/switching and package4
signed app/store distribution remain separate.

## Production lineage reconciliation

The live Web deployment discovered during release inspection is
`dpl_2GViT9JPSAXMb14HHV8mxuVz4feP`, source
`7c215d13f2086afd5328c472d5ed91eb25525a3a`. It contains47 deployed commits beyond
GitHub main1fc033e. The candidate therefore merges that exact production lineage
with09b84de before release. Deploying the original feature tree would regress
customer linking/privacy, support recovery, invoice intake, cache safeguards and
SEO. All those deployed runtime paths are retained; no production SQL is replayed.

The second review was repeated against that production baseline. Shared OPS SDK,
transport, response-profile policy, Staff runtime schemas, portal business logic,
existing Web pages/SEO, Support runtime and migrations match the deployed source.
The merged tooling retains strict documentation/wire separation while including
all three published Website, Customer Portal and Staff specs, exact hashes,
canonical immutable URLs and source provenance. Live sync/preflight are rerun.
Regression fixtures now cover the deployed explicitly supported4.1 and9.1 response
profiles, reject an unsupported older profile and still reject missing required
business identity fields. This preserves deployed compatibility; it does not
weaken runtime schema validation. Original commercial fixtures remain unchanged.


## Observed production activation

PR #56 merged as 84278b717029424c3cb4b7d6e6e08a9d293f72b5. Its tree is exactly the
reviewed/CI-green921aca405b48524d33a7b5dea6fdd5a63ce0cb8b tree
061c623722a1730146118b6bbe36a914ccce4ce5. All executed CI jobs passed: verify
(including browser/auth-isolation/performance/build/security), contract, support
(including browser/build), native-shell, standalone-export and portable-native-export.
CodeRabbit was skipped and is not counted as a review.

Production deployment dpl_97r9w3PvvjavCfpHgJiUEVyjBujw is READY in the existing
Gridex Web project. gridex.se andwww.gridex.se point to it. Production flag
GRIDEX_MOBILE_API_ENABLED=true is active. The published API origin is
https://gridex.se and path/api/mobile/customer. No protection bypass, customer
secret, direct OPS credential or second database is required in the app.

At20:31:47Z all30 public HTTP guard checks passed. At20:33:45Z the signup handoff
returned the expected308 to/teckna-avtal; that page, login and public contracts
returned200. The actual native market parser accepted96 real SE3 intervals for
2026-11-06. Homepage also returned200. Runtime error inspection after activation
reported no errors in its selected window; this is a short observation window,
not a claim about future operation or authenticated customer flows.

Reports are in quality/mobile/package-1-2/. automated-verification.json records
its own scope and does not infer production activation; deployment evidence is
this section and the separate production reports. Root clean Turbopack and
webpack builds and the Support production build passed after reconciliation.
An old local Turbopack persistence cache initially failed; a fresh generated build
directory resolved it. No product code or release gate was weakened.

The OPS production source 8969f01a31e34a494e4f7c80a593cd4693235cf1 was also read:
metering route blob 843392e550c42009e9f80411a2be1998f0e776bf and public DTO
blob 310712e0938ac7c8a0095afe2c85ed840a6c4217 have the same missing authoritative
delivery-window contract as the reviewed main source. Live Gridex consumption
therefore remains blocked deliberately. No OPS deployment was changed.

This final evidence update changes documentation/test reports only. The
application-code qualification remains bound to the exact reviewed/deployed tree
above. It does not turn blocked customer/consumption checks into passes.
