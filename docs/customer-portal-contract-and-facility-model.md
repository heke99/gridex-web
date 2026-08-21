# Customer portal: customer, contract and facility model

## Production invariant

A customer identity is not the same thing as an application, contract or facility.

Gridex Web and OPS must preserve the following cardinality:

- one authenticated Mina sidor user maps to one canonical customer identity;
- one canonical customer may have many website applications;
- one canonical customer may have many electricity contracts;
- one canonical customer may have many facilities / delivery points;
- one facility may have its own metering point and supplier-switch lifecycle;
- a retry of the same signing must not create a second application or contract;
- a genuinely new signing for another facility must create a new application/contract/facility and must not overwrite prior ones.

## Identity rules

Name and email are contact attributes. They are never agreement uniqueness keys.

For a private customer, the stable website customer reference is derived from customer type plus the legal identity (personal number). For a business customer it is derived from customer type plus organization number. When a trusted Mina sidor profile already has an external customer reference, Web reuses that reference.

A new facility, address, offer or signing attempt must therefore not by itself create a new customer identity.

The customer identity is verified independently from the transaction identity:

- Auth UUID identifies the Mina sidor account;
- `external_customer_id` and OPS customer number identify the canonical customer;
- `submission_attempt_id` identifies the exact Web signing attempt;
- OPS application number/reference identifies the business application;
- OPS contract reference/number identifies the contract;
- facility / site / metering-point identifiers identify the energy installation.

## Web persistence

The tenant projection intentionally supports many child records per user:

- `website_application_submissions`: one row per `submission_attempt_id`;
- `portal_onboarding_jobs`: one row per `submission_attempt_id`;
- `customer_contract_portal_links`: unique per `(user_id, contract_provider_key, contract_external_ref)`;
- `customer_delivery_points`: unique per `(user_id, facility_id)`;
- `customer_profiles`: one canonical profile per Auth `user_id`.

Consequences:

1. A repeat request with the same idempotency/submission identity is deduplicated.
2. A new contract reference creates another contract link for the same user.
3. A new facility ID creates another delivery point for the same user.
4. Existing contract links and delivery points must remain untouched.

## Thank-you page

Every verified successful contract signing uses the same thank-you page, regardless of whether the customer is:

- new or existing;
- logged in or logged out;
- signing their first contract or an additional contract;
- signing for an existing or a new facility.

Only the Mina sidor guidance/CTA changes according to portal state.

For an existing account that still needs a secure post-checkout claim, the CTA verifies that exact signed result before linking it. If the contract is already linked, the CTA goes to Mina sidor. The thank-you page itself is not replaced by an account-specific success page.

## OPS contract

OPS remains the source of truth for canonical customer, facility, metering point, contract and operational workflow data.

For an already known customer, a new website application must link to the same canonical customer and create/attach the new site, metering point and contract as separate child objects. `link_selected` is used when an existing portal identity has already resolved a customer; otherwise canonical `link_unique` matching may resolve the legal customer.

A facility or metering point already owned by another customer is a conflict and must fail closed/manual-review rather than being moved silently.

## Email ownership

- Gridex tenant owns Mina sidor/Auth email: signup, confirmation, invite, password setup/recovery and account/session communication.
- OPS owns business/contract events: application received, contract confirmation/PDF, cooling-off information, supplier switch, operational completion requests, welcome and future invoices.
- OPS must not send or own passwords, Auth activation or credential recovery.

## Regression requirements

CI must reject changes that accidentally regress these guarantees. At minimum tests must cover:

- stable customer reference independent of facility/signing attempt;
- contract projection uniqueness by external contract reference, not email/name;
- facility projection uniqueness by facility ID, not email/name;
- exact-submission portal claim with signed checkout proof;
- one universal verified thank-you page;
- shared customer password policy across registration and recovery.
