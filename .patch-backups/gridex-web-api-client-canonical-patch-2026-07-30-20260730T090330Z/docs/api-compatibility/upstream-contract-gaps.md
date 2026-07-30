# Gridex OPS – blockerande kontraktsluckor

Datum: 2026-07-29  
Granskad kontraktsversion: `2026-07-28.2`

Det här dokumentet skiljer mellan fel som kan rättas i Gridex Web och fel som kräver en ny, maskinläsbar OPS-kontraktsversion. Gridex Web får inte kringgå dessa luckor med toleranta parserregler eller odokumenterade fält.

## Sammanfattning

| Kod | Berörd operation | Status | Rekommenderad ändring |
|---|---|---|---|
| `customer_application_portal_identity_missing` | `POST /api/v1/website/customer-applications` | BLOCKERAD AV OPS | Lägg till båda portal-ID-fälten i requestschemat. |
| `legal_acceptances_not_dynamic` | Kundansökan och legal bundle | BLOCKERAD AV OPS | Ersätt fasta booleanfält med dokumentbundna acceptanser. |
| `portfolio_response_schema_not_strict` | `GET /api/v1/website/portfolio-prices` | BLOCKERAD AV OPS | Publicera ett slutet response-envelope. |
| `website_quote_validation_response_not_strict` | `POST /api/v1/website/quote/validate` | BLOCKERAD AV OPS | Stäng och typa response-envelope och dess `data`. |
| `website_customer_events_schema_not_strict` | `POST /api/v1/website/customer-events` | BLOCKERAD AV OPS | Publicera typad request och response. |
| `customer_portal_sync_request_not_strict` | `POST /api/v1/customer-portal/sync` | BLOCKERAD AV OPS | Publicera ett slutet linking-requestschema. |
| `customer_portal_sync_response_is_invoice_list` | `POST /api/v1/customer-portal/sync` | BLOCKERAD AV OPS | Returnera linking-resultat, inte `CustomerInvoice[]`. |
| `customer_portal_identity_headers_missing` | Customer Portal-operationer | BLOCKERAD AV OPS | Dokumentera båda externa auth-headers maskinellt. |
| `customer_portal_resource_schemas_not_strict` | Portal bundle och granular routes | BLOCKERAD AV OPS | Publicera slutna resurs-, pagination- och write-scheman. |
| `ops_domain_webhook_schema_not_published` | Dokumenterade domänwebhooks | BLOCKERAD AV OPS | Publicera envelope och eventtypsspecifika payloadscheman. |

## 1. Atomisk portalidentitet i kundansökan

### Nuvarande konflikt

Den människoläsbara guiden kräver samma serververifierade Supabase `session.user.id` i:

```json
{
  "customer_portal_user_id": "uuid",
  "auth_user_id": "uuid"
}
```

`CustomerApplicationRequest` i Website OpenAPI saknar båda fälten och använder `additionalProperties: false`. Gridex Web kan därför inte skicka den dokumenterade identiteten utan att bryta OpenAPI.

### Korrigerad requestmodell

Lägg till:

```json
{
  "customer_portal_user_id": {
    "type": ["string", "null"],
    "format": "uuid",
    "description": "Extern portal-användare verifierad server-side av tenantens backend."
  },
  "auth_user_id": {
    "type": ["string", "null"],
    "format": "uuid",
    "description": "Samma externa auth-user som customer_portal_user_id."
  }
}
```

Serverregler i OPS:

1. båda eller inget fält,
2. fälten måste vara lika,
3. de får aldrig användas som tenantväljare,
4. API-nyckeln avgör alltid bolag,
5. portal account, identity, kundansökan och avtal skapas i samma transaktion,
6. samma idempotency key med annan portalidentitet ska ge konflikt.

### Response

Behåll canonicala kund-, ansöknings- och portalreferenser, men gör `portal_identity_id` obligatoriskt när portal-ID skickades.

### Headers

`Authorization`, `Content-Type`, `Idempotency-Key`.

### Klassificering

Breaking för nuvarande slutna requestschema. Föreslagen version: nästa kontraktsversion efter `2026-07-28.2`.

## 2. Dynamiska juridiska acceptanser

### Nuvarande konflikt

Guiden beskriver juridik som databasdriven, men kundansökan accepterar endast fem fasta booleanfält. En ny obligatorisk dokumenttyp kräver därför en frontendrelease eller blockeras som okänd.

### Föreslagen modell

```json
{
  "legal_bundle_version": "string",
  "legal_acceptances": [
    {
      "requirement_code": "string",
      "document_id": "uuid-or-opaque-reference",
      "document_version": "string",
      "document_hash": "sha256-hex",
      "accepted": true,
      "accepted_at": "date-time"
    }
  ]
}
```

Krav:

- `additionalProperties: false` på envelope och rad,
- unik `requirement_code` per bundle,
- samtliga obligatoriska krav måste finnas,
- `document_id`, version och hash måste matcha den bundle som valideras i submitögonblicket,
- `accepted` måste vara exakt `true`,
- ändrad bundle, version eller hash ska ge en stabil konfliktkod och kräva ny acceptans,
- historisk audit ska lagra exakt visat dokument.

### Migreringsstrategi

Fasta booleanfält kan behållas en version som deprecated läsalias, men OPS ska skriva canonicalt från `legal_acceptances` och därefter ta bort booleanmodellen i en deklarerad breaking version.

## 3. Portfoliohistorik

### Nuvarande konflikt

Guiden kräver `data.method`, `data.historical_final_prices` och `data.final_billing_rule = locked_settlement_only`. OpenAPI beskriver ett fritt objekt.

