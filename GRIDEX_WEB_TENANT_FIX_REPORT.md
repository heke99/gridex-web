# Gridex Web tenant fix report – 2026-07-23

The website now follows API 2026-07-22.2:

- removed calls to OPS website quote, quote validation and energy-area routes;
- local price-area resolution is the canonical area service;
- Elprisetjustnu is used by the local pricing preview for market-linked contracts;
- fixed prices are not exposed to the browser before area resolution;
- signed local pricing snapshots replace OPS quote references;
- OPS customer applications use `offer_reference` and documented site/customer/contract fields only;
- customer type is canonicalized to `private | business`;
- obsolete readiness scopes were removed;
- audit tables were added with RLS and no browser grants.
