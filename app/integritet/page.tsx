// app/integritet/page.tsx

export const metadata = {
  title: 'Integritetspolicy – Gridex AB',
  description:
    'Så behandlar Gridex AB personuppgifter enligt GDPR och svensk lag.',
}

export default function IntegritetPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-12 text-gray-300 leading-7 text-sm">
      <h1 className="text-4xl font-bold text-white">
        Integritetspolicy
      </h1>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          1. Personuppgiftsansvarig
        </h2>
        <p>
          Gridex AB (org.nr 559416-7149) är personuppgiftsansvarig för behandlingen
          av personuppgifter enligt denna policy.
        </p>
        <p>
          Kontakt: support@gridex.se
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          2. Vilka uppgifter vi behandlar
        </h2>
        <p>
          I samband med tecknande och hantering av elavtal behandlar vi följande uppgifter:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Namn</li>
          <li>Personnummer</li>
          <li>Adress och anläggnings-ID</li>
          <li>Kontaktuppgifter (telefon och e-post)</li>
          <li>Avtalsuppgifter</li>
          <li>Mätvärden och förbrukningsdata</li>
          <li>Betalningsinformation</li>
          <li>IP-adress och teknisk information vid signering</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          3. Ändamål och rättslig grund
        </h2>
        <p>
          Vi behandlar personuppgifter för att:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Ingå och administrera elavtal</li>
          <li>Fullgöra rättsliga skyldigheter enligt ellagen</li>
          <li>Hantera mätvärden och rapportering till elmarknadens aktörer</li>
          <li>Genomföra fakturering och betalningsuppföljning</li>
          <li>Skicka avtalsrelaterad kommunikation</li>
        </ul>
        <p>
          Rättslig grund är i första hand avtal, rättslig förpliktelse samt berättigat intresse.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          4. Delning av uppgifter
        </h2>
        <p>
          Personuppgifter kan delas med:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Balansansvarig part (BRP)</li>
          <li>Systemleverantör för elmarknadsdata</li>
          <li>Svenska kraftnät och eSett enligt marknadsregler</li>
          <li>Fakturering- och betaltjänstleverantörer</li>
          <li>Myndigheter enligt lagkrav</li>
        </ul>
        <p>
          Vi säljer aldrig personuppgifter till tredje part.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          5. Lagringstid
        </h2>
        <p>
          Uppgifter sparas så länge avtalsförhållandet består samt därefter
          enligt bokföringslagen och ellagens krav. Vissa uppgifter kan
          sparas längre vid rättsliga tvister.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          6. Dina rättigheter
        </h2>
        <p>
          Du har rätt att:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Begära registerutdrag</li>
          <li>Begära rättelse av felaktiga uppgifter</li>
          <li>Begära radering i vissa fall</li>
          <li>Invända mot behandling</li>
          <li>Begära dataportabilitet</li>
          <li>Lämna klagomål till Integritetsskyddsmyndigheten (IMY)</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          7. Säkerhet
        </h2>
        <p>
          Vi använder tekniska och organisatoriska säkerhetsåtgärder för att
          skydda personuppgifter mot obehörig åtkomst, förlust och manipulation.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          8. Cookies
        </h2>
        <p>
          Information om hur vi använder cookies finns i vår cookiepolicy.
        </p>
      </section>

      <div className="text-xs text-gray-500 pt-6 border-t border-gray-800">
        Senast uppdaterad: {new Date().toLocaleDateString('sv-SE')}
      </div>
    </div>
  )
}