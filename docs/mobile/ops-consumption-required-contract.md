# OPS consumption dependency — proposed contract, not a published capability

The Gridex mobile consumer now has a real scoped read adapter. Production OPS
still lacks the authoritative delivery metadata and documented query parameters
needed to use it. This document is a concrete producer handoff, not permission to
infer rights, bypass OpenAPI validation or modify another agent's files.

## Authoritative source

Read the existing `customer_supply_periods` under the verified company/customer
and the selected site's owned metering points. The canonical table has
`metering_point_id`, `market_start_at`, `market_end_at`, `market_state_version`,
`actual_start_date`, `actual_end_date`, `status`, and source linkage. Use qualified
market instants for the rights boundary; a missing authoritative instant is a
held capability, not permission to substitute move-in, requested contract start,
installation date, today's owner or an unrelated contract. Preserve the canonical
source/lifecycle constraints. No app-created second customer database is needed.

## Proposed sites extension

Inside the existing authenticated `/api/v1/customer/sites` data object, add:

```json
{
  "delivery_access": {
    "version": "customer-supply-periods-v1",
    "complete": true,
    "windows": [
      {
        "facility_reference": "facility_public_reference",
        "metering_point_reference": "metering_point_public_reference",
        "from": "2026-11-01T23:00:00.000Z",
        "to": null
      }
    ]
  }
}
```

`complete:true` MUST mean all owned metering points and all authoritative delivery
windows for EVERY site in this exact sites page have been read completely.
Never split one facility's meter/window group across pages or claim complete
after a database row cap/error. Windows on another sites page cannot authorize a
reading for this page. Null `to` means an open delivery period; re-read its current
canonical state on every request. Closed boundaries use an exclusive end.
Only public references are returned, never internal UUIDs or raw source records.

## Metering and revision contract

Keep the current meter value reference, meter reference, period and quantity
fields. Also publish `revision_status`, `direction` and `unit` from the canonical
read model. The consumer requires explicit `current` revision, consumption,
kWh and stored state, and finite nonnegative quantities. Known replaced,
superseded and void revisions are ignored; missing/unknown revision authority
fails closed. Do not label raw Wh/MWh as kWh or turn production into consumption.
Resolve current revision conflicts in OPS; the app rejects duplicate references
and overlapping current intervals within the same meter series.

Metering reads MUST remain company/customer scoped and enforce delivery rights
server-side for all customers, including the existing Web/bundle paths. The app
also checks the exact meter-specific delivery windows before returning readings.
Do not rely on the mobile filter to close the existing OPS pre-delivery exposure.

## Publish query parameters before using them

The current checked-in/published OpenAPI operations declare header parameters but
NO query parameters. The real Web `opsCustomerFetch` therefore rejects paging and
filter queries with `openapi_query_parameter_unknown` before transport. This is
reproduced by `tests/mobile-gridex-consumption-openapi.test.mjs`.

The OPS API owner must publish the implemented, validated query contract for:

- sites: bounded `limit` and opaque scoped `cursor`;
- metering-values: bounded `limit`, opaque scoped `cursor`, `from`, `to`, and
  `facility_id` derived from an owned site.

Keep customer/tenant identity in verified context, not query overrides. Bind each
cursor to company/customer/resource/filter set. Publish exact schemas, canonical
URLs, immutable release URLs/hashes and version metadata through the existing
qualified API publication workflow. Then sync/re-generate/verify Web's pinned
contract. Do not add a local query allowlist exemption or alter frozen immutable
schema bytes. Publishing only the new JSON fields is insufficient.

## Current consumer behavior and tests

The first sites capability read uses the documented base path with no query.
Missing/incomplete/legacy capability stops before meter values are requested.
After verified capability, the consumer uses the normal SDK and its unchanged
query validator. Old published schemas still block unsupported queries.

The adapter retains the same verified Auth/RLS identity on every page, allows
max10 sites pages and40 metering pages, and enforces an overall15-second deadline.
A capped meter read is explicitly partial. Each meter keeps its own series and
rights; simultaneous distinct meters may sum, while same-meter overlaps fail.
An interval crossing a delivery boundary or gap is excluded whole, not prorated.
The native view sums fetched readings, never fills missing readings with zero,
and labels incomplete periods.

Actual route tests use synthetic Auth/provider fixtures: two users, foreign
facilities, pre-start/post-end/gap intervals, independent meters, superseded
revisions, units/direction, paging, cursor loops, caps and deadline. Separate tests
exercise the real published validator. These are not live customer readbacks.

## Custody/capability status

The OPS source was read in a clean checkout at
`f23c1dc0c58f8bb1a55b83d8409e5712177b51b6`; the deployed8969f01 source was compared
in the preceding release. The active board is#840 (the older#766 reached2500
comments). Exact sites/metering/publicDto file-ref reads returned404; per protocol
that is only collision information, not a source claim or owner handoff.

The official source-claim CLI validates a local scoped plan. This environment has
no GitHub CLI, no CLI GitHub credential binding, and no connector operation for
atomic tag-ref creation. A normal authenticated CLI probe returned401 while the
connected GitHub app is authenticated. No neutral receipt/tag claim, source
write, shared GEN operation, OPS merge or OPS production deployment was performed.
The OPS producer must acquire the exact source/publication scopes through the
existing protocol; source-only custody does not grant GEN/replay/merge roles.
The local private plan stays outside repositories, as required. No foreign refs,
shared canonical schema or source files were changed.

Until that bounded OPS publication and Web contract sync are completed, real
Gridex consumption remains503. Real customer Auth/provider readback also remains
unverified. The portable template works with its independently supplied trusted
provider and does not need OPS.
