# Gridex Web – API-anpassning 2026-08-04.1

## Resultat

Projektet är anpassat till den incheckade Gridex OPS-kontraktsversionen `2026-08-04.1`.
Den slutliga kundansökan kan inte längre skickas anonymt och båda obligatoriska
portalidentitetsfälten binds till samma verifierade Supabase Auth-UUID.

## Genomförda ändringar

- `customer_portal_user_id` och `auth_user_id` är obligatoriska i den interna inputtypen.
- Payloadbyggaren stoppar saknade, ogiltiga eller olika portalidentiteter.
- Payloadbyggaren verifierar att båda identitetsfälten både finns och är `required` i OpenAPI.
- Anonym teckning stoppas server-side innan ansökan skapas.
- Inloggning och registrering bevarar checkout-/offer-returen till `/teckna-avtal`.
- Returadresser valideras centralt för att blockera externa och backslash-baserade redirects.
- OpenAPI-synken uppdaterar `GRIDEX_MINIMUM_TENANT_INTEGRATION_VERSION` separat från releaseversionen.
- Release-manifestvalideringen kräver `minimum_tenant_integration_version`.
- Kompatibilitetskontrollen kräver att identitetsfälten ligger i OpenAPI-modellens `required`-lista.
- Webhook-regressionstestet validerar det publicerade named schema i stället för en obefintlig OpenAPI-path.
- Scope-testet accepterar `customer_portal.read` endast som dokumenterat deprecated legacy-alias och förbjuder det i aktiva operationers `x-required-scopes`.
- Historiskt hårdkodade API-versioner/checksummor i aktiva tester har ersatts med release-manifestet.
- Staging-E2E kräver nu ett verifierat `portal_user_id` och skickar samma UUID i båda ansökningsfälten.

## Verifiering utförd i leveransmiljön

Godkänt:

- OpenAPI local drift check för website och customer portal.
- API compatibility: inga upstream contract gaps och inga environment blockers.
- Migration manifest integrity: 32 filer.
- OpenAPI sync contract test.
- API regressionstester för 2026-08-01 och 2026-08-02.
- Runtime OpenAPI-regression för webhook och kundportal.
- Website API contract och runtime contract.
- Launch-readiness och API hardening.
- Public-contract-, pricing-, quote-, signup-, portal- och transportregressioner.
- Säker intern redirect-testning.
- Syntax/transpilering av samtliga ändrade TypeScript- och TSX-filer.

Miljöbegränsning:

`npm ci` kunde inte slutföras mot leveransmiljöns interna npm-spegel eftersom den
saknade flera paketversioner, bland annat `zod-validation-error@4.0.2`,
`zod@4.3.6` och `yocto-queue@0.1.0`. `package-lock.json` har inte ändrats.
Runtimekontraktstesterna kördes därför med tillfälliga test-only shims i
`node_modules`; dessa har tagits bort och ingår inte i leveransen. Kör den fulla
verifieringskedjan i den vanliga projektmiljön där `npm ci` fungerar.

## Rekommenderad verifiering efter synkning

```bash
npm ci
npm run api:check:live
npm run typecheck
npm run test:launch
npm run build
npm run api:preflight
```
