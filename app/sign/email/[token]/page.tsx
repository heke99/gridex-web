import Link from 'next/link'
export const dynamic = 'force-dynamic'

/** Retired legacy links must never mutate an agreement when fetched by mail scanners. */
export default async function EmailSign() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8 text-center">
        <h1 className="text-2xl font-bold text-white">Den här signeringslänken används inte längre</h1>
        <p className="mt-3 text-gray-400">Kontrollera avtalsstatusen på Mina sidor eller kontakta kundservice för en aktuell länk.</p>
        <Link href="/mina-sidor" className="mt-5 inline-block text-cyan-300">Öppna Mina sidor</Link>
      </div>
    </div>
  )
}
