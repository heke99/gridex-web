export default function ForetagsVillkorPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
      <h1 className="text-4xl font-bold">Allmänna avtalsvillkor – Företagskund</h1>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <p>
          Dessa villkor gäller för juridiska personer och näringsidkare.
        </p>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">Ansvarsbegränsning</h2>
        <p>
          Gridex ansvarar inte för indirekta skador, utebliven vinst
          eller produktionsbortfall.
        </p>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">Betalningsvillkor</h2>
        <p>
          Betalning ska ske enligt faktura. Dröjsmålsränta enligt räntelagen.
        </p>
      </section>

      <section className="space-y-4 text-gray-300 text-sm leading-6">
        <h2 className="text-xl font-semibold text-white">Avtalsbrott</h2>
        <p>
          Vid väsentligt avtalsbrott har Gridex rätt att häva avtalet.
        </p>
      </section>

      <div className="text-xs text-gray-500">
        Svensk lag tillämpas. Tvist avgörs i svensk domstol.
      </div>
    </div>
  )
}