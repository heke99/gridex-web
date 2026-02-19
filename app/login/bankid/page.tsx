export default function BankIdPage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6 text-center">

        <h1 className="text-xl font-semibold">BankID-inloggning</h1>

        <p className="text-sm text-white/70">
          BankID-integration är planerad för kommande release.
        </p>

        <div className="rounded-xl border border-white/10 bg-black/40 p-6 text-sm text-white/60">
          Detta kommer möjliggöra:
          <ul className="mt-3 space-y-1">
            <li>• Stark kundautentisering</li>
            <li>• Säker identifiering</li>
            <li>• Företagsverifiering</li>
          </ul>
        </div>

      </div>
    </main>
  )
}