# Verification matrix

`UNVERIFIED` means the check requires an environment not available in this GitHub-only run.

| Control | Result | Evidence |
|---|---|---|
| OPS API contract | PASS (public contract) | current public OPS docs/spec and local runtime now use `2026-08-05.1` |
| OpenAPI drift | PENDING CI | `npm run api:check:local` |
| DB migrations | PENDING CI | `npm run db:migrations:check` |
| DB/code consistency | PASS for reviewed rate-limit path | application RPC matches repository migration |
| Tenant isolation | PASS for reviewed changes | no new shared sensitive cache or client-controlled tenant trust added |
| Rate limiting | PASS for reviewed checkout paths | distributed limiter plus route 429 behavior |
| Cache isolation | PASS for reviewed changes | transactional no-store preserved |
| Files <= 2000 lines | PENDING CI | `node scripts/check-file-size.mjs` |
| TypeScript | PENDING CI | `npm run typecheck` |
| Lint | PENDING CI | `npm run lint` |
| Tests | PENDING CI | focused regression plus `npm test` |
| Build | PENDING CI | `npm run build` |
| Security | PASS for reviewed source controls | transport/error/rate-limit/RLS evidence |
| Authenticated live checkout | UNVERIFIED | requires deployed integration context |
| Production database/hosting configuration | UNVERIFIED | requires deployed environment access |
