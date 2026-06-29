import Link from 'next/link'
import { requireAdminPageAccess } from '@/lib/admin/guards'
import { supabaseService } from '@/lib/supabase/service'
import { finalizeAgreement } from '@/lib/contracts/finalizeAgreement'
import { ContractAgreement, LegalAcceptance } from '@/lib/types/contracts'

export const dynamic = 'force-dynamic'

function acceptanceTypeLabel(item: {
  type?: string | null
  acceptance_type?: string | null
  kind?: string | null
  category?: string | null
}) {
  return (
    item.type ??
    item.acceptance_type ??
    item.kind ??
    item.category ??
    'acceptance'
  )
}

export default async function AgreementDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireAdminPageAccess({ anyOf: ['agreements.read', 'agreements.write', 'admin.access'] })

  const { data: agreement, error: agreementError } = await supabaseService
    .from('contract_agreements')
    .select('*')
    .eq('id', id)
    .single<ContractAgreement>()

  if (agreementError) {
    throw new Error(agreementError.message)
  }

  const { data: legalData, error: legalError } = await supabaseService
    .from('legal_acceptances')
    .select('*')
    .eq('agreement_id', id)
    .order('accepted_at', { ascending: false })

  if (legalError) {
    throw new Error(legalError.message)
  }

  const legal = (legalData ?? []) as LegalAcceptance[]
  const signedAt =
    agreement?.bankid_completed_at ??
    agreement?.email_signed_at ??
    null

  const fullName =
    `${agreement?.first_name ?? ''} ${agreement?.last_name ?? ''}`.trim() ||
    agreement?.customer_name ||
    'Okänd kund'

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Avtalsdetalj</div>
            <h1 className="mt-2 text-3xl font-bold text-white">{fullName}</h1>
            <p className="mt-3 text-gray-400">
              {agreement?.email ?? 'Ingen e-post'} • {agreement?.contract_slug ?? 'Ingen contract slug'}
            </p>
          </div>

          {agreement?.user_id && (
            <Link
              href={`/admin/customers/${agreement.user_id}`}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20"
            >
              Öppna kundkort
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Info label="Status" value={agreement?.status ?? '—'} />
        <Info label="Signmetod" value={agreement?.sign_method ?? '—'} />
        <Info label="Signerad" value={signedAt ? formatDate(signedAt) : '—'} />
        <Info label="Aktiverad" value={agreement?.activated_at ? formatDate(agreement.activated_at) : '—'} />
        <Info label="Personnummer" value={agreement?.personal_number ?? '—'} />
        <Info label="Adress" value={agreement?.address ?? '—'} />
        <Info label="Postnummer" value={agreement?.postal_code ?? '—'} />
        <Info label="Telefon" value={agreement?.phone ?? '—'} />
      </div>

      <section className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Godkända villkor</h2>
            <p className="mt-2 text-sm text-gray-400">
              Visar när kunden godkände villkor, integritet och cookies.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <form
              action={async () => {
                'use server'
                await finalizeAgreement(id)
              }}
            >
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-black hover:bg-white/90"
              >
                Generera PDF + skicka mail
              </button>
            </form>

            <a
              href={`/api/agreements/${id}/pdf`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm hover:bg-white/10"
            >
              Ladda ner PDF
            </a>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {legal.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium text-white">{acceptanceTypeLabel(item)}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Version: {item.version ?? '—'}
                  </div>
                </div>
                <div className="text-xs text-gray-400">{formatDate(item.accepted_at)}</div>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-2 text-xs text-gray-500">
                <div className="break-all">IP: {item.ip_address ?? '—'}</div>
                <div className="break-all">Hash: {item.document_hash ?? '—'}</div>
              </div>
            </div>
          ))}

          {legal.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-800 bg-black/20 p-4 text-sm text-gray-500">
              Inga legal acceptances hittades för detta avtal.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-gray-800 bg-gray-950 p-5">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-sm text-white break-words">{value}</div>
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('sv-SE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}