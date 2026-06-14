// Global not-found page displayed when a route does not exist.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-24 text-center text-white">
      <h1 className="text-5xl font-bold">Sidan kunde inte hittas</h1>
      <p className="mt-4 text-gray-400">
        Den sida du försökte nå finns inte. Kontrollera att adressen är korrekt eller gå tillbaka till startsidan.
      </p>
      <a
        href="/"
        className="mt-6 inline-block rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-black hover:bg-cyan-400"
      >
        Till startsidan
      </a>
    </div>
  )
}