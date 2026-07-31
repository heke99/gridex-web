# GRIDEX signup contract canonical hotfix — 2026-07-31

## Grundorsak

`OpsPublicContract` kräver canonicala routingfält:

- `channel`
- `customer_type`

Signupflödet konverterade först ett `OpsPublicContract` till den lokala presentationsmodellen `SignupContractOption`, men presentationsmodellen bevarade inte dessa två fält. Därefter byggde två separata `optionAsOpsContract()`-funktioner tillbaka ett ofullständigt `OpsPublicContract`. Next.js/TypeScript stoppade därför bygget i `CustomerApplicationForm.tsx`.

## Korrigering

- `SignupContractOption` har nu `channel` och `customerType` med typer direkt från `OpsPublicContract`.
- `toSignupContractOption()` bevarar `item.channel` och `item.customer_type`.
- De två duplicerade `optionAsOpsContract()`-funktionerna har tagits bort.
- En gemensam `signupContractOptionAsOpsContract()` används av båda signupkomponenterna.
- Adaptern bevarar även `portfolio_price_ore_per_kwh` och `legal_requirements`.
- Ett regressionstest verifierar roundtrip för canonicala routingfält, prisalternativ och juridik.
- TypeScript-narrowing för canonical `area_prices` har korrigerats så att nästa buildstopp i `publicContractContract.ts` undviks.

## Verifiering

Följande riktade tester passerade:

- `tests/signup-contract-option-adapter.test.mjs`
- `tests/signup-pricing-regression.test.mjs`
- `tests/customer-facing-pricing-visibility.test.mjs`
- `tests/public-contract-canonical-area-prices.test.mjs`
- `tests/public-contract-contract.test.mjs`

Fullständig `npm run typecheck` och `npm run build` kräver installerade projektberoenden. Den här körmiljön saknade Next.js-, React- och Supabase-paketen, men den rapporterade ursprungliga strukturella typen är nu komplett och regressionstestad.
