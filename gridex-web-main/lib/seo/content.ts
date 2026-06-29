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
    primaryCta: { label: 'Starta teckning', href: '/teckna-avtal' },
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
      'Teckna online.',
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
      { label: 'Teckna elavtal', href: '/teckna-avtal', description: 'Gå vidare till teckning.' },
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
          'Ja, du kan jämföra och teckna online. Exakta villkor visas innan du tecknar.',
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
          'Jämför totalen: spotpris eller fast pris, påslag, månadsavgift, moms och avtalsvillkor. Gridex visar priset innan du tecknar.',
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
    primaryCta: { label: 'Starta teckning', href: '/teckna-avtal' },
    secondaryCta: { label: 'Läs mer om bytet', href: '/elavtal/byta-elbolag' },
    sections: [
      { title: 'Kontrollera nuvarande avtal', body: ['Se om du har bindningstid, uppsägningstid eller andra villkor innan du väljer startdatum.'] },
      { title: 'Nätägaren ändras inte', body: ['Du behåller nätägaren eftersom nätägaren styrs av din anläggnings geografiska plats.'] },
    ],
    bullets: ['Kontrollera bindningstid.', 'Välj nytt elhandelsavtal.', 'Teckna med rätt uppgifter.'],
    faq: [
      { question: 'Tar det lång tid att byta elbolag?', answer: 'Tiden beror på startdatum, nuvarande avtal och om alla anläggningsuppgifter finns.' },
      { question: 'Måste jag kontakta nätägaren?', answer: 'Normalt hanteras elhandelsbytet utan att du byter nätägare, men kompletteringar kan behövas.' },
    ],
    related: [
      { label: 'Byta elbolag', href: '/elavtal/byta-elbolag', description: 'Produktsida om bytet.' },
      { label: 'Fullmakt', href: '/fullmakt', description: 'Om uppgifter och godkännanden.' },
      { label: 'Teckna elavtal', href: '/teckna-avtal', description: 'Gå vidare till teckning.' },
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



const SEO_COMPETITOR_BATCH_MODIFIED = new Date('2026-06-24T00:00:00.000Z')

type CompetitorSeoPageInput = Omit<SeoPageContent, 'lastModified'>

function competitorSeoPage(input: CompetitorSeoPageInput): SeoPageContent {
  return { ...input, lastModified: SEO_COMPETITOR_BATCH_MODIFIED }
}

function elavtalCompetitorPage(input: Omit<CompetitorSeoPageInput, 'primaryCta' | 'secondaryCta'>): SeoPageContent {
  return competitorSeoPage({
    ...input,
    primaryCta: { label: 'Teckna elavtal', href: '/teckna-avtal' },
    secondaryCta: { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal' },
  })
}

function guideCompetitorPage(input: Omit<CompetitorSeoPageInput, 'primaryCta' | 'secondaryCta'>): SeoPageContent {
  return competitorSeoPage({
    ...input,
    primaryCta: { label: 'Räkna på elpriset', href: '/#rakna-elpris' },
    secondaryCta: { label: 'Se Gridex elavtal', href: '/elavtal' },
  })
}

elavtalPages.push(
  ...[
    elavtalCompetitorPage({
      slug: 'privat',
      path: '/elavtal/privat',
      title: 'Elavtal för privatpersoner – välj elavtal online',
      description: 'Teckna elavtal som privatkund hos Gridex. Se rörligt, fast, kvartspris och tydliga avgifter innan du tecknar.',
      eyebrow: 'Privat elavtal',
      h1: 'Elavtal för privatpersoner',
      lead: 'Gridex hjälper privatkunder att välja elavtal med tydlig prisbild, enkel digital teckning och information om vad som händer efter teckning.',
      intent: 'För privatpersoner som vill förstå och teckna ett elhandelsavtal utan krångliga villkor.',
      sections: [
        { title: 'Välj efter förbrukning och risknivå', body: ['Ett hushåll med låg förbrukning påverkas ofta mer av fasta avgifter, medan ett hushåll med högre förbrukning påverkas mer av kWh-pris och påslag.', 'Gridex visar avtalsdelarna öppet så att du kan välja mellan rörligt, fast och tidsstyrt pris med bättre kontroll.'] },
        { title: 'Digital teckning med tydliga nästa steg', body: ['När du tecknar kontrolleras uppgifter för avtal och anläggning. Om något saknas återkommer Gridex med vad som behöver kompletteras.'] },
      ],
      bullets: ['För villa, lägenhet och fritidshus.', 'Tydliga prisrader innan teckning.', 'Mina sidor när kundprofilen är klar.'],
      faq: [
        { question: 'Kan jag teckna elavtal helt digitalt?', answer: 'Ja, du kan teckna online. Avtalet startar först när uppgifter och marknadsregler tillåter det.' },
        { question: 'Vad behöver jag som privatkund?', answer: 'Du behöver kontaktuppgifter, adress, ungefärlig förbrukning och gärna anläggnings- eller mätpunktsinformation om du har den.' },
      ],
      related: [
        { label: 'Elavtal för villa', href: '/elavtal/villa', description: 'För hushåll med högre förbrukning.' },
        { label: 'Elavtal för lägenhet', href: '/elavtal/lagenhet', description: 'För mindre förbrukning och enkel start.' },
        { label: 'Byta elbolag', href: '/elavtal/byta-elbolag', description: 'Se hur leverantörsbyte fungerar.' },
      ],
    }),
    elavtalCompetitorPage({
      slug: 'foretag',
      path: '/elavtal/foretag',
      title: 'Elavtal för företag – tydlig elhandel för verksamheter',
      description: 'Gridex erbjuder elavtal för företag med tydliga priser, avtalsvillkor och digital hantering från teckning till start.',
      eyebrow: 'Företagsavtal',
      h1: 'Elavtal för företag',
      lead: 'Företag behöver elavtal som är begripliga, enkla att följa upp och tydliga i budgeten. Gridex gör pris, avgifter och nästa steg synliga innan du tecknar.',
      intent: 'För företag som söker ny elleverantör eller vill få bättre kontroll över elhandelsdelen.',
      sections: [
        { title: 'Företag behöver rätt kostnadsbild', body: ['Elkostnaden påverkas av förbrukningsprofil, elområde, avtalsform och avgifter. Därför ska företagsavtal jämföras på total kostnad, inte bara ett kWh-pris.', 'Gridex kan stödja både rörliga och mer förutsägbara upplägg beroende på vad som är publicerat för kunden.'] },
        { title: 'Separera elhandel från elnät', body: ['Elnätsavgiften kommer från nätägaren. Gridex elhandelsavtal gäller elhandelsdelen och visar avgifterna som hör till det avtalet.'] },
      ],
      bullets: ['För aktiebolag och andra verksamheter.', 'Tydlig pris- och avtalsinformation.', 'Digital teckning med spårbara uppgifter.'],
      faq: [
        { question: 'Kan företag teckna elavtal hos Gridex?', answer: 'Ja, företag kan teckna när avtal för företag finns publicerat. Uppgifter kontrolleras innan start.' },
        { question: 'Behöver vi veta årsförbrukningen?', answer: 'Årsförbrukningen gör jämförelsen mer rättvis och hjälper till att uppskatta månadskostnaden.' },
      ],
      related: [
        { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal', description: 'Jämför totalpris och avgifter.' },
        { label: 'Fast elpris', href: '/elavtal/fast-elpris', description: 'För mer förutsägbar kostnad.' },
        { label: 'Rörligt elpris', href: '/elavtal/rorligt-elpris', description: 'För marknadsnära pris.' },
      ],
    }),
    elavtalCompetitorPage({
      slug: 'brf',
      path: '/elavtal/brf',
      title: 'Elavtal för BRF – tydliga villkor för bostadsrättsföreningar',
      description: 'Elavtal för BRF och gemensamma utrymmen. Gridex hjälper föreningar se pris, avgifter och avtalsform tydligt.',
      eyebrow: 'BRF',
      h1: 'Elavtal för bostadsrättsföreningar',
      lead: 'En BRF behöver ett elavtal som går att förklara för styrelsen och följa upp över tid. Gridex fokuserar på tydlig prisstruktur och enkel digital process.',
      intent: 'För bostadsrättsföreningar som jämför elleverantör för gemensamma abonnemang.',
      sections: [
        { title: 'Jämför med föreningens faktiska förbrukning', body: ['Gemensam el, belysning, tvättstuga, garage och laddning kan ge olika förbrukningsmönster. Därför bör BRF jämföra avtal utifrån egen historik.', 'Gridex visar de viktigaste prisdelarna så att styrelsen kan fatta ett informerat beslut.'] },
        { title: 'Tydlig dokumentation', body: ['För en förening är det extra viktigt att villkor, startdatum och kontaktuppgifter är tydliga. Teckning samlar informationen digitalt.'] },
      ],
      bullets: ['För gemensamma elabonnemang.', 'Passar styrelsebeslut och uppföljning.', 'Tydligt om påslag och fasta avgifter.'],
      faq: [
        { question: 'Kan en BRF teckna elavtal digitalt?', answer: 'Ja, men Gridex kan behöva organisationsuppgifter, kontaktperson och anläggningsuppgifter innan avtalet kan starta.' },
        { question: 'Vad ska styrelsen jämföra?', answer: 'Jämför total kostnad, avtalsform, bindningstid, månadsavgift, påslag och hur priset följer marknaden.' },
      ],
      related: [
        { label: 'Elavtal för företag', href: '/elavtal/foretag', description: 'För juridiska personer och verksamheter.' },
        { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal', description: 'Se hur jämförelsen bör göras.' },
        { label: 'Elpris med moms', href: '/elpriser/elpris-med-moms', description: 'Förstå prisets delar.' },
      ],
    }),
  ],
)

const homeTypePages: Array<{ slug: string; label: string; lead: string; bullets: string[] }> = [
  { slug: 'villa', label: 'villa', lead: 'Villor har ofta högre förbrukning än lägenheter, särskilt med elvärme, värmepump eller elbil. Därför spelar både påslag och avtalsform stor roll.', bullets: ['Jämför utifrån årsförbrukning.', 'Se hur värme och elbil påverkar kostnaden.', 'Välj avtal efter risknivå och flexibilitet.'] },
  { slug: 'hus', label: 'hus', lead: 'Ett hus kan ha stora skillnader i elförbrukning beroende på uppvärmning, storlek och vanor. Rätt elavtal behöver därför utgå från hushållets faktiska behov.', bullets: ['Passar hushåll med varierande förbrukning.', 'Tydlig jämförelse av månadsavgift och påslag.', 'Bra koppling till prisräknaren.'] },
  { slug: 'lagenhet', label: 'lägenhet', lead: 'Lägenheter har ofta lägre elförbrukning. Då blir fasta avgifter extra viktiga att jämföra eftersom de kan påverka totalpriset mer än man tror.', bullets: ['Låg förbrukning kräver fokus på fasta avgifter.', 'Enkel digital teckning.', 'Bra för första egna elavtalet.'] },
  { slug: 'bostadsratt', label: 'bostadsrätt', lead: 'I en bostadsrätt tecknar du ofta eget elhandelsavtal för hushållselen medan föreningen ansvarar för andra delar. Gridex gör det tydligt vad elhandelsavtalet gäller.', bullets: ['För hushållsel i bostadsrätt.', 'Tydlig startprocess.', 'Jämför totalpris före teckning.'] },
  { slug: 'hyresratt', label: 'hyresrätt', lead: 'I hyresrätt behöver du ofta själv välja elleverantör för hushållselen. Kontrollera vad som ingår i hyran och teckna rätt elhandelsavtal för din lägenhet.', bullets: ['Passar dig som flyttar in i hyresrätt.', 'Kontrollera inflyttningsdatum.', 'Se fasta avgifter tydligt.'] },
  { slug: 'radhus', label: 'radhus', lead: 'Radhus kan ligga mellan lägenhet och villa i förbrukning. Värme, hushållsel och eventuell laddning gör att avtalsform och avgifter behöver jämföras noggrant.', bullets: ['För hushåll med medelhög förbrukning.', 'Jämför med faktisk årsförbrukning.', 'Se elområde och avtalstyp.'] },
  { slug: 'fritidshus', label: 'fritidshus', lead: 'Fritidshus kan ha låg årsförbrukning men periodvis hög användning. Då blir både månadsavgift och säsongsförbrukning viktiga i jämförelsen.', bullets: ['För säsongsboende och stugor.', 'Kontrollera fasta avgifter.', 'Välj efter användningsmönster.'] },
  { slug: 'sommarstuga', label: 'sommarstuga', lead: 'För en sommarstuga bör elavtalet anpassas efter hur ofta den används. En låg månadsavgift kan vara viktig när förbrukningen är begränsad.', bullets: ['Bra för låg eller säsongsvis förbrukning.', 'Titta på totalpris per år.', 'Undvik onödigt höga fasta avgifter.'] },
]

elavtalPages.push(
  ...homeTypePages.map((page) =>
    elavtalCompetitorPage({
      slug: page.slug,
      path: `/elavtal/${page.slug}`,
      title: `Elavtal för ${page.label} – jämför rätt pris och avgifter`,
      description: `Se vad du bör tänka på när du väljer elavtal för ${page.label}. Gridex visar pris, avgifter och avtalsform tydligt innan teckning.`,
      eyebrow: `Elavtal för ${page.label}`,
      h1: `Elavtal för ${page.label}`,
      lead: page.lead,
      intent: `För kunder som söker elavtal anpassat efter boendeformen ${page.label}.`,
      sections: [
        { title: 'Jämför utifrån din faktiska förbrukning', body: ['Använd tidigare faktura eller uppskattad årsförbrukning för att få en mer rättvis bild av kostnaden.', 'Gridex prisräknare hjälper dig se hur pris och avgifter påverkar totalen.'] },
        { title: 'Tänk på elområde och avtalsform', body: ['Elpriset kan skilja sig mellan SE1–SE4. Rörligt, fast och kvartspris passar olika hushåll beroende på risknivå och möjlighet att styra förbrukningen.'] },
      ],
      bullets: page.bullets,
      faq: [
        { question: `Vilket elavtal passar för ${page.label}?`, answer: 'Det beror på årsförbrukning, elområde, uppvärmning och hur mycket förutsägbarhet du vill ha.' },
        { question: 'Är månadsavgiften viktig?', answer: 'Ja, särskilt vid lägre förbrukning. Jämför alltid månadsavgift tillsammans med kWh-pris och påslag.' },
      ],
      related: [
        { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal', description: 'Jämför avtalsformer och avgifter.' },
        { label: 'Elpris idag', href: '/elpriser/elpris-idag', description: 'Se aktuellt elpris per elområde.' },
        { label: 'Så läser du elfakturan', href: '/guider/sa-laser-du-din-elfaktura', description: 'Hitta förbrukning och avgifter.' },
      ],
    }),
  ),
)

elavtalPages.push(
  ...[
    { slug: 'avtalsformer', label: 'avtalsformer', h1: 'Olika avtalsformer för el', lead: 'Rörligt, fast, mixpris, portfölj och kvartspris ger olika balans mellan prisrisk och förutsägbarhet.' },
    { slug: 'mixpris', label: 'mixpris el', h1: 'Mixpris på elavtal', lead: 'Mixpris kombinerar flera prissättningsdelar. Det kan ge en balans mellan marknadspris och mer förvaltad prisbild.' },
    { slug: 'portfoljpris', label: 'portföljpris el', h1: 'Portföljpris på el', lead: 'Portföljpris innebär att en del av priset kan bygga på en förvaltad inköpsstrategi. Kunden ska alltid se hur modellen fungerar innan teckning.' },
    { slug: 'anvisningspris', label: 'anvisningspris', h1: 'Vad är anvisningspris på el?', lead: 'Anvisningspris kan uppstå när kunden inte själv har valt elhandelsavtal. Det är viktigt att jämföra mot ett aktivt valt avtal.' },
    { slug: 'tillsvidarepris', label: 'tillsvidarepris', h1: 'Tillsvidarepris på el', lead: 'Tillsvidarepris är ofta mindre aktivt valt av kunden. Kontrollera alltid villkor och jämför mot aktuella elavtal.' },
    { slug: 'vintersakrat-elpris', label: 'vintersäkrat elpris', h1: 'Vintersäkrat elpris', lead: 'Vintersäkring handlar om att minska risken för höga kostnader under kalla månader. Det kräver tydliga villkor och rätt förväntningar.' },
    { slug: 'el-till-inkopspris', label: 'el till inköpspris', h1: 'El till inköpspris – vad betyder det?', lead: 'Begreppet inköpspris kan vara missvisande om påslag, avgifter eller moms tillkommer. Därför ska varje prisrad vara tydlig.' },
    { slug: 'byta-elleverantor', label: 'byta elleverantör', h1: 'Byta elleverantör', lead: 'När du byter elleverantör byter du elhandelsbolag, inte nätägare. Gridex visar vad som behövs för ett tryggt byte.' },
    { slug: 'flytta-elavtal', label: 'flytta elavtal', h1: 'Flytta elavtal', lead: 'Vid flytt behöver du ofta teckna eller flytta elavtal i god tid så att elen fungerar från rätt startdatum.' },
    { slug: 'teckna-elavtal-vid-flytt', label: 'teckna elavtal vid flytt', h1: 'Teckna elavtal vid flytt', lead: 'När du flyttar är adress, inflyttningsdatum och anläggningsuppgifter centrala för att avtalet ska kunna starta korrekt.' },
    { slug: 'uppsagningstid-elavtal', label: 'uppsägningstid elavtal', h1: 'Uppsägningstid på elavtal', lead: 'Kontrollera alltid uppsägningstid innan du byter elbolag. Det minskar risken för dubbla kostnader eller fel startdatum.' },
    { slug: 'bindningstid-elavtal', label: 'bindningstid elavtal', h1: 'Bindningstid på elavtal', lead: 'Bindningstid påverkar när du kan byta elavtal och vilka villkor som gäller under perioden.' },
  ].map((page) =>
    elavtalCompetitorPage({
      slug: page.slug,
      path: `/elavtal/${page.slug}`,
      title: `${page.h1} – guide från Gridex`,
      description: `Lär dig mer om ${page.label}. Gridex förklarar pris, villkor och vad du bör kontrollera innan du väljer elavtal.`,
      eyebrow: page.h1,
      h1: page.h1,
      lead: page.lead,
      intent: `För kunder som söker information om ${page.label} innan de väljer elavtal.`,
      sections: [
        { title: 'Det viktigaste att kontrollera', body: ['Se hur priset beräknas, vilka avgifter som tillkommer och om avtalet har bindningstid eller särskilda villkor.', 'En tydlig jämförelse ska visa totalpris för din förbrukning, inte bara en enskild prisrad.'] },
        { title: 'Så använder du informationen', body: ['Börja med ditt elområde och din ungefärliga årsförbrukning. Jämför därefter avtalsform och avgifter innan du tecknar.'] },
      ],
      bullets: ['Kontrollera pris, påslag och månadsavgift.', 'Läs villkor innan teckning.', 'Jämför alltid total kostnad.'],
      faq: [
        { question: `Varför är ${page.label} viktigt?`, answer: 'Det påverkar både kostnad, risk och hur lätt det är att byta eller följa upp avtalet.' },
        { question: 'Hur jämför jag rätt?', answer: 'Använd samma förbrukning, samma elområde och räkna med både rörliga och fasta avgifter.' },
      ],
      related: [
        { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal', description: 'Se helheten före val.' },
        { label: 'Billigt elavtal', href: '/elavtal/billigt-elavtal', description: 'Förstå vad som driver kostnaden.' },
        { label: 'Prisvillkor', href: '/prisvillkor', description: 'Läs Gridex prisinformation.' },
      ],
    }),
  ),
)

elprisPages.push(
  ...[
    { slug: 'morgondagens-elpris', h1: 'Morgondagens elpris', label: 'morgondagens elpris', lead: 'Morgondagens elpris är relevant för dig som vill planera förbrukning, laddning eller uppvärmning efter kommande marknadspris.' },
    { slug: 'negativt-elpris', h1: 'Negativt elpris', label: 'negativt elpris', lead: 'Negativt elpris kan uppstå när produktionen är hög och efterfrågan låg. Slutpriset påverkas ändå av avgifter, moms och elnät.' },
    { slug: 'nord-pool', h1: 'Nord Pool och elpriset', label: 'Nord Pool', lead: 'Nord Pool är elbörsen där spotpriset sätts. Priset påverkar många rörliga elavtal men är inte samma sak som kundens slutpris.' },
    { slug: 'elborsen', h1: 'Elbörsen och spotpris', label: 'elbörsen', lead: 'Elbörsen speglar marknadspriset på el. För kunden behöver börspriset kombineras med avtalets påslag, avgifter och moms.' },
    { slug: 'elpris-per-kwh', h1: 'Elpris per kWh', label: 'elpris per kWh', lead: 'Elpris per kWh visar kostnaden per förbrukad kilowattimme, men totalen beror också på fasta avgifter och hur mycket el du använder.' },
    { slug: 'elpris-med-moms', h1: 'Elpris med moms', label: 'elpris med moms', lead: 'Moms läggs normalt ovanpå elhandelsprisets delar. Jämför därför pris både före och efter moms när du räknar hushållets kostnad.' },
    { slug: 'elpris-utan-moms', h1: 'Elpris utan moms', label: 'elpris utan moms', lead: 'Elpris utan moms kan vara relevant för jämförelse och företagskalkyler, men privatkunden behöver oftast se priset inklusive moms.' },
    { slug: 'elpris-vinter', h1: 'Elpris på vintern', label: 'elpris vinter', lead: 'Vinterpriser påverkas ofta av högre förbrukning, väder och produktionsläge. Hushåll med elvärme bör räkna på vintermånaderna extra noga.' },
    { slug: 'elpris-sommar', h1: 'Elpris på sommaren', label: 'elpris sommar', lead: 'Sommarens elpris påverkas av lägre förbrukning, väder, vattennivåer och produktionsmix. Det kan skilja sig från vinterkostnaden.' },
  ].map((page) =>
    competitorSeoPage({
      slug: page.slug,
      path: `/elpriser/${page.slug}`,
      title: `${page.h1} – förstå priset med Gridex`,
      description: `Läs om ${page.label}, spotpris, elområde och vad som påverkar totalpriset på elavtalet.`,
      eyebrow: page.h1,
      h1: page.h1,
      lead: page.lead,
      intent: `För kunder som söker ${page.label} och vill förstå hur marknadspriset påverkar elavtalet.`,
      primaryCta: { label: 'Se elpris idag', href: '/elpriser/elpris-idag' },
      secondaryCta: { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal' },
      sections: [
        { title: 'Marknadspris är inte hela fakturan', body: ['Spotpris och börspris visar elens marknadspris. Kundens slutpris påverkas även av avtalets påslag, månadsavgift, moms och elnätskostnader.', 'Därför ska du använda marknadspriset som signal och sedan räkna på totalen för ditt hushåll eller företag.'] },
        { title: 'Elområde spelar roll', body: ['Sverige är indelat i SE1, SE2, SE3 och SE4. Samma dag kan elpriset skilja sig mellan områden, vilket gör att rätt elområde behövs för jämförelsen.'] },
      ],
      bullets: ['Se priset per elområde.', 'Räkna med påslag och avgifter.', 'Jämför mot rätt avtalsform.'],
      faq: [
        { question: `Är ${page.label} samma som mitt slutpris?`, answer: 'Nej, slutpriset påverkas av avtalets avgifter, moms och elnätskostnader utöver marknadspriset.' },
        { question: 'Hur använder jag prisinformationen?', answer: 'Använd den för att förstå marknadsläget och jämför sedan elavtal med din egen förbrukning.' },
      ],
      related: [
        { label: 'Elpris idag', href: '/elpriser/elpris-idag', description: 'Aktuellt pris per elområde.' },
        { label: 'Spotpris el', href: '/elpriser/spotpris-el', description: 'Förstå spotpriset.' },
        { label: 'Rörligt elpris', href: '/elavtal/rorligt-elpris', description: 'Se hur rörligt avtal fungerar.' },
      ],
    }),
  ),
)

const cityPricePages: Array<{ slug: string; city: string; area: string; region?: string }> = [
  { slug: 'helsingborg', city: 'Helsingborg', area: 'SE4', region: 'Skåne' },
  { slug: 'lund', city: 'Lund', area: 'SE4', region: 'Skåne' },
  { slug: 'trelleborg', city: 'Trelleborg', area: 'SE4', region: 'Skåne' },
  { slug: 'kristianstad', city: 'Kristianstad', area: 'SE4', region: 'Skåne' },
  { slug: 'uppsala', city: 'Uppsala', area: 'SE3' },
  { slug: 'vasteras', city: 'Västerås', area: 'SE3' },
  { slug: 'orebro', city: 'Örebro', area: 'SE3' },
  { slug: 'linkoping', city: 'Linköping', area: 'SE3' },
  { slug: 'jonkoping', city: 'Jönköping', area: 'SE3' },
  { slug: 'umea', city: 'Umeå', area: 'SE2' },
  { slug: 'lulea', city: 'Luleå', area: 'SE1' },
]

elprisPages.push(
  ...cityPricePages.map((page) =>
    competitorSeoPage({
      slug: page.slug,
      path: `/elpriser/${page.slug}`,
      title: `Elpris i ${page.city} – se elområde ${page.area}`,
      description: `Se hur elpris i ${page.city} hänger ihop med elområde ${page.area}, förbrukning och val av elavtal hos Gridex.`,
      eyebrow: `Elpris ${page.city}`,
      h1: `Elpris i ${page.city}`,
      lead: `${page.city}${page.region ? ` i ${page.region}` : ''} tillhör normalt elområde ${page.area}. Det betyder att spotpriset ska jämföras mot rätt område innan du väljer elavtal.`,
      intent: `Lokal SEO-sida för kunder som söker elpris i ${page.city} och behöver koppla det till rätt elområde.`,
      primaryCta: { label: 'Se elpris idag', href: '/elpriser/elpris-idag' },
      secondaryCta: { label: 'Teckna elavtal', href: '/teckna-avtal' },
      sections: [
        { title: `Så påverkas elpriset i ${page.city}`, body: [`Det lokala elpriset styrs av elområde ${page.area}, marknadsläge och hur avtalet är uppbyggt. Elnätsavgiften faktureras separat av nätägaren.`, 'Använd prisräknaren för att se hur förbrukning och avtalsform påverkar den uppskattade kostnaden.'] },
        { title: 'Jämför innan du tecknar', body: ['Titta på spotpris, påslag, månadsavgift, moms och bindningstid. Det ger en mer rättvis bild än att bara titta på ett dagspris.'] },
      ],
      bullets: [`Elområde: ${page.area}.`, 'Spotpris är marknadspris, inte hela fakturan.', 'Jämför med din årsförbrukning.'],
      faq: [
        { question: `Vilket elområde gäller för ${page.city}?`, answer: `${page.city} ligger normalt i ${page.area}. Kontrollera alltid adressen om du är osäker.` },
        { question: 'Kan jag teckna elavtal direkt?', answer: 'Ja, du kan teckna online. Uppgifter kontrolleras innan avtalet startar.' },
      ],
      related: [
        { label: `Elpris ${page.area}`, href: `/elpriser/${page.area.toLowerCase()}`, description: 'Se elområdessidan.' },
        { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal', description: 'Jämför rätt kostnad.' },
        { label: 'Byta elbolag', href: '/elavtal/byta-elbolag', description: 'Så fungerar bytet.' },
      ],
    }),
  ),
)

guidePages.push(
  ...[
    { slug: 'spotpris-vs-rorligt-elpris', h1: 'Spotpris vs rörligt elpris', label: 'spotpris och rörligt elpris', lead: 'Spotpris är marknadspriset på elbörsen. Rörligt elpris är avtalspriset som ofta bygger på spotpris plus avgifter och moms.' },
    { slug: 'innan-du-tecknar-elavtal', h1: 'Innan du tecknar elavtal', label: 'checklista före elavtal', lead: 'Kontrollera pris, avgifter, bindningstid, startdatum och vad som inte ingår innan du tecknar.' },
    { slug: 'kontrollera-elavtal', h1: 'Kontrollera ditt elavtal', label: 'kontrollera elavtal', lead: 'Ett elavtal ska gå att förstå. Se över avtalsform, påslag, månadsavgift, uppsägningstid och om priset är inklusive moms.' },
    { slug: 'rabatter-pa-elavtal', h1: 'Rabatter på elavtal', label: 'rabatter på elavtal', lead: 'Rabatter kan vara tillfälliga. Jämför vad avtalet kostar när rabatten är slut och kontrollera alla fasta avgifter.' },
    { slug: 'bindningstid-och-uppsagningstid', h1: 'Bindningstid och uppsägningstid', label: 'bindningstid och uppsägningstid', lead: 'Bindningstid och uppsägningstid påverkar när du kan byta elbolag och hur startdatum ska planeras.' },
    { slug: 'anvisat-elavtal', h1: 'Anvisat elavtal', label: 'anvisat elavtal', lead: 'Ett anvisat elavtal kan gälla om du inte aktivt valt elleverantör. Det är ofta värt att jämföra mot ett eget valt avtal.' },
    { slug: 'undvik-dolda-avgifter', h1: 'Undvik dolda avgifter på elavtal', label: 'dolda avgifter', lead: 'Ett tydligt elavtal ska visa påslag, månadsavgift, fakturaavgift, moms och vad som ligger utanför elhandelspriset.' },
    { slug: 'energieffektivisera-hemmet', h1: 'Energieffektivisera hemmet', label: 'energieffektivisering', lead: 'Lägre förbrukning kan vara lika viktigt som rätt elavtal. Börja med de åtgärder som ger störst effekt utan att försämra vardagen.' },
    { slug: 'anvanda-mindre-el', h1: 'Använda mindre el', label: 'minska elanvändning', lead: 'Smarta vanor, rätt uppvärmning och bättre styrning kan sänka elanvändningen över tid.' },
    { slug: 'styr-din-elanvandning', h1: 'Styr din elanvändning', label: 'styra elanvändning', lead: 'Med tim- eller kvartsnära prissignaler kan vissa hushåll flytta förbrukning till billigare timmar.' },
    { slug: 'ladda-elbil-billigare', h1: 'Ladda elbil billigare', label: 'ladda elbil billigare', lead: 'Elbilsladdning kan påverka elförbrukningen mycket. Styr laddningen och jämför avtal med rätt årsförbrukning.' },
    { slug: 'varmepump-elforbrukning', h1: 'Värmepump och elförbrukning', label: 'värmepump elförbrukning', lead: 'Värmepump kan sänka uppvärmningskostnaden men påverkar fortfarande elanvändningen. Följ upp förbrukningen per säsong.' },
    { slug: 'vad-drar-mest-el-i-hemmet', h1: 'Vad drar mest el i hemmet?', label: 'vad drar mest el', lead: 'Uppvärmning, varmvatten, elbilsladdning, torktumlare och äldre apparater kan stå för stor del av förbrukningen.' },
    { slug: 'sanka-elkostnaden', h1: 'Sänka elkostnaden', label: 'sänka elkostnaden', lead: 'Du kan sänka elkostnaden genom att minska förbrukning, jämföra avtal och undvika onödiga fasta avgifter.' },
  ].map((page) =>
    guideCompetitorPage({
      slug: page.slug,
      path: `/guider/${page.slug}`,
      title: `${page.h1} – guide från Gridex`,
      description: `Gridex förklarar ${page.label} med fokus på elpris, avtal, förbrukning och tydliga beslut för svenska elkunder.`,
      eyebrow: page.h1,
      h1: page.h1,
      lead: page.lead,
      intent: `Guide för kunder som vill förstå ${page.label} innan de jämför eller tecknar elavtal.`,
      sections: [
        { title: 'Börja med helheten', body: ['Elkostnaden påverkas av både elavtal, förbrukning, elområde, moms och elnätsavgifter. En bra jämförelse börjar därför med totalen.', 'Använd guiden som stöd och kontrollera sedan avtalsinformationen innan du tecknar.'] },
        { title: 'Gör jämförelsen konkret', body: ['Ta fram tidigare årsförbrukning, kontrollera elområde och titta på både rörliga och fasta avgifter. Då blir nästa steg mer tillförlitligt.'] },
      ],
      bullets: ['Förstå kostnaden innan du väljer.', 'Jämför pris och villkor tillsammans.', 'Använd rätt elområde och förbrukning.'],
      faq: [
        { question: `Varför är ${page.label} viktigt?`, answer: 'Det hjälper dig fatta ett bättre beslut och undvika att bara jämföra en enskild prisrad.' },
        { question: 'Vad är nästa steg?', answer: 'Räkna på din förbrukning, jämför avtalsformer och kontrollera villkoren innan du tecknar.' },
      ],
      related: [
        { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal', description: 'Gå från guide till val.' },
        { label: 'Elpris idag', href: '/elpriser/elpris-idag', description: 'Se marknadsläget.' },
        { label: 'Teckna elavtal', href: '/teckna-avtal', description: 'Teckna digitalt.' },
      ],
    }),
  ),
)

export const glossaryPages: SeoPageContent[] = [
  { slug: 'kwh', label: 'kWh', title: 'kWh – kilowattimme', description: 'kWh betyder kilowattimme och används för att mäta elförbrukning.' },
  { slug: 'spotpris', label: 'spotpris', title: 'Spotpris', description: 'Spotpris är marknadspriset på el som sätts på elbörsen.' },
  { slug: 'paslag', label: 'påslag', title: 'Påslag på elpris', description: 'Påslag är en kostnad som kan läggas ovanpå marknadspriset i elavtalet.' },
  { slug: 'elnatsavgift', label: 'elnätsavgift', title: 'Elnätsavgift', description: 'Elnätsavgift är kostnaden till nätägaren för elnätet och ingår normalt inte i elhandelspriset.' },
  { slug: 'elhandelspris', label: 'elhandelspris', title: 'Elhandelspris', description: 'Elhandelspris är priset för elen du köper från elleverantören.' },
  { slug: 'elomrade', label: 'elområde', title: 'Elområde', description: 'Sverige är indelat i elområdena SE1, SE2, SE3 och SE4.' },
  { slug: 'forbrukning', label: 'förbrukning', title: 'Elförbrukning', description: 'Elförbrukning visar hur mycket el du använder under en period.' },
  { slug: 'anlaggnings-id', label: 'anläggnings-ID', title: 'Anläggnings-ID', description: 'Anläggnings-ID identifierar elanslutningen för en anläggning.' },
  { slug: 'matpunkt', label: 'mätpunkt', title: 'Mätpunkt', description: 'Mätpunkten används för att mäta och rapportera elförbrukningen.' },
  { slug: 'nord-pool', label: 'Nord Pool', title: 'Nord Pool', description: 'Nord Pool är elbörsen där spotpriset fastställs.' },
  { slug: 'bindningstid', label: 'bindningstid', title: 'Bindningstid', description: 'Bindningstid är perioden då avtalet gäller enligt villkoren.' },
  { slug: 'uppsagningstid', label: 'uppsägningstid', title: 'Uppsägningstid', description: 'Uppsägningstid påverkar när avtalet kan avslutas eller bytas.' },
].map((item) =>
  competitorSeoPage({
    slug: item.slug,
    path: `/ordlista/${item.slug}`,
    title: `${item.title} – förklaring från Gridex`,
    description: item.description,
    eyebrow: 'Ordlista',
    h1: item.title,
    lead: `${item.label} är ett vanligt begrepp när du jämför elavtal, elpris och fakturor. Här förklarar Gridex vad det betyder i praktiken.`,
    intent: `Ordlistesida för begreppet ${item.label}.`,
    primaryCta: { label: 'Se ordlistan', href: '/ordlista' },
    secondaryCta: { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal' },
    sections: [
      { title: `Vad betyder ${item.label}?`, body: [item.description, 'Begreppet är viktigt eftersom det påverkar hur du läser pris, avtal och faktura.'] },
      { title: 'Varför spelar det roll?', body: ['När du förstår begreppen blir det lättare att jämföra elavtal och undvika missförstånd kring totalpriset.'] },
    ],
    bullets: ['Används vid elavtal och faktura.', 'Påverkar hur du jämför pris.', 'Bra att känna till innan du tecknar.'],
    faq: [
      { question: `Vad betyder ${item.label}?`, answer: item.description },
      { question: 'Var hittar jag det på fakturan?', answer: 'Det beror på begreppet. Prisdelar, förbrukning och avgifter visas normalt i fakturans specifikation eller avtalsvillkor.' },
    ],
    related: [
      { label: 'Så läser du elfakturan', href: '/guider/sa-laser-du-din-elfaktura', description: 'Förstå begreppen på fakturan.' },
      { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal', description: 'Använd begreppen i jämförelsen.' },
      { label: 'Elpris idag', href: '/elpriser/elpris-idag', description: 'Se aktuellt pris.' },
    ],
  }),
)

export const marketPages: SeoPageContent[] = [
  competitorSeoPage({
    slug: 'elbolag',
    path: '/elbolag',
    title: 'Elbolag i Sverige – förstå skillnaden innan du byter',
    description: 'Lär dig vad ett elbolag gör, hur elhandel skiljer sig från elnät och vad du bör jämföra innan du väljer elleverantör.',
    eyebrow: 'Elbolag',
    h1: 'Elbolag i Sverige',
    lead: 'Ett elbolag säljer elhandelsavtal till kunder. Nätägaren ansvarar för elnätet. Den skillnaden är viktig när du jämför kostnader.',
    intent: 'Informativ sida för kunder som söker elbolag och vill förstå marknaden innan de väljer.',
    primaryCta: { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal' },
    secondaryCta: { label: 'Teckna hos Gridex', href: '/teckna-avtal' },
    sections: [
      { title: 'Elhandel och elnät är olika saker', body: ['Du kan välja elhandelsbolag, men nätägare beror på var anläggningen finns. Därför består elkostnaden ofta av två delar: elhandel och elnät.'] },
      { title: 'Så jämför du elbolag', body: ['Titta på avtalsform, pris, påslag, månadsavgift, bindningstid, kundprocess och tydlighet i villkoren.'] },
    ],
    bullets: ['Elbolag säljer elhandelsavtal.', 'Nätägaren hanterar elnätet.', 'Jämför totalpris och villkor.'],
    faq: [
      { question: 'Kan jag välja nätägare?', answer: 'Nej, nätägaren styrs av var anläggningen ligger. Du kan däremot välja elhandelsbolag.' },
      { question: 'Vad ska jag jämföra mellan elbolag?', answer: 'Jämför pris, påslag, fasta avgifter, villkor och hur tydlig kundprocessen är.' },
    ],
    related: [
      { label: 'Gridex El AB', href: '/elbolag/gridex-el-ab', description: 'Läs om Gridex som elleverantör.' },
      { label: 'Byta från annat elbolag', href: '/elbolag/byta-fran-annat-elbolag', description: 'Så går bytet till.' },
      { label: 'Nätägare', href: '/natagare', description: 'Förstå elnätets roll.' },
    ],
  }),
  competitorSeoPage({
    slug: 'elhandlare',
    path: '/elhandlare',
    title: 'Elhandlare – vad gör en elleverantör?',
    description: 'En elhandlare säljer elavtal till kunder. Gridex förklarar skillnaden mellan elhandlare, elbolag och nätägare.',
    eyebrow: 'Elhandlare',
    h1: 'Vad gör en elhandlare?',
    lead: 'En elhandlare köper och säljer el genom elhandelsavtal. Kunden betalar elhandlaren för elhandelsdelen och nätägaren för elnätsdelen.',
    intent: 'För sökningar kring elhandlare och elleverantör där kunden behöver grundförståelse.',
    primaryCta: { label: 'Se Gridex elavtal', href: '/elavtal' },
    secondaryCta: { label: 'Läs om elbolag', href: '/elbolag' },
    sections: [
      { title: 'Elhandlarens roll', body: ['Elhandlaren ansvarar för avtalet, prissättningen och relationen kring elhandelsdelen. Nätägaren sköter elnätet och mätningen.'] },
      { title: 'Välj med tydlighet', body: ['Ett bra elhandelsavtal ska visa hur priset byggs upp, vad som ingår och vad som faktureras separat.'] },
    ],
    bullets: ['Elhandlare = elleverantör för elavtal.', 'Nätavgift ligger separat.', 'Tydliga villkor minskar risken för fel beslut.'],
    faq: [
      { question: 'Är elhandlare och elbolag samma sak?', answer: 'Ofta används orden liknande, men elhandlare syftar särskilt på den aktör som säljer elhandelsavtal.' },
      { question: 'Byter jag elnät när jag byter elhandlare?', answer: 'Nej, normalt byter du bara elhandelsavtal.' },
    ],
    related: [
      { label: 'Byta elleverantör', href: '/elavtal/byta-elleverantor', description: 'Så fungerar bytet.' },
      { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal', description: 'Jämför rätt delar.' },
      { label: 'Nätägare', href: '/natagare', description: 'Se skillnaden mot elnät.' },
    ],
  }),
  competitorSeoPage({
    slug: 'natagare',
    path: '/natagare',
    title: 'Nätägare – förstå elnät och elnätsavgift',
    description: 'Nätägaren ansvarar för elnätet där du bor. Gridex förklarar skillnaden mellan nätägare och elleverantör.',
    eyebrow: 'Nätägare',
    h1: 'Vad är en nätägare?',
    lead: 'Nätägaren ansvarar för ledningar, mätning och elnätet i ditt område. Du kan normalt inte välja nätägare, men du kan välja elhandelsbolag.',
    intent: 'För kunder som blandar ihop nätägare och elhandelsbolag.',
    primaryCta: { label: 'Läs om elnätsavgift', href: '/natagare/elnatsavgift' },
    secondaryCta: { label: 'Jämför elavtal', href: '/elavtal/jamfor-elavtal' },
    sections: [
      { title: 'Nätägaren sköter elnätet', body: ['Nätägaren ansvarar för infrastrukturen och fakturerar elnätsavgiften. Det är separat från elhandelsavtalet hos en elleverantör.'] },
      { title: 'Varför spelar det roll?', body: ['När du jämför elavtal ska du inte blanda ihop elhandelspris med nätavgift. Elnätskostnaden påverkas av nätägaren och reglerade villkor.'] },
    ],
    bullets: ['Nätägare väljs efter adress.', 'Elhandelsbolag kan du välja.', 'Elnätsavgift är separat från elhandelspris.'],
    faq: [
      { question: 'Kan jag byta nätägare?', answer: 'Nej, normalt inte. Nätägaren beror på var anläggningen är ansluten.' },
      { question: 'Varför får jag två fakturor?', answer: 'I vissa fall faktureras elhandel och elnät separat eftersom de kommer från olika aktörer.' },
    ],
    related: [
      { label: 'Elnätsavgift', href: '/natagare/elnatsavgift', description: 'Förstå nätkostnaden.' },
      { label: 'Elnätsavgift vs elhandelspris', href: '/guider/elnatsavgift-vs-elhandelspris', description: 'Se skillnaden.' },
      { label: 'Elbolag', href: '/elbolag', description: 'Förstå elhandelsdelen.' },
    ],
  }),
  competitorSeoPage({
    slug: 'elnatsavgift',
    path: '/natagare/elnatsavgift',
    title: 'Elnätsavgift – vad ingår och vem tar betalt?',
    description: 'Elnätsavgiften kommer från nätägaren och är separat från elhandelspriset. Gridex förklarar skillnaden.',
    eyebrow: 'Elnätsavgift',
    h1: 'Elnätsavgift är inte samma sak som elhandelspris',
    lead: 'Elnätsavgiften betalas till nätägaren för att elen ska kunna transporteras till din anläggning. Den ingår normalt inte i Gridex elhandelspris.',
    intent: 'För kunder som vill förstå varför elräkningen består av flera delar.',
    primaryCta: { label: 'Jämför elhandelsavtal', href: '/elavtal/jamfor-elavtal' },
    secondaryCta: { label: 'Läs om nätägare', href: '/natagare' },
    sections: [
      { title: 'Två olika kostnader', body: ['Elhandelspriset gäller elen du köper. Elnätsavgiften gäller elnätet och faktureras av nätägaren enligt dennes villkor.'] },
      { title: 'Så jämför du ändå rätt', body: ['När du väljer elhandelsavtal ska du fokusera på elhandelsdelens pris och villkor, men komma ihåg att elnätsavgiften tillkommer i hushållets totala elkostnad.'] },
    ],
    bullets: ['Faktureras av nätägaren.', 'Ingår normalt inte i elhandelspriset.', 'Påverkar total elkostnad.'],
    faq: [
      { question: 'Ingår elnätsavgift i Gridex elavtal?', answer: 'Nej, elnätsavgiften hanteras normalt av nätägaren och ligger separat från elhandelsavtalet.' },
      { question: 'Kan jag påverka elnätsavgiften?', answer: 'Du kan normalt inte välja nätägare, men förbrukning och abonnemang kan påverka vissa delar enligt nätägarens villkor.' },
    ],
    related: [
      { label: 'Elnätsavgift vs elhandelspris', href: '/guider/elnatsavgift-vs-elhandelspris', description: 'Fördjupad guide.' },
      { label: 'Så läser du elfakturan', href: '/guider/sa-laser-du-din-elfaktura', description: 'Se fakturans delar.' },
      { label: 'Elpris med moms', href: '/elpriser/elpris-med-moms', description: 'Förstå priset inklusive moms.' },
    ],
  }),
  competitorSeoPage({
    slug: 'gridex-el-ab',
    path: '/elbolag/gridex-el-ab',
    title: 'Gridex El AB – svensk elleverantör',
    description: 'Gridex El AB är en svensk elleverantör med fokus på tydliga elavtal, digital teckning och transparent prisinformation.',
    eyebrow: 'Gridex El AB',
    h1: 'Gridex El AB som elleverantör',
    lead: 'Gridex El AB erbjuder elavtal med fokus på tydlighet, digital hantering och öppen information om pris, avgifter och nästa steg.',
    intent: 'Varumärkessida för kunder som söker Gridex som elbolag.',
    primaryCta: { label: 'Se Gridex elavtal', href: '/elavtal' },
    secondaryCta: { label: 'Teckna elavtal', href: '/teckna-avtal' },
    sections: [
      { title: 'Tydliga elavtal', body: ['Gridex visar elhandelspris, avtalsform och viktiga avgifter innan kunden tecknar. Målet är att kunden ska förstå vad som händer före och efter teckning.'] },
      { title: 'Digital kundresa', body: ['Teckning skickas online och Gridex återkommer om anläggningsuppgifter eller andra delar behöver kompletteras innan avtalsstart.'] },
    ],
    bullets: ['Svensk elleverantör.', 'Digital teckning.', 'Tydlig prisinformation.'],
    faq: [
      { question: 'Vad erbjuder Gridex?', answer: 'Gridex erbjuder elhandelsavtal och digital teckning för svenska kunder.' },
      { question: 'Hur tecknar jag avtal?', answer: 'Du väljer avtal, fyller i uppgifter och tecknar online.' },
    ],
    related: [
      { label: 'Elavtal', href: '/elavtal', description: 'Se aktuella avtal.' },
      { label: 'Elpris idag', href: '/elpriser/elpris-idag', description: 'Se marknadspriset.' },
      { label: 'Kundservice', href: '/kundservice', description: 'Kontakta Gridex.' },
    ],
  }),
  competitorSeoPage({
    slug: 'byta-fran-annat-elbolag',
    path: '/elbolag/byta-fran-annat-elbolag',
    title: 'Byta från annat elbolag till Gridex',
    description: 'Så byter du från ditt nuvarande elbolag till Gridex. Kontrollera bindningstid, startdatum och anläggningsuppgifter.',
    eyebrow: 'Byta elbolag',
    h1: 'Byta från annat elbolag till Gridex',
    lead: 'När du byter till Gridex byter du elhandelsavtal. Nätägaren ligger normalt kvar eftersom elnätet styrs av adressen.',
    intent: 'För kunder som redan har elavtal och vill byta till Gridex.',
    primaryCta: { label: 'Starta teckning', href: '/teckna-avtal' },
    secondaryCta: { label: 'Läs om bytet', href: '/elavtal/byta-elbolag' },
    sections: [
      { title: 'Kontrollera nuvarande avtal', body: ['Se om ditt nuvarande avtal har bindningstid eller uppsägningstid. Det påverkar lämpligt startdatum för nytt avtal.'] },
      { title: 'Teckna online', body: ['Gridex samlar uppgifter digitalt och kontrollerar vad som behövs för att gå vidare med leverantörsbytet.'] },
    ],
    bullets: ['Kontrollera bindningstid.', 'Välj startdatum med omsorg.', 'Gridex återkommer om något saknas.'],
    faq: [
      { question: 'Måste jag säga upp mitt gamla elavtal?', answer: 'Det beror på villkoren. Kontrollera bindnings- och uppsägningstid innan du byter.' },
      { question: 'Byter jag nätägare?', answer: 'Nej, normalt byter du bara elleverantör för elhandeln.' },
    ],
    related: [
      { label: 'Byta elbolag', href: '/elavtal/byta-elbolag', description: 'Mer om processen.' },
      { label: 'Uppsägningstid', href: '/elavtal/uppsagningstid-elavtal', description: 'Kontrollera datum.' },
      { label: 'Bindningstid', href: '/elavtal/bindningstid-elavtal', description: 'Förstå villkoren.' },
    ],
  }),
]

export const glossaryRoutePaths = ['/ordlista', ...glossaryPages.map((page) => page.path)]
export const marketRoutePaths = marketPages.map((page) => page.path)

export function findPage(pages: SeoPageContent[], slug: string) {
  return pages.find((page) => page.slug === slug) ?? null
}

export function findPageByPath(pages: SeoPageContent[], path: string) {
  return pages.find((page) => page.path === path) ?? null
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
  ...glossaryRoutePaths,
  ...marketRoutePaths,
  '/sitemap',
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
