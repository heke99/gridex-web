# Full E2E Verification Report

## Release verdict

**RED for complete system qualification:** the previously documented genuine registration-email activation remains unverified. The scoped area/comparison tests below pass. This report does not assert a new production signing or complete customer-account journey.

## Execution identity

- Repository: `heke99/gridex-web`.
- Branch: `codex/area-comparison-audit-20261020`.
- Parent production source: `7e32c559b24bc3ffb4d33542f87c8c7a3cfe7eec`; equivalent local parent `1f3c356f08ddc2af3743f619d1af625e4e10b544`, tree `ef94dcad0c8c602624f65bb74476e37bca231f06`.
- Exact delivered commit/deployment: recorded in PR53 and the private delivery checkpoint.
- Environment: isolated real Next/browser application, actual protected Web production, real OPS specifications/public APIs.
- Runtime: Next16.3.8, React19.2.3; local Node24, production Node22.
- Database: existing Web Supabase; no DDL or direct database mutation performed.
- Date:20 October2026; user-facing dates use Europe/Stockholm.
- Skill: full-e2e-verification. Private evidence directory: `/workspace/gridex-proof-output/area-comparison-audit-20261020/`.

## Architecture

Address/start selection →800ms debounce → component-owned lookup coordinator → actual public HTTP adapter → existing bounded Web resolver → OPS canonical price-area assurance → signed area token/public audit → visible area → canonical quote → checked area/offer tuple → existing checkout context → signing review.

The coordinator holds one address result and one in-flight request per mounted calculator. It has no shared customer cache or browser-storage copy of addresses/tokens. Offer/consumption changes reuse a valid address result; address/start changes cancel and invalidate it. Accepted commercial quotes keep their existing non-expiring behavior and are not automatically repriced on restoration.

## Quality gates

| Gate | Result | Evidence |
|---|---|---|
| Full repository npm test | PASS | Includes9 new behavioral coordinator/adapter tests |
| Lint, TypeScript, production build | PASS | `lint.log`, `typecheck.log`, `build.log` |
| Real calculator browser journeys | PASS |44 runs:22 each in Chromium/Firefox at desktop/mobile widths |
| Neighboring browser regressions | PASS | Old quote suppression, customer retry states, recovery limits, support intent, notification read and terminal status |
| Live OPS contract drift | PASS | Website/customer/staff contracts remain2026-10-12.1 |
| Delivery integrity | PASS |49 migration files, local contract/type snapshots and API compatibility |
| Published before-fix reproduction | PASS | Complete public Luleå address did not reveal area or trigger a lookup before consumption/price |
| Published after-fix checks | Recorded at delivery | `live-browser-after.json`, `live-price-area-verification.json` and checkpoint |

## Scenario summary

| ID | Priority | Flow | Result |
|---|---|---|---|
| AREA-01 | P0 | SE1–SE4 visible before consumption; same area reaches quote/handoff | PASS in browser |
| AREA-02 | P1 | Incomplete/rapidly edited address does not cause request bursts | PASS |
| AREA-03 | P0 | Cancelled/late address and quote responses cannot restore an old result | PASS |
| AREA-04 | P1 | Same-address comparison shares work; expired local token refreshes | PASS |
| AREA-05 | P0 |409/429/HTML/malformed/ambiguous responses fail safely, without automatic retries | PASS |
| AREA-06 | P0 | Wrong quote area or offer rejected before persistence/continuation | PASS |
| AREA-07 | P0 | Restored original quote unchanged; edited address requires new verification | PASS |

## P0 evidence

### AREA-01 — a customer can see their area before fetching a price

The original production calculator required a selected consumption value and a price click before resolving the area. A real protected-production browser reproduced this for a public Luleå address: HTTP200, no JavaScript errors, zero area requests and no displayed area. The new calculator looks up a complete address after typing settles and renders the returned SE area next to the address, independent of consumption. Synthetic browser scenarios cover all four areas, then confirm that the quote request, rendered price and checkout handoff carry that same area.

### AREA-03 / AREA-04 — races, deadlines and limits

Address changes abort the previous fetch and invalidate the area/cache/quote. Late replies cannot replace a newer address result. Concurrent auto-lookup and price clicks share one request. A valid result is reused for another contract, so comparing offers does not repeat the geographic lookup. Cache freshness is bounded by upstream expiry and a29-minute cap below the30-minute Web-signed token lifetime. Requests have a12-second deadline.409/429 responses do not start a retry loop; a visible retry control permits recovery.

### AREA-06 / AREA-07 — commercial evidence stays attached to its address

Before rendering a quote or creating checkout context, the calculator checks the returned primary area, optional canonical area field and offer reference against the selected address/offer. Both wrong-area and wrong-offer browser scenarios fail without a result or handoff. The server's existing signed-token/location/canonical-tuple validation remains authoritative. Restoring an accepted quote does not issue a replacement lookup or silently update commercial evidence. Editing the address clears that result and requires fresh verification.

## Failures and fixes

1. Area unavailable until consumption/price: automatic bounded lookup and visible status next to the address.
2. Comparing more contracts left the calculator: the control now focuses the existing contract selector, preserving address and approved consumption.
3. Area/quote read model could be accepted by the client without matching the current selection: reject mismatched area/offer before continuation.
4. Repeated work and stale area replies: per-widget deduplication, freshness bounds, abort and generation checks.
5. Misleading home copy offered manual area selection that did not exist: the copy now describes the actual automatic address lookup.

## Security / tenancy

The lookup uses the existing anonymous public BFF; no API key, service credential, customer assertion or staff permission is exposed or changed. Areas are returned by OPS rather than inferred from the browser's IP or a hardcoded SE3 fallback. Ambiguous assurance is never converted to verified data. OPS-authorized estimated single-area results retain their original assurance status. Public pricing readiness does not assert a physical facility, grid owner or supplier-switch readiness.

## Database / migrations

No schema or customer-data migration is included. Existing public resolution audit/cache writes may occur during native probes; these are not new customers, agreements or consent records. Existing signing evidence, privacy RPCs, customer bindings and staff accounts are unchanged. Migration integrity passes; a new full legacy database replay is not claimed.

## External integrations

The existing OPS website resolver, quote and validation contracts are reused. Only optional AbortSignal support was added to the browser adapter; no external request/response contract or OPS documentation changed. Live specification checks show no drift. The original production agreement/PDF/mail test is not replayed.

## Performance observations

Debouncing avoids a request per keystroke. In-flight sharing and per-widget reuse avoid repeating address verification when requesting a price or comparing another offer. Incomplete input causes no request; failure causes no polling loop. These are bounded sanity checks, not a load-test claim.

## Cleanup

Local fixture processes and disposable source copies are removed by the runners. The browser fixtures use synthetic data and intercept external business boundaries. Native probes use public city addresses and explicit endpoint allowlists; no actual application, customer, email or supplier switch is created.

## Remaining blockers

The earlier real email-link activation and exact OPS test portal retirement remain incomplete as separately documented. These Web changes do not claim to resolve those tasks. Physical GPS detection, grid-owner/facility verification and a new production signing are not inferred from the area-comparison proofs.

## Final conclusion

The scoped comparison defects are corrected and pass the listed automated/browser gates. Publication, current source identity and native SE1–SE4 evidence are tracked in PR53 and the private checkpoint. System-wide qualification remains incomplete for the separate earlier blockers.
