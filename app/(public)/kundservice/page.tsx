import type { Metadata } from 'next'
import FaqJsonLd from '@/components/seo/FaqJsonLd'
import KundserviceClient from './KundserviceClient'

export const metadata: Metadata = {
  title: 'Kundservice – kontakta Gridex',
  description:
    'Kontakta Gridex kundservice. Få hjälp med elavtal, teckning, faktura, flytt, Mina sidor och anläggningsuppgifter.',
  alternates: { canonical: 'https://gridex.se/kundservice' },
}

const faqItems = [
  { question: 'Hur byter jag elavtal?', answer: 'Välj ett aktuellt elavtal, teckna och godkänn fullmakt. Gridex kontrollerar anläggningsuppgifterna och återkommer med nästa steg.' },
  { question: 'När startar avtalet?', answer: 'Avtalet startar enligt önskat datum eller så snart som möjligt när uppgifterna är verifierade och marknadsreglerna tillåter det.' },
  { question: 'Har jag ångerrätt?', answer: 'Som konsument har du normalt 14 dagars ångerrätt vid distansavtal. Information finns på sidan Ångerrätt.' },
  { question: 'Vad gör jag om jag saknar anläggnings-ID eller mätpunkts-ID?', answer: 'Du kan teckna ändå. Med din fullmakt kan Gridex behöva hämta eller verifiera uppgifterna via nätägaren.' },
  { question: 'Vad ingår i priset?', answer: 'Elhandelspriset kan innehålla elpris, påslag, månadsavgift, fakturaavgift och moms beroende på valt avtal.' },
  { question: 'Vad ingår inte i priset?', answer: 'Elnätsavgift och kostnader kopplade till nätabonnemanget faktureras normalt av ditt elnätsföretag och ingår inte i Gridex elhandelspris.' },
  { question: 'Vad är skillnaden mellan rörligt, fast och förvaltat avtal?', answer: 'Rörligt pris följer marknaden, fastpris ger mer förutsägbarhet och ett förvaltat avtal kan kombinera marknadspris med aktiv prishantering.' },
  { question: 'Hur fungerar Mina sidor?', answer: 'På Mina sidor kan du se kunduppgifter, avtal, anläggning, dokument, godkännanden och status när kundprofilen är kopplad.' },
  { question: 'Var hittar jag fakturor?', answer: 'Fakturor visas på Mina sidor när de finns tillgängliga. Om inga fakturor visas kan de ännu inte ha skapats eller hämtats.' },
  { question: 'Hur gör jag vid flytt?', answer: 'Kontakta Gridex med flyttdatum och adress. Vid inflytt kan anläggningsuppgifter behöva kontrolleras innan avtalet startar.' },
  { question: 'Vad händer om uppgifter saknas?', answer: 'Gridex pausar nästa steg och kontaktar dig eller nätägaren för att komplettera uppgifterna innan leverantörsbyte går vidare.' },
]

export default function KundservicePage() {
  return (
    <>
      <FaqJsonLd items={faqItems} />
      <KundserviceClient faqItems={faqItems} />
    </>
  )
}
