export default function CookiePolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
      <h1 className="text-4xl font-bold">Cookiepolicy</h1>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <p>
          Denna webbplats använder cookies och liknande tekniker för att
          säkerställa funktionalitet, förbättra användarupplevelsen och
          analysera trafik.
        </p>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">1. Vad är cookies?</h2>
        <p>
          Cookies är små textfiler som lagras på din enhet när du besöker en webbplats.
        </p>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">2. Vilka typer använder vi?</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Nödvändiga cookies (inloggning, säkerhet)</li>
          <li>Analyscookies (statistik och förbättring)</li>
          <li>Funktionella cookies (val och inställningar)</li>
        </ul>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">3. Tredjepartscookies</h2>
        <p>
          Vi kan använda tredjepartsleverantörer såsom betalningsleverantörer,
          signeringsleverantörer, analysverktyg och hostingtjänster.
        </p>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">4. Hantering av cookies</h2>
        <p>
          Du kan när som helst ändra dina cookie-inställningar i din webbläsare.
        </p>
      </section>

      <div className="text-xs text-gray-500">
        Senast uppdaterad: {new Date().toLocaleDateString('sv-SE')}
      </div>
    </div>
  )
}