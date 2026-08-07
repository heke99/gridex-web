# Skill routing

`AGENTS.md`, `skills-lock.json` and `.agent-memory` were not present on the audited baseline. `.agents/SKILLS_SOURCES.tsv` was therefore used as the machine-readable primary inventory (35 entries). The later `.claude/skills` tree is treated as supplemental agent tooling/mirrors, not as a replacement lockfile.

| Skill | Status | Use | Result |
|---|---|---|---|
| source-driven-development | ACTIVE | Evidence hierarchy | Repo/live-contract claims separated from inference |
| pg-aiguide | ACTIVE | Postgres review | Migration/RPC/index review |
| supabase-postgres-best-practices | ACTIVE | RLS/query/index review | Rate-limit schema verified |
| debug-bundle | ACTIVE | Failure-chain review | Contract drift isolated |
| frontend-design | CONDITIONAL | UI integrity | No speculative redesign |
| next-best-practices | ACTIVE | Next.js boundaries/cache | Server transport/cache reviewed |
| composition-patterns | CONDITIONAL | Component structure | No unjustified fragmentation |
| nextjs-app-router-patterns | ACTIVE | Route handlers | Checkout/public routes reviewed |
| vercel-react-best-practices | ACTIVE | Rendering/performance | Client/server boundary considered |
| supabase-skill | ACTIVE | Supabase integration | RPC/migrations reviewed |
| migrate-to-neon | N/A | Neon migration | Project remains Supabase; no migration requested |
| neon-postgres | N/A | Neon | No Neon runtime |
| use-neon | N/A | Neon | No Neon runtime |
| neondb-skill | N/A | Neon | No Neon runtime |
| postgres | ACTIVE | Schema review | Migration-backed DB findings |
| sql-optimization-patterns | ACTIVE | Query/index review | Existing reset index verified |
| index-tuning | ACTIVE | Index audit | No blind index additions |
| code-review | ACTIVE | Correctness review | P0 drift and observability gap |
| debug | ACTIVE | Root-cause analysis | `.2` sync commit traced |
| test-fix | ACTIVE | Regression protection | Version-observation test added |
| code-optimizer | ACTIVE | Performance review | Existing transport safeguards preserved |
| api-and-interface-design | ACTIVE | OPS boundary | Canonical OpenAPI hierarchy enforced |
| architecture-and-structure | ACTIVE | Layering | Transport/domain boundary preserved |
| ci-cd-and-automation | ACTIVE | Merge gates | Full quality workflow added |
| code-quality-playbook | ACTIVE | Verification discipline | PASS/FAIL/UNVERIFIED evidence model |
| core-llm-development | N/A | LLM systems | No LLM subsystem in audited scope |
| docs-research-and-pdf-evidence | N/A | PDF evidence | No PDF source required |
| document-and-report-generation | ACTIVE | Remediation evidence | Required report set generated |
| llm-security-and-prompt-injection-defense | N/A | LLM threats | No LLM input surface |
| performance-optimization | ACTIVE | Network/cache/server | Timeout/retry/cache paths audited |
| reusable-prompt-and-schema-design | N/A | LLM schemas | Not part of product runtime |
| security-and-hardening | ACTIVE | Secrets/tenant/errors/rate limit | Existing controls verified; no secret exposure added |
| spellbook | CONDITIONAL | General workflow | No independent product-specific change required |
| test-driven-development | ACTIVE | Regression-first changes | Focused regression added |
| threat-model | ACTIVE | Trust boundaries | Browser→web→OPS→DB boundary reviewed |

Supplemental `.claude/skills` capabilities used conceptually where overlapping include acquire-codebase-knowledge, API design, auth patterns, CI/CD, code review, debugging/error recovery, observability, OpenAPI generation, performance, refactoring, SAST/secrets/security threat modelling and E2E/testing patterns. Duplicated mirrors were not counted as separate product requirements.
