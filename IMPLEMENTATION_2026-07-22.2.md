# Implementation 2026-07-22.2

This version migrates Gridex Web from OPS-hosted website quotes to a tenant-owned pricing BFF.

Implemented:
- local price-area resolution;
- local Elprisetjustnu market-price calculation;
- signed local pricing snapshots;
- no OPS quote validation before application;
- canonical `private | business` customer type;
- fixed-price redaction until verified area resolution;
- server-only OPS application payload using `offer_reference`;
- audit snapshot migration and RLS lockdown;
- removed legacy readiness probes.
