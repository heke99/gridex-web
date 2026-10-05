# Gridex Support

Independent staff application for `support123.gridex.se`. Gridex is one company
using the shared Personal API. Other companies use their own applications and
credentials. This application has its own login, cookies and navigation.

All persistent support, customer, staff, role and Auth data must be in the named
Supabase project **gridex-prod**, reference **ayiuxjlfazkjmmtlvhsl**. The portal
does not create a separate support database and never uses website credentials
as a fallback. Operational reads and writes go through the Personal API.

## Run and verify

Use Node 22 and install dependencies at the repository root with `npm ci`.

```sh
npm run dev:support
npm run test:support
npm run typecheck:support
npm run test:support:browser
npm run build:support
```

The browser check starts an owned local server with fresh synthetic accounts,
RSA keys and state. Its preload intercepts Auth and API requests, verifies the
actual signed staff assertions, and blocks unexpected outbound traffic. It
does not create production rows or send emails. Install Chromium with
`npx playwright install chromium` if no system Chromium is available.

## Server configuration

Configure the support application separately from the marketing website.
Never expose the staff key or signing key through `NEXT_PUBLIC_*` variables.

| Variable | Meaning |
| --- | --- |
| `GRIDEX_SUPPORT_SUPABASE_URL` | Exactly `https://ayiuxjlfazkjmmtlvhsl.supabase.co` |
| `GRIDEX_SUPPORT_SUPABASE_ANON_KEY` | Public Auth key of that same project; service/secret keys are rejected |
| `GRIDEX_STAFF_COMPANY_ID` | Verified Gridex company UUID in **gridex-prod** |
| `GRIDEX_STAFF_API_KEY` | Dedicated active API client of that company with required staff scopes |
| `GRIDEX_STAFF_ASSERTION_ISSUER` | Registered staff provider issuer |
| `GRIDEX_STAFF_ASSERTION_AUDIENCE` | Registered staff provider audience |
| `GRIDEX_STAFF_ASSERTION_KID` | Registered public signing key ID |
| `GRIDEX_STAFF_ASSERTION_PRIVATE_KEY` | Server-only RSA signing key, at least 2048 bits |
| `GRIDEX_STAFF_TIMEOUT_MS` | Optional bounded request timeout; default 12000 ms |

The API destination is fixed to `https://app.gridex.se/api/v1/staff`. Each call
requests project `ayiuxjlfazkjmmtlvhsl` with `X-Gridex-Expected-Project-Ref` and
requires the successful response to attest that exact project through
`X-Gridex-Project-Ref`. The corresponding OPS guard compares the project with
the URL captured by the real Supabase service client **before** API auth,
rate-limit, audit and handler database access. The portal also performs a
verified case-read authorization probe before each command. An old or
incorrectly configured API deployment cannot pass that probe.

Auth uses `getUser` to verify the account, never an unverified cookie subject.
Cookies use the dedicated `gridex-support-auth` name and are host-only,
HttpOnly, SameSite=Lax and Secure in production. Role, company and actor fields
submitted by the browser do not grant authority. API role limits, active
membership, tenant isolation and audit remain authoritative.

Every write requires a stable idempotency key. Writes are never automatically
retried. Contact changes include the server-provided optimistic version; a 409
requires the employee to reload before changing the current value.

## Independent staff invitations

Register the dedicated client's `metadata.staff_onboarding_origin` as
`https://support123.gridex.se` and include that exact origin in its
`allowed_origins` column. Supabase Auth must separately allow the portal's
`/auth/invitation` callback; otherwise email delivery may fall back to its
global Site URL. Qualify the actual callback destination before enabling real
invitations. These settings have not been changed in production.

The existing leased OPS worker delivers the Auth email to this own callback.
GET displays a password form and creates no membership. The employee explicitly
submits a new password, verified against this portal's own Prod Auth session,
before the server requests canonical acceptance through the separately
versioned `POST /api/v1/staff-onboarding/invitations/accept` contract
(`2026-10-05.1`). This additive contract does not modify the frozen Staff release.
Acceptance verifies the real Auth identity, fresh staff assertion, original
invitation/client binding and current native authority before granting access.
The legacy OPS acceptance page rejects invitations created through the Staff API.

The `must_change_password` user metadata is an advisory UX hint. It is editable
by the account and does not enforce a native password-rotation policy or grant
tenant access. The invitation form's successful password update precedes the
membership grant; a failed update makes no onboarding API request.

## Deployment status and remaining prerequisites

The checked source provides login, cases, customer search/detail/contact
changes, case history/replies/internal notes/phone/status/assignment, attachment
downloads, staff invitations, role changes, disable and re-enable commands.
The API supplies role definitions; this interface does not implement arbitrary
new role creation or attachment upload.

**Live activation is blocked.** The 2026-10-05 read-only catalog inspection of
the named `gridex-prod` project found missing Staff API functions, support and
integration tables, the private attachment bucket, and prerequisite canonical
functions. It recorded none of the 22 frozen Staff forwards. Existing companies
are Div3rsa AB and Nibela AB; no verified Gridex company UUID or initial Gridex
administrator is available yet. Do not reuse the UUID or users from
`gridex-ops-dev`.

The earlier hosted Personal API acceptance used the OPS deployment backed by
`gridex-ops-dev` (`piidsfebjqjmnepdpnas`). It remains valid for that historical
target and is **not** acceptance of the named `gridex-prod` project.

Before assigning the domain, qualify the actual production-shaped dependency
closure with native SQL, register the correct Gridex company/admin, install the
reviewed additive code, and provision the dedicated client/staff provider. The
independent invitation callback and explicit canonical acceptance must also
pass native SQL and hosted delivery checks before real staff invitations are enabled. Never replay
the entire historical OPS migration directory into this different baseline,
write a fake readiness row, change the global OPS callback URL, or copy live
tenant data without an explicit data mapping.

The intended Vercel application has root directory `apps/support` and its own
environment. The marketing project continues to serve `gridex.se` and
`www.gridex.se`. This source alone does not change the current DNS/domain
assignment. Legacy marketing support-ticket storage has not been merged into
the canonical Personal API case store.

The original offline receipt and its immutable evidence remain in
`quality/support123/verification-20261005.md`. The final invitation addition is
recorded separately; local browser fixtures are not native or hosted acceptance.
