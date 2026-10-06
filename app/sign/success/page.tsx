import Link from 'next/link'

export default function LegacySignStatus() {
  return <div className="mx-auto max-w-xl px-6 py-24 text-center">
    <h1 className="text-3xl font-bold">Kontrollera ditt avtals status</h1>
    <p className="mt-4 text-gray-400">Den äldre signeringssidan visar ingen verifierad avtalsstatus. Aktuella uppgifter finns på Mina sidor.</p>
    <Link href="/mina-sidor" className="mt-6 inline-block text-cyan-300">Öppna Mina sidor</Link>
  </div>
}
