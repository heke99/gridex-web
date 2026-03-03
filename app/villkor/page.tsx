export default function VillkorPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
      <h1 className="text-4xl font-bold">
        Allmänna avtalsvillkor & Integritetspolicy
      </h1>

      {/* ==================== 1 ==================== */}
      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          1. Om bolaget
        </h2>
        <p>
          Div3rsa AB, org.nr [559416-7149], är ett svenskt elhandelsföretag.
          Bolaget är registrerat hos Energimarknadsinspektionen och följer
          ellagen (1997:857) samt tillämplig konsumentskyddslagstiftning.
        </p>
        <p>
          Kontakt: support@gridex.se
        </p>
      </section>

      {/* ==================== 2 ==================== */}
      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          2. Avtalets ingående
        </h2>
        <p>
          Avtal ingås digitalt via BankID eller e-postsignering.
          Avtalet blir bindande när kunden har signerat och Gridex har bekräftat avtalet.
        </p>
        <p>
          Vid tecknande godkänner kunden dessa allmänna villkor,
          aktuell prisbilaga samt integritetspolicy.
        </p>
      </section>

      {/* ==================== 3 ==================== */}
      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          3. Ångerrätt (Distansavtalslagen)
        </h2>
        <p>
          Enligt lagen (2005:59) om distansavtal har konsument rätt att
          frånträda avtalet inom 14 dagar från det att avtalet ingicks.
        </p>
        <p>
          Om leverans påbörjats under ångerfristen är kunden betalningsskyldig
          för den el som levererats fram till frånträdandet.
        </p>
      </section>

      {/* ==================== 4 ==================== */}
      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          4. Pris och betalning
        </h2>
        <p>
          Elpriset framgår av avtalet och kan vara rörligt (spot/tim),
          portföljförvaltat eller fastpris.
        </p>
        <p>
          Fakturering sker månadsvis i efterskott.
          Betalningsvillkor är 15–20 dagar.
        </p>
        <p>
          Vid försenad betalning debiteras dröjsmålsränta enligt räntelagen
          samt lagstadgad påminnelseavgift.
        </p>
      </section>

      {/* ==================== 5 ==================== */}
      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          5. Leverans och nät
        </h2>
        <p>
          Gridex ansvarar för elhandeln. Lokalt nätbolag ansvarar
          för överföring av el.
        </p>
        <p>
          Mätvärden erhålls via nätägare och hanteras enligt
          Ediel- och branschstandard.
        </p>
      </section>

      {/* ==================== 6 ==================== */}
      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          6. Personuppgifter (GDPR)
        </h2>
        <p>
          Gridex är personuppgiftsansvarig för behandling av personuppgifter.
          Behandling sker i enlighet med EU:s dataskyddsförordning (GDPR).
        </p>
        <p>
          Personuppgifter behandlas för:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Fullgörande av avtal</li>
          <li>Fakturering och betalning</li>
          <li>Kundservice</li>
          <li>Rättsliga skyldigheter enligt ellagen</li>
        </ul>
        <p>
          Rättslig grund är fullgörande av avtal och rättslig förpliktelse.
        </p>
        <p>
          Uppgifter sparas så länge avtal pågår och därefter enligt bokföringslagen (7 år).
        </p>
      </section>

      {/* ==================== 7 ==================== */}
      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          7. Kreditupplysning
        </h2>
        <p>
          Gridex kan vid behov inhämta kreditupplysning i samband med avtalets ingående.
          Kunden informeras i sådant fall.
        </p>
      </section>

      {/* ==================== 8 ==================== */}
      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          8. Force majeure
        </h2>
        <p>
          Part är befriad från ansvar vid händelse utanför partens kontroll,
          såsom naturkatastrof, myndighetsbeslut, strejk eller tekniska störningar.
        </p>
      </section>

      {/* ==================== 9 ==================== */}
      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          9. Tvist
        </h2>
        <p>
          Tvist prövas i svensk domstol.
        </p>
        <p>
          Konsument kan även vända sig till Allmänna reklamationsnämnden (ARN).
        </p>
      </section>

      <div className="text-xs text-gray-500">
        Senast uppdaterad: {new Date().toLocaleDateString('sv-SE')}
      </div>
    </div>
  )
}