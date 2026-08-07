# SKILL_ROUTING

`AGENTS.md`, `skills-lock.json` och `.agent-memory` saknades på auditbaseline. `.agents/SKILLS_SOURCES.tsv` användes därför som faktisk machine-readable inventory; `.claude/skills` behandlades som kompletterande tooling.

| Skill/förmåga | Status | Användning/resultat |
|---|---|---|
| source-driven-development | ACTIVE | Repo/live-kontrakt separerades från inference. |
| pg-aiguide / postgres | ACTIVE | Migrationer, RPC, RLS och index granskades. |
| supabase-postgres-best-practices | ACTIVE | Rate-limit och snapshot-schema verifierades. |
| sql-optimization-patterns / index-tuning | ACTIVE | Inga blinda index lades till. |
| debug / debug-bundle | ACTIVE | OPS version drift, lint och testsplitfel rotorsakades via CI. |
| code-review / code-quality-playbook | ACTIVE | P0/P1-fynd klassificerades och verifierades. |
| test-fix / test-driven-development | ACTIVE | Regressionstester uppdaterades efter modulsplit utan att försvaga invariants. |
| code-optimizer / performance-optimization | ACTIVE | Monolit, transport, cache och nätverk granskades. |
| api-and-interface-design | ACTIVE | OPS OpenAPI och canonical quote tuple styrde implementationen. |
| next-best-practices / nextjs-app-router-patterns | ACTIVE | Lint, route boundaries och server-side transport granskades. |
| vercel-react-best-practices | ACTIVE | Client/server boundaries bevarades; inga spekulativa client-optimeringar. |
| architecture-and-structure / composition-patterns | ACTIVE | OPS-klienten delades i ansvarsmoduler. |
| ci-cd-and-automation | ACTIVE | Read-only full quality gate skapades för PR/main. |
| security-and-hardening / threat-model | ACTIVE | Credentials, redirects, tenant/cache, retries och immutable quote-context granskades. |
| supabase-skill | ACTIVE | Migration-backed persistence och rate limiter verifierades. |
| document-and-report-generation | ACTIVE | 13 slutrapporter genererades. |
| frontend-design | CONDITIONAL | Ingen evidensbaserad redesign krävdes. |
| spellbook | CONDITIONAL | Ingen separat produktförändring krävdes. |
| migrate-to-neon / neon-* | N/A | Projektet använder Supabase; ingen Neon-migration begärdes. |
| core-llm-development | N/A | Ingen LLM-runtime i scope. |
| llm-security-and-prompt-injection-defense | N/A | Ingen LLM-inputyta i scope. |
| reusable-prompt-and-schema-design | N/A | Inte del av produkt-runtime. |
| docs-research-and-pdf-evidence | N/A | Ingen PDF-källa krävdes för denna repo-remediation. |

Kompletterande `.claude/skills` som användes där de överlappar ovan: acquire-codebase-knowledge, API design, auth patterns, CI/CD, code review, debugging/error recovery, observability, OpenAPI generation, performance, refactoring, SAST/secrets/security threat modelling och E2E/testing patterns.
