# Catalogue background refresh

Scope: the confirmed ISR background-fetch failure in Gridex Web and the separate
lost upstream-status failure in OPS. Web parent source:
`f6c349086d5af02e5d2f5ff8195eb499a4e385b0`.

## Web finding and correction

Production logs showed catalogue refresh failures within 2–4 ms without an HTTP
status. Direct reproduction with the installed Next 16.3.8 patched fetch proved
that `after()` inherits the home page's legacy-prerender work-unit. Its direct
`no-store` request threw `DYNAMIC_SERVER_USAGE` (E550) before native fetch ran.
The transport then reported a network error, obscuring the framework failure.

The background refresh now executes in a supported `unstable_cache` callback.
Only its successful boolean marker is cached for 15 seconds, with the existing
tenant/API-client/customer-type key and catalogue publication tag. The validated
snapshot read, page ISR interval and explicit fresh validation remain intact.
An unsuccessful initial refresh stores no successful marker. Existing in-flight
coalescing remains; the provider promise itself also stays shared when Next's
dynamic stale-while-revalidate path returns an expired marker early. This is
not a distributed lock or a second catalogue store.

Nine behavior tests execute the real feed, Next cache/async stores/patched fetch,
and application transport. Only snapshot/provider I/O and incremental-cache
persistence are synthetic. The baseline fails with zero native requests; the
correction passes ISR delivery, refresh interval, tenant/type separation, tag
invalidation, recovery, static/dynamic coalescing and final fresh-validation checks. The suite
is included in `npm test` through `test:public-contract-refresh`.

## OPS finding and verification

A later production probe after OPS publication observed database statement
timeout57014 and12-second Web transport timeouts under concurrent public reads.
The sequential browser comparison passed. A read-only database check confirmed
the production client and cheap fingerprint function; no schema or data mutation
was performed. Background refresh now uses the existing conditional client path
instead of a forced full catalogue read. A confirmed304 renews freshness through
the existing atomic snapshot RPC; stale fallback or rejected durable writes cannot
create a successful marker. The real client regression proves ETag/304 behavior
and the final forceFresh200 bypass independently. This reduces avoidable full
reads; it does not establish that every upstream capacity limit is resolved.

A distinct real HTTP500 was traced to lost Supabase/PostgREST gateway status.
The existing F43 author patch at
`25a842b88576786fdbae0f8e82a402e7be9bbff2` classifies these failures as HTTP503;
its catalogue GET adds `retryable:true` and `Retry-After:2`. A read-only independent
review executed 330 assertions, including real canonical response formatting and
preservation of typed validation/auth/tenant/legal failures. The deployed baseline
failed the corresponding lost-gateway case.

The three catalogue production files form a bounded subset; the application POST
change and unrelated branch work are excluded. Thirty-eight new route tests
exercise the real GET handler. OPS production source
`2a234c415a8bb4eaac784ab044230735733559e2` is deployed as
`dpl_7ropoDXHqydvxNr2vfGC4Z763Z3f`. Its full supported Node22 suite passed
21,233 tests across1,237 files. The same five changed files have a separate
main-integration review in OPS PR876; its normal merge remains separate.

## Atomic snapshot revision guard

Review also reproduced an existing missing-row race in the Web snapshot RPC.
If a webhook creates a newer publication state after the first SELECT finds no
row, the guarded UPSERT preserves that newer state, but the old function assumed
its own revision won and could store an older snapshot. A forward migration now
reads and locks the actual state after the UPSERT and rejects an older revision
before changing the snapshot. It refuses to replace an unexpected function body
and preserves service-role-only execution. Five in-memory PostgreSQL tests cover
the faulty baseline, deterministic interleaving for full and canonical-empty
feeds, ordinary renewal, revision advancement, organization conflicts and source
guard. The interleaving is instrumented; two parallel live DB sessions were not
used. No historical migration is edited.

No tenant authorization change, original signing replay, customer creation,
agreement submission, or email is part of this correction.
