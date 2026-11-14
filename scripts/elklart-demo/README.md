# Isolated Elklart portal runtime

The current repository contains additive migrations, not a complete portal database baseline. In particular `user_profiles`, `user_roles` and the original `assign_default_role()` definition are absent. Migration `20261020104944_customer_registration_default_role.sql` asserts a historical function hash, so replaying migrations over a current schema snapshot is incorrect. The OPS profile bootstrap is a different schema and must not replace the portal baseline.

## Authoritative schema capture

`capture-portal-schema.sql` is a read-only PostgreSQL catalog query for the existing portal project `ayiuxjlfazkjmmtlvhsl`. It returns current schema definitions, not application records or Auth records. It includes public tables, enums, sequences, functions, constraints, indexes, ordered view dependencies, policies, triggers (including Auth triggers calling public functions), ownership and grants. Supabase-managed Auth/Storage schemas come from the separate local Supabase stack. Extension declarations come from the source; restore fails if the local stack lacks an extension or required role/dependency.

The user explicitly approved this schema-only export on 2026-11-10 after automatic review required specific authorization. The approved current snapshot was captured privately and compiled successfully: 138 tables, 108 functions, 48 views, 409 policies, source PostgreSQL 17.6. No application rows or Auth user values were selected. The metadata SHA256 is `cdbaeb35ab7922704038b12f823b2449e29493b04eeda6fea5ee8232115e0ed1`. A basic embedded-secret pattern scan found no matches. Live restore into the separate local portal stack passed. The existing database readiness SQL also passed. A fresh local catalog capture matches every captured application schema section, including all 303 owner statements and all grants; the only additional extension is platform-installed `pg_net`. The first transactional attempt as restricted `postgres` failed on `supabase_admin` default privileges and rolled back with zero public tables; the successful bootstrap used local `supabase_admin` and restored all authoritative object owners. No end-to-end application scenario is claimed by this schema check.

For another capture within the approved scope, run the query through the approved read-only Supabase connection. Save only the returned `schema_metadata` object as private `/workspace/elklart-runtime/portal/schema-metadata-v2.json`, outside this repository. Do not commit the production metadata, generated SQL, credentials or Auth data. Review that routine definitions contain no embedded secrets before retaining or importing them.

Compile the reviewed metadata:

```sh
node scripts/elklart-demo/portal-schema.mjs compile \
  /workspace/elklart-runtime/portal/schema-metadata-v2.json \
  /workspace/elklart-runtime/portal/schema-v2.sql
```

Both output paths must be absent: exclusive creation refuses existing files and symlinks, and creates SQL and provenance with mode 0600. If provenance creation is refused, the newly created empty SQL output is removed. The adjacent provenance file records source project, capture timestamp, SHA256 of the exact input bytes and SHA256 of generated SQL. Compilation rejects missing sections and view dependency cycles. Scalar function signatures are restored before tables, because generated columns call normalization functions. Functions with relation-type signatures follow tables. Signature dependencies come from the authoritative PostgreSQL catalog.

## Restore a fresh dedicated local stack

The runtime owner provisions a separate Supabase project named `elklart-portal-demo`, with API port 55321 and PostgreSQL port 55322. OPS uses another stack. The database must be empty of public tables/views/sequences before import; this loader never drops an existing database or tables.

The runtime owner sets the project marker, using the dedicated portal database connection:

```sql
ALTER DATABASE postgres SET elklart.runtime_project = 'elklart-portal-demo';
```

Reconnect after setting it. Supply `ELKLART_PORTAL_DATABASE_URL` securely in the process environment, targeting loopback port 55322 and database `postgres`. Supply the reviewed metadata SHA256 as `ELKLART_PORTAL_SCHEMA_SHA256`, and set `ELKLART_DEMO_RESET_ACK=elklart-portal-local-only`. The loader accepts no remote hostname, alternate port/database, or connection query parameters. Credentials enter psql only through its environment.

```sh
node scripts/elklart-demo/portal-schema.mjs apply \
  /workspace/elklart-runtime/portal/schema-metadata-v2.json
```

A PostgreSQL `psql` client must be available, or set `ELKLART_PORTAL_DB_CONTAINER=supabase_db_elklart-portal-demo` to run psql inside the existing database container. Every Docker invocation pins `unix:///var/run/docker.sock` explicitly and rejects endpoint, context, TLS and config environment overrides before invoking Docker. The Docker adapter verifies the exact Supabase project label and requires actual PostgreSQL host bindings to be loopback port 55322. An empty declared HostIp is accepted only when the attached Docker network inspection confirms the loopback default; explicit wildcard or inconsistent declarations are refused. It uses the local platform bootstrap role `supabase_admin` to preserve source default privileges belonging to that role; the restricted `postgres` role cannot restore those grants. It still checks the database project marker and never creates containers. The database URL is unnecessary in Docker mode. Restore is transactional and stops on SQL errors. The existing `scripts/verify-gridex-web-database.sql` runs afterward. Passing it verifies schema readiness only. It does not verify Auth registration, checkout, webhook delivery, invoices, or any scenario. The runtime owner must separately verify those ordinary application flows.

