export default function GDPRPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
      <h1 className="text-4xl font-bold">Integritetspolicy (GDPR)</h1>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          1. Personuppgiftsansvarig
        </h2>
        <p>
          Gridex AB, org.nr 559416-7149, är personuppgiftsansvarig.
        </p>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          2. Vilka uppgifter behandlas
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Namn och personnummer</li>
          <li>Adress och anläggnings-ID</li>
          <li>E-post och telefon</li>
          <li>Betalningsinformation</li>
          <li>Mätvärden och förbrukningsdata</li>
        </ul>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          3. Ändamål
        </h2>
        <p>
          Uppgifter behandlas för att:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Administrera elavtal</li>
          <li>Skicka fakturor</li>
          <li>Hantera kundsupport</li>
          <li>Uppfylla rättsliga krav</li>
        </ul>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          4. Lagringstid
        </h2>
        <p>
          Uppgifter sparas under avtalstiden samt enligt bokföringslagen.
        </p>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          5. Dina rättigheter
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Rätt till registerutdrag</li>
          <li>Rätt till rättelse</li>
          <li>Rätt till radering</li>
          <li>Rätt till dataportabilitet</li>
        </ul>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">
          6. Tillsynsmyndighet
        </h2>
        <p>
          Integritetsskyddsmyndigheten (IMY) är tillsynsmyndighet i Sverige.
        </p>
      </section>

      <div className="text-xs text-gray-500">
        Senast uppdaterad: {new Date().toLocaleDateString('sv-SE')}
      </div>
    </div>
  )
}