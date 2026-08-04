# Gridex Web – automatiskt checkoutval

Datum: 2026-08-04
API-kontrakt: 2026-08-04.1

## Implementerat

- Kunden väljer inte prisalternativ.
- Webbservern väljer exakt ett OPS-publicerat standardprisalternativ.
- Exakt en giltig `is_default`-rad används när flera prisalternativ är giltiga.
- Om OPS publicerar flera giltiga alternativ utan en entydig default blockeras checkout i stället för att gissa.
- Kunden väljer inte fakturasätt.
- Webbens canonical API-värde är `e_invoice`.
- Kivra är dokumenterad som primär downstream-kanal och e-faktura som fallback.
- Kunden väljer inte antal anläggningar; `site_count` är alltid `1` server-side.
- Kunden väljer inte pristillägg; `selected_component_references` är alltid tom från webbcheckout.
- Endast startvalet exponeras: `earliest_possible` eller `specific_date`.
- Äldre/restaurerade pris-tokenar med tidigare kundval av fakturasätt, pristillägg eller fler anläggningar avvisas och måste skapas om.
- Kundtexter om offertval har ersatts med pris- och avtalsunderlag.

## Viktigt om Kivra

OpenAPI 2026-08-04.1 accepterar endast `email`, `e_invoice`, `paper` och
`direct_debit` i `invoice_delivery_method`. Webben kan därför inte skicka
`kivra` som API-värde. Den här patchen skickar `e_invoice` som canonical fallback.
OPS eller billingleverantören måste använda kundens identitet för att försöka
Kivra först och därefter använda e-faktura om Kivra inte är tillgängligt.

## Verifiering utförd

Godkända kontroller:

- API compatibility hardening
- signup pricing regression
- automatic checkout policy
- automatic price-option runtime selection
- customer-facing pricing visibility
- canonical quote expiry
- signup contract option adapter
- launch readiness
- safe redirect paths
- TypeScript/TSX syntaxtranspilering för samtliga ändrade filer

Full `npm ci`, `typecheck` och Next.js-build kunde inte köras i leveransmiljön
eftersom den interna npm-spegeln saknade `zod-validation-error@4.0.2`. Kör den
fullständiga verifieringskedjan lokalt efter synkning.