### Föreslaget response-envelope

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["data", "request_id", "contract_schema_version"],
  "properties": {
    "data": {
      "type": "object",
      "additionalProperties": false,
      "required": ["method", "historical_final_prices", "final_billing_rule"],
      "properties": {
        "method": { "$ref": "#/components/schemas/PublicPortfolioMethod" },
        "historical_final_prices": {
          "type": "array",
          "items": { "$ref": "#/components/schemas/PublicFinalPortfolioPrice" }
        },
        "final_billing_rule": { "const": "locked_settlement_only" }
      }
    },
    "request_id": { "type": "string", "format": "uuid" },
    "contract_schema_version": { "type": "string", "const": "<next-version>" }
  }
}
```

Interna `company_id`, offer-ID, prisplans-ID och portfolio-ID får inte förekomma i publika rader.

### Klassificering

Breaking för klienter som byggt mot det fria objektet, men nödvändig för strict compatibility.

## 4. Quote validation

`POST /api/v1/website/quote/validate` har ett uttryckligen öppet response-envelope. Publicera ett slutet schema med minst:

```json
{
  "data": {
    "valid": true,
    "status": "valid",
    "code": null,
    "quote_reference": "opaque",
    "offer_reference": "opaque",
    "valid_until": "date-time",
    "publication_revision": 1,
    "legal_bundle_version": "string"
  },
  "request_id": "uuid",
  "contract_schema_version": "<next-version>"
}
```

Alla required fields, enums och nullablefält ska beskrivas explicit. `additionalProperties: false` ska användas på envelope och `data`.

## 5. Website customer events

### Nuvarande konflikt

Både request och response är `additionalProperties: true`. Det gör att idempotens, identitet och eventtyp inte kan runtimevalideras.

### Föreslagen request

```json
{
  "event_type": "customer.opened_document",
  "source": "gridex_website",
  "entity_type": "document",
  "entity_id": "opaque",
  "customer_portal_user_id": "uuid",
  "auth_user_id": "uuid",
  "external_customer_id": "opaque-or-null",
  "customer_number": "opaque-or-null",
  "customer_email": "email-or-null",
  "metadata": {}
}
```

Krav:

- slutet schema,
- `Idempotency-Key` obligatorisk och dokumenterad,
- eventtyp som enum eller discriminator-baserad union,
- båda portal-ID-fälten lika,
- ingen `company_id` eller fritt `customer_id`.

### Föreslagen response

Canonical event ID, status, duplicate flag, request ID och contract version i ett slutet envelope.

## 6. `customer-portal/sync`

### Nuvarande konflikt

Requesten är fri och 200-responsen är en fakturalista. Det motsvarar inte operationens syfte.

### Föreslagen request

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["customer_portal_user_id", "auth_user_id"],
  "properties": {
    "customer_portal_user_id": { "type": "string", "format": "uuid" },
    "auth_user_id": { "type": "string", "format": "uuid" },
    "external_customer_id": { "type": ["string", "null"] },
    "customer_number": { "type": ["string", "null"] },
    "email": { "type": ["string", "null"], "format": "email" },
    "metadata": { "type": "object", "additionalProperties": true }
  }
}
```

Kundmatchning ska kräva redan länkad auth-user eller en dokumenterad kombination av stabila kunduppgifter. Ambiguous match ska ge 409.

### Föreslagen response

```json
{
  "data": {
    "linked": true,
    "created": false,
    "role": "owner",
    "portal_identity_id": "uuid",
    "customer_number": "opaque",
    "external_customer_id": "opaque-or-null"
  },
  "request_id": "uuid",
  "contract_schema_version": "<next-version>"
}
```

### Headers

Dokumentera minst:

- `x-gridex-customer-portal-user-id`,
- `x-gridex-auth-user-id`,
- `x-gridex-external-customer-id`,
- `x-gridex-customer-number`,
- `x-gridex-customer-email`,
- `Idempotency-Key`.

## 7. Övriga Customer Portal-resurser

Flera read-responser är endast `{ "type": "object" }` och flera writes har fria requestobjekt. Publicera endpointsspecifika modeller för profil, avtal, anläggningar, fakturor, dokument, juridik, fullmakter, mätvärden, notiser, händelser och portal bundle.

Varje listresponse ska innehålla dokumenterad pagination:

```json
{
  "data": [],
  "meta": {
    "next_cursor": "string-or-null",
    "has_more": false
  },
  "request_id": "uuid",
  "contract_schema_version": "<next-version>"
}
```

Portal bundle måste ha ett slutet `data`-schema och får inte använda ett tomt objekt för att signalera komplett resultat.

## 8. Domänwebhooks

Den publika guiden listar domänhändelser, men endast `contracts.publication.changed` har ett maskinläsbart webhookschema i Website OpenAPI.

OPS bör publicera:

1. ett slutet gemensamt envelope,
2. obligatoriska headers inklusive event ID, event type, delivery ID, timestamp och signature,
3. discriminator på `type`,
4. ett schema per aktiv eventtyp,
5. dokumenterad policy för okända/framtida event,
6. stabil idempotens och replayregler.

`invoice.paid`, `supplier_switch.started` och liknande planerade event ska inte beskrivas som aktiva förrän de faktiskt är publicerade i kontraktet.

## Releasegrind

Gridex Web markerar `full_api_compatibility_ready = false` så länge någon kod ovan finns kvar. Att ett endpointanrop fungerar manuellt får inte överstyra ett saknat eller motsägelsefullt maskinkontrakt.
