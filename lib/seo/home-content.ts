import type { SeoPageContent } from './content'

type HomeContent = Pick<SeoPageContent, 'sections' | 'faq' | 'related'>

export const homeContent: Record<string, HomeContent> = {
  villa: {
    sections: [
      { title: 'Värme och laddning påverkar villans elavtal', body: ['Utgå från ett helt års förbrukning så att även vintermånaderna ingår. Skilj mellan hushållsel, elvärme och laddning när du bedömer hur mycket användning som faktiskt går att flytta i tid.', 'Med kvartspris spelar priset när du förbrukar el roll. Automatisk styrning av en värmepump eller laddbox kan ge flexibilitet, men komfort, effektbehov och nätavgifter behöver också vägas in.'] },
      { title: 'Räkneexempel för en villa med hög förbrukning', body: ['Vid en antagen förbrukning på 20 000 kWh per år motsvarar 1 öre/kWh i påslag 200 kronor per år. En månadsavgift på 49 kronor blir 588 kronor per år. Dessa fiktiva belopp illustrerar avgifternas betydelse; energipris och andra kostnader tillkommer.', 'Jämför både påslag och fasta avgifter. Ett lågt påslag säger inget om framtida spotpris eller hur ett annat avtals energipris beräknas.'] },
    ],
    faq: [
      { question: 'Är kvartspris bäst för en villa med värmepump?', answer: 'Det beror på när värmepumpen använder el och hur mycket som kan flyttas utan att påverka komforten. Jämför förbrukningsprofil och avtalsvillkor; det finns ingen garanti för att kvartspris blir billigast.' },
      { question: 'Ska jag jämföra med sommarens eller hela årets förbrukning?', answer: 'Använd ett helt år om det finns historik. En sommarmånad kan ge en missvisande bild när uppvärmningen använder mycket el på vintern.' },
    ],
    related: [
      { label: 'Värmepumpens elförbrukning', href: '/guider/varmepump-elforbrukning', description: 'Förstå hur uppvärmningen påverkar elkostnaden.' },
      { label: 'Ladda elbil billigare', href: '/guider/ladda-elbil-billigare', description: 'Bedöm vilka delar av laddningen du kan styra.' },
    ],
  },
  hus: {
    sections: [
      { title: 'Börja med husets uppvärmningssystem', body: ['Två lika stora hus kan ha olika elförbrukning om det ena har fjärrvärme och det andra direktverkande el. Kontrollera därför vad som faktiskt ingår i mätvärdena innan du använder ett annat hushålls förbrukning som jämförelse.', 'Om du nyligen har bytt värmesystem kan äldre årsförbrukning behöva justeras. Beräkna flera scenarier i stället för att utgå från en generell siffra för alla hus.'] },
      { title: 'Flyttar du in i ett hus?', body: ['Fråga efter historisk elförbrukning och hur huset har använts. Tidigare boendes temperatur, antal personer och laddning kan skilja sig från dina vanor.', 'Kontrollera både elhandelsavtal och elnätsavtal inför inflyttningen. Att välja elhandelsbolag ersätter inte ett elnätsavtal på den nya adressen.'] },
    ],
    faq: [
      { question: 'Hur uppskattar jag förbrukningen i ett nytt hus?', answer: 'Utgå från tillgänglig årshistorik och justera för uppvärmning, hushållets storlek och eventuell elbil. Saknas historik, jämför flera rimliga förbrukningsscenarier.' },
      { question: 'Följer säljarens elavtal med huset?', answer: 'Utgå inte från det. Kontrollera vilka egna avtal du behöver för elhandel och elnät och vilket datum de ska börja gälla.' },
    ],
    related: [
      { label: 'Teckna elavtal vid flytt', href: '/elavtal/teckna-elavtal-vid-flytt', description: 'Förbered elavtalen inför inflyttning.' },
      { label: 'Vad drar mest el i hemmet?', href: '/guider/vad-drar-mest-el-i-hemmet', description: 'Identifiera användningen som påverkar kostnaden.' },
    ],
  },
  lagenhet: {
    sections: [
      { title: 'Fasta avgifter märks mer vid låg förbrukning', body: ['När värme och varmvatten ingår i boendekostnaden kan den egna elräkningen främst avse hushållsel. Kontrollera vad som ingår innan du uppskattar årsförbrukningen.', 'Vid en fiktiv förbrukning på 2 000 kWh per år kostar ett påslag på 5 öre/kWh 100 kronor per år. En månadsavgift på 49 kronor kostar 588 kronor per år. Energipris och övriga kostnader tillkommer.'] },
      { title: 'Kontrollera om du ska ha ett eget elavtal', body: ['En lägenhet kan ha en egen anslutning där du väljer elhandlare, eller ingå i en gemensam lösning där el debiteras via hyresvärd eller förening. Fråga innan du tecknar.', 'Om du har en egen anslutning behöver du skilja elhandelsavtalet från nätägarens abonnemang. Kontrollera inflyttningsdatum så att båda avtalen avser rätt adress och period.'] },
    ],
    faq: [
      { question: 'Vad är viktigast när jag jämför elavtal för lägenhet?', answer: 'Vid låg förbrukning kan månadsavgiften få stor betydelse. Jämför ändå hela elhandelskostnaden och kontrollera vad som ingår i boendet.' },
      { question: 'Kan jag välja elbolag om elen debiteras av föreningen?', answer: 'Det beror på hur mätning och abonnemang är ordnade. Vid gemensamt abonnemang väljer föreningen normalt elhandlare för anslutningen.' },
    ],
    related: [
      { label: 'Billig el', href: '/elavtal/billigt-elavtal', description: 'Jämför fasta avgifter och påslag med ett räkneexempel.' },
      { label: 'Förstå elnätsavgiften', href: '/natagare/elnatsavgift', description: 'Se vad som hör till nätkostnaden.' },
    ],
  },
  bostadsratt: {
    sections: [
      { title: 'Eget abonnemang eller gemensam el i föreningen?', body: ['Kontrollera med styrelsen om bostaden har eget elnätsabonnemang eller om föreningen har gemensam el med individuell mätning och debitering. Det avgör om du själv kan välja elhandelsbolag.', 'Vid eget abonnemang väljer du elhandelsavtal för bostaden. Vid gemensam lösning ligger valet normalt hos föreningen; teckna inte ett separat avtal utan att kontrollera upplägget.'] },
      { title: 'Skilj bostadens kostnad från föreningens', body: ['El till trapphus, garage och gemensamma utrymmen kan ligga på föreningens avtal. Den kostnaden är inte nödvändigtvis en del av din egen mätning.', 'Kontrollera också om laddning debiteras separat. Använd din faktiska hushållsförbrukning när du jämför avgifter och pris för ett eget avtal.'] },
    ],
    faq: [
      { question: 'Vad betyder individuell mätning och debitering av el?', answer: 'Det innebär att användningen mäts för varje bostad och debiteras individuellt inom en gemensam lösning. Fråga föreningen hur abonnemang och avtal är ordnade.' },
      { question: 'Kan styrelsen teckna avtal för gemensamma utrymmen?', answer: 'Föreningen kan ha egna elhandelsavtal för sina anslutningar. Det är ett annat underlag än ett hushålls eget avtal.' },
    ],
    related: [
      { label: 'Elavtal för BRF', href: '/elavtal/brf', description: 'Underlag för föreningens gemensamma anslutningar.' },
      { label: 'Elavtal för lägenhet', href: '/elavtal/lagenhet', description: 'Bedöm fasta avgifter för hushållselen.' },
    ],
  },
  hyresratt: {
    sections: [
      { title: 'Läs vad som ingår i hyran', body: ['El kan ingå i hyran, debiteras av hyresvärden eller kräva egna avtal. Kontrollera hyresavtalet och fråga hyresvärden om bostaden har egen anslutning.', 'Om värme och varmvatten ingår bör de inte räknas som egen elförbrukning. Ett hushåll med elvärme behöver däremot ett annat beräkningsunderlag.'] },
      { title: 'Planera både inflyttning och utflyttning', body: ['När du ansvarar för egna elavtal behöver startdatumet stämma med tillträdet. Kontrollera adress och lägenhetsuppgifter så att avtalet avser rätt bostad.', 'Vid utflyttning behöver de gamla avtalen hanteras enligt villkoren. Ett nytt avtal på en annan adress betyder inte automatiskt att allt på den gamla adressen är avslutat.'] },
    ],
    faq: [
      { question: 'Måste jag teckna elavtal för en hyresrätt?', answer: 'Det beror på hyresavtalet och hur fastighetens el är ordnad. Fråga hyresvärden om du ska teckna egna avtal för elhandel och elnät.' },
      { question: 'Vilket datum ska elavtalet börja gälla?', answer: 'Utgå från när du får tillträde och ansvarar för bostadens el. Kontrollera datumet med hyresvärden och följ bekräftelsen för avtalsstart.' },
    ],
    related: [
      { label: 'Flytta elavtal', href: '/elavtal/flytta-elavtal', description: 'Kontrollera både den nya och den gamla adressen.' },
      { label: 'Elavtal för lägenhet', href: '/elavtal/lagenhet', description: 'Jämför kostnader vid låg förbrukning.' },
    ],
  },
  radhus: {
    sections: [
      { title: 'Kontrollera vad samfälligheten ansvarar för', body: ['I vissa radhusområden finns gemensamma lösningar för värme, garage eller laddning. Kontrollera vad som ligger på din egen elmätare och vad som debiteras av samfällighet eller förening.', 'Jämför inte husets totala boendekostnad med enbart elhandelspriset. Nätkostnader och gemensamma avgifter kan behöva bedömas separat.'] },
      { title: 'Utgå från radhusets faktiska användning', body: ['Ett radhus med fjärrvärme kan ha en annan förbrukningsprofil än ett med elvärme. Laddning, ventilation och hushållets vanor kan också påverka när elen används.', 'Använd årshistorik och kontrollera hur stor del som kan styras i tid innan du väljer mellan månadspris och kvartspris.'] },
    ],
    faq: [
      { question: 'Går gemensam laddning på mitt eget elavtal?', answer: 'Det beror på anslutningen och hur området debiterar laddningen. Kontrollera om laddningen ligger på din egen mätare eller ett gemensamt abonnemang.' },
      { question: 'Har alla radhus samma behov av elavtal?', answer: 'Nej. Uppvärmning, anslutning och hushållets användning skiljer sig. Jämför med din egen förbrukning.' },
    ],
    related: [
      { label: 'Timpris eller månadspris', href: '/guider/timpris-eller-manadspris', description: 'Bedöm hur användningens tidpunkt spelar roll.' },
      { label: 'Elavtal för hus', href: '/elavtal/hus', description: 'Utgå från uppvärmning och årshistorik.' },
    ],
  },
  fritidshus: {
    sections: [
      { title: 'Räkna på månaderna när huset står tomt', body: ['Ett fritidshus kan använda el även utan besök: frostskydd, kyl, ventilation och annan utrustning kan vara igång. Använd ett helt års mätvärden så att grundförbrukningen kommer med.', 'En fast månadsavgift betalas normalt även under perioder med liten användning. Jämför därför årskostnad och inte bara kostnaden under semesterveckorna.'] },
      { title: 'Vinterbruk kan ändra förbrukningsprofilen', body: ['Om du börjar använda huset vintertid eller höjer grundtemperaturen kan äldre förbrukningshistorik underskatta det nya behovet. Bedöm uppvärmning och komfort innan du uppskattar framtida kostnad.', 'Styrning kan vara användbar, men sänk inte värme eller ventilation utan att ta hänsyn till frost- och fuktrisk. Ett elavtal ersätter inte planering av hur byggnaden ska hållas i skick.'] },
    ],
    faq: [
      { question: 'Betalar jag månadsavgift när fritidshuset är tomt?', answer: 'Kontrollera avtalet. En fast månadsavgift tas normalt även när förbrukningen är låg eller noll.' },
      { question: 'Kan jag använda gamla mätvärden om jag börjar vistas där på vintern?', answer: 'De ger ett underlag, men behöver justeras när användning och uppvärmning ändras. Jämför flera scenarier för årsförbrukningen.' },
    ],
    related: [
      { label: 'Elpris på vintern', href: '/elpriser/elpris-vinter', description: 'Förstå varför vinteranvändning kan påverka kostnaden.' },
      { label: 'Använda mindre el', href: '/guider/anvanda-mindre-el', description: 'Se över grundförbrukningen.' },
    ],
  },
  sommarstuga: {
    sections: [
      { title: 'Fasta avgifter kan dominera vid få besök', body: ['Vid en fiktiv årsförbrukning på 1 000 kWh kostar ett påslag på 5 öre/kWh 50 kronor per år. En månadsavgift på 49 kronor kostar 588 kronor per år. Energipris, elnät och andra avgifter tillkommer.', 'Exemplet visar varför ett lågt kWh-påslag inte ensamt avgör vilket avtal som passar en stuga som används sällan. Beloppen är inte ett erbjudande från Gridex.'] },
      { title: 'Kontrollera elen före och efter sommarsäsongen', body: ['Se vad som fortsätter dra el efter sista besöket och kontrollera avtalsvillkoren innan du ändrar något. Kyl, pump och grundvärme kan ge användning även när ingen bor i stugan.', 'Att stänga ett abonnemang och återansluta senare är en annan fråga än att välja billigare elhandel. Be nätägaren om villkor och eventuella kostnader innan du beslutar om en säsongslösning.'] },
    ],
    faq: [
      { question: 'Är ett lågt påslag viktigast för en sommarstuga?', answer: 'Vid mycket låg förbrukning kan fasta avgifter ha större betydelse. Räkna på hela året och inkludera kostnader som ligger utanför elhandeln.' },
      { question: 'Kan jag stänga elen under vintern?', answer: 'Kontrollera först byggnadens behov av frostskydd och ventilation samt nätägarens villkor för frånkoppling och återanslutning. Det är inte samma sak som ett vanligt leverantörsbyte.' },
    ],
    related: [
      { label: 'Elavtal för fritidshus', href: '/elavtal/fritidshus', description: 'Bedöm grundförbrukning och vinteranvändning.' },
      { label: 'Billig el', href: '/elavtal/billigt-elavtal', description: 'Räkna på fasta avgifter och påslag.' },
    ],
  },
}
