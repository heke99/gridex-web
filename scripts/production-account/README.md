# Riktad Androidkontroll i produktion

Kör endast `.github/workflows/mobile-production-account.yml` manuellt. Den återanvänder den färdiga produktionskonfigurerade APK:n från körning 43317701102 med låst SHA256. Den bygger inte om appen och upprepar inte tidigare kvalificeringssviter. Den återanvända APK:n är det ursprungliga device-testbygget; distributionssigneringen är separat verifierad och ändrar inte appens JavaScript/innehåll.

Förutsättningar:

- Testkunden och dess publicerade nollfaktura finns kvar i OPS.
- Lägg in `GRIDEX_PROD_ACCEPTANCE_EMAIL_20261113` och `GRIDEX_PROD_ACCEPTANCE_PASSWORD_20261113` som Actions repository secrets. Använd testkontots privata överlämningsfil; lägg inga värden i Git, workflow-inputs eller kommentarer.
- Originalartefakten finns kvar (begränsad retention). Om den har löpt ut, använd en tillgänglig verifierad identisk artefakt och uppdatera källbindningen under granskning; bygg inte om av vana.

Kontrollen öppnar testkundens avtal, anläggning, publicerade fakturadetalj på 0 SEK och 30-dagarsförbrukning på 60 kWh. Den kontrollerar bakgrund/återgång och utloggning efter processomstart. Kontot använder syntetiska värden, ingen faktisk elleverans eller debitering. Apple-signering och distribution ingår inte.

Artefakten innehåller fem skärmbilder från inloggade kundvyer samt resultat med APK-hash och workflow-commit. Inloggnings-/utloggningsvyer fotograferas inte. Appdata och den egna UI-hierarkifilen rensas; misslyckad städning ger inte PASS. Ta bort de två tillfälliga repository secrets efter körningen.

Aktuell blockerare 2026-11-13: den anslutna GitHub-integrationen svarar `403 Resource not accessible by integration` på `/actions/secrets/public-key`. Inga hemligheter har skapats av försöket. HTTP-inloggning samt fakturalista/fakturadetalj är redan verifierade i produktion; denna nativekontroll är ännu inte körd. Tidigare Android-resultat ersätter inte den nya produktionskontrollen.
