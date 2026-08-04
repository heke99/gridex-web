# Gridex Web – automatisk checkoutpolicy

Denna leverans tar bort kundval av prisalternativ, fakturasätt, pristillägg och
antal anläggningar från webbcheckouten.

Servern väljer automatiskt OPS-publicerat standardpris, använder exakt en
anläggning och skickar `e_invoice` som API-värde. Kivra ska prövas först i OPS
eller billingleverantören, eftersom OpenAPI 2026-08-04.1 inte har `kivra` i
enumen för `invoice_delivery_method`.

Synka ändringarna från den extraherade mappen till projektroten med:

```bash
rsync -av ./gridex-web-automatic-checkout-changed-files/ /Users/hekmath/Projects/gridex-web/
```

Verifiera därefter:

```bash
npm ci
npm run typecheck
npm run test:launch
npm run build
npm run api:preflight
```
