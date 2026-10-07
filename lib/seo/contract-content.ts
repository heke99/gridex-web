import type { SeoPageContent } from './content'

type EditorialContent = Pick<SeoPageContent, 'sections' | 'faq'> & Partial<Pick<SeoPageContent, 'lead' | 'related'>>

export const contractContent: Record<string, EditorialContent> = {
  '/elavtal/avtalsformer': {
    sections: [
      { title: 'Välj vilken prisrisk du vill ta', body: ['Fast pris innebär ett avtalat energipris under den angivna perioden. Rörligt månadspris beräknas enligt avtalets månadsmodell. Kvartspris följer priserna när elen används. Förbrukning och avgifter påverkar kostnaden i samtliga fall.', 'Jämför förutsägbarhet, möjlighet att styra användningen och villkor vid avslut. En avtalsform är inte automatiskt billigast för alla hushåll.'] },
      { title: 'Läs modellen bakom mix och portfölj', body: ['Mixpris och portföljpris kan ha olika betydelse i olika avtal. Kontrollera vilka delar som är fasta eller marknadsbaserade, hur andelarna bestäms och vilka avgifter som tillkommer.', 'Gridex aktuella erbjudanden och publicerade dokument visar vad som faktiskt går att teckna. Denna guide beskriver begreppen och lovar inte att alla avtalsformer är tillgängliga.'] },
    ],
    faq: [{ question: 'Hur väljer jag mellan månadspris och kvartspris?', answer: 'Jämför hur din användning fördelas över tid och hur mycket du kan flytta. Väg möjligheten att styra mot prisrisk och praktiska behov.' }],
  },
  '/elavtal/mixpris': {
    sections: [
      { title: 'Kontrollera vilka delar som blandas', body: ['Ett mixavtal kombinerar olika prissättningar. Läs vad som gäller för varje del, om fördelningen är bestämd i förväg och hur priset beräknas under perioden.', 'Namnet mixpris räcker inte för att jämföra två erbjudanden. Andelar, inköpsmodell och avgifter behöver också framgå.'] },
      { title: 'Räkneexempel med två andelar', body: ['Om ett fiktivt avtal har 50 procent på 80 öre/kWh och 50 procent på 120 öre/kWh blir det vägda energipriset 100 öre/kWh före eventuella tillägg. Exemplet antar samma prisgrund och momsbehandling i båda delarna.', 'Om andelarna eller priserna varierar förändras resultatet. Kontrollera även månadsavgift, påslag och hur avräkningen görs. Exemplet beskriver inte ett Gridex-erbjudande.'] },
    ],
    faq: [{ question: 'Är mixpris samma sak som fast pris?', answer: 'Nej. En del kan vara fast medan en annan varierar. Läs hur varje del och dess andel bestäms i det aktuella avtalet.' }],
  },
  '/elavtal/portfoljpris': {
    sections: [
      { title: 'Vad beror portföljens pris på?', body: ['Portföljpris kan bygga på en avtalad inköps- eller prissäkringsmodell. Resultatet kan påverkas av när inköp görs, vilka delar som säkras och hur kostnader fördelas.', 'Kontrollera vilka prisdelar kunden betalar och hur modellen följs upp. Ett historiskt resultat är inte en garanti för framtida kostnad.'] },
      { title: 'Jämför transparens och risk', body: ['Be om en begriplig beskrivning av avgifter, eventuella andelar och hur marknadsförändringar påverkar priset. Kontrollera även bindningstid och avslutsvillkor.', 'Bedöm om modellen passar ditt behov av budgetering. Portföljpris innebär inte i sig ett fast kWh-pris eller ett löfte om lägre kostnad än andra avtalsformer.'] },
    ],
    faq: [{ question: 'Kan jag veta portföljpriset i förväg?', answer: 'Det beror på vad avtalet låser och vad som kan variera. Läs den publicerade prisberäkningen och skilj prognoser från garanterade prisdelar.' }],
  },
  '/elavtal/anvisningspris': {
    sections: [
      { title: 'Identifiera ett avtal som du inte själv valt', body: ['Anvisningspris kan gälla när du fått en elhandlare utan att göra ett eget val. Kontrollera avtalsformen i bekräftelsen eller fråga elhandlaren vad som gäller.', 'Läs energipris, påslag, månadsavgift och uppsägningstid. Anvisat avtal och elnätsabonnemang är olika saker.'] },
      { title: 'Jämför ett aktivt val på hela kostnaden', body: ['Använd din egen årsförbrukning och jämför samma tidsperiod. Kontrollera vilka kostnader som gäller i det nuvarande avtalet innan du räknar på ett byte.', 'Ett nytt elhandelsavtal ändrar normalt inte nätägaren. Kontrollera befintliga avslutsvillkor och följ det nya avtalets bekräftade startdatum.'] },
    ],
    faq: [{ question: 'Är anvisningspris ett pris från nätägaren?', answer: 'Det är priset för ett elhandelsavtal som anvisats. Nätägarens abonnemang och nätavgifter behöver bedömas separat.' }],
  },
  '/elavtal/tillsvidarepris': {
    lead: 'Tillsvidare beskriver hur ett avtal löper, inte en enda bestämd prisnivå. Kontrollera prissättningen och uppsägningstiden i just ditt avtal.',
    sections: [
      { title: 'Avtalstid och prisberäkning är olika frågor', body: ['Ett tillsvidareavtal löper utan ett i förväg bestämt slutdatum enligt villkoren. Namnet säger inte ensamt om energipriset beräknas månadsvis eller på annat sätt.', 'Kontrollera avtalsmodell, möjlighet till prisändring och hur ändringar meddelas. Ett tillsvidareavtal är inte automatiskt ett anvisat avtal.'] },
      { title: 'Kontrollera villkoren när du vill byta', body: ['Ett avtal utan angivet slutdatum kan ändå ha uppsägningstid. Läs villkoren innan du bestämmer när ett nytt avtal ska starta.', 'Jämför det aktuella priset med avgifter och eventuella kampanjvillkor i det nya erbjudandet. Jämför inte enbart en gammal faktura med ett kort introduktionspris.'] },
    ],
    faq: [{ question: 'Betyder tillsvidare att jag kan avsluta samma dag?', answer: 'Inte nödvändigtvis. Kontrollera avtalets uppsägningstid och hur ett avslut eller leverantörsbyte ska hanteras.' }],
  },
  '/elavtal/vintersakrat-elpris': {
    sections: [
      { title: 'Vilken period och prisdel är säkrad?', body: ['Vintersäkring är ett begrepp för upplägg som begränsar prisrisk under en viss period. Kontrollera datum, vilka prisdelar som omfattas och hur priset bestäms utanför perioden.', 'Ett säkrat energipris betyder inte att hela fakturan blir fast. Förbrukning, avgifter och nätkostnader kan fortfarande förändras.'] },
      { title: 'Bedöm hela året, inte bara vinterpriset', body: ['Hushåll med elvärme bör jämföra vinterförbrukningen med kostnaden för säkringen och villkoren för övriga månader. Kontrollera också hur avtalet avslutas eller fortsätter.', 'Säkring kan ge mer förutsägbarhet men garanterar inte lägre kostnad än ett osäkrat upplägg. Utbud och exakta villkor framgår av aktuella erbjudanden.'] },
    ],
    faq: [{ question: 'Är vintersäkrat elpris samma som ett helt års fastpris?', answer: 'Nej, inte nödvändigtvis. Kontrollera säkringsperioden och vad som gäller för priset resten av året.' }],
  },
  '/elavtal/el-till-inkopspris': {
    sections: [
      { title: 'Vad ingår i begreppet inköpspris?', body: ['Kontrollera hur inköpspris definieras i avtalet. Det kan behöva skiljas från ett enkelt börsspotpris om inköpsmodellen innehåller andra rörliga kostnader.', 'Fråga vilka komponenter som räknas in och vilka som läggs ovanpå. Samma marknadsföringsuttryck behöver inte beskriva samma total kostnad.'] },
      { title: 'Räkna med fasta avgifter och moms', body: ['Ett erbjudande utan ett visst påslag kan ändå ha månadsavgift eller andra kostnader. Jämför samtliga prisrader för din förbrukning.', 'Skilj den marknadsförda prisgrunden från fakturans slutbelopp. Nätkostnader och hur skatter redovisas behöver också ingå i din budget.'] },
    ],
    faq: [{ question: 'Betyder inköpspris att avtalet saknar avgifter?', answer: 'Nej. Kontrollera inköpsprisets definition, fasta avgifter och andra komponenter i det aktuella erbjudandet.' }],
  },
  '/elavtal/byta-elleverantor': {
    sections: [
      { title: 'Vad är det som byts vid leverantörsbyte?', body: ['Elleverantören säljer elhandeln till din anläggning. Nätägaren ansvarar för anslutning och överföring och bestäms av adressen. Ett vanligt elhandelsbyte kräver normalt inget fysiskt arbete.', 'Kontrollera att det nya avtalet gäller rätt avtalspart och anläggning. Ett leverantörsbyte på samma adress skiljer sig från en flytt.'] },
      { title: 'Förbered det nya avtalet', body: ['Ta fram årsförbrukning, nuvarande villkor och anläggningsuppgifter. Jämför energiprisets beräkning och fasta avgifter innan du väljer ett erbjudande.', 'Läs den mer detaljerade bytesguiden för steg och vanliga frågor. Kontrollera befintliga avtalsfrister och följ det bekräftade startdatumet.'] },
    ],
    faq: [{ question: 'Behöver någon byta min elmätare när jag väljer elhandlare?', answer: 'Ett vanligt byte av elhandlare innebär normalt inte att mätaren byts. Nätägaren ansvarar för anslutningen och mätningen.' }],
    related: [{ label: 'Byta elbolag steg för steg', href: '/elavtal/byta-elbolag', description: 'Fördjupa dig i förberedelser och avtalsstart.' }, { label: 'Nätägare', href: '/natagare', description: 'Förstå anslutningens ansvar.' }],
  },
  '/elavtal/flytta-elavtal': {
    sections: [
      { title: 'Hantera två adresser och två tidsperioder', body: ['Vid flytt behöver du kontrollera när ansvaret för elen upphör på den gamla adressen och börjar på den nya. Ett avtal är knutet till en anläggning; det flyttar inte automatiskt med personen.', 'Fråga din elhandlare om det nuvarande avtalet kan flyttas och vilka villkor som gäller. Kontrollera även nätabonnemanget på båda adresserna.'] },
      { title: 'Spara bekräftelserna för avslut och start', body: ['Ordna adress, lägenhetsuppgifter och tillträdesdatum i god tid. Om bostäderna överlappar kan du behöva avtal för båda under en period.', 'Kontrollera slut- och startbekräftelser separat. Jämför inte den nya bostadens kostnad med den gamla utan att ta hänsyn till uppvärmning och användning.'] },
    ],
    faq: [{ question: 'Flyttas mitt elnätsavtal automatiskt till den nya bostaden?', answer: 'Utgå inte från det. Nätavtalet gäller en anslutning och nätägaren kan vara en annan på den nya adressen. Kontrollera båda adresserna.' }],
  },
  '/elavtal/teckna-elavtal-vid-flytt': {
    sections: [
      { title: 'Ta reda på om bostaden behöver egna avtal', body: ['Fråga hyresvärd, förening eller säljare hur elen är ordnad. Om bostaden har gemensam el eller el inkluderad i boendekostnaden kan förutsättningarna skilja sig från en egen anslutning.', 'När du ansvarar för egna avtal behöver både elhandel och elnät vara ordnade. Kontrollera rätt adress och datum för tillträde.'] },
      { title: 'Uppskatta förbrukningen i den nya bostaden', body: ['Utgå från historik om den finns, men justera för ditt hushåll, uppvärmning och eventuell laddning. Din tidigare bostads förbrukning kan vara ett dåligt mått.', 'Välj erbjudande med de villkor som visas vid teckningen. Följ bekräftelsen för aktuellt startdatum och hantera den gamla adressens avtal separat.'] },
    ],
    faq: [{ question: 'Vad gör jag om jag inte vet årsförbrukningen vid inflyttning?', answer: 'Fråga efter historik och bedöm uppvärmning och eget användningsmönster. Använd flera förbrukningsscenarier när underlaget är osäkert.' }],
  },
  '/elavtal/uppsagningstid-elavtal': {
    sections: [
      { title: 'Räkna bakåt från önskat avslut', body: ['Uppsägningstid beskriver hur långt i förväg avtalet behöver avslutas enligt villkoren. Kontrollera hur tiden räknas och hur meddelandet ska lämnas.', 'Be om bekräftelse om datumet är oklart. Utgå inte från att ett marknadsfört uttryck som flexibel innebär att avtalet kan avslutas samma dag.'] },
      { title: 'Skilj uppsägningstid från bindningstid', body: ['Bindningstid kan begränsa när avtalet kan avslutas, medan uppsägningstiden styr framförhållningen. Båda behöver kontrolleras inför ett nytt startdatum.', 'Ett vanligt leverantörsbyte hanteras normalt genom marknadsprocessen. Fråga hur den processen påverkar ditt avtal innan du vidtar en separat uppsägning.'] },
    ],
    faq: [{ question: 'Var hittar jag uppsägningstiden?', answer: 'Läs avtalsbekräftelsen och de villkor som gäller för ditt avtal. Kontakta elhandlaren om tid eller avslutsdatum är oklart.' }],
  },
  '/elavtal/bindningstid-elavtal': {
    sections: [
      { title: 'Kontrollera periodens början och slut', body: ['Bindningstid är den period då avtalet är bundet enligt villkoren. Kontrollera om tiden räknas från teckning, leveransstart eller ett särskilt angivet datum.', 'Notera även vad som händer efter slutdatumet. Avtalet kan fortsätta med andra villkor eller kräva att du agerar inför förlängning.'] },
      { title: 'Bedöm kostnaden för ett förtida avslut', body: ['Ett för tidigt byte kan innebära kostnad eller att startdatum behöver ändras. Be nuvarande elhandlare förklara vilka villkor som gäller i just ditt fall.', 'Väg en eventuell avslutskostnad mot den möjliga skillnaden i framtida elhandelskostnad. Ett lägre nytt påslag säger inte ensamt att bytet blir ekonomiskt bättre.'] },
    ],
    faq: [{ question: 'Tar bindningstiden slut när rabatten upphör?', answer: 'Inte nödvändigtvis. Kampanjperiod och bindningstid kan ha olika datum. Kontrollera båda i avtalsunderlaget.' }],
  },
}
