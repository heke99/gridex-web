# Gridex Support

`support123.gridex.se` is Gridex’s internal staff application, with its own
login, cookies and navigation. Gridex web and `gridex-prod` are one ordinary
tenant of the independent OPS platform. `gridex.se` provides the tenant’s
customer website and Mina sidor; the support app provides customer search,
case handling and staff administration through the company-scoped API.

Tenant authentication and invitation-delivery state belong in **gridex-prod**,
Supabase reference **ayiuxjlfazkjmmtlvhsl**. Canonical customers, cases, central
staff actors, membership, RBAC and audit remain in **OPS**. Do not copy the OPS
schema into the tenant database or retarget the central API to tenant Prod.
A registered issuer/local subject binding connects the two identities; matching
UUIDs, email addresses or user metadata never establish authorization.

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
RSA keys and state. Auth and central actor UUIDs deliberately differ. Its
preload verifies signed assertions and rejects unexpected outbound requests.
It creates no production accounts or emails. Install Chromium with
`npx playwright install chromium` if no system Chromium is available.

## Server configuration

Configure the support application separately from the marketing website.
Never expose the API, service or signing secrets through `NEXT_PUBLIC_*`.

| Variable | Meaning |
| --- | --- |
| `GRIDEX_SUPPORT_SUPABASE_URL` | Exactly `https://ayiuxjlfazkjmmtlvhsl.supabase.co` |
| `GRIDEX_SUPPORT_SUPABASE_ANON_KEY` | Public Auth key of that tenant project; service/secret keys are rejected |
| `GRIDEX_STAFF_COMPANY_ID` | Verified Gridex company UUID in central **OPS** |
| `GRIDEX_STAFF_API_PROJECT_REF` | Verified central OPS project reference; separate from tenant Auth |
| `GRIDEX_STAFF_API_KEY` | Dedicated active same-company API client with explicit staff scopes |
| `GRIDEX_STAFF_ASSERTION_ISSUER` | Registered staff provider issuer |
| `GRIDEX_STAFF_ASSERTION_AUDIENCE` | Registered staff provider audience |
| `GRIDEX_STAFF_ASSERTION_KID` | Registered public signing key ID |
| `GRIDEX_STAFF_ASSERTION_PRIVATE_KEY` | Server-only RSA signing key, at least 2048 bits |
| `GRIDEX_STAFF_TIMEOUT_MS` | Optional bounded timeout; default 12000 ms |

The tenant-owned delivery bridge also requires server-only
`GRIDEX_SUPPORT_SUPABASE_SERVICE_KEY` (tenant Prod only),
`GRIDEX_SUPPORT_DELIVERY_API_CLIENT_ID`, `GRIDEX_SUPPORT_DELIVERY_PROVIDER_ID`,
`GRIDEX_SUPPORT_DELIVERY_OPS_ISSUER`, `GRIDEX_SUPPORT_DELIVERY_OPS_KID` and
`GRIDEX_SUPPORT_DELIVERY_OPS_PUBLIC_JWK`. Its receipts use the dedicated Staff
signing key. The OPS worker alone holds `GRIDEX_STAFF_DELIVERY_PRIVATE_KEY` for
signed bridge requests; it never receives the tenant Auth service key.

The Staff destination is fixed to `https://app.gridex.se/api/v1/staff`.
`X-Gridex-Expected-Project-Ref` requests the configured **central** project and
successful responses must attest it through `X-Gridex-Project-Ref`. The OPS
guard compares this value with its actual captured service SDK URL before
Auth, rate-limit, audit and handler access. Tenant Auth uses its own Prod URL.
There is no website-credential or same-project fallback.

Each protected request first verifies tenant Auth using `getUser`. Only then
is `getSession` used to obtain a bearer for transport; its cookie user is never
an authority. A fresh local-purpose assertion and that bearer are sent to
`POST /api/v1/staff-onboarding/identity/resolve` (contract `2026-10-05.2`). OPS
verifies the session against the registered tenant’s public Auth client and
looks up the exact current binding, client, provider and company membership.
The closed result supplies the central actor UUID and binding/version.

Normal Staff assertions retain the frozen contract’s central actor `sub` and
include the current binding ID/version and tenant issuer/subject. They cannot
exchange identity-resolution or invitation-acceptance proof for Staff access.
OPS rechecks current binding and authority for each request; native mutation
guards repeat their checks under existing transaction locks. The portal also
runs a case-read authorization probe before privileged actions. There is no
cached identity or role shortcut.

Cookies use `gridex-support-auth` and are host-only, HttpOnly, SameSite=Lax and
Secure in production. Browser-supplied actor, company and role fields cannot
grant authority. Writes need stable idempotency keys and are never retried
automatically. Contact updates include the server’s optimistic version.

