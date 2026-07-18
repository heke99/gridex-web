export type FaqCategory =
  | 'innan-du-tecknar'
  | 'pris-och-avtal'
  | 'byte-och-start'
  | 'juridik'
  | 'efter-teckning'

export type FaqItem = {
  id: string
  category: FaqCategory
  question: string
  answer: string
  checkoutRelevant?: boolean
}

export const faqCategoryLabels: Record<FaqCategory, string> = {
  'innan-du-tecknar': 'Innan du tecknar',
  'pris-och-avtal': 'Pris och avtal',
  'byte-och-start': 'Byte och start',
  juridik: 'Juridik',
  'efter-teckning': 'Efter teckning och Mina sidor',
}

export const faqItems: FaqItem[] = [
  { id: 'behover', category: 'innan-du-tecknar', checkoutRelevant: true, question: 'Vad behöver jag för att teckna elavtal?', answer: 'Du behöver adress, uppskattad förbrukning, kontaktuppgifter och personnummer. Företag anger även organisationsnummer samt uppgifter om den behöriga personen som skriver under.' },
  { id: 'utan-anlaggnings-id', category: 'innan-du-tecknar', checkoutRelevant: true, question: 'Kan jag teckna utan anläggnings-ID eller mätpunkts-ID?', answer: 'Ja. Du kan fortsätta utan de tekniska uppgifterna. Gridex kontrollerar vad som saknas efter teckningen och ber dig komplettera om uppgifterna inte kan verifieras på annat sätt.' },
  { id: 'hitta-anlaggnings-id', category: 'innan-du-tecknar', question: 'Var hittar jag mitt anläggnings-ID?', answer: 'Det står vanligtvis på elnätsfakturan eller på Mina sidor hos ditt elnätsföretag. Det är inte samma sak som kundnummer eller avtalsnummer.' },
  { id: 'elomrade', category: 'innan-du-tecknar', checkoutRelevant: true, question: 'Hur vet jag vilket elområde jag tillhör?', answer: 'Teckningsflödet fastställer automatiskt elområdet SE1–SE4 från adressen. Om adressen inte kan verifieras får du kontrollera den eller kontakta kundservice.' },
  { id: 'foretag-undertecknare', category: 'innan-du-tecknar', checkoutRelevant: true, question: 'Kan ett företag teckna och vem får skriva under?', answer: 'Ja, när avtalet är publicerat för företag. Den fysiska person som skriver under måste ha rätt att företräda företaget och ange namn, personnummer och roll eller befattning.' },

  { id: 'vad-ingar', category: 'pris-och-avtal', checkoutRelevant: true, question: 'Vad ingår i priset och vad fakturerar nätägaren separat?', answer: 'Teckningsflödet visar de publicerade komponenterna för elhandelsavtalet och beräknad moms. Elnätsavgift och nätabonnemang faktureras normalt separat av elnätsföretaget.' },
  { id: 'pris-andras', category: 'pris-och-avtal', checkoutRelevant: true, question: 'Varför kan priset ändras innan jag tecknar?', answer: 'Marknadspris och vissa avtalskomponenter kan uppdateras. Därför verifierar Gridex pris, adress, elområde och förbrukning igen när du tecknar. Om något ändrats får du räkna om priset.' },
  { id: 'pris-giltighet', category: 'pris-och-avtal', checkoutRelevant: true, question: 'Hur länge gäller min prisberäkning?', answer: 'Prisberäkningen är kortlivad och visar sin giltighetstid. När den har gått ut behöver priset räknas om innan avtalet kan tecknas.' },
  { id: 'avtalsskillnad', category: 'pris-och-avtal', question: 'Vad är skillnaden mellan rörligt, fast, månadsfast, mix och förvaltat avtal?', answer: 'Rörligt följer marknaden, fast låser ett kWh-pris och månadsfast följer avtalets fasta månadsmodell. Mix kombinerar prisandelar medan förvaltat pris bygger på den publicerade förvaltningsmodellen. Exakta komponenter visas per avtal.' },
  { id: 'prisbegrepp', category: 'pris-och-avtal', question: 'Vad betyder påslag, månadsavgift och fakturaavgift?', answer: 'Påslag anges vanligtvis per kWh, månadsavgift tas per månad och fakturaavgift per faktura. Bara de komponenter som är publicerade för det valda avtalet visas i avtalskortet.' },

  { id: 'start', category: 'byte-och-start', checkoutRelevant: true, question: 'När startar avtalet?', answer: 'Du kan välja så snart som möjligt eller ett framtida datum. Starten bekräftas först när Gridex har verifierat uppgifterna och marknadsreglerna tillåter leverantörsbytet.' },
  { id: 'saga-upp', category: 'byte-och-start', question: 'Måste jag själv säga upp mitt nuvarande elavtal?', answer: 'Vid ett vanligt leverantörsbyte hanteras bytet normalt genom marknadsprocessen. Säg inte upp avtalet i onödan; kontrollera först eventuell bindnings- och uppsägningstid hos nuvarande leverantör.' },
  { id: 'bindningstid', category: 'byte-och-start', question: 'Vad händer om jag har bindningstid hos nuvarande leverantör?', answer: 'Du ansvarar för att kontrollera ditt nuvarande avtal. Ett för tidigt byte kan medföra avgift eller att startdatum behöver justeras.' },
  { id: 'saknade-uppgifter', category: 'byte-och-start', question: 'Vad händer om uppgifter saknas efter att jag tecknat?', answer: 'OPS markerar vad som saknas och nästa steg pausas vid behov. Gridex kontaktar dig för komplettering innan leverantörsbytet skickas vidare.' },
  { id: 'elnat', category: 'byte-och-start', question: 'Vad är skillnaden mellan Gridex och mitt elnätsföretag?', answer: 'Gridex är elhandelsföretaget som säljer elavtalet. Elnätsföretaget äger nätet i området, hanterar överföring och strömavbrott samt fakturerar nätavgifter.' },

  { id: 'fullmakt', category: 'juridik', checkoutRelevant: true, question: 'Vad ger jag Gridex fullmakt att göra?', answer: 'Den exakta publicerade fullmaktstexten visas innan signering. När fullmakt krävs omfattar den normalt leverantörsbyte och uppslag av nödvändiga anläggningsuppgifter.' },
  { id: 'villkor', category: 'juridik', question: 'Vilka villkor godkänner jag?', answer: 'Du får separata länkar till de exakta publicerade versionerna av allmänna villkor, prisvillkor, integritetspolicy och ångerrätt. Fullmakt visas separat när den krävs.' },
  { id: 'angerratt', category: 'juridik', question: 'Hur fungerar 14 dagars ångerrätt?', answer: 'Som konsument har du normalt 14 dagars ångerrätt vid distansavtal. Din bekräftelse visar signeringstid och ångerfrist när OPS har fastställt dem.' },
  { id: 'avtalspdf', category: 'juridik', question: 'Var hittar jag avtalsbekräftelsen och den frysta PDF-versionen?', answer: 'Avtalsbekräftelsen skickas när avtalet är redo och dokumentet visas på Mina sidor när kundprofilen och dokumentet har kopplats.' },

  { id: 'mail', category: 'efter-teckning', checkoutRelevant: true, question: 'Vilka mail får jag efter teckningen?', answer: 'OPS kan skicka mottagningsbekräftelse, avtalsbekräftelse och ångerrättsinformation. Om du är ny kund skickas även ett separat mail för att aktivera Mina sidor. Kvittosidan visar vad som har initierats.' },
  { id: 'mina-sidor', category: 'efter-teckning', question: 'När kan jag logga in på Mina sidor?', answer: 'Om du redan har ett länkat konto kan du logga in direkt. Som ny kund aktiverar du kontot via mailet när kundprofilen har skapats.' },
  { id: 'befintligt-konto', category: 'efter-teckning', question: 'Vad gör jag om jag redan har ett konto?', answer: 'Logga in med ditt befintliga lösenord. Teckna med samma e-post om avtalet ska kopplas automatiskt till den inloggade profilen.' },
  { id: 'mail-saknas', category: 'efter-teckning', question: 'Vad gör jag om bekräftelsemailet inte kommer?', answer: 'Kontrollera skräppost och att e-postadressen är rätt. Utskicksstatus kan ändras efter teckningen; kontakta kundservice om mailet fortfarande saknas.' },
  { id: 'switch-status', category: 'efter-teckning', question: 'Var ser jag status för leverantörsbytet?', answer: 'Kvittosidan visar den första säkra statusen. När profilen är kopplad visas fortsatta händelser och uppdateringar på Mina sidor eller via e-post.' },
  { id: 'rattelse', category: 'efter-teckning', question: 'Hur kompletterar eller rättar jag uppgifter?', answer: 'Logga in på Mina sidor eller kontakta kundservice. Ändringar som påverkar identitet, avtal eller leverantörsbyte kan behöva verifieras innan de synkas till OPS.' },
]

export function faqByIds(ids: string[]): FaqItem[] {
  const wanted = new Set(ids)
  return faqItems.filter((item) => wanted.has(item.id))
}

export const checkoutFaqItems = faqItems.filter((item) => item.checkoutRelevant)
export const customerServiceFaqItems = faqByIds([
  'utan-anlaggnings-id', 'start', 'angerratt', 'vad-ingar', 'elnat',
  'saknade-uppgifter', 'mail', 'mina-sidor', 'befintligt-konto', 'rattelse',
])
