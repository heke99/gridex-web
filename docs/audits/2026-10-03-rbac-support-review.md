# RBAC and support boundary review — 2026-10-03

This review concerns the checked-out Web source and isolated runtime regressions.
It does not establish production configuration, applied migration state, live
tenant scopes, support domain availability, or successful authenticated live flows.

## Reproduced defects and corrections

| Defect | Correction | Regression evidence |
| --- | --- | --- |
| The customer BFF discarded canonical `error.blockers`, although the OPS transport retained them. A browser could not inspect the reason a business operation was blocked. | `customerApiErrorResponse` retains the canonical blocker array; the shared Web error envelope always includes an array, including local failures. | `customer-portal-tenant-runtime.test.mjs` failed with `undefined` blockers before the correction, then passed for transport-normalized and nested canonical error details. |
| Binary support downloads inferred retries from HTTP status, overriding an explicit `retryable: false` on HTTP 503. They also lost canonical envelope request/correlation IDs and `Retry-After`. | Downloads reuse the existing safe OPS HTTP error parser and customer-safe message filter. Header IDs take precedence, with canonical envelope IDs as fallback. Redirects remain refused without retry; each download still makes one attempt with one customer assertion. | `support-contract-runtime.test.mjs` reproduced `true !== false` before the correction. It now verifies the complete error-to-BFF path, envelope/header IDs, blockers, retry delay and exactly one attempt. |
| The RBAC assignment table compared assignment text to a display name, while server actions store canonical role keys. Registered role IDs and assignment status were omitted from the UI read. An assigned role with a friendly name could appear disabled and could not be revoked through its button. | Reads include registered role ID, key and assignment status. The table uses an exact registered ID, falling back to case-insensitive canonical text only for legacy ID-less rows. Form submissions use the canonical key. Inactive catalog roles permit revocation but offer no new grant. | `rbac-client-runtime.test.mjs` runs the actual TSX table and reproduced an incorrect grant (`active=true`) for an existing registered assignment. It now covers friendly names, old text, conflicting IDs, disabled status and inactive catalogs. |
| `/api/me/permissions` returned session-specific permissions without explicit private cache control or cookie variation. | Every response uses `private, no-store`, `Vary: Cookie`, and a dynamic route. Authentication verification errors return no permissions and do not call the privileged permission reader. | The same runtime test calls the actual route for anonymous, authenticated and auth-error sessions. |
| The assignment directory filtered role/active matches after pagination of the profile query, missing matches outside the current unfiltered page and reporting the wrong total. | The page uses a service-only, actor-verified paginated directory RPC. Role, effective active-global-role and literal search filters run before pagination. Profiles and their global role/override details arrive in one snapshot; catalog reads remain separate. | The actual TSX regression reproduced an empty first page with five matching users outside the initial ten profiles. It now checks first/later pages, filtered totals, navigation, literal punctuation, unknown-role isolation and absence of unfiltered/detail-table reads. Native RPC assertions belong to the coordinated database package. |

## Authorization paths reviewed

- Customer support identity comes from a server-verified session and the OPS
  portal identity service. Browser-supplied customer, organization and staff
  fields are rejected before an OPS write.
- Customer support responses select explicit public fields. Internal messages,
  staff identities and storage paths remain excluded. Attachments retain MIME,
  byte limit and hash checks; downloads reject redirects.
- Staff pages and prospect actions require global permissions. Reads require
  `support_tickets.read`; assignment/status writes additionally require
  `support_tickets.manage`; internal notes additionally require
  `support_tickets.reply`. `admin.access` does not substitute for these grants.
- The permission/role readers verify that their requested user matches the
  authenticated session before invoking service-only authorization RPCs.
  No active caller of the legacy label-only `lib/auth/admin.ts` or
  `lib/auth/rbac.ts` guards was found in the application/component paths.
- Effective roles, membership, profile status, scoped/global denies and timed
  overrides are decided by database functions. The exact registered-role join
  and native database regressions are a separate database review, not evidence
  established by the mocked runtime tests here.

## Validation scope

The focused customer portal, support API, support BFF, support UI, role assignment,
RBAC authorization and new RBAC client runtime tests pass in the local runtime.
Focused ESLint and TypeScript checks are required on the integrated candidate.
Full CI, native replay and authenticated live verification belong to that
candidate and cannot be inferred from these tests.

## Deployment dependency

The assignment directory caller requires the new
`gridex_web_list_global_rbac_users(uuid,text,uuid,boolean,integer,integer)` RPC.
Its migration must accompany the Web candidate. Runtime fixtures establish the
caller/UI behavior; native PostgreSQL tests establish effective role resolution,
actor authorization, browser ACLs and filter-before-pagination semantics.
