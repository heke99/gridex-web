# Mobile app portability foundation – 2026-11-06

Owner: current root session. Scope is additive mobile foundation files only.
Base main: `1fc033ef791b5bb62ac6672576e64c83727c17d0`.

User decisions: website and native customer app share gridex-web and the existing
Gridex Web Supabase project/accounts. OPS keeps its own repository/database and
is consumed through its API. Mobile template/layout must be extractable later.
Buyer installations use their own credentials/data and OPS tenant or compatible
API; a template export never copies Gridex accounts/customers/secrets.

Implemented: dependency-free public brand model, provider-neutral interface
contracts, separate Gridex brand configuration, allowlisted standalone foundation
export, portability tests and CI job. Masterplan updated to v2 in docs/mobile.

Validation: Node v24.22.1, six focused runtime/export tests PASS. Exported package
tests run in a fresh directory outside the repository. Tests cover two independent
brands, forbidden config fields, unsafe URLs/themes, standalone export, refusal
of existing destinations and paths into the source (including parent symlinks).
Source syntax and whitespace checks PASS. No root dependencies or web runtime
paths changed. Whole-web tests/build, Node22 CI and native builds not run locally.

No database/hosted Auth changes, migration, live customer read, deployment or
production activation. This increment is a portable foundation, not a working
native customer app. Source remains separate from production until qualified.

Next: integrate Expo runtime, actual shared mobile layout and guarded per-brand
build configuration; then Supabase Auth adapter against existing Gridex accounts
and server-verified OPS customer overview. Test every added package in standalone
export. API gaps for contract change, price series and summaries remain in plan.


Continuation: added Expo 58 native shell, independent locked dependency install,
brand-driven five-tab layout, isolated TypeScript config and Metro sibling-package
watch boundary. Typecheck PASS; Android JS/Hermes export PASS (not an APK).
Six portability tests remain PASS. Added native CI typecheck and platform bundles.
Physical-device UI/Auth/OPS verification remains pending. No database changes.
