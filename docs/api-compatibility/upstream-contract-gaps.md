# Gridex OPS – kontraktsgap

Datum: 2026-07-30  
Granskad kontraktsversion: `2026-07-30.1`

## Resultat

`npm run api:compatibility:known-gaps` rapporterar ett kvarvarande maskinellt
kontraktsgap:

| Kod | Blockerare |
|---|---|
| `public_contract_price_options_not_published` | `ContractPriceOption` och offertens valfält finns, men `PublicContract` deklarerar inte `price_options`. |

Följande tidigare blockerare är korrigerade i release `2026-07-30.1`:

| Kod | Korrigering |
|---|---|
| `customer_application_portal_identity_missing` | Båda auth-ID:n finns i det slutna ansökningsschemat och måste skickas parvis. |
| `legal_acceptances_not_dynamic` | Juridik är en dynamisk array bunden till bundle, dokument-ID, version och SHA-256. |
| `portfolio_response_schema_not_strict` | Portfolio använder slutet envelope och `locked_settlement_only`. |
| `website_quote_validation_response_not_strict` | Quote validation har ett slutet response- och data-schema. |
| `website_customer_events_schema_not_strict` | Customer events har canonical request/response och idempotensheader. |
| `customer_portal_sync_request_not_strict` | Sync-requesten är sluten och kräver identiska auth-ID:n. |
| `customer_portal_sync_response_is_invoice_list` | Sync returnerar linking-resultat, inte fakturor. |
| `customer_portal_identity_headers_missing` | Båda verifierade auth-headers publiceras maskinellt. |
| `customer_portal_resource_schemas_not_strict` | Portaloperationernas envelopes och writes är stängda. |
| `ops_domain_webhook_schema_not_published` | Ett slutet domänwebhook-envelope finns i Website OpenAPI. |

## Kvarvarande releasegrindar

Kodbeviset är lokalt. Följande är miljöverifiering och får inte markeras som
klart av en kodpatch:

- OPS-migrationerna ska appliceras i rätt ordning i staging.
- Historisk migrationschecksumma `20260728170000` ska återställas från betrodd
  källa innan deploy.
- OPS ska deployas atomiskt och live release-manifest ska verifieras.
- `npm run api:sync` och `npm run api:check:live` ska passera efter deploy.
- Stagingflöde, två-tenant-isolering och signerade webhook retries/dead-letter
  ska verifieras med riktiga miljöresurser.

`full_api_compatibility_ready` förblir därför `false` tills samtliga granulara
readinesskontroller har verifierat sin miljöevidens.
