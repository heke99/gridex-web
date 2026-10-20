# Kundens personuppgiftsbegäranden

Mina sidor har ett gemensamt flöde för registerutdrag och radering på `/dashboard/privacy`. Begäran lagras tillsammans med sitt köjobb i en lokal databastransaktion. För en kopplad kund överför den befintliga outbox-processen begäran till OPS dokumenterade kundsupport-API. Ett Auth-konto som ännu saknar kundkoppling får i stället ett riktigt ärende i den befintliga Web-inkorgen, synligt i Support123. Kundservice hanterar begäran och återkommer till kunden.

## Webbens API

`POST /api/web/customer/privacy-requests` kräver en verifierad Auth-session och bekräftad e-post. JSON innehåller endast:

```json
{"kind":"access","client_operation_id":"11111111-1111-4111-8111-111111111111"}
```

`kind` är `access` eller `erasure`. Operation-ID är en UUIDv4 som klienten behåller vid återförsök. Kundens ID, mejl och kundkoppling hämtas på servern; dessa fält accepteras inte från webbläsaren. Begäran begränsas till 1 KiB, rätt innehållstyp och tillåten origin.

Ett `202`-svar innehåller `data.id`, `data.kind`, `data.created_at`, `data.replayed` och `status: received`. Det bekräftar hållbar mottagning. Det bekräftar inte utfört registerutdrag, genomförd radering eller mottaget mejl. Återförsök med samma användare och operation-ID återger samma begäran. Annan åtgärd med samma ID ger `409`. Fem nya begäranden per rullande dygn tillåts per användare; identiska återförsök förbrukar inte denna kvot. Kundservice är tillgänglig även när kvoten nåtts.

`GET /api/web/customer/privacy-requests` visar sessionens senaste 50 begäranden. Svaren är privata och får inte cachas. Klienten får inga köpayloads, identitetssnapshots eller interna felmeddelanden. Ett läsfel returneras som fel, inte som tom historik.

Felkoder: `400` ogiltig begäran, `401` saknad session, `403` obekräftad e-post eller otillåten origin, `409` ändrat innehåll för samma operation, `413` för stor body, `415` fel innehållstyp, `429` kvot, `503` lagringen är otillgänglig. Vid okänt utfall ska klienten återanvända samma operation-ID.

## Databas och överföring

- `gridex_enqueue_privacy_request_v1` sparar `customer_privacy_requests` och ett `privacy_request`-jobb i `customer_portal_write_outbox` atomiskt. Per-användare-lås, unik nyckel och kvotkontroll finns i samma transaktion.
- Saknas båda kundreferenserna anropar samma RPC den befintliga `gridex_create_public_inquiry_v1`. Begäran, Web-ärende, kundmeddelande, köat e-postkvitto och slutförd lokal överföring sparas i samma transaktion. Support123:s befintliga personalgräns visar ärendet med kategorin `data_protection`. Inget OPS-kundärende eller påhittad OPS-referens skapas. Kvittooperatören använder begärans unika ID, så lika klient-UUID från olika användare inte delar ärende.
- RPC-funktionerna är `SECURITY INVOKER` med tom `search_path` och får endast köras av `service_role`. Browserroller kan varken läsa eller skriva tabellen eller anropa funktionerna. Den inloggade användaren verifieras i BFF-gränsen.
- För OPS-överföring kontrollerar worker den aktuella Auth-identiteten, bekräftad mejl, spärr/radering och båda normaliserade kundreferenserna. Ändrad kundkoppling får inte styra om en köad begäran. Den lokala vägen bygger på BFF-gränsens verifierade, bekräftade session vid mottagningen.
- Överföringen använder befintliga `POST /api/v1/customer/support/cases`, kategorin `data_protection`, ordinarie tenantklient och kundheaders samt samma `Idempotency-Key` vid varje försök. Inga nya OPS-endpoints eller rättigheter införs.
- `gridex_complete_privacy_request_v1` sparar OPS ärendereferens och slutför köjobbet i samma transaktion. Både försöksnummer och låstid måste stämma. En gammal worker kan inte slutföra en ersättningslease.
- Vid nätverksfel efter OPS-acceptans kan samma anrop upprepas med originalnyckeln. Det är inte en gemensam ACID-transaktion över HTTP och två databaser. OPS måste behålla idempotenskvittot enligt sitt kontrakt; okända utfall får inte hanteras med en ny nyckel.
- Befintlig cron och dess autentisering används. Normalt sker överföring inom en timme utan att formuläret väntar på OPS. Retry-After och exponentiell väntetid respekteras. Permanenta fel och förbrukade försök visas som att kundservice behöver hjälpa till.

## Hantering och avgränsning

Statusarna är `queued` (sparad), `submitted` (riktigt ärende skapat i rätt inkorg) och `needs_attention` (överföring behöver hjälp). `submitted` betyder aldrig att personuppgifterna är raderade eller att ett fullständigt utdrag har levererats. Lokal handläggningsstatus läses direkt från det kopplade Web-ärendet. Kundservice återkommer via kontaktuppgifterna; ett OPS-ärendes fortsatta dialog finns även under Kundservice på Mina sidor. Det lokala ärendets interna UUID lämnas inte ut som en OPS-referens.

Handläggaren behöver inhämta och bedöma uppgifter från Web/Auth, OPS, dokumentlagring och berörda leveranssystem. Lagstadgat bevarande och andra rättsliga grunder bedöms innan radering. Ingen allmän purge-RPC, kundstyrd Auth-adminfunktion, automatisk personalradering eller automatisk avtalsradering exponeras.

Kör `npm run test:privacy` för faktisk SQL-migrering i isolerad PostgreSQL, BFF-gränser, aktuell identitetskontroll samt worker-/kvittobeteende. Dessa prov använder syntetiska användare och ersatta nätverksgränser. De bevisar inte i sig att ett verkligt OPS-ärende har skapats eller att begäran har handlagts.
