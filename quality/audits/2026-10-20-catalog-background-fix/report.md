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

Five behavior tests execute the real feed, Next cache/async stores/patched fetch,
and application transport. Only snapshot/provider I/O and incremental-cache
persistence are synthetic. The baseline fails with zero native requests; the
correction passes ISR delivery, refresh interval, tenant/type separation, tag
invalidation, recovery, static/dynamic coalescing and final fresh-validation checks. The suite
is included in `npm test` through `test:public-contract-refresh`.

## OPS finding and delivery boundary

A distinct real HTTP500 was traced to lost Supabase/PostgREST gateway status.
The existing F43 author patch at
`25a842b88576786fdbae0f8e82a402e7be9bbff2` classifies these failures as HTTP503;
its catalogue GET adds `retryable:true` and `Retry-After:2`. A read-only independent
review executed 330 assertions, including real canonical response formatting and
preservation of typed validation/auth/tenant/legal failures. The deployed baseline
failed the corresponding lost-gateway case.

The three catalogue production files are a bounded reusable subset; the author's
application POST change and unrelated branch work are excluded. The existing
author test does not execute catalogue GET and cannot be imported unchanged into
that subset. The author's active exact-file claim requires a positive bounded
handoff and verified custody under OPS `AGENTS.md`. Neither a source rewrite nor
OPS publication is implied by this review. Exact current delivery state and Web
production probes are recorded in PR53 and the private task checkpoint.

No database migration, tenant authorization change, original signing replay,
customer creation, agreement submission, or email is part of this correction.
