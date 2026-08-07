# VERIFICATION_MATRIX

Datum: 2026-08-07
Verifierad kod-head på `main`: `e70ed0ca6f8c16870a0aa97b8fb102095da10d7c`
Live OpenAPI run: `31190726958`
Full quality run: `31190727274`

| Kontroll | Evidens | Status |
|---|---|---|
| `npm ci` | GitHub Actions | PASS |
| Dependency audit under install | 400 packages audited, 0 vulnerabilities | PASS |
| OpenAPI local drift | snapshots/types/manifest konsistenta | PASS |
| OpenAPI live preflight | aktuell live `.2` + hash | PASS |
| Website OpenAPI hash | `e8ddc6b8a35d14f561caf4e3ef13917affb1b1af58ae759cb1a8a0332f59a701` | PASS |
| Customer portal hash | `2a998b7b8be3780fc9793ab1de742912915a9d4925bfb3246d84b2f1c3d9f65e` | PASS |
| Migration manifest | 33 migrations | PASS |
| API compatibility | compatibility check | PASS |
| Production file-size guard | inga icke-genererade produktionsfiler > 2 000 rader | PASS |
| Contract-version observation regression | dedicated test | PASS |
| ESLint | `npm run lint` | PASS |
| TypeScript | `npm run typecheck` | PASS |
| Full regression/launch suite | `npm test` | PASS |
| Next.js production build | `npm run build` | PASS |
| Main live-drift gate on every push | `.github/workflows/openapi-drift.yml` | PASS |
| Quality workflow permissions | read-only på main | PASS |
| Existing migrations edited | none | PASS |
| New speculative DB migration/index | none | PASS |
| Authenticated live tenant checkout E2E | riktiga credentials ej använda i denna CI | UNVERIFIED |
| Production Vercel deployment | kontrolleras separat | UNVERIFIED |
| Production load/p95/p99 | produktionstelemetri ej tillgänglig i CI | UNVERIFIED |

## Definition of Done – repo scope

PASS. Kod-head `e70ed0ca…` har både live contract gate och full quality gate gröna.

## Upstream release-integritet

OPS ändrade website-specen inom samma versionsnummer `2026-08-05.2`. Klienten är synkad mot aktuell live-hash och main blockerar nu same-version drift via live preflight. Själva upstream-beteendet bör dock korrigeras i OPS genom immutable releases/version bump-policy.
