import type { SeoPageContent } from './content'

type EditorialContent = Pick<SeoPageContent, 'sections' | 'faq'> & Partial<Pick<SeoPageContent, 'lead' | 'related'>>

export const priceContent: Record<string, EditorialContent> = {
  '/elpriser/morgondagens-elpris': {
    sections: [
      { title: 'Kontrollera datum och publiceringsstatus', body: ['Morgondagens priser kan användas för planering först när prisuppgifterna för rätt datum och elområde har publicerats. Om uppgifterna saknas är det inte samma sak som att priset är noll.', 'Kontrollera om visningen avser enskilda intervall, dygnsmedel eller ett annat genomsnitt. Jämför uppgifter med samma tidszon och tidsperiod.'] },
      { title: 'Använd kommande priser med rätt avtalsform', body: ['Med kvartspris kan användningens tidpunkt påverka energikostnaden. Med månadspris behöver du läsa avtalets beräkningsmodell; morgondagens låga kvartpris är inte automatiskt ditt eget pris.', 'Planera inom praktiska behov för laddning, värme och komfort. Påslag, moms och nätkostnader behöver räknas med utöver marknadspriset.'] },
    ],
    faq: [{ question: 'Vad betyder det om morgondagens pris inte visas?', answer: 'Uppgifterna kan vara opublicerade eller otillgängliga. Utgå inte från nollpris eller dagens priser som ett bekräftat pris för nästa dag.' }],
  },
  '/elpriser/negativt-elpris': {
    sections: [
      { title: 'Ett negativt marknadspris är inte en negativ faktura', body: ['Marknadspriset kan bli negativt under vissa intervall när utbud och efterfrågan ger det utfallet. Kundens avtalsmodell avgör hur priset påverkar elhandeln.', 'Ett månadsgenomsnitt kan samtidigt vara positivt. Kontrollera period och förbrukning innan du jämför ett negativt kvartpris med din faktura.'] },
      { title: 'Räkneexempel med kvarvarande kostnader', body: ['Anta fiktivt ett energipris på −10 öre/kWh och andra rörliga elhandelskostnader på 15 öre/kWh, på samma momsgrund. Summan blir 5 öre/kWh. Fasta avgifter och nätkostnader tillkommer.', 'Att använda mer el är därför inte automatiskt lönsamt. Bedöm hela marginalkostnaden och använd inte ett börspris som ett löfte om ersättning från ditt elavtal.'] },
    ],
    faq: [{ question: 'Får jag alltid betalt för att använda el när spotpriset är negativt?', answer: 'Nej. Avtalsmodell, andra rörliga kostnader, fasta avgifter och nätkostnader påverkar vad du faktiskt betalar.' }],
  },
  '/elpriser/nord-pool': {
    sections: [
      { title: 'Marknadspriset sätts för område och leveransperiod', body: ['På elbörsen möts köp- och säljbud för bestämda leveransperioder. Priset kan skilja sig mellan områden när produktion, efterfrågan och överföringskapacitet skiljer sig.', 'Ett publicerat marknadspris gäller därför ett visst elområde och intervall. Det är inte ett generellt pris som alla kunder betalar.'] },
      { title: 'Kontrollera enhet, valuta och moms', body: ['Prisdata kan visas i olika enheter och valutor. Förväxla inte pris per MWh med pris per kWh eller ett pris utan moms med ett konsumentpris inklusive moms.', 'Koppla marknadsuppgiften till ditt avtals beräkning och tillägg. Den här guiden ändrar inte hur Gridex erbjudanden eller prisdata hämtas.'] },
    ],
    faq: [{ question: 'Är ett börspris per MWh samma tal som öre per kWh?', answer: 'Nej. En MWh är 1 000 kWh. Kontrollera också valuta och moms innan du gör omräkningen.' }],
  },
  '/elpriser/elborsen': {
    sections: [
      { title: 'Varför marknadspriset varierar', body: ['Efterfrågan, tillgänglig produktion och möjligheten att föra över el påverkar vilka bud som möts på marknaden. Väder och driftläget kan förändra förutsättningarna.', 'Att en produktionsform har låg kostnad betyder inte att alla intervall får samma marknadspris. Tillgänglighet och överföring behöver också beaktas.'] },
      { title: 'Skilj börsens signal från avtalets kostnad', body: ['Börspriset kan hjälpa dig förstå variation mellan intervall och elområden. Avtalet bestämmer hur dessa uppgifter omvandlas till ditt energipris.', 'Kontrollera avgifter och förbrukningsprofil. En ögonblicksbild från marknaden ersätter inte en jämförelse av hela elhandelskostnaden.'] },
    ],
    faq: [{ question: 'Varför kan elen vara dyrare trots att det blåser?', answer: 'Priset påverkas även av efterfrågan, annan produktion och överföringskapacitet. Vind är en av flera faktorer.' }],
  },
  '/elpriser/elpris-per-kwh': {
    sections: [
      { title: 'Räkna från kWh till kronor', body: ['Om ett fiktivt pris är 150 öre/kWh kostar 100 kWh 150 kronor för just den prisdelen: 100 × 150 ÷ 100. Kontrollera om beloppet inkluderar moms och andra komponenter.', 'En kWh är energi, medan kW är effekt. Att känna apparatens effekt räcker inte för att veta kostnaden utan användningstid.'] },
      { title: 'Fasta avgifter ändrar snittkostnaden', body: ['En fiktiv månadsavgift på 49 kronor motsvarar 49 öre/kWh vid 100 kWh under månaden och 4,9 öre/kWh vid 1 000 kWh. Samma fasta avgift får alltså olika betydelse.', 'När du jämför ett genomsnittspris, kontrollera vilka kostnader och vilken förbrukning som har räknats med. Räkna inte samma avgift två gånger.'] },
    ],
    faq: [{ question: 'Kan jag multiplicera kWh-priset med förbrukningen för att få hela fakturan?', answer: 'Bara om priset omfattar alla relevanta kostnader. Fasta avgifter, andra prisdelar och nätkostnader kan behöva läggas till.' }],
  },
  '/elpriser/elpris-med-moms': {
    sections: [
      { title: 'Jämför konsumentpriser på samma momsgrund', body: ['När du jämför för ett privat hushåll behöver du veta om varje prisrad inkluderar moms. Ett pris utan moms ser lägre ut även när det avser samma erbjudande.', 'Med antagen moms på 25 procent blir ett fiktivt belopp på 80 kronor utan moms 100 kronor inklusive moms. Om momsen redan ingår ska den inte läggas på igen.'] },
      { title: 'Skilj moms från andra prisdelar', body: ['Moms är inte samma sak som påslag eller energiskatt. Kontrollera vilka komponenter underlaget innehåller och hur skatter redovisas på fakturorna.', 'Använd det publicerade erbjudandets momsuppgifter. Denna omräkning är en allmän förklaring och ändrar inte Gridex prisberäkning.'] },
    ],
    faq: [{ question: 'Hur räknar jag om ett belopp utan moms vid 25 procent moms?', answer: 'Multiplicera med 1,25. Kontrollera först att beloppet verkligen är utan moms och att denna momssats gäller för underlaget.' }],
  },
  '/elpriser/elpris-utan-moms': {
    sections: [
      { title: 'Räkna tillbaka från ett pris inklusive moms', body: ['Vid 25 procent moms räknas ett belopp utan moms fram genom att dividera beloppet inklusive moms med 1,25. Ett fiktivt belopp på 125 kronor blir 100 kronor utan moms.', 'Att dra av 25 procent från konsumentpriset ger ett annat resultat och är inte samma omräkning. Kontrollera alltid angiven momsgrund.'] },
      { title: 'Företagskalkyl och betalningsbelopp kan skilja sig', body: ['Ett företag kan jämföra kostnader på en annan momsgrund än ett privat hushåll. Hur momsen hanteras beror på verksamhetens förutsättningar; ett pris utan moms betyder inte att moms saknas på fakturan.', 'Jämför energipris, fasta avgifter och övriga komponenter på samma grund. Använd verksamhetens redovisningsunderlag när den slutliga kostnaden bedöms.'] },
    ],
    faq: [{ question: 'Kan jag ta bort 25 procent från ett pris inklusive moms?', answer: 'För att räkna bort 25 procent moms dividerar du med 1,25. Momsen är 20 procent av beloppet inklusive moms i det fallet.' }],
  },
  '/elpriser/elpris-vinter': {
    sections: [
      { title: 'Högre användning kan förstärka vinterkostnaden', body: ['Ett eluppvärmt hushåll kan använda fler kWh när värmebehovet ökar. Därför kan kostnaden stiga även om priset per kWh inte stiger lika mycket.', 'Jämför vintermånader med liknande väder och användning. Ett årsgenomsnitt kan dölja månader som behöver större utrymme i budgeten.'] },
      { title: 'Bedöm prisrisk och förbrukning tillsammans', body: ['Rörligt och tidsbaserat pris påverkas av olika beräkningsmodeller, medan fast energipris kan ge större förutsägbarhet för en viss prisdel. Inget av dem låser hela förbrukningen eller alla nätkostnader.', 'Om du överväger ett säkrat upplägg, kontrollera vilka perioder och komponenter det omfattar. Tidigare vinterpriser är inte en garanti för nästa vinter.'] },
    ],
    faq: [{ question: 'Varför blir min vinterfaktura högre trots samma elavtal?', answer: 'Förbrukningen kan öka med uppvärmningsbehovet. Kontrollera både antal kWh, avtalets prisberäkning och andra avgifter.' }],
  },
  '/elpriser/elpris-sommar': {
    sections: [
      { title: 'Sommaren har ett annat användningsmönster', body: ['Mindre uppvärmning kan sänka hushållets förbrukning, samtidigt som laddning, kylning eller vistelse i en sommarstuga kan förändra när elen används.', 'Fasta avgifter ligger normalt kvar även när användningen minskar. Jämför därför förbrukning och avgifter separat.'] },
      { title: 'En billig sommar säger inte vad året kostar', body: ['Marknadspriset påverkas även sommartid av produktion, efterfrågan och överföring. Lägre värmebehov garanterar inte ett visst pris för varje intervall.', 'Använd inte enbart sommarens mätvärden när du väljer avtal för ett eluppvärmt hem. Ta med vinterhistorik och eventuella ändringar i användningen.'] },
    ],
    faq: [{ question: 'Kan jag uppskatta hela årets kostnad från en sommarmånad?', answer: 'Det blir ofta för förenklat, särskilt med elvärme. Använd årshistorik och ta hänsyn till säsongsvariation.' }],
  },
  '/elpriser/se1': {
    sections: [
      { title: 'Läs uppgifterna för det nordligaste elområdet', body: ['SE1 används för det nordligaste svenska elområdet. När du följer aktuella uppgifter behöver du välja SE1 i prisvisningen; ett annat områdes låga pris är inte automatiskt relevant för din anslutning.', 'Kontrollera både leveransdatum och vilken period priset avser. Din anläggnings elområde gäller även om du väljer en elhandlare med verksamhet i andra delar av landet.'] },
      { title: 'Lågt områdespris tar inte bort övriga kostnader', body: ['Om marknadspriset är lågt kan fasta avgifter få större betydelse i jämförelsen. Kontrollera också nätkostnader och skatter i ditt eget underlag.', 'Ett eluppvärmt hushåll behöver bedöma vinterförbrukningen även när vissa intervall har låga priser. Utgå från din anslutning och historik, inte ett genomsnitt för alla i norra Sverige.'] },
    ],
    faq: [{ question: 'Kan jag välja SE1 för att få dess pris?', answer: 'Nej. Elområdet hör till anläggningens geografiska anslutning. Val av elhandlare flyttar inte anläggningen till ett annat område.' }],
  },
  '/elpriser/se2': {
    sections: [
      { title: 'Välj SE2 även om du jämför med grannområden', body: ['SE2 är ett eget prisområde mellan SE1 och SE3. Att områdenas priser ibland är lika betyder inte att de alltid följs åt.', 'Vid jämförelse av dagar och månader behöver alla uppgifter avse SE2 om det är din anläggnings område. Kontrollera adressunderlaget om du är osäker på en plats nära en områdesgräns.'] },
      { title: 'Överföring kan ge skillnader trots geografisk närhet', body: ['El kan produceras, användas och överföras mellan områden, men kapaciteten är begränsad. Det kan bidra till att SE2 har ett annat pris än ett grannområde under samma intervall.', 'Jämför därför ditt avtals kostnad med rätt områdesdata och användningstid. Nätavgiften bestäms separat och är inte ett gemensamt SE2-pris.'] },
    ],
    faq: [{ question: 'Är elnätsavgiften samma för alla i SE2?', answer: 'Nej. Nätavgiften beror på nätägare, abonnemang och tariff. Elområde avser marknadspriset och är en annan indelning.' }],
  },
  '/elpriser/se3': {
    sections: [
      { title: 'Flera städer delar SE3:s marknadspris', body: ['SE3 omfattar bland annat orter i mellersta Sverige. Städer som Stockholm och Göteborg kan därför använda samma områdespris för samma leveransintervall.', 'Kundernas fakturor kan ändå skilja sig genom användning, avtalsmodell, avgifter och nätabonnemang. Staden är inte i sig ett separat börsprisområde.'] },
      { title: 'Jämför lägenhet och eluppvärmt hus på olika underlag', body: ['Ett hushåll med låg användning kan påverkas mer av en fast avgift, medan ett eluppvärmt hus behöver väga in högre förbrukning och vinterprofil.', 'Använd SE3 tillsammans med dina egna mätvärden. Ett generellt SE3-pris ger inte hela kostnaden för alla bostäder i området.'] },
    ],
    faq: [{ question: 'Varför skiljer min elräkning från någon annans i SE3?', answer: 'Ni kan ha olika förbrukning, användningstid, avtalsmodell, elhandelsavgifter och nätkostnader trots samma områdespris.' }],
  },
  '/elpriser/se4': {
    sections: [
      { title: 'SE4 är elområdet för södra Sverige', body: ['Flera orter i södra Sverige använder SE4:s områdespris. Ett pris för exempelvis Malmö och Landskrona behöver därför avse samma leveransintervall för att kunna jämföras.', 'Produktion, efterfrågan och överföring påverkar områdespriset. Ett historiskt prisförhållande mellan norra och södra Sverige är inte ett löfte om nästa intervall.'] },
      { title: 'Planera utan att anta att alla kvartar är dyra', body: ['Priset kan variera inom ett dygn. Med ett tidsbaserat avtal kan förbrukningsprofilen därför spela stor roll, men nätkostnad, andra avgifter och praktiska behov behöver också bedömas.', 'Kontrollera SE4 i den befintliga prisvisningen och läs periodinformationen. Jämför inte ett dagsmedel med ett historiskt månadsunderlag som om de vore samma uppgift.'] },
    ],
    faq: [{ question: 'Har alla städer i SE4 ett eget spotpris?', answer: 'Nej. Om anläggningarna tillhör SE4 gäller samma områdespris för samma marknadsintervall. Avtalspris och total kostnad kan ändå skilja sig.' }],
  },
}
