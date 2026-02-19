'use client'

import { useState } from 'react'

export default function KundserviceClient() {
  const [sent, setSent] = useState(false)

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-16 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Kundservice</h1>
          <p className="text-gray-400 mt-2">
            Har du frågor om ditt elavtal, faktura eller priser?
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <div className="text-emerald-400 font-semibold">
              Tack! Ditt ärende har skickats.
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSent(true)
            }}
            className="space-y-4"
          >
            <input
              type="text"
              placeholder="Namn"
              required
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3"
            />
            <input
              type="email"
              placeholder="E-post"
              required
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3"
            />
            <textarea
              placeholder="Beskriv ditt ärende"
              required
              rows={5}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3"
            />
            <button
              type="submit"
              className="bg-cyan-500 text-black font-bold px-6 py-3 rounded-lg"
            >
              Skicka ärende
            </button>
          </form>
        )}

        <div className="text-sm text-gray-500">
          Alternativt maila oss på{' '}
          <a
            href="mailto:support@gridex.se"
            className="text-cyan-400 underline"
          >
            support@gridex.se
          </a>
        </div>
      </div>
    </div>
  )
}