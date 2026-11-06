# Provider-neutral customer backend

This runnable reference adapter has no OPS dependency, no database SDK and no
external packages. Exported alongside the mobile template. It is not a provisioned
production service. Node 22+ is required.

Run `npm run demo` in this directory. Only binds 127.0.0.1:4310. Synthetic read-only
example: GET /customer/v1/profile with Authorization: Bearer demo-customer-one-token
(or demo-customer-two-token). These are fixed public demonstration tokens, not real
credentials. NODE_ENV=production refuses to start the demo. The mobile auth adapter
still uses Supabase Auth: the demo endpoint is a backend integration example, not
an alternative native login. Do not configure a real app to use these demo tokens.

For a customer's own service, import createCustomerBackend from handler.mjs and
supply authenticate(token) and provider.read(binding,operation). authenticate must
verify a real token and return a trusted {subject,tenantId,customerReference}, or
null. Bind tenant/customer using trusted server configuration and your identity
store, never request headers or the public app brand. provider.read must enforce
that binding for every resource and return {items:[canonical rows],page?}. Field
requirements are in backend-contract.md and native parsers. Reads require no OPS
API; data can come from the buyer's own ERP, database or another integration.

Optional provider.write receives the same binding and {kind,reference,input,
idempotencyKey}. It must enforce ownership, transaction-safe durable idempotency
scoped by tenant/customer/action/key, and return {accepted:true} only after commit.
Same key with a different body must be rejected. Default demo implements no writes.
The handler validates body size/fields, rejects identity query overrides, requires
Bearer authentication, filters verified identity and checks allowed document origins.
Configure documentOrigins explicitly. The provider must return only customer-facing
canonical data; never pass raw ERP payloads, private messages or secrets as items.

Mount the Request→Response handler on your server/framework under /customer/v1
(or another configured prefix). Set EXPO_PUBLIC_CUSTOMER_API_PATH=/customer/v1
in the mobile build and EXPO_PUBLIC_CUSTOMER_API_URL to your HTTPS server origin.
Add your own persistent storage, production auth verification, rate limits, audit,
HTTP framework adapter and deployment. No sample rows migrate into Gridex storage.

Throw CustomerBackendError(403|404|409|429) for a customer ownership denial,
missing record, idempotency conflict or throttling. The handler preserves these
statuses with a generic public message, so the mobile retry flow can distinguish
an uncertain transport failure from a conflict. Other errors become a generic503.
The handler projects canonical public fields and rejects explicit internal message
visibility, but the data provider must exclude all private messages and enforce
ownership before returning any record.

Optional account writes: POST profile {phone} delegates kind phone. POST
notifications/read {reference} delegates kind notificationRead with the target
reference. Only return accepted:true after canonical commit/confirmation, and for
notificationRead return a valid server readAt timestamp as well. Ownership must
be resolved within binding. The synthetic demo intentionally supplies no writes.
