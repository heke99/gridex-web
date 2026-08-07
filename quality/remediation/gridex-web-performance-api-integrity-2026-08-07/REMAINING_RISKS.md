# Remaining risks

Only unresolved or environment-dependent items are listed.

1. **Deployed authenticated end-to-end verification — UNVERIFIED.** Repository/public-contract evidence cannot prove tenant-specific production behavior.
2. **Production database parity and query plans — UNVERIFIED.** Repository migrations are internally reviewable, but deployed migration state, table cardinality and production `EXPLAIN` evidence require database access.
3. **Vercel/CDN runtime cache headers — UNVERIFIED.** Source policy was reviewed; deployed edge behavior requires runtime observation.
4. **Real-user performance budgets — UNVERIFIED.** No production RUM/Lighthouse trace is available in the GitHub connector, so no invented LCP/CLS/INP improvements are claimed.
5. **Future OPS releases.** The repo now aligns to current public `2026-08-05.1`; the existing drift tooling and new CI gate must remain required so a later release is adopted only after it is actually published and verified.
6. **Missing repository governance files.** `AGENTS.md`, `skills-lock.json` and referenced `.agent-memory` material were absent on the baseline. The remediation did not fabricate them.

No known blocker justifies a new database migration or unsafe cache/index change in the verified paths.
