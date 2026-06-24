export const SITE_URL = 'https://gridex.se'
export const DEFAULT_LAST_MODIFIED = new Date('2026-06-24T00:00:00.000Z')

export type FaqItem = {
  question: string
  answer: string
}

export type SeoPageContent = {
  slug: string
  path: string
  title: string
  description: string
  eyebrow: string
  h1: string
  lead: string
  intent: string
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  sections: Array<{ title: string; body: string[] }>
  bullets: string[]
  faq: FaqItem[]
  related: Array<{ label: string; href: string; description: string }>
  lastModified?: Date
}

export const elavtalPages: SeoPageContent[] = [
  {
    slug: 'jamfor-elavtal',
    path: '/elavtal/jamfor-elavtal',
    title: 'Jämför elavtal – se pris, påslag och avgifter',
    description:
      'Jämför elavtal hos Gridex och se skillnaden mellan rörligt elpris, fastpris, kvartspris och portföljupplägg innan du tecknar.',
    eyebrow: 'Jämför elavtal',
    h1: 'Jämför elavtal utan att missa avgifterna',
    lead:
      'Ett lågt öre/kWh-pris säger inte allt. När du jämför elavtal behöver du se spotpris, påslag, månadsavgift, moms och vad som inte ingår i elhandelspriset.',
    intent: 'Hjälper kunder som söker jämförelse mellan elavtal och vill förstå totalpriset innan teckning.',
    primaryCta: { label: 'Räkna på ditt elpris', href: '/#rakna-elpris' },
    secondaryCta: { label: 'Teckna elavtal', href: '/teckna-avtal' },
    sections: [
      {
        title: 'Titta på totalen, inte bara på öre/kWh',
        body: [
          'Elhandelspriset kan bestå av spotpris eller fast pris, påslag, rörliga avgifter, fast månadsavgift och moms. Två avtal kan därför se lika ut men ge olika månadskostnad.',
          'Gridex visar prisraderna tydligt så att du kan jämföra avtalsformer på samma grund innan du väljer.',
        ],
      },
      {
        title: 'Vilket elavtal passar bäst?',
        body: [
          'Rörligt elpris passar ofta dig som accepterar marknadsvariation. Fastpris passar dig som prioriterar förutsägbarhet. Kvartspris/timpris kan passa dig som kan styra förbrukningen till billigare timmar.',
        ],
      },
    ],
    bullets: [
      'Jämför rörligt, fast, portfölj och kvartspris på samma sida.',
      'Se vilka avgifter som läggs ovanpå spotpriset.',
      'Kom ihåg att elnätsavgiften kommer från nätägaren och inte ingår i elhandelspriset.',
    ],
    faq: [
      {
        question: 'Vad ska jag jämföra när jag väljer elavtal?',
        answer:
          'Jämför avtalsform, bindningstid, påslag, månadsavgift, moms och hur priset beräknas. Titta på totalen för din förbrukning, inte bara på ett enskilt öre/kWh-tal.',
      },
      {
        question: 'Är det billigaste elavtalet alltid bäst?',
        answer:
          'Inte alltid. Ett avtal kan vara billigt i ett scenario men mindre bra om din förbrukning, ditt elområde eller marknaden ändras. Välj efter både pris, risk och tydlighet.',
      },
    ],
    related: [
      { label: 'Billigt elavtal', href: '/elavtal/billigt-elavtal', description: 'Se vad som faktiskt gör ett elavtal billigt.' },
      { label: 'Rörligt elpris', href: '/elavtal/rorligt-elpris', description: 'Förstå rörliga avtal och spotprisbaserad prissättning.' },
      { label: 'Elpris idag', href: '/elpriser/elpris-idag', description: 'Se aktuellt elpris per elområde.' },
    ],
  },
  {
    slug: 'billigt-elavtal',
    path: '/elavtal/billigt-elavtal',
    title: 'Billigt elavtal – hitta ett tydligt elpris',
    description:
      'Letar du efter billigt elavtal? Gridex hjälper dig jämföra totalpris, påslag och månadsavgift så att du ser vad avtalet kostar.',
    eyebrow: 'Billigt elavtal',
    h1: 'Billigt elavtal börjar med tydligt totalpris',
    lead:
      'Ett billigt elavtal är inte bara ett lågt marknadspris. Det handlar också om låga och tydliga avgifter, rätt avtalsform och att priset passar din förbrukning.',
    intent: 'Fångar kunder som söker billigt elavtal och behöver en seriös väg från jämförelse till teckning.',
    primaryCta: { label: 'Jämför ditt pris', href: '/#rakna-elpris' },
    secondaryCta: { label: 'Se elavtal', href: '/elavtal' },
    sections: [
      {
        title: 'Så hittar du ett billigare elavtal',
        body: [
          'Börja med att kontrollera ditt elområde och din ungefärliga årsförbrukning. Därefter kan du jämföra hur olika avtalsformer påverkar din månadskostnad.',
          'Gridex visar priset på ett sätt som gör det lättare att se vad som driver kostnaden.',
        ],
      },
      {
        title: 'Billigt ska också vara begripligt',
        body: [
          'Undvik avtal där det är svårt att se påslag, bindningstid eller månadsavgift. Ett tydligt avtal gör det enklare att undvika överraskningar.',
        ],
      },
    ],
    bullets: [
      'Se spotpris och avgifter separat.',
      'Jämför utifrån ditt elområde och din förbrukning.',
      'Teckna först när du förstår prisbilden.',
    ],
    faq: [
      {
        question: 'Hur får jag billig el?',
        answer:
          'Du kan påverka kostnaden genom att välja rätt avtalsform, ha koll på din förbrukning, jämföra påslag och undvika otydliga avgifter.',
      },
      {
        question: 'Vad är viktigast för ett billigt elavtal?',
        answer:
          'Totalpriset är viktigast: marknadspris, påslag, fasta avgifter och moms tillsammans. Ett lågt spotpris hjälper inte om övriga avgifter är höga.',
      },
    ],
    related: [
      { label: 'Billigaste elavtalet', href: '/elavtal/billigaste-elavtalet', description: 'Så jämför du utan att bli lurad av enskilda prisrader.' },
      { label: 'Spotpris el', href: '/elpriser/spotpris-el', description: 'Förstå spotpriset bakom många rörliga avtal.' },
      { label: 'Byta elbolag', href: '/elavtal/byta-elbolag', description: 'Se hur bytet går till i praktiken.' },
    ],
  },
  {
    slug: 'billigaste-elavtalet',
    path: '/elavtal/billigaste-elavtalet',
    title: 'Billigaste elavtalet – jämför rätt innan du väljer',
    description:
      'Billigaste elavtalet beror på elområde, förbrukning, avgifter och avtalsform. Gridex hjälper dig jämföra totalen tydligt.',
    eyebrow: 'Billigaste elavtalet',
    h1: 'Billigaste elavtalet är det med lägst total för dig',
    lead:
      'Det finns inget elavtal som alltid är billigast för alla. Priset påverkas av elområde, marknad, förbrukningsmönster, avgifter och vilken risknivå du vill ha.',
    intent: 'Fångar högkommersiella sökningar men håller innehållet ärligt och användbart.',
    primaryCta: { label: 'Räkna ut din ungefärliga kostnad', href: '/#rakna-elpris' },
    secondaryCta: { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal' },
    sections: [
      {
        title: 'Därför varierar billigaste valet',
        body: [
          'Ett hushåll med låg förbrukning kan påverkas mer av månadsavgiften, medan ett hushåll med hög förbrukning påverkas mer av påslag och kWh-pris.',
          'I SE1–SE4 kan spotpriset skilja sig, vilket gör att elområdet spelar stor roll.',
        ],
      },
      {
        title: 'Undvik förenklade jämförelser',
        body: [
          'Jämförelser som bara visar ett pris utan tydliga antaganden kan bli missvisande. Därför ska varje pris beräknas med förbrukning, elområde och avtalsvillkor.',
        ],
      },
    ],
    bullets: [
      'Låg månadsavgift kan vara viktigt vid låg förbrukning.',
      'Lågt påslag kan vara viktigare vid hög förbrukning.',
      'Rörligt, fast och kvartspris har olika risk och förutsägbarhet.',
    ],
    faq: [
      {
        question: 'Vilket elavtal är billigast?',
        answer:
          'Det beror på ditt elområde, din förbrukning och avtalsvillkoren. Jämför alltid totalen för ditt hushåll i stället för att bara titta på ett marknadspris.',
      },
      {
        question: 'Kan Gridex garantera billigast el?',
        answer:
          'Nej. Elmarknaden förändras. Gridex fokuserar på tydlig prissättning och transparens så att du kan fatta ett bättre beslut.',
      },
    ],
    related: [
      { label: 'Elpris idag', href: '/elpriser/elpris-idag', description: 'Se marknadspris per elområde.' },
      { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal', description: 'Jämför avtalsformer och avgifter.' },
      { label: 'Så jämför du elavtal', href: '/guider/jamfor-elavtal-utan-att-bli-lurad', description: 'Guide till tryggare elavtalsval.' },
    ],
  },
  {
    slug: 'byta-elbolag',
    path: '/elavtal/byta-elbolag',
    title: 'Byta elbolag – så fungerar leverantörsbytet',
    description:
      'Så byter du elbolag till Gridex. Se vad du behöver, hur startdatum fungerar och vad som händer med elnätsavtalet.',
    eyebrow: 'Byta elbolag',
    h1: 'Byta elbolag ska vara enkelt och tydligt',
    lead:
      'När du byter elhandelsbolag behåller du normalt samma nätägare. Det du byter är elhandelsavtalet – alltså vem som säljer elen till dig.',
    intent: 'Hjälper kunder som är nära köp men behöver förstå processen.',
    primaryCta: { label: 'Starta ansökan', href: '/teckna-avtal' },
    secondaryCta: { label: 'Jämför avtal först', href: '/elavtal/jamfor-elavtal' },
    sections: [
      {
        title: 'Det här behöver du',
        body: [
          'Du behöver person- eller organisationsuppgifter, adress, ungefärlig förbrukning och information om anläggningen. I vissa fall behövs kompletteringar från nätägaren.',
        ],
      },
      {
        title: 'Elnätsavtalet ligger kvar',
        body: [
          'Nätägaren ansvarar för elnätet i ditt område och fakturerar nätavgifter. Gridex ansvarar för elhandelsdelen när avtalet startar.',
        ],
      },
    ],
    bullets: [
      'Välj avtal och startdatum.',
      'Skicka ansökan online.',
      'Gridex hanterar nästa steg och återkommer om uppgifter saknas.',
    ],
    faq: [
      {
        question: 'Kan jag byta elbolag när som helst?',
        answer:
          'Det beror på ditt nuvarande avtal. Kontrollera bindningstid och uppsägningstid innan du byter.',
      },
      {
        question: 'Byter jag även nätägare?',
        answer:
          'Nej, nätägaren styrs av var anläggningen finns. Vid elhandelsbyte byter du bara elhandelsbolag.',
      },
    ],
    related: [
      { label: 'Teckna elavtal', href: '/teckna-avtal', description: 'Gå vidare till ansökan.' },
      { label: 'Fullmakt', href: '/fullmakt', description: 'Läs om fullmakt och uppgifter.' },
      { label: 'Kundservice', href: '/kundservice', description: 'Få hjälp med frågor innan du byter.' },
    ],
  },
  {
    slug: 'fast-elpris',
    path: '/elavtal/fast-elpris',
    title: 'Fast elpris – förutsägbart elavtal',
    description:
      'Fast elpris passar dig som vill ha mer förutsägbarhet. Se hur fastpris skiljer sig från rörligt och kvartspris.',
    eyebrow: 'Fast elpris',
    h1: 'Fast elpris ger mer förutsägbarhet',
    lead:
      'Med fast elpris vet du vilket pris per kWh som gäller under avtalsperioden. Det kan vara rätt val när du prioriterar stabilitet framför att följa marknaden.',
    intent: 'Fångar sökningar om fastpris och hjälper kunden jämföra risk mot pris.',
    primaryCta: { label: 'Se våra elavtal', href: '/elavtal' },
    secondaryCta: { label: 'Jämför mot rörligt', href: '/elavtal/rorligt-elpris' },
    sections: [
      {
        title: 'När passar fast elpris?',
        body: [
          'Fastpris kan passa hushåll som vill budgetera elkostnaden och slippa större marknadssvängningar under avtalsperioden.',
        ],
      },
      {
        title: 'Vad ska du kontrollera?',
        body: [
          'Titta på bindningstid, villkor, månadsavgift och om priset anges med eller utan moms. Jämför också vad du betalar om marknadspriset sjunker.',
        ],
      },
    ],
    bullets: [
      'Mer förutsägbarhet än rörligt pris.',
      'Kan vara dyrare om marknadspriset sjunker.',
      'Passar kunder som vill undvika prisrisk.',
    ],
    faq: [
      {
        question: 'Är fast elpris billigast?',
        answer:
          'Inte alltid. Fast elpris ger förutsägbarhet men kan vara dyrare än rörligt om marknaden faller.',
      },
      {
        question: 'Vad ingår i fast elpris?',
        answer:
          'Det beror på avtalet. Kontrollera kWh-pris, moms, månadsavgift och övriga villkor innan du tecknar.',
      },
    ],
    related: [
      { label: 'Rörligt elpris', href: '/elavtal/rorligt-elpris', description: 'Jämför med marknadsbaserat pris.' },
      { label: 'Kvartspris el', href: '/elavtal/kvartspris-el', description: 'För dig som kan styra förbrukningen mer aktivt.' },
      { label: 'Elprisprognos', href: '/elpriser/elprisprognos', description: 'Få mer kontext om elmarknaden.' },
    ],
  },
  {
    slug: 'rorligt-elpris',
    path: '/elavtal/rorligt-elpris',
    title: 'Rörligt elpris – följ marknadspriset',
    description:
      'Rörligt elpris följer elmarknaden. Läs hur spotpris, påslag och månadsavgift påverkar din kostnad hos Gridex.',
    eyebrow: 'Rörligt elpris',
    h1: 'Rörligt elpris följer marknaden',
    lead:
      'Rörligt elpris baseras normalt på marknadspriset i ditt elområde plus avtalade avgifter. Det kan ge lägre kostnad över tid men varierar mer från månad till månad.',
    intent: 'Rankar för rörligt elpris och förklarar prisformeln med tydlighet.',
    primaryCta: { label: 'Räkna på rörligt pris', href: '/#rakna-elpris' },
    secondaryCta: { label: 'Se spotpris', href: '/elpriser/spotpris-el' },
    sections: [
      {
        title: 'Så byggs rörligt pris upp',
        body: [
          'Rörligt pris består av marknadspris, elhandlarens påslag, eventuella avgifter och moms. Elnätsavgiften kommer separat från nätägaren.',
        ],
      },
      {
        title: 'Fördelar och risker',
        body: [
          'Fördelen är att du följer marknaden och kan dra nytta av lägre priser. Risken är att kostnaden stiger när marknaden blir dyrare.',
        ],
      },
    ],
    bullets: [
      'Passar dig som accepterar prisvariation.',
      'Jämför alltid påslag och månadsavgift.',
      'Elområdet påverkar spotpriset.',
    ],
    faq: [
      {
        question: 'Vad betyder rörligt elpris?',
        answer:
          'Det betyder att priset följer elmarknaden i ditt elområde i stället för att vara låst under en längre period.',
      },
      {
        question: 'Vad är skillnaden mellan rörligt och timpris?',
        answer:
          'Rörligt månadspris utgår ofta från ett snitt, medan timpris eller kvartspris kan följa priset mer direkt för varje tidsperiod.',
      },
    ],
    related: [
      { label: 'Spotpris el', href: '/elpriser/spotpris-el', description: 'Se grunden bakom rörligt pris.' },
      { label: 'Elpris idag', href: '/elpriser/elpris-idag', description: 'Aktuella priser per elområde.' },
      { label: 'Fast elpris', href: '/elavtal/fast-elpris', description: 'Jämför med mer förutsägbart avtal.' },
    ],
  },
  {
    slug: 'kvartspris-el',
    path: '/elavtal/kvartspris-el',
    title: 'Kvartspris el – när priset följer förbrukningen tätare',
    description:
      'Kvartspris el gör priset mer tidsnära. Läs hur det skiljer sig från rörligt månadspris och när det kan passa.',
    eyebrow: 'Kvartspris el',
    h1: 'Kvartspris el passar dig som kan styra förbrukningen',
    lead:
      'När elpriset följer kortare tidsperioder blir det viktigare när på dygnet du använder el. Det kan vara intressant för dig med elbil, smart styrning eller flexibel förbrukning.',
    intent: 'Förklarar kvartspris/timpris och fångar moderna sökningar kring tidsbaserad el.',
    primaryCta: { label: 'Jämför avtalsformer', href: '/elavtal/jamfor-elavtal' },
    secondaryCta: { label: 'Se elpris nu', href: '/elpriser/elpris-nu' },
    sections: [
      {
        title: 'När kan kvartspris vara bra?',
        body: [
          'Det kan passa om du kan flytta förbrukning till billigare timmar, till exempel laddning av elbil, uppvärmning eller större hushållsmaskiner.',
        ],
      },
      {
        title: 'När ska du vara försiktig?',
        body: [
          'Om du inte kan påverka förbrukningstid kan kortare prisperioder ge mindre kontroll. Då kan rörligt månadspris eller fastpris kännas enklare.',
        ],
      },
    ],
    bullets: [
      'Kan ge bättre styrning vid flexibel förbrukning.',
      'Kräver mer uppmärksamhet än ett vanligt rörligt avtal.',
      'Passar extra bra med smart styrning och tydlig prisdata.',
    ],
    faq: [
      {
        question: 'Är kvartspris samma som timpris?',
        answer:
          'Nej, kvartspris följer kortare perioder än timpris. Båda gör dock att tidpunkten för din förbrukning blir viktigare.',
      },
      {
        question: 'Vem passar kvartspris för?',
        answer:
          'Det passar bäst för kunder som kan styra förbrukningen och vill följa marknaden mer aktivt.',
      },
    ],
    related: [
      { label: 'Elpris nu', href: '/elpriser/elpris-nu', description: 'Se aktuellt pris per område.' },
      { label: 'Spotpris el', href: '/elpriser/spotpris-el', description: 'Förstå marknadspriset.' },
      { label: 'Så påverkas elpriset', href: '/guider/vad-paverkar-elpriset', description: 'Lär dig vad som styr priserna.' },
    ],
  },
]

export const elprisPages: SeoPageContent[] = [
  {
    slug: 'elpris-nu',
    path: '/elpriser/elpris-nu',
    title: 'Elpris nu – aktuellt elpris per elområde',
    description:
      'Se elpris nu och förstå hur aktuellt spotpris påverkar elavtal i SE1, SE2, SE3 och SE4.',
    eyebrow: 'Elpris nu',
    h1: 'Elpris nu – följ marknadspriset i ditt område',
    lead:
      'Elpriset förändras över dygnet och skiljer sig mellan Sveriges fyra elområden. Aktuellt pris är en marknadssignal, inte hela ditt elavtalspris.',
    intent: 'Fångar sökningar på el nu, elpris nu och aktuellt elpris.',
    primaryCta: { label: 'Se elpris idag', href: '/elpriser/elpris-idag' },
    secondaryCta: { label: 'Räkna totalpris', href: '/#rakna-elpris' },
    sections: [
      {
        title: 'Aktuellt pris är inte hela fakturan',
        body: [
          'Spotpriset visas normalt utan elnätsavgift, energiskatt, moms och elhandlarens påslag. Därför ska du använda det som underlag, inte som slutpris.',
        ],
      },
      {
        title: 'Skillnad mellan SE1–SE4',
        body: [
          'Elområde, produktion, efterfrågan och överföringskapacitet påverkar priset. Därför kan elpris nu skilja sig mellan norra och södra Sverige.',
        ],
      },
    ],
    bullets: ['Se priset per elområde.', 'Jämför med föregående månads snitt.', 'Räkna totalen innan du tecknar.'],
    faq: [
      {
        question: 'Varför ändras elpris nu hela tiden?',
        answer:
          'Elpriset påverkas av efterfrågan, produktion, väder, överföringskapacitet och marknadsläget. Därför kan priset variera under dygnet.',
      },
      {
        question: 'Är elpris nu samma som mitt avtalspris?',
        answer:
          'Nej. Ditt avtalspris påverkas också av avgifter, påslag, moms och avtalsform.',
      },
    ],
    related: [
      { label: 'Elpris idag', href: '/elpriser/elpris-idag', description: 'Dagens prisbild per elområde.' },
      { label: 'Rörligt elpris', href: '/elavtal/rorligt-elpris', description: 'Så används marknadspris i rörliga avtal.' },
      { label: 'Elområde SE4', href: '/elpriser/se4', description: 'Läs mer om elpris i SE4.' },
    ],
  },
  {
    slug: 'spotpris-el',
    path: '/elpriser/spotpris-el',
    title: 'Spotpris el – förstå marknadspriset bakom elavtalet',
    description:
      'Spotpris el är marknadspriset på el. Läs hur spotpris fungerar och hur det påverkar rörligt elpris och kvartspris.',
    eyebrow: 'Spotpris el',
    h1: 'Spotpris el är grunden i många rörliga avtal',
    lead:
      'Spotpris är marknadspriset på el i ett elområde. För kunden blir slutpriset först komplett när påslag, avgifter, skatt, moms och nätkostnader hanteras korrekt.',
    intent: 'Bygger auktoritet kring spotpris och rörliga avtal.',
    primaryCta: { label: 'Se spotpris idag', href: '/elpriser/elpris-idag' },
    secondaryCta: { label: 'Jämför rörligt elpris', href: '/elavtal/rorligt-elpris' },
    sections: [
      {
        title: 'Spotpris per elområde',
        body: [
          'Sverige är uppdelat i SE1, SE2, SE3 och SE4. Spotpriset kan skilja sig mellan områdena eftersom tillgång, efterfrågan och överföring skiljer sig.',
        ],
      },
      {
        title: 'Från spotpris till kundpris',
        body: [
          'Ett elavtal kan baseras på spotpris men innehåller normalt fler delar. Därför visar Gridex totalen tydligt innan teckning.',
        ],
      },
    ],
    bullets: ['Spotpris är marknadspris.', 'Elområde påverkar priset.', 'Slutpris kräver avgifter, moms och villkor.'],
    faq: [
      {
        question: 'Vad är spotpris på el?',
        answer:
          'Spotpris är marknadspriset på el för ett visst elområde och en viss tidsperiod. Det är inte samma sak som hela kundens fakturapris.',
      },
      {
        question: 'Är spotpris alltid billigast?',
        answer:
          'Inte nödvändigtvis. Spotpris kan vara lågt vissa perioder och högt andra. Totalen beror även på avtalets avgifter och din förbrukning.',
      },
    ],
    related: [
      { label: 'Elpris SE1', href: '/elpriser/se1', description: 'Spotpris i norra Sverige.' },
      { label: 'Elpris SE3', href: '/elpriser/se3', description: 'Spotpris i Mellansverige.' },
      { label: 'Elpris SE4', href: '/elpriser/se4', description: 'Spotpris i södra Sverige.' },
    ],
  },
  {
    slug: 'historiska-elpriser',
    path: '/elpriser/historiska-elpriser',
    title: 'Historiska elpriser – se hur elpriset har rört sig',
    description:
      'Historiska elpriser hjälper dig förstå variationer över tid i SE1, SE2, SE3 och SE4.',
    eyebrow: 'Historiska elpriser',
    h1: 'Historiska elpriser visar varför avtalsform spelar roll',
    lead:
      'Elpriset rör sig över tid. Genom att titta på historiska priser får du bättre kontext när du väljer mellan rörligt, fast och tidsbaserat pris.',
    intent: 'Skapar backlink-vänlig datayta för historiska elprisfrågor.',
    primaryCta: { label: 'Se elpris idag', href: '/elpriser/elpris-idag' },
    secondaryCta: { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal' },
    sections: [
      {
        title: 'Historik är inte en garanti',
        body: [
          'Historiska elpriser kan förklara tidigare variationer men säger inte säkert vad priset blir framåt. De hjälper däremot dig att förstå risk och spridning.',
        ],
      },
      {
        title: 'Använd historiken för bättre beslut',
        body: [
          'Titta på skillnader mellan elområden, säsong, dygnsvariation och hur prisnivåerna påverkar hushåll med olika förbrukning.',
        ],
      },
    ],
    bullets: ['Jämför SE1–SE4 över tid.', 'Förstå säsongsvariation.', 'Använd historik som beslutsstöd, inte garanti.'],
    faq: [
      {
        question: 'Varför är historiska elpriser viktiga?',
        answer:
          'De visar hur mycket priset kan variera och hjälper dig förstå skillnaden mellan stabilitet och marknadsrisk.',
      },
      {
        question: 'Kan historiska elpriser förutsäga framtiden?',
        answer:
          'Nej, men de ger viktig kontext när du jämför avtalsformer och risknivå.',
      },
    ],
    related: [
      { label: 'Elprisprognos', href: '/elpriser/elprisprognos', description: 'Faktorer som påverkar framåtblickande prisbild.' },
      { label: 'Fast eller rörligt', href: '/guider/fast-eller-rorligt-elpris', description: 'Guide till avtalsval.' },
      { label: 'Vad påverkar elpriset?', href: '/guider/vad-paverkar-elpriset', description: 'Lär dig drivkrafterna bakom priset.' },
    ],
  },
  {
    slug: 'elprisprognos',
    path: '/elpriser/elprisprognos',
    title: 'Elprisprognos – vad kan påverka elpriset framåt?',
    description:
      'Elprisprognos med fokus på faktorer som väder, produktion, förbrukning, överföring och elområde.',
    eyebrow: 'Elprisprognos',
    h1: 'Elprisprognos handlar om risk, väder och marknad',
    lead:
      'Ingen kan lova exakt framtida elpris. Men du kan förstå vilka faktorer som ofta påverkar prisbilden och välja avtalsform därefter.',
    intent: 'Fångar sökningar kring elprisprognos utan oseriösa löften.',
    primaryCta: { label: 'Se dagens elpris', href: '/elpriser/elpris-idag' },
    secondaryCta: { label: 'Jämför avtalsformer', href: '/elavtal/jamfor-elavtal' },
    sections: [
      {
        title: 'Faktorer som ofta påverkar prognosen',
        body: [
          'Väder, vindproduktion, vattennivåer, efterfrågan, bränslepriser, överföringskapacitet och driftläget i elsystemet kan påverka prisbilden.',
        ],
      },
      {
        title: 'Välj avtal efter risknivå',
        body: [
          'Om du vill ha mer stabilitet kan fastpris vara intressant. Om du accepterar variation kan rörligt elpris passa bättre. Om du kan styra förbrukningen kan tidsbaserade avtal vara relevanta.',
        ],
      },
    ],
    bullets: ['Prognos är inte garanti.', 'Risknivå ska passa hushållet.', 'Prisdata bör kombineras med tydliga avtalsvillkor.'],
    faq: [
      {
        question: 'Kan man veta framtida elpris?',
        answer:
          'Nej, inte exakt. Prognoser bygger på förutsättningar som kan ändras snabbt.',
      },
      {
        question: 'Hur ska jag använda en elprisprognos?',
        answer:
          'Använd den som stöd för att förstå risk och välja avtalsform, inte som ett löfte om framtida pris.',
      },
    ],
    related: [
      { label: 'Historiska elpriser', href: '/elpriser/historiska-elpriser', description: 'Se hur priser kan variera över tid.' },
      { label: 'Fast elpris', href: '/elavtal/fast-elpris', description: 'Avtal med mer förutsägbarhet.' },
      { label: 'Rörligt elpris', href: '/elavtal/rorligt-elpris', description: 'Avtal som följer marknaden.' },
    ],
  },
  ...(['SE1', 'SE2', 'SE3', 'SE4'] as const).map((area) => ({
    slug: area.toLowerCase(),
    path: `/elpriser/${area.toLowerCase()}`,
    title: `Elpris ${area} – elpris idag och tydliga elavtal`,
    description: `Se elpris i ${area}, jämför avtalsformer och förstå hur spotpris, påslag, moms och avgifter påverkar totalen.`,
    eyebrow: `Elområde ${area}`,
    h1: `Elpris ${area} – följ priset i ditt elområde`,
    lead: `${area} är ett av Sveriges elområden. Priset påverkas av marknad, efterfrågan, produktion och överföringskapacitet. Gridex visar både prisdata och hur elavtalet byggs upp.`,
    intent: `Rankar för elpris ${area} och kopplar elområdessökningar till tydligt avtalsval.`,
    primaryCta: { label: `Se livepris och snitt för ${area}`, href: '/elpriser/elpris-idag' },
    secondaryCta: { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal' },
    sections: [
      {
        title: `Så påverkas priset i ${area}`,
        body: [
          'Elområdespriset styrs av elmarknaden. Skillnader mellan områden uppstår när produktion, förbrukning och överföringskapacitet inte räcker till på samma sätt i hela landet.',
        ],
      },
      {
        title: 'Räkna på totalen',
        body: [
          'Använd elområde och förbrukning när du jämför avtal. Då ser du hur spotpris, påslag, månadsavgift och moms påverkar din faktiska kostnad.',
        ],
      },
    ],
    bullets: [`Följ aktuellt pris i ${area}.`, 'Jämför rörligt, fast och kvartspris.', 'Se vad som ingår innan du tecknar.'],
    faq: [
      {
        question: `Varför skiljer sig elpris i ${area} från andra områden?`,
        answer:
          'Prisskillnader kan bero på produktion, förbrukning och begränsningar i överföringskapacitet mellan elområden.',
      },
      {
        question: `Kan jag teckna elavtal i ${area} hos Gridex?`,
        answer:
          'Ja, du kan jämföra och ansöka online. Exakta villkor visas innan du skickar ansökan.',
      },
    ],
    related: [
      { label: 'Elpris idag', href: '/elpriser/elpris-idag', description: 'Aktuella priser för alla elområden.' },
      { label: 'Spotpris el', href: '/elpriser/spotpris-el', description: 'Förstå marknadspriset.' },
      { label: 'Billigt elavtal', href: '/elavtal/billigt-elavtal', description: 'Jämför tydliga avtal.' },
    ],
  })),
  ...[
    { slug: 'skane', place: 'Skåne', area: 'SE4', note: 'Skåne ligger normalt i elområde SE4, där prisbilden ofta påverkas starkt av södra Sveriges balans mellan förbrukning, produktion och överföring.' },
    { slug: 'landskrona', place: 'Landskrona', area: 'SE4', note: 'Landskrona ligger i Skåne och priset ska därför förstås utifrån SE4 och den lokala nätägarens område.' },
    { slug: 'stockholm', place: 'Stockholm', area: 'SE3', note: 'Stockholm ligger normalt i SE3. För kunder i huvudstadsområdet är förbrukningsmönster, boendeform och avtalsform viktiga vid jämförelse.' },
    { slug: 'goteborg', place: 'Göteborg', area: 'SE3', note: 'Göteborg ligger normalt i SE3. Jämför totalpris och avtalsform i stället för att bara titta på spotpriset.' },
    { slug: 'malmo', place: 'Malmö', area: 'SE4', note: 'Malmö ligger i SE4. I södra Sverige är tydlig prissättning extra viktig eftersom prisnivån kan skilja sig mot norra elområden.' },
  ].map(({ slug, place, area, note }) => ({
    slug,
    path: `/elpriser/${slug}`,
    title: `Elpris i ${place} – jämför elavtal och ${area}`,
    description: `Se hur elpris i ${place} påverkas av elområde ${area}. Jämför tydliga elavtal, avgifter och totalpris hos Gridex.`,
    eyebrow: `Lokal elprisguide`,
    h1: `Elpris i ${place} – förstå priset innan du väljer avtal`,
    lead: note,
    intent: `Lokal SEO-sida för ${place} med unik nytta kring elområde, pris och avtalsval.`,
    primaryCta: { label: 'Räkna på ditt pris', href: '/#rakna-elpris' },
    secondaryCta: { label: `Se ${area}`, href: `/elpriser/${area.toLowerCase()}` },
    sections: [
      {
        title: `Så jämför du elavtal i ${place}`,
        body: [
          'Börja med elområde och årsförbrukning. Kontrollera därefter påslag, månadsavgift, moms och avtalsform. Det är totalen som avgör om avtalet är bra för dig.',
        ],
      },
      {
        title: 'Nätägare och elhandel är två olika delar',
        body: [
          'Elnätsavgiften bestäms av nätägaren i området. Gridex elhandelsavtal avser elhandelsdelen och visas separat från nätkostnader.',
        ],
      },
    ],
    bullets: [`${place} kopplas till ${area}.`, 'Jämför totalpris med rätt förbrukning.', 'Teckna först när prisraderna är tydliga.'],
    faq: [
      {
        question: `Vilket elområde gäller för ${place}?`,
        answer: `${place} kopplas i denna guide till ${area}. Kontrollera alltid din anläggning och nätägare vid teckning om du är osäker.`,
      },
      {
        question: `Hur hittar jag billigt elavtal i ${place}?`,
        answer:
          'Jämför totalen: spotpris eller fast pris, påslag, månadsavgift, moms och avtalsvillkor. Gridex visar priset innan ansökan skickas.',
      },
    ],
    related: [
      { label: `Elpris ${area}`, href: `/elpriser/${area.toLowerCase()}`, description: 'Fördjupning per elområde.' },
      { label: 'Billigt elavtal', href: '/elavtal/billigt-elavtal', description: 'Lär dig vad som gör ett avtal billigt.' },
      { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal', description: 'Se vad du ska jämföra.' },
    ],
  })),
]

export const guidePages: SeoPageContent[] = [
  {
    slug: 'vad-paverkar-elpriset',
    path: '/guider/vad-paverkar-elpriset',
    title: 'Vad påverkar elpriset? Produktion, väder och elområden',
    description:
      'Lär dig vad som påverkar elpriset: efterfrågan, väder, produktion, elområden, överföring, skatter och avgifter.',
    eyebrow: 'Guide',
    h1: 'Vad påverkar elpriset?',
    lead:
      'Elpriset påverkas av flera saker samtidigt. För att välja rätt elavtal behöver du förstå både marknadspriset och hur avtalet lägger på avgifter.',
    intent: 'Bygger auktoritet och hjälper användaren förstå grunderna bakom elpris.',
    primaryCta: { label: 'Se elpris idag', href: '/elpriser/elpris-idag' },
    secondaryCta: { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal' },
    sections: [
      {
        title: 'Marknaden styr spotpriset',
        body: [
          'Efterfrågan, produktion, väder, vind, vattennivåer, import, export och överföringskapacitet påverkar spotpriset. När efterfrågan är hög och produktionen låg kan priset stiga.',
        ],
      },
      {
        title: 'Avtalet styr vad du betalar utöver marknaden',
        body: [
          'Elhandelsavtalet kan lägga till påslag, månadsavgift och andra villkor. Därför är det viktigt att jämföra totalen, inte bara spotpriset.',
        ],
      },
    ],
    bullets: ['Efterfrågan och produktion påverkar priset.', 'Elområden kan ge olika pris.', 'Avgifter och moms gör spotpris till totalpris.'],
    faq: [
      {
        question: 'Varför är elpriset högt ibland?',
        answer:
          'Det kan bero på hög efterfrågan, låg produktion, kallt väder, svag vind eller begränsningar i överföringskapaciteten.',
      },
      {
        question: 'Kan jag påverka mitt elpris?',
        answer:
          'Du kan påverka din kostnad genom avtalsval, förbrukning, timing och genom att undvika otydliga avgifter.',
      },
    ],
    related: [
      { label: 'Elområden SE1–SE4', href: '/guider/elomraden-se1-se2-se3-se4', description: 'Förstå varför priset skiljer sig i Sverige.' },
      { label: 'Spotpris vs rörligt', href: '/guider/spotpris-vs-rorligt-elpris', description: 'Skillnaden mellan marknadspris och avtal.' },
      { label: 'Elprisprognos', href: '/elpriser/elprisprognos', description: 'Vad påverkar priset framåt?' },
    ],
  },
  {
    slug: 'elomraden-se1-se2-se3-se4',
    path: '/guider/elomraden-se1-se2-se3-se4',
    title: 'Elområden SE1, SE2, SE3 och SE4 – så påverkas elpriset',
    description:
      'Guide till Sveriges elområden SE1–SE4 och varför elpriset skiljer sig mellan norra och södra Sverige.',
    eyebrow: 'Elområden',
    h1: 'Så fungerar elområden SE1–SE4',
    lead:
      'Sverige är indelat i fyra elområden. Vilket område din anläggning ligger i påverkar spotpriset och därmed många rörliga elavtal.',
    intent: 'Stärker intern länkning till SE1–SE4-sidorna och svarar på informationssökningar.',
    primaryCta: { label: 'Se elpris per område', href: '/elpriser' },
    secondaryCta: { label: 'Räkna elpris', href: '/#rakna-elpris' },
    sections: [
      {
        title: 'Varför finns elområden?',
        body: [
          'Elområden hjälper marknaden hantera skillnader mellan produktion, förbrukning och överföringskapacitet i elsystemet.',
        ],
      },
      {
        title: 'Så använder du elområdet vid jämförelse',
        body: [
          'Välj rätt elområde när du räknar på elavtal. Då blir prisbilden mer relevant för din faktiska anläggning.',
        ],
      },
    ],
    bullets: ['SE1 och SE2 ligger i norra Sverige.', 'SE3 täcker stora delar av Mellansverige.', 'SE4 avser södra Sverige.'],
    faq: [
      {
        question: 'Vilket elområde tillhör jag?',
        answer:
          'Det beror på var din anläggning ligger. Du kan ofta se detta via nätägaren eller genom att ange postnummer i en prisräknare.',
      },
      {
        question: 'Varför är SE4 ofta dyrare?',
        answer:
          'Priset kan påverkas av hög efterfrågan, mindre lokal produktion och begränsad överföring från andra områden.',
      },
    ],
    related: [
      { label: 'Elpris SE1', href: '/elpriser/se1', description: 'Prisguide för SE1.' },
      { label: 'Elpris SE3', href: '/elpriser/se3', description: 'Prisguide för SE3.' },
      { label: 'Elpris SE4', href: '/elpriser/se4', description: 'Prisguide för SE4.' },
    ],
  },
  {
    slug: 'fast-eller-rorligt-elpris',
    path: '/guider/fast-eller-rorligt-elpris',
    title: 'Fast eller rörligt elpris – vilket elavtal ska du välja?',
    description:
      'Jämför fast och rörligt elpris. Se fördelar, risker och vad du bör kontrollera innan du tecknar elavtal.',
    eyebrow: 'Avtalsval',
    h1: 'Fast eller rörligt elpris?',
    lead:
      'Fast och rörligt elpris passar olika kunder. Rätt val beror på riskvilja, budget, marknadstro och hur mycket förutsägbarhet du behöver.',
    intent: 'Beslutsstöd för kunder som väljer avtalsform.',
    primaryCta: { label: 'Jämför avtal', href: '/elavtal/jamfor-elavtal' },
    secondaryCta: { label: 'Se dagens pris', href: '/elpriser/elpris-idag' },
    sections: [
      {
        title: 'Fastpris ger stabilitet',
        body: ['Fast elpris gör kostnaden mer förutsägbar under avtalsperioden, men kan bli dyrare om marknadspriset faller.'],
      },
      {
        title: 'Rörligt följer marknaden',
        body: ['Rörligt elpris kan bli billigare över tid men innebär större variation när marknaden rör sig.'],
      },
    ],
    bullets: ['Fastpris: mer kontroll.', 'Rörligt: mer marknadsexponering.', 'Jämför alltid totalpris och villkor.'],
    faq: [
      { question: 'Vad är bäst – fast eller rörligt?', answer: 'Det beror på din risknivå och hur viktigt det är med förutsägbar kostnad.' },
      { question: 'Kan jag byta från fast till rörligt?', answer: 'Det beror på bindningstid och villkor i ditt nuvarande avtal.' },
    ],
    related: [
      { label: 'Fast elpris', href: '/elavtal/fast-elpris', description: 'Fördjupning om fastpris.' },
      { label: 'Rörligt elpris', href: '/elavtal/rorligt-elpris', description: 'Fördjupning om rörligt.' },
      { label: 'Elprisprognos', href: '/elpriser/elprisprognos', description: 'Förstå marknadsläget framåt.' },
    ],
  },
  {
    slug: 'timpris-eller-manadspris',
    path: '/guider/timpris-eller-manadspris',
    title: 'Timpris eller månadspris – välj rätt elavtal',
    description:
      'Timpris, kvartspris eller månadspris? Förstå skillnaden och när tidsbaserat elpris kan passa.',
    eyebrow: 'Tidspris',
    h1: 'Timpris eller månadspris?',
    lead:
      'Skillnaden handlar om hur nära din förbrukning följer marknadspriset. Ju kortare tidsperiod, desto viktigare blir när på dygnet du använder el.',
    intent: 'Svarar på sökningar kring timpris/kvartspris och styr till rätt avtalsform.',
    primaryCta: { label: 'Läs om kvartspris', href: '/elavtal/kvartspris-el' },
    secondaryCta: { label: 'Se elpris nu', href: '/elpriser/elpris-nu' },
    sections: [
      { title: 'Timpris och kvartspris kräver styrning', body: ['Om du kan flytta förbrukning till billigare tider kan tidsbaserat pris vara intressant.'] },
      { title: 'Månadspris är enklare', body: ['Rörligt månadspris jämnar ut variationer och kan vara lättare att förstå för många hushåll.'] },
    ],
    bullets: ['Tidspris passar flexibel förbrukning.', 'Månadspris är enklare att följa.', 'Elbil och värmepump kan göra styrning mer relevant.'],
    faq: [
      { question: 'Är timpris billigare?', answer: 'Det kan vara billigare om du kan styra förbrukningen, men det är inte garanterat.' },
      { question: 'Vad är kvartspris?', answer: 'Kvartspris innebär att priset följer kortare tidsperioder än timpris.' },
    ],
    related: [
      { label: 'Kvartspris el', href: '/elavtal/kvartspris-el', description: 'Fördjupning om kvartspris.' },
      { label: 'Rörligt elpris', href: '/elavtal/rorligt-elpris', description: 'Jämför med rörligt månadspris.' },
      { label: 'Elpris nu', href: '/elpriser/elpris-nu', description: 'Följ aktuellt pris.' },
    ],
  },
  {
    slug: 'byta-elbolag',
    path: '/guider/byta-elbolag',
    title: 'Så byter du elbolag – steg för steg',
    description:
      'Guide: byta elbolag, vad du behöver kontrollera, bindningstid, startdatum och vad som händer med nätägaren.',
    eyebrow: 'Guide',
    h1: 'Så byter du elbolag',
    lead:
      'Att byta elhandelsbolag är ofta enklare än många tror. Det viktiga är att kontrollera nuvarande avtal och förstå vilka uppgifter som behövs.',
    intent: 'Stödjer köpbeslut och minskar friktion i teckningsflödet.',
    primaryCta: { label: 'Starta ansökan', href: '/teckna-avtal' },
    secondaryCta: { label: 'Läs mer om bytet', href: '/elavtal/byta-elbolag' },
    sections: [
      { title: 'Kontrollera nuvarande avtal', body: ['Se om du har bindningstid, uppsägningstid eller andra villkor innan du väljer startdatum.'] },
      { title: 'Nätägaren ändras inte', body: ['Du behåller nätägaren eftersom nätägaren styrs av din anläggnings geografiska plats.'] },
    ],
    bullets: ['Kontrollera bindningstid.', 'Välj nytt elhandelsavtal.', 'Skicka ansökan med rätt uppgifter.'],
    faq: [
      { question: 'Tar det lång tid att byta elbolag?', answer: 'Tiden beror på startdatum, nuvarande avtal och om alla anläggningsuppgifter finns.' },
      { question: 'Måste jag kontakta nätägaren?', answer: 'Normalt hanteras elhandelsbytet utan att du byter nätägare, men kompletteringar kan behövas.' },
    ],
    related: [
      { label: 'Byta elbolag', href: '/elavtal/byta-elbolag', description: 'Produktsida om bytet.' },
      { label: 'Fullmakt', href: '/fullmakt', description: 'Om uppgifter och godkännanden.' },
      { label: 'Teckna elavtal', href: '/teckna-avtal', description: 'Gå vidare till ansökan.' },
    ],
  },
  {
    slug: 'sa-laser-du-din-elfaktura',
    path: '/guider/sa-laser-du-din-elfaktura',
    title: 'Så läser du din elfaktura – elhandel, elnät och avgifter',
    description:
      'Lär dig läsa elfakturan: elhandel, elnätsavgift, energiskatt, moms, påslag och månadsavgift.',
    eyebrow: 'Elfaktura',
    h1: 'Så läser du din elfaktura',
    lead:
      'Elfakturan kan vara svår att förstå eftersom flera kostnadsdelar blandas. Börja med att skilja på elhandel och elnät.',
    intent: 'Informativ guide som bygger förtroende och hjälper kunder förstå pris.',
    primaryCta: { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal' },
    secondaryCta: { label: 'Kontakta kundservice', href: '/kundservice' },
    sections: [
      { title: 'Elhandel', body: ['Elhandel är priset för elen du köper via elhandelsavtalet, inklusive avtalsform och elhandlarens avgifter.'] },
      { title: 'Elnät', body: ['Elnätsavgiften tas ut av nätägaren och är separat från elhandelsavtalet.'] },
    ],
    bullets: ['Skilj på elhandel och elnät.', 'Kontrollera påslag och månadsavgift.', 'Moms och skatter påverkar totalen.'],
    faq: [
      { question: 'Varför får jag elnätsavgift?', answer: 'Elnätsavgiften betalas till nätägaren som ansvarar för ledningarna i ditt område.' },
      { question: 'Ingår elnätsavgiften i Gridex pris?', answer: 'Nej, Gridex elhandelspris visas separat från nätägarens avgifter.' },
    ],
    related: [
      { label: 'Vad är elnätsavgift?', href: '/guider/elnatsavgift-vs-elhandelspris', description: 'Fördjupning om nät och handel.' },
      { label: 'Prisvillkor', href: '/prisvillkor', description: 'Läs mer om villkor.' },
      { label: 'Billigt elavtal', href: '/elavtal/billigt-elavtal', description: 'Jämför rätt delar.' },
    ],
  },
  {
    slug: 'elnatsavgift-vs-elhandelspris',
    path: '/guider/elnatsavgift-vs-elhandelspris',
    title: 'Elnätsavgift och elhandelspris – vad är skillnaden?',
    description:
      'Skillnaden mellan elnätsavgift och elhandelspris. Förstå vad nätägaren respektive elhandelsbolaget fakturerar.',
    eyebrow: 'Elhandel vs elnät',
    h1: 'Elnätsavgift och elhandelspris är olika saker',
    lead:
      'När du jämför elavtal är det viktigt att veta vilken del du faktiskt kan byta. Elhandelsbolaget kan du välja, nätägaren bestäms av var anläggningen finns.',
    intent: 'Reducerar missförstånd och stärker transparent kommunikation.',
    primaryCta: { label: 'Se våra elavtal', href: '/elavtal' },
    secondaryCta: { label: 'Läs prisvillkor', href: '/prisvillkor' },
    sections: [
      { title: 'Elnätet', body: ['Nätägaren ansvarar för ledningarna och elöverföringen till din anläggning.'] },
      { title: 'Elhandeln', body: ['Elhandelsbolaget säljer elen och avtalet kan baseras på exempelvis rörligt pris, fastpris eller tidspris.'] },
    ],
    bullets: ['Nätägare kan normalt inte väljas fritt.', 'Elhandelsbolag kan du byta.', 'Jämför elhandelspriset separat från nätkostnaden.'],
    faq: [
      { question: 'Kan jag byta nätägare?', answer: 'Nej, nätägaren bestäms normalt av var din anläggning finns.' },
      { question: 'Kan jag byta elhandelsbolag?', answer: 'Ja, du kan välja elhandelsbolag utifrån avtal och villkor.' },
    ],
    related: [
      { label: 'Byta elbolag', href: '/guider/byta-elbolag', description: 'Så fungerar bytet.' },
      { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal', description: 'Jämför elhandelsdelen.' },
      { label: 'Så läser du elfakturan', href: '/guider/sa-laser-du-din-elfaktura', description: 'Se var kostnaderna finns.' },
    ],
  },
  {
    slug: 'kwh-forbrukning-villa-lagenhet',
    path: '/guider/kwh-forbrukning-villa-lagenhet',
    title: 'kWh-förbrukning för villa och lägenhet – räkna elpris',
    description:
      'Förstå ungefärlig kWh-förbrukning för villa, lägenhet, elbil och värmepump när du jämför elavtal.',
    eyebrow: 'Förbrukning',
    h1: 'kWh-förbrukning påverkar vilket elavtal som blir billigast',
    lead:
      'Samma avtal kan ge olika resultat beroende på hur mycket el du använder. Därför ska du alltid jämföra elavtal med en realistisk förbrukning.',
    intent: 'Informativ söksida och stöd för kalkylatorn.',
    primaryCta: { label: 'Räkna med din förbrukning', href: '/#rakna-elpris' },
    secondaryCta: { label: 'Billigt elavtal', href: '/elavtal/billigt-elavtal' },
    sections: [
      { title: 'Låg förbrukning', body: ['Vid låg förbrukning kan månadsavgiften få större betydelse än ett litet påslag per kWh.'] },
      { title: 'Hög förbrukning', body: ['Vid hög förbrukning blir kWh-pris och påslag extra viktiga eftersom de multipliceras med fler kilowattimmar.'] },
    ],
    bullets: ['Lägenheter har ofta lägre förbrukning.', 'Villor med elvärme har ofta högre förbrukning.', 'Elbil och värmepump kan öka elanvändningen.'],
    faq: [
      { question: 'Varför frågar prisräknaren efter kWh?', answer: 'Förbrukningen behövs för att räkna total kostnad och jämföra avgifter rätt.' },
      { question: 'Vad händer om jag anger fel förbrukning?', answer: 'Då blir beräkningen mindre träffsäker. Använd helst faktisk årsförbrukning från tidigare faktura.' },
    ],
    related: [
      { label: 'Räkna elpris', href: '/#rakna-elpris', description: 'Använd kalkylatorn.' },
      { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal', description: 'Se hur avgifter slår olika.' },
      { label: 'Så läser du elfakturan', href: '/guider/sa-laser-du-din-elfaktura', description: 'Hitta din förbrukning.' },
    ],
  },
  {
    slug: 'jamfor-elavtal-utan-att-bli-lurad',
    path: '/guider/jamfor-elavtal-utan-att-bli-lurad',
    title: 'Så jämför du elavtal utan att bli lurad av prisrader',
    description:
      'Undvik vanliga misstag när du jämför elavtal. Se totalpris, påslag, månadsavgift, bindningstid och avtalsform.',
    eyebrow: 'Jämförelseguide',
    h1: 'Så jämför du elavtal utan att bli lurad',
    lead:
      'Många jämför elavtal på fel sätt. Titta inte bara på en rubrik eller ett spotpris – jämför det du faktiskt kommer att betala.',
    intent: 'Backlink-vänlig guide med hög kommersiell relevans.',
    primaryCta: { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal' },
    secondaryCta: { label: 'Räkna ditt pris', href: '/#rakna-elpris' },
    sections: [
      { title: 'Vanliga misstag', body: ['Att bara titta på öre/kWh, missa månadsavgift, blanda ihop elnät och elhandel eller inte kontrollera bindningstid.'] },
      { title: 'Så gör du rätt', body: ['Använd rätt elområde, realistisk förbrukning och kontrollera alla avgifter innan du tecknar.'] },
    ],
    bullets: ['Jämför totalpris.', 'Läs villkor och bindningstid.', 'Kontrollera vad som inte ingår.'],
    faq: [
      { question: 'Vad är vanligaste misstaget?', answer: 'Att jämföra ett marknadspris utan att ta med avgifter, moms och avtalsvillkor.' },
      { question: 'Hur vet jag om avtalet är bra?', answer: 'Ett bra avtal är tydligt, passar din förbrukning och har villkor du förstår innan du tecknar.' },
    ],
    related: [
      { label: 'Billigaste elavtalet', href: '/elavtal/billigaste-elavtalet', description: 'Så tänker du kring billigast.' },
      { label: 'Elpris idag', href: '/elpriser/elpris-idag', description: 'Se marknadspriset.' },
      { label: 'Prisvillkor', href: '/prisvillkor', description: 'Läs villkoren.' },
    ],
  },
]

export function findPage(pages: SeoPageContent[], slug: string) {
  return pages.find((page) => page.slug === slug) ?? null
}

export const moneyRoutePaths = elavtalPages.map((page) => page.path)
export const elprisRoutePaths = ['/elpriser', '/elpriser/elpris-idag', ...elprisPages.map((page) => page.path)]
export const guideRoutePaths = ['/guider', ...guidePages.map((page) => page.path)]

export const canonicalPublicRoutes = [
  '/',
  '/elavtal',
  ...moneyRoutePaths,
  ...elprisRoutePaths,
  ...guideRoutePaths,
  '/teckna-avtal',
  '/kundservice',
  '/integritetspolicy',
  '/allmanna-villkor',
  '/angerratt',
  '/prisvillkor',
  '/fullmakt',
  '/cookies',
  '/angerblankett',
  '/foretagsvillkor',
]
