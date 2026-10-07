import type { SeoPageContent } from './content'

type GuideContent = Pick<SeoPageContent, 'sections' | 'faq'>

export const guideContent: Record<string, GuideContent> = {
  'spotpris-vs-rorligt-elpris': {
    sections: [
      { title: 'Spotpris beskriver marknaden, avtalspris beskriver vad du betalar', body: ['Spotpris avser elens marknadspris för ett visst elområde och tidsintervall. Det är ett underlag för många elavtal, men anger inte ensamt kostnaden på en elhandelsfaktura.', 'Ett rörligt månadspris beräknas enligt avtalets månadsmodell och kompletteras med de avgifter som gäller för avtalet. Med kvartspris spelar de kvartar då du använder el roll. Jämför alltid avtalens beräkningsmetoder.'] },
      { title: 'Jämför samma period och samma prisdelar', body: ['Jämför inte ett enskilt lågt kvartpris med ett helt månadspris. Använd samma elområde och kontrollera om beloppen inkluderar moms, påslag och andra kostnader.', 'Elnätskostnader behöver bedömas separat. Kontrollera också vilka prisdelar som redan ingår så att samma kostnad inte räknas två gånger.'] },
    ],
    faq: [{ question: 'Är ett lågt spotpris samma sak som en låg elräkning?', answer: 'Nej. Förbrukning, avtalsmodell, påslag, fasta avgifter och nätkostnader påverkar totalen. Ett spotpris för en enskild kvart beskriver inte en hel månads kostnad.' }],
  },
  'innan-du-tecknar-elavtal': {
    sections: [
      { title: 'Samla underlaget före valet', body: ['Ta fram årsförbrukning, elområde och nuvarande avtals slutdatum. Kontrollera om du jämför för egen bostad, företag eller en gemensam anslutning.', 'Notera energiprisets beräkning, påslag, månadsavgift och eventuell fakturaavgift. För privat jämförelse bör priserna avse samma period och redovisas inklusive moms.'] },
      { title: 'Läs erbjudandet som gäller vid teckningen', body: ['Kontrollera bindningstid, uppsägningstid, rabattens längd och vad som gäller efter kampanjperioden. Ett marknadsfört pris behöver kompletteras med villkoren för just ditt val.', 'Läs de publicerade dokumenten i teckningsflödet och spara bekräftelsen. Följ det bekräftade startdatumet; ett önskat datum är inte ett löfte om leveransstart.'] },
    ],
    faq: [{ question: 'Vad ska jag ha framför mig när jag jämför ett erbjudande?', answer: 'Årsförbrukning, elområde, prisdelar och aktuella avtalsvillkor. Kontrollera också hur ett nytt startdatum passar ihop med det befintliga avtalet.' }],
  },
  'kontrollera-elavtal': {
    sections: [
      { title: 'Kontrollera avtalet mot fakturan', body: ['Leta upp avtalsformen och prisberäkningen i bekräftelsen. Jämför påslag, fasta avgifter och rabattvillkor med motsvarande rader på fakturan.', 'Kontrollera vilken period fakturan avser och om förbrukningen är uppmätt eller uppskattad. Vid en avvikelse, samla faktura och avtalsunderlag innan du kontaktar elhandlaren.'] },
      { title: 'Lägg in nästa viktiga datum', body: ['Notera när kampanjer och bindningstid löper ut samt när uppsägning behöver ske enligt avtalet. Kontrollera vad som gäller om avtalet förlängs.', 'Gör jämförelsen på nytt när förbrukningen ändras, exempelvis efter installation av värmepump eller elbil. Ett tidigare prisexempel kan då bli missvisande.'] },
    ],
    faq: [{ question: 'Vad gör jag om fakturan inte stämmer med avtalet?', answer: 'Kontrollera period, förbrukning, moms och rabattens giltighet. Kontakta elhandlaren med faktura och avtalsbekräftelse om avvikelsen kvarstår.' }],
  },
  'rabatter-pa-elavtal': {
    sections: [
      { title: 'Vad är det som rabatteras?', body: ['En rabatt kan gälla månadsavgift, påslag eller en annan prisdel. Kontrollera vilken del som påverkas, hur länge rabatten gäller och om den kräver särskilda villkor.', 'En rabatt på en avgift tar inte bort andra kostnader. Jämför samma förbrukning och period för att förstå erbjudandets värde.'] },
      { title: 'Räkna även månaderna efter rabatten', body: ['Om en fiktiv månadsavgift på 49 kronor tas bort i tre månader är rabatten värd 147 kronor. Återstående nio månader kostar 441 kronor i månadsavgift. Energipris och andra avgifter tillkommer.', 'Jämför den samlade kostnaden över perioden du avser att ha avtalet. Notera ordinarie pris efter kampanjen och om bindningstid kvarstår när rabatten är slut.'] },
    ],
    faq: [{ question: 'Är ett avtal med rabatt alltid billigare?', answer: 'Nej. Rabattens värde måste vägas mot ordinarie pris, andra avgifter och villkor under hela jämförelseperioden.' }],
  },
  'bindningstid-och-uppsagningstid': {
    sections: [
      { title: 'Två tidsfrister med olika betydelse', body: ['Bindningstid anger perioden som avtalet är bundet enligt villkoren. Uppsägningstid anger hur långt i förväg ett avslut behöver meddelas. Kontrollera båda; samma slutdatum betyder inte alltid att du kan agera samma dag.', 'Läs också vad som sker vid förlängning och om ett förtida avslut medför kostnad. Använd avtalsbekräftelsen som underlag.'] },
      { title: 'Planera ett byte utan att gissa datum', body: ['Be nuvarande elhandlare bekräfta tidigaste avslutsdatum om villkoren är oklara. Välj önskat startdatum med hänsyn till det underlaget.', 'Vid ett vanligt leverantörsbyte hanteras bytet normalt genom marknadsprocessen. Kontrollera villkoren innan du skickar en separat uppsägning eller antar att ett bundet avtal är avslutat.'] },
    ],
    faq: [{ question: 'Kan ett avtal sakna bindningstid men ha uppsägningstid?', answer: 'Ja. Begreppen avser olika saker. Kontrollera den uppsägningstid och de avslutsvillkor som står i just ditt avtal.' }],
  },
  'anvisat-elavtal': {
    sections: [
      { title: 'När du inte själv har valt elhandlare', body: ['Ett anvisat avtal kan uppstå när en anslutning behöver elhandel och kunden inte har gjort ett eget val. Kontrollera vem som levererar elen och vilka priser och villkor som gäller.', 'Det är ett elhandelsavtal, inte samma sak som nätägarens avgifter. Läs fakturans specifikation för att skilja kostnaderna åt.'] },
      { title: 'Gör ett aktivt val på jämförbara uppgifter', body: ['Ta fram årsförbrukning och kontrollera uppsägningstid och andra villkor i det anvisade avtalet. Jämför sedan total elhandelskostnad med andra avtalsalternativ.', 'Utgå inte från att alla anvisade avtal har samma pris. Ett nytt val behöver fortfarande passa förbrukning, risknivå och startdatum.'] },
    ],
    faq: [{ question: 'Hur vet jag om jag har ett anvisat avtal?', answer: 'Kontrollera avtalsbekräftelsen och fakturan eller fråga din elhandlare vilken avtalsform som gäller och vilka avslutsvillkor du har.' }],
  },
  'undvik-dolda-avgifter': {
    sections: [
      { title: 'Läs samtliga prisrader', body: ['Kontrollera energipris, påslag, övriga rörliga kostnader, månadsavgift och fakturaavgift. Se om priset anges med eller utan moms och vilka kostnader som redan ingår.', 'Ett lågt påslag behöver inte innebära låg total kostnad om andra avgifter är högre. Avgifternas betydelse beror också på hur mycket el du använder.'] },
      { title: 'Kontrollera kostnader utanför prisexemplet', body: ['Läs villkor för kampanjens slut, betalningssätt, avtalsförlängning och förtida avslut. Be om förklaring om en prisdel är oklar.', 'Skilj elhandel från nätavgifter och andra delar av elkostnaden. En separat nätfaktura är inte i sig en dold avgift, men behöver räknas med i hushållets budget.'] },
    ],
    faq: [{ question: 'Hur jämför jag avtal med olika avgifter?', answer: 'Räkna om fasta avgifter och påslag till kostnad för samma förbrukning och period. Kontrollera därefter energiprisets beräkning och övriga villkor.' }],
  },
  'energieffektivisera-hemmet': {
    sections: [
      { title: 'Börja med mätning och de stora användningsområdena', body: ['Jämför månadsförbrukningen med samma period tidigare år och ta hänsyn till väder och ändrad användning. Värme, varmvatten och laddning kan vara viktigare än enskilda småapparater.', 'Gör en lista över åtgärder med uppskattad besparing, kostnad och påverkan på komfort. En lägre elräkning kan bero på lägre pris och behöver inte betyda att energianvändningen minskat.'] },
      { title: 'Bedöm investeringen innan du köper', body: ['Om en fiktiv åtgärd sparar 500 kWh per år och den undvikbara kostnaden antas vara 1,50 kronor/kWh blir besparingen 750 kronor per år. En investering på 3 000 kronor har då en enkel återbetalningstid på fyra år, utan hänsyn till ränta eller underhåll.', 'Fasta avgifter försvinner normalt inte när du sparar några kWh. Använd därför kostnaden som faktiskt minskar i kalkylen och kontrollera byggnadens behov av ventilation och värme.'] },
    ],
    faq: [{ question: 'Sparar varje borttagen kWh hela fakturans genomsnittspris?', answer: 'Inte alltid. Fasta avgifter kan ligga kvar. Beräkna besparingen med de kostnader som faktiskt påverkas av lägre förbrukning.' }],
  },
  'anvanda-mindre-el': {
    sections: [
      { title: 'Hitta grundförbrukningen', body: ['Studera mätvärden när få apparater används och identifiera utrustning som är igång länge. Tänk på kyl, frys, ventilation, pumpar och grundvärme innan du stänger av något.', 'Effekt gånger tid ger energi: en fiktiv apparat som använder 100 watt i tio timmar använder 1 kWh. Kontrollera verklig effekt och drifttid; märkdata är inte alltid samma sak som genomsnittlig användning.'] },
      { title: 'Följ upp en ändring i taget', body: ['Välj en åtgärd, mät före och efter och jämför liknande perioder. Väder, antal personer hemma och semester kan annars ge fel slutsats.', 'Att flytta användning till en billigare kvart minskar inte antalet kWh. Skilj energibesparing från prisstyrning när du följer upp resultatet.'] },
    ],
    faq: [{ question: 'Använder jag mindre el om jag flyttar laddningen till natten?', answer: 'Inte nödvändigtvis. Samma laddning kan använda lika många kWh men kosta annorlunda beroende på avtalsform och priset när elen används.' }],
  },
  'styr-din-elanvandning': {
    sections: [
      { title: 'Vilken användning går att flytta?', body: ['Laddning och vissa former av uppvärmning kan ibland planeras, medan andra behov måste fungera direkt. Kontrollera utrustningens möjligheter och komfortkrav.', 'Prisstyrning har olika betydelse beroende på avtalsform. Ett kvartsprisavtal påverkas av användningens tidpunkt, medan ett månadspris beräknas enligt en annan modell.'] },
      { title: 'Undvik att skapa en ny effekttopp', body: ['Att köra flera stora laster samtidigt kan påverka nätkostnaden om din nättariff innehåller en effektdel. Läs nätägarens modell innan du samlar all användning till samma period.', 'Bedöm energipris, nätkostnad och praktiska begränsningar tillsammans. Ett lågt spotpris är inte ett skäl att använda mer el än du behöver.'] },
    ],
    faq: [{ question: 'Ska jag starta alla apparater när spotpriset är lågt?', answer: 'Kontrollera först avtalsform, nätets effekttariff och utrustningens behov. Samtidiga stora laster kan ge andra kostnader även om energipriset är lågt.' }],
  },
  'ladda-elbil-billigare': {
    sections: [
      { title: 'Räkna med energi från vägguttaget', body: ['Använd laddboxens eller elmätarens mätvärden när du räknar kostnaden. Energin från nätet kan vara större än den som lagras i batteriet på grund av laddförluster.', 'Om en fiktiv laddning tar 40 kWh från nätet och relevant rörlig kostnad antas vara 1,50 kronor/kWh blir kostnaden 60 kronor. Fasta avgifter och andra kostnader behöver bedömas separat.'] },
      { title: 'Planera laddningen efter avtal och avresa', body: ['Med kvartspris kan schemaläggning påverka energikostnaden. Ange när bilen behöver vara klar och kontrollera om styrningen också tar hänsyn till effektbegränsning och andra laster.', 'Jämför hemmaladdning och publik laddning på samma grund. Priset kan anges per kWh, minut eller laddningstillfälle och kan innehålla olika avgifter.'] },
    ],
    faq: [{ question: 'Varför skiljer laddboxens kWh från batteriets ökning?', answer: 'Laddning har förluster och bilen kan använda energi till andra funktioner. Använd energi från nätet när du beräknar vad hemmaladdningen kostar.' }],
  },
  'varmepump-elforbrukning': {
    sections: [
      { title: 'Skilj värme som levereras från el som används', body: ['Värmepumpens värmeproduktion är inte samma sak som dess elförbrukning. Effektiviteten varierar med temperatur, driftförhållanden och anläggning.', 'Kontrollera om mätvärdena avser enbart pumpen eller hela huset. Tillsatsvärme, varmvatten och cirkulationspumpar kan behöva ingå i bedömningen.'] },
      { title: 'Använd vinterdata när du jämför elavtal', body: ['När värmebehovet ökar kan förbrukningen vara koncentrerad till perioder med andra priser än under sommaren. Ett årsmedel utan förbrukningsprofil kan ge en förenklad kostnadsbild.', 'Styrning behöver ta hänsyn till komfort, varmvatten och utrustningens rekommendationer. Låt inte en kortsiktig prissignal ersätta en lämplig driftinställning.'] },
    ],
    faq: [{ question: 'Kan jag uppskatta förbrukningen från värmepumpens effekt?', answer: 'Effekt visar inte ensam årsförbrukningen. Drifttid, temperatur, effektivitet och tillsatsvärme påverkar. Använd uppmätt historik när den finns.' }],
  },
  'vad-drar-mest-el-i-hemmet': {
    sections: [
      { title: 'Effekt och användningstid avgör tillsammans', body: ['En apparat med hög effekt kan använda lite energi om den körs kort tid. En mindre last som är igång hela året kan bidra mer än väntat.', 'Som fiktiva exempel använder 2 000 watt i en halvtimme 1 kWh, medan 20 watt under 24 timmar använder 0,48 kWh. Den senare lasten skulle använda 175,2 kWh på ett år om den var konstant.'] },
      { title: 'Prioritera utifrån ditt hushåll', body: ['I ett eluppvärmt hus kan värme och varmvatten dominera. I en lägenhet där dessa ingår i boendet ser fördelningen annorlunda ut. Laddning kan också ändra bilden.', 'Mät eller använd tillförlitlig användningshistorik innan du bestämmer vad som ska åtgärdas. Ändra inte säkerhets- eller ventilationsfunktioner enbart för att spara el.'] },
    ],
    faq: [{ question: 'Drar den apparat med flest watt alltid mest el?', answer: 'Nej. Energi beror på både effekt och drifttid. Räkna kWh eller mät faktisk användning över en relevant period.' }],
  },
  'sanka-elkostnaden': {
    sections: [
      { title: 'Skilj tre sätt att påverka kostnaden', body: ['Du kan minska antalet kWh, ändra när elen används eller välja ett elhandelsavtal med en annan pris- och avgiftsstruktur. De åtgärderna påverkar olika delar av kostnaden.', 'Elnätet har egna villkor och avgifter. Kontrollera vilka kostnader som går att påverka innan du jämför åtgärder.'] },
      { title: 'Gör en plan som går att följa upp', body: ['Ta fram en baslinje för förbrukning och kostnad, notera avtalsavgifter och välj en åtgärd i taget. Jämför liknande perioder och ta hänsyn till väder och hushållets användning.', 'Kontrollera kampanjens slutdatum och utvärdera avtalet med din faktiska årsförbrukning. Ingen enskild åtgärd eller avtalsform garanterar lägst framtida elkostnad.'] },
    ],
    faq: [{ question: 'Måste jag byta elbolag för att sänka kostnaden?', answer: 'Nej. Lägre förbrukning eller bättre användningstid kan också påverka kostnaden. Ett avtalsbyte bör bedömas utifrån totalpris och villkor.' }],
  },
}
