import Link from 'next/link'

export default function SignPendingPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
          1
        </div>
        <h1 className="text-3xl font-bold">Vi har tagit emot din beställning</h1>
        <p className="mt-4 text-gray-400">
          Ditt avtal har skickats vidare till avtalssystemet. Nästa steg är att
          signeringsmail skickas och att avtalet väntar på signering.
        </p>

        <div className="mt-6 grid gap-3 text-left text-sm text-gray-300">
          {[
            'Vi har tagit emot din beställning',
            'Avtal väntar på signering',
            'Avtal signerat',
            'Avtal aktiveras',
            'Avtal aktivt',
          ].map((label, index) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-black/30 p-4"
            >
              <span className="mr-2 text-cyan-300">{index + 1}.</span>
              {label}
            </div>
          ))}
        </div>

        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-2xl bg-cyan-500 px-5 py-3 font-bold text-black hover:bg-cyan-400"
        >
          Gå till Mina sidor
        </Link>
      </div>
    </div>
  )
}