For a full reset, stop both app processes, recreate only the dedicated runtime's Supabase data/Auth/Storage/queue volumes using its owner launcher, set the marker, import this snapshot, provision fictitious demo users through real Supabase Auth, and run ordinary checkout/sync/scenario flows. The schema loader does not implement or claim full runtime reset. Never use existing staging or production as a reset target.

## App configuration

Use `ELKLART_DEMO_ENABLED=true`, `ELKLART_DEMO_LOCAL_RUNTIME=true`, `NODE_ENV=development`, and no `VERCEL_ENV`. The only local pairs accepted are:

- `NEXT_PUBLIC_SITE_URL=http://localhost:3001` with `GRIDEX_OPS_API_URL=http://localhost:3000/api/v1`.
- `NEXT_PUBLIC_SITE_URL=https://localhost:3001` with `GRIDEX_OPS_API_URL=https://localhost:3000/api/v1`.

HTTPS requires the private runtime CA trusted by Node/browser; do not disable certificate validation. Mixed protocols, other ports/hosts and any deployed Vercel environment fail closed. Deployed demo origins retain their original exact pairing.

## Verification at this checkpoint

```sh
node tests/elklart-portal-schema.test.mjs
node --experimental-strip-types --experimental-loader ./tests/typescript-alias-loader.mjs tests/elklart-demo-config.test.mjs
```

The seventeen targeted portal tests pass under Node 22. Full `npm run typecheck` and scoped ESLint for the changed TS/MJS files also pass after installing the existing lockfile with scripts disabled. These tests exercise compilation guards, dependency ordering and URL restrictions using synthetic metadata. They are unit tests, not live schema import or end-to-end scenario evidence.


## Compare a restored local schema

Run the same catalog query against the dedicated local portal database with `search_path=public` (the query now sets this explicitly). Save its JSON metadata privately, without application rows. Compare it against the approved source snapshot:

```sh
node scripts/elklart-demo/verify-portal-schema.mjs \
  /workspace/elklart-runtime/portal/schema-metadata-v2.json \
  /workspace/elklart-runtime/portal/schema-restored-metadata-v2.json
```

The verifier checks every captured section, including ownership and execution grants, while ignoring capture timestamps, PostgreSQL patch version and ACL entry order. The only allowed extra extension is local platform `pg_net`. It fails on additional application objects, changed definitions, policies, owners or grants. The local metadata's source-project label identifies the reference source of the comparison; the guarded database connection and runtime marker establish the local target identity.


## Launch the portal app and verify real Auth

Use Node 22 with the locked dependencies installed. The runtime owner supplies `portal/status.json` from the dedicated stack and the private TLS files `tls/server-key.pem`, `tls/server.pem`, `tls/ca.pem`.

```sh
node scripts/elklart-demo/portal-app.mjs prepare
node scripts/elklart-demo/portal-app.mjs start
```

Once the runtime owner provisions the canonical OPS website client into private `ops/integration.json`, run:

```sh
node scripts/elklart-demo/portal-app.mjs configure-integration
node scripts/elklart-demo/portal-app.mjs stop
node scripts/elklart-demo/portal-app.mjs start
```

The integration command validates the exact local OPS API origin and company identifier, merges only the real API key and shared webhook signing secret, and atomically replaces private `portal/app.env`. The integration source file must be included alongside the app environment in consistent runtime snapshots. This command does not claim catalogue readiness. The first actual public-offers call after loading credentials returned `ops_network_error` while the OPS app was still being prepared; after fixing explicit development CA forwarding, the call reaches OPS and reports `platform_schema_not_ready`. Retry after its platform/catalogue are ready.

`prepare` exclusively creates private `portal/app.env` with dedicated Auth settings and generated local PII/state signing secrets. It deliberately leaves the OPS API key unconfigured. `start` validates fixed demo HTTPS origins, the separate portal Auth origin, development gates and CA trust; records `portal/app.pid`; and writes private `portal/app.log`. It binds the Next development server to loopback port 3001. Existing env/PID files are refused rather than overwritten by preparation/start. Actual listening address was verified as `127.0.0.1:3001`, recorded privately in `portal/app-listen.json`. Credentials are not emitted or passed through shell arguments. To stop only this app process group, use `node scripts/elklart-demo/portal-app.mjs stop`.

For a fresh stack with no Auth-smoke fixture files:

```sh
NODE_EXTRA_CA_CERTS=/workspace/elklart-runtime/tls/ca.pem \
  node scripts/elklart-demo/verify-portal-auth.mjs
```

The browser uses installed `/usr/bin/chromium` and trusts only the exact generated server certificate's SPKI. It blocks nonloopback network requests, submits the normal `/register` form, then opens a separate browser context and submits `/login`. It requires `/mina-sidor`, the authenticated public-session endpoint and the portal's distinct `sb-127` cookie. A generated fictitious test account and password are saved privately in `portal/auth-smoke.json`; evidence and a screenshot stay in the private runtime directory. It does not mock Auth or OPS.