## Customer support and incoming contacts

Authenticated customers create and reply to support cases on `gridex.se` through
the frozen **Customer API**, not a Staff assertion. The server verifies its own
tenant Auth user and derives the customer identity from the tenant profile.
Canonical cases and public messages are the same records handled through the
Staff API; customer responses exclude internal notes. The customer page follows
the API cursor to expose older cases. Stable per-form operation IDs prevent a
repeated submission from creating duplicate cases or replies. Failed API calls
are surfaced without writing a second local support record.

The website's server-only `GRIDEX_API_KEY` needs `customer_support.read` and
`customer_support.write` in its central tenant client. The existing Customer
transport supplies paired Auth-user headers and stable customer references.
It does **not** sign Customer-provider assertions: an enrolled Customer provider
in enforce mode needs its own assertion integration before activation. An API
403 must not be bypassed by a Staff credential or local persistence fallback.

Anonymous website contacts have no verified customer identity. They remain
tenant-owned records in **gridex-prod** and appear in the staff application's
separate **Kontaktförfrågningar** inbox. Every read first requires fresh central
Staff access, then uses the tenant-only server service key with both
`user_id IS NULL` and `metadata.source = public_kundservice_form` filters. Contact
details are labelled unverified. The inbox offers customer search, without
guessing a customer association or copying a contact into a canonical case.
This view is read-only; status changes require a separate authoritative write
permission interface. Existing authenticated legacy local tickets are not
shown or migrated by this correction.

## Tenant-owned staff invitations

The existing leased OPS worker remains the single invitation-delivery owner.
For registered external staff it delegates to the signed tenant-owned delivery
bridge before any OPS Auth invitation, OTP or password effect. The bridge uses
only its own tenant Auth administration credentials. OPS holds the tenant’s
public Auth key, never the tenant Auth service key.

Register the exact support origin, registered tenant Auth URL/public key and
signed delivery bridge in the dedicated OPS client. Tenant Auth must allow its
own `/auth/invitation` callback. Durable claim-before-email state is tenant-local;
completed retries reuse the receipt, while an indeterminate started delivery
cannot automatically send a second email. The signed receipt creates an
explicit local-subject-to-central-actor binding. No email matching grants a
membership or merges accounts.

The registered client metadata is `staff_onboarding_origin`,
`staff_tenant_auth: {url, public_key}` and
`staff_tenant_delivery: {url, issuer, audience, key_id, request_public_jwk}`.
The origin must be an exact member of `allowed_origins`; bridge URL and audience
must equal that origin plus `/api/internal/staff/invitations/deliver`.
The JWK is public RSA only, with `kid` equal to registered `key_id` and
`GRIDEX_SUPPORT_DELIVERY_OPS_KID`. The bridge is signature-gated and has no caller-
selected Auth project or service key.

The invitation GET displays a form without granting membership. The employee
explicitly verifies the tenant session and successfully sets a first password
before `POST /api/v1/staff-onboarding/invitations/accept` requests acceptance
(contract `2026-10-05.2`). The native wrapper verifies the exact delivered
binding and reuses the existing canonical membership/RBAC engine. Legacy OPS
acceptance refuses external tenant staff invitations. Initial tenant-admin
enrollment requires an explicitly authorized OPS-admin invitation through that
same engine; it does not assume a pre-existing external staff session.

The `must_change_password` metadata is an advisory UX hint, editable by its
account. It grants no access and is not a native password-rotation policy.

## Deployment and evidence

The app provides login, case queue/details/history/replies/notes/phone logging,
status and assignment, attachment download, customer search/detail/contact
updates, anonymous contact intake, invitations, role changes and disable/re-enable commands. OPS supplies
assignable role definitions. This interface does not yet create arbitrary new
role definitions or upload attachments.

**The corrected code is being qualified; the live domain has not changed.**
Before activation, verify the existing central Gridex company, enroll its first
tenant Auth identity explicitly, register the dedicated client/provider/Auth
issuer/bridge, apply each reviewed migration only to its owning database and
verify an actual invitation and staff session against the intended services.
The tenant database does not need the central Staff/RBAC/case migration history.

Deploy the support app with Vercel root `apps/support` and its own environment,
then assign `support123.gridex.se`. The marketing app continues to serve
`gridex.se` and `www.gridex.se`. Legacy marketing support-ticket storage has not
been merged into canonical API cases. No hosted migration, account, email,
environment or domain change has occurred during source correction.

Previous offline/native receipts describe their exact historical sources and
targets. Their earlier interpretation requiring all OPS data in tenant Prod is
superseded by this architecture; preserve the evidence, never relabel it as
qualification of corrected code. New verification must identify its own source.
