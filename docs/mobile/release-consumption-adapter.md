# Packages1–2 continuation: scoped consumption adapter

Source baseline:c344f8dc4ef257613fbe5f49e80be0a9a8077d2c. Existing public mobile
API activation remains in place. This packet does not declare live consumption
or authenticated real-customer verification complete.

## Changes

- Replaces the unconditional Gridex consumption placeholder with a real scoped
  OPS read adapter, using the existing verified Auth/RLS binding and ordinary SDK.
- Checks proposed authoritative per-facility/per-meter delivery capability before
  any meter read. Old/missing/incomplete proof remains503.
- Traverses scoped pages with loop protection and bounded page/time budgets;
  a metering cap explicitly reports partial data instead of a full period total.
- Handles current/superseded revisions, per-meter delivery gaps and boundaries,
  consumption direction/kWh validation and stripping of raw/internal fields.
- Preserves independent meter series through the neutral backend and native
  parser. Different meters can overlap/sum; same-meter overlaps remain invalid.
- Includes new route/provider tests in the normal mobile verification and CI,
  plus separate tests against the REAL pinned OPS request validator.

## Two independent reviews

Security/data reviewer reproduced a legitimate two-meter overlap failure in the
first implementation. It is fixed with per-series rights and overlap checks in
both server and native parsing. Integration reviewer found the real published
query schema blocks paging/filter parameters; initial capability lookup is now
query-free and the unresolved upstream schema dependency is explicitly retained.
No validator exemption or pinned-schema modification was made.

Both independent read-only reviewers re-reviewed the fixes and bound their final
approval to the final post-read deadline check. No remaining concrete findings
were reported in the consumer changes. Neither approval qualifies a live OPS
capability or real customer readback. No reviewer coauthored the implementation.

## Verification scope

26 focused tests:7 neutral/server projection,12 actual Gridex route/adapter with
synthetic Auth/provider,5 native UI/parser/DST,2 real published-validator checks.
The larger mobile runner also tests existing account/security/UI paths, native
and Web types and lint. Strict live preflight still validates published exact
versions/hashes; its green status does not establish consumption query support.
Root launch/build and Gridex/extracted Android+iOS export evidence is verified
separately for the release candidate. Synthetic-provider200 tests do not imply
that the current OPS production API publishes the proposed metadata.

## Exact remaining upstream work

[Required contract](ops-consumption-required-contract.md) specifies the canonical
supply source, complete page grouping, new delivery/revision metadata, existing
Web/bundle privacy enforcement and qualified publication of query parameters.
After the normal OPS source/publication custody workflow, Web must sync and
verify the published contract before live filtered paging is usable.

An official OPS source plan validated locally, but no authenticated CLI/tag-ref
creation capability is available here to execute its mandatory source reservation.
No OPS source, claims, schema, shared producer, merge or deployment were changed.
Real customer login/provider readback still has no provisioned customer session.
The existing fail-closed boundary is retained while those prerequisites remain.