This actual browser flow passed against the restored local stack. Local database checks confirmed one Auth user, one corresponding profile, one customer role and zero privileged roles. The local Auth configuration has email confirmation disabled, so this verifies real registration/password login with automatic local confirmation; it does not verify email delivery. Canonical OPS credentials and the commercial signup/application chain remain separate verification requirements.


## Prepare and enable independent customer assertions

```sh
node scripts/elklart-demo/prepare-customer-assertion.mjs
```

This generates a private local RSA 3072 key and a public registration descriptor, both exclusively created mode 0600 under the private portal runtime. It performs no OPS writes and never sends the private key to OPS. The descriptor documents the existing authenticated OPS `/admin/customer-login` action `saveTenantKeyProviderAction`, with `expected_company_id`, `purpose=customer`, and `public_jwk`. The ordinary companion `setEnforcementAction` changes the customer provider to `enforce`; both actions require tenant-scoped settings permissions and write the existing audit log. The issuer and audience follow the authoritative OPS helpers: `gridex-tenant:<company UUID>` and `gridex-customer-api:<company UUID>`.

The runtime owner must register the public key through that existing authenticated configuration flow, verify the active provider and enforcement, and add its actual `providerId` with `registrationState=registered_and_enforced` to the private registration descriptor. Preparation alone never enables signing. After registration:

```sh
node scripts/elklart-demo/portal-app.mjs configure-customer-assertion
node scripts/elklart-demo/portal-app.mjs stop
node scripts/elklart-demo/portal-app.mjs start
```

Activation checks that the company matches the real provisioned integration, issuer/audience match OPS conventions, and the RSA private key matches the registered public JWK and SHA256 fingerprint. It then stores only the five explicit customer assertion environment fields, including `GRIDEX_CUSTOMER_ASSERTION_REQUIRED=true`, in the private app environment. Actual requests are signed by the existing portal transport with current authenticated user ID, 60-second expiry and a fresh one-time JTI; no unsigned identity bypass is introduced.

Include `customer-assertion-private.pem`, `customer-assertion-registration.json`, `app.env`, and `ops/integration.json` with the corresponding OPS provider/replay state in consistent private snapshots. RSA preparation/activation tests do not verify actual tenant replay rejection or customer resource access; those require subsequent genuine linked-customer requests.

The launcher passes both `NODE_EXTRA_CA_CERTS` and `--experimental-https-ca`. Current Next.js development workers overwrite the former from the latter, so omitting the explicit CLI CA causes server-to-server TLS verification failure even when the parent environment contains a trusted CA. Certificate validation remains enabled.


## Actual setup outcomes and remaining intake gate

Customer assertion public-key registration and enforcement passed through the existing authenticated OPS customer-login form as the tenant administrator. A separate readback verified the provider ID, issuer, audience, key ID and public-key fingerprint before enabling the portal signer. `verify-customer-assertion.mjs` exercised the existing `signCustomerAssertion` implementation using a real local Auth-verified subject, verified the RSA signature, 60-second expiry and fresh JTI. This signer check does not claim customer-resource or replay-gate verification.

The ordinary platform company activation form was submitted and correctly returned blockers, preserving onboarding state/version 0. The current runtime operation-policy body exactly matches authoritative OPS `supabase/schema.sql`: customer/contract intake is decoupled from the Ediel production-send live lock. However, the separate tenant activation readiness still requires canonical company qualification, alongside configured channels and published offers. No external certification or test counts were fabricated.

A normal API permissions edit exposed a separate scope catalogue bug: canonical `customer_legal.read`, `customer_events.read` and `customer_sync.write` were being dropped. The narrowly authorized OPS fix includes declared canonical customer portal scopes in the existing allowed-values set. Two regression tests were observed failing before the fix and passing afterward, including unknown-scope rejection and unchanged default groups. The ordinary authenticated edit then restored exactly the original profile defaults plus `website_contracts.diagnostics`; no unintended partner scopes remain. Evidence is private under `portal/add-diagnostics-evidence-*.json`.

The existing initial client is labelled `development` in the isolated local tenant. The normal production-labelled client creation UI is a separate configuration action, not a relabel or real production deployment. Its service only returns a newly generated one-time credential after smoke completes; creation must wait until tenant activation permits that smoke to avoid temporarily unrevealed credentials. The original development credential is preserved privately as `ops/integration-development-original.json`. A newly returned credential must be saved privately before any subsequent UI navigation and merged with `configure-integration`.

At this checkpoint, root paused browser mutations for a consistent foundation snapshot. Production-labelled client creation, final website verification and Anna's ordinary commercial application have not yet run. The snapshot is not a completed presentation rehearsal. Other agents own Karin's support scenario and its separate private account file; these scripts must not overwrite that fixture.
