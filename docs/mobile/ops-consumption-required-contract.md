# OPS consumption supplement — composed source under qualification

The mobile server adapter uses the independent `customer-consumption-v1`
contract (revision `2026-11-13.1`), checked in at
`docs/openapi/customer-consumption-v1.json`. It calls
`/api/v1/customer/consumption/sites` and
`/api/v1/customer/consumption/metering-values` through the existing service
client, installation receipt and verified customer identity. The ordinary
request/response validator chooses this schema only for the new consumption
namespace. Existing Website and Customer Portal documents remain unchanged.

The matched OPS source is prepared on `codex/customer-consumption-capability`
from main `d93f361c51e81bc49cd48e817bd0b0fbe65e3d5b`. Its nine new source files
and unique session were reserved with the official CLI and own authenticated
readback (receipt `fd1c51bb1fb286a41bc082bd52524c12aadc7af9`). The three retained
older API-document refs were not changed. Source custody does not grant a
shared GEN, native, backend or production role.

OPS reads canonical `customer_supply_periods` for the resolved company/customer
and the selected site's meters. Confirmed rights require both `actual_start_date`
and `market_start_at`. Planned starts, move-in and contract dates never grant
rights. Ended supply requires `actual_end_date`. Inclusive Swedish end dates
become the next local midnight; canonical market instants and planned end dates
can only narrow the half-open UTC interval, including 23/25-hour DST days.
Missing authority on a confirmed period is a sanitized error, not an inferred
right. Cancelled/planned/rejected periods grant no windows.

Sites return complete meter-specific `delivery_access` windows for exactly their
page. Authority queries require exact row counts and fail closed above 1,000
rows or on schema/read failures. Meter values must belong to the resolved
company/customer, requested owned facility, consumption direction and kWh unit.
OPS excludes intervals outside that meter's confirmed supply; Web repeats the
window check. An empty filtered meter page may still carry a continuation cursor.
The consumer follows all pages within its bound, ignores replaced/superseded/void
revisions, and rejects unsupported current values, duplicate references and
same-series overlap. No estimated values fill gaps or become invented zeroes.

The adapter retains the same verified Auth/RLS identity on every page, allows
10 site pages and 40 metering pages, and has one 15-second deadline. A capped
meter read remains explicitly partial. Multiple meters keep independent rights;
cross-boundary intervals are excluded whole.

Local component and real OpenAPI-validator tests cover this composition. They
are not live Auth/database or Android/iOS positive consumption acceptance. This
supplement must pass fresh positive A/B consumption qualification on the exact
composed source before release. The existing approved core, session, market,
support and native release proofs are retained with their original applicability;
no unrelated test suite is rerun merely because this feature changes.

Production OPS has not received this supplement yet. Missing/old capability
still fails closed; no production customer consumption PASS is claimed.
