'use client'

// This file defines a global error boundary that catches unexpected errors
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  console.error('Global error captured', error)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-24 text-center text-white">
      <h1 className="text-5xl font-bold">Ett oväntat fel uppstod</h1>
      <p className="mt-4 text-gray-400">
        Vi kunde inte visa sidan på grund av ett fel. Försök igen senare eller kontakta kundservice.
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