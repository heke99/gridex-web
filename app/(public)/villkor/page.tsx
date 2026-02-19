export default function VillkorPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
      <h1 className="text-4xl font-bold">Allmänna villkor & Integritetspolicy</h1>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">1. Personuppgifter (GDPR)</h2>
        <p>
          Gridex behandlar personuppgifter i enlighet med EU:s dataskyddsförordning (GDPR).
          Uppgifter används för att tillhandahålla tjänsten, hantera avtal och uppfylla rättsliga krav.
        </p>
        <p>
          Du har rätt att begära utdrag, rättelse eller radering av dina personuppgifter.
          Kontakta oss på support@gridex.se.
        </p>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">2. Konto och säkerhet</h2>
        <p>
          Du ansvarar för att hålla dina inloggningsuppgifter konfidentiella.
          Obehörig användning ska omedelbart rapporteras.
        </p>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">3. Ansvarsbegränsning</h2>
        <p>
          Gridex tillhandahåller prisinformation och administrativa verktyg.
          Vi ansvarar inte för indirekta ekonomiska förluster.
        </p>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">4. Tvist</h2>
        <p>
          Svensk lag tillämpas. Tvist avgörs i svensk domstol.
        </p>
      </section>

      <div className="text-xs text-gray-500">
        Senast uppdaterad: {new Date().toLocaleDateString('sv-SE')}
      </div>
    </div>
  )
}