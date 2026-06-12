import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ansökan mottagen – Gridex',
  description: 'Bekräftelse på att Gridex har tagit emot din ansökan.',
  robots: { index: false, follow: false },
}

function customerTextForStatus(status: string) {
  switch (status) {
    case 'needs_facility_data':
    case 'facility_data_requested':
      return 'Vi har tagit emot din ansökan och kontrollerar dina anläggningsuppgifter.'
    case 'ready_for_switch':
      return 'Din ansökan är mottagen och uppgifterna är redo för nästa steg.'
    case 'switch_requested':
      return 'Din ansökan är mottagen och leverantörsbytet är påbörjat.'
    default:
      return 'Vi har tagit emot din ansökan och går vidare med nästa steg i Gridex OPS.'
  }
}

function labelForMissing(field: string) {
  switch (field) {
    case 'metering_point_id':
      return 'Mätpunkts-ID saknas eller behöver verifieras.'
    case 'facility_id':
      return 'Anläggnings-ID saknas eller behöver verifieras.'
    case 'facility_verified':
      return 'Anläggningsuppgifter behöver verifieras.'
    case 'power_of_attorney':
      return 'Fullmakt behöver sparas eller verifieras.'
    default:
      return field.replaceAll('_', ' ')
  }
}

export default async function TackPage({
  searchParams,
}: {
  searchParams?: Promise<{
    status?: string
    customerNumber?: string
    contractNumber?: string
    applicationNumber?: string
    nextStep?: string
    missing?: string
  }>
}) {
  const params = (await searchParams) ?? {}
  const missing = (params.missing ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const status = params.status ?? 'application_received'

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <section className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          Ansökan mottagen
        </div>

        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Tack! Din ansökan är skickad.
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">
          {customerTextForStatus(status)}
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Info label="Kundnummer" value={params.customerNumber ?? 'Skapas i OPS'} />
          <Info label="Avtalsnummer" value={params.contractNumber ?? 'Skapas i OPS'} />
          <Info label="Ansökningsnummer" value={params.applicationNumber ?? '—'} />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-semibold text-white">Status</div>
          <div className="mt-1 text-sm text-gray-300">{status.replaceAll('_', ' ')}</div>
          {params.nextStep ? (
            <div className="mt-2 text-xs text-gray-500">
              Nästa steg: {params.nextStep.replaceAll('_', ' ')}
            </div>
          ) : null}
        </div>

        {missing.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="text-sm font-semibold text-amber-100">
              Uppgifter som kan behöva kompletteras
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-50/80">
              {missing.map((field) => (
                <li key={field}>{labelForMissing(field)}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-amber-50/70">
              Du behöver inte skicka in en ny ansökan. Gridex OPS hanterar nästa steg.
            </p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-xl bg-cyan-500 px-6 py-3 text-center font-bold text-black transition hover:bg-cyan-400"
          >
            Till startsidan
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 px-6 py-3 text-center text-gray-200 transition hover:border-cyan-500/40 hover:bg-white/5"
          >
            Gå till Mina sidor
          </Link>
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 break-words text-lg font-semibold text-white">{value}</div>
    </div>
  )
}
