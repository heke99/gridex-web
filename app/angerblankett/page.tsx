export default function AngerblankettPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
      <h1 className="text-4xl font-bold">Ångerblankett</h1>

      <p className="text-gray-300 text-sm leading-6">
        Denna blankett används om du vill frånträda ditt avtal inom 14 dagar.
      </p>

      <div className="space-y-6 text-sm text-gray-300 leading-6">
        <p>
          Till: Gridex AB  
          E-post: support@gridex.se
        </p>

        <p>
          Jag meddelar härmed att jag frånträder mitt elhandelsavtal.
        </p>

        <div className="space-y-2">
          <p>Avtalets ingångsdatum: ____________________</p>
          <p>Namn: ____________________</p>
          <p>Personnummer: ____________________</p>
          <p>Anläggningsadress: ____________________</p>
          <p>Datum: ____________________</p>
          <p>Underskrift: ____________________</p>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Enligt lagen (2005:59) om distansavtal och avtal utanför affärslokaler.
      </div>
    </div>
  )
}