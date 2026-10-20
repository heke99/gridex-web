# Validering av webbens fakturaimport

`POST /api/integrations/invoices` kräver den befintliga integrationsnyckeln före inläsning av body. Förfrågan ska ha `Content-Type: application/json`, vara ett JSON-objekt och rymmas inom 256 KiB. Den gemensamma läsgränsen har tolv sekunders deadline. Tjänsteanrop använder befintlig headerautentisering och kräver ingen webbläsar-origin.

`providerKey` och `externalInvoiceRef` är obligatoriska. Tillhandahållna belopp ska vara ändliga tal eller numeriska strängar enligt den befintliga normaliseringen. Noll, negativa kreditbelopp och exempelvis `1 234,56` behåller sitt värde. Utelämnade valfria belopp behåller tidigare nollstandard. Ogiltiga belopp blir inte noll.

Tillhandahållna datum valideras före kund-, faktura- och synkloggsskrivningar. Ogiltiga typer, oläsbara datum och omöjliga ISO-kalenderdatum som `2026-02-30` ger400. Valfria utelämnade datum förblir tomma. Giltiga skottdagar accepteras.

Felkoder:401/403 för integrationsautentisering,400 för ogiltig JSON eller indata,413 för för stor body,415 för fel innehållstyp och408 när body inte kan läsas inom gränsen. Befintlig kundmatchning och fakturans upsertnyckel används. Den äldre importens lagringssteg är fortfarande sekventiella; valideringsrättningen inför ingen ny databastransaktion över alla steg.

Kör `npm run test:invoice-intake` för tester av den verkliga routen och importören med isolerad databasgräns. Proven gör inga externa skrivningar.
