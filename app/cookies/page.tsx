export default function CookiePolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
      <h1 className="text-4xl font-bold">Cookiepolicy</h1>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <p>
          Gridex använder cookies och liknande tekniker för att säkerställa
          grundläggande funktionalitet och en bättre användarupplevelse. Vi
          sparar inga icke-nödvändiga cookies utan ditt samtycke och spårar
          inte ditt beteende för marknadsföring eller analys.
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
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Nödvändiga cookies</strong> – krävs för att webbplatsen ska
            fungera, till exempel för inloggning, säkerhet och formulär.
          </li>
          <li>
            <strong>Dina val</strong> – vi sparar endast ditt cookie-samtycke i en
            lokal cookie så att bannern inte visas varje gång. Inga
            statistik‑ eller funktionella cookies sätts utan samtycke.
          </li>
        </ul>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">3. Tredjepartsleverantörer</h2>
        <p>
          Vi använder leverantörer som hjälper oss att leverera tjänsten, till
          exempel hosting, betalning och signering. Dessa kan sätta sina egna
          cookies för att leverera sina tjänster. Vi delar inte dina
          personuppgifter med tredje part för marknadsföring.
        </p>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">4. Hantering av cookies</h2>
        <p>
          Du kan när som helst ändra dina cookie-inställningar genom att klicka på
          “Hantera val” i cookie-bannern eller genom att besöka denna sida
          igen. Du kan även göra justeringar i din webbläsare. Om du avvisar
          cookies kan vissa funktioner sluta fungera.
        </p>
      </section>

      <div className="text-xs text-gray-500">
        Senast uppdaterad: {new Date().toLocaleDateString('sv-SE')}
      </div>
    </div>
  )
}