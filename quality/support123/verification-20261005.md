# Independent Gridex Support verification

Status: **portal source verified offline; named gridex-prod activation blocked**.

The user confirmed an independent application with its own staff login,
tenant-managed staff and RBAC through OPS APIs. Gridex is the selected company;
the API itself remains available to all companies. A later explicit requirement
pins all persistent data to named `gridex-prod` (`ayiuxjlfazkjmmtlvhsl`).

| Check | Result |
| --- | --- |
| Signed client and closed immutable Staff DTOs | 21 tests pass |
| Verified Auth and dedicated host-only session | 9 tests pass |
| Actual server commands through signed API/real Auth boundaries | 18 tests pass |
| Actual independent Next application in Chromium | 15 checks pass, zero browser errors |
| Scoped strict TypeScript | Pass |
| Scoped ESLint, zero warnings | Pass |
| Production support build, no credentials | Pass; 10 dynamic routes |
| Existing website TypeScript | Pass |
| Existing website ESLint | Pass; two pre-existing unused-variable warnings in pricingQuote.ts |
| OPS case-permission and storage guard regression | 29 tests pass across four files |
| Production catalog/migration ledger, read only | NOT_READY; no mutations |

The browser exercised real pages/actions: login, inbox, history, released
attachment download, reply, internal note, status, version-bound contact
change, staff/role view, case creation without duplication, sign-out,
read-only write denial and foreign-company denial. The local boundary supplied
synthetic records matching the immutable contract, verified actual RSA proofs
and blocked unexpected external requests. Screenshots contain only synthetic
accounts and data.

The support destination is fixed. Auth rejects a project other than
`ayiuxjlfazkjmmtlvhsl`; successful API responses must attest that same actual
service-client project. Missing/wrong attestation blocks the authorization
probe before a command can write. OPS refuses mismatching requested projects
before even auth, rate-limit or audit writes. Actual SDK capture tests cover
both singleton and request clients after environment mutation.

Read-only catalog inspection found no Gridex company in named prod: only
Div3rsa AB and Nibela AB. The initial Gridex company/admin cannot be guessed
from dev. The dependency map must qualify actual canonical/table/runtime
prerequisites before any production migration. The separate own-portal
invitation callback and explicit acceptance are being implemented and require
their own final evidence; this receipt does not cover that addition.

Current live `support123.gridex.se` remains assigned to the marketing project.
This work has not changed that assignment, enrolled a production staff
provider/client, sent an invitation, or created/migrated production data.
Earlier hosted Personal API acceptance applies to the historical OPS backend
`gridex-ops-dev` (`piidsfebjqjmnepdpnas`), not named gridex-prod.

Safe durable evidence and checksums: [manifest](evidence-20261005/manifest.json).
Configuration and activation prerequisites: [application README](../../apps/support/README.md).
