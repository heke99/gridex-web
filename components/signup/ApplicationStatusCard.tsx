'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { nextStepDescription, statusDescription } from '@/lib/customerPortal/statusHelper'
import type { OpsWebsiteApplicationStatus } from '@/lib/ops/client/types'
import { isStrictCalendarDate } from '@/lib/website/businessDate'
import { pollReceiptStatus } from '@/lib/website/receiptStatusPolling'

type Status = Omit<OpsWebsiteApplicationStatus, 'raw'>

type Receipt = {
  status: string
  pageState?: Status['checkout']['page_state']
  customerNumber: string | null
  contractNumber: string | null
  contractStatus: string | null
  signedAt: string | null
  withdrawalDeadlineAt: string | null
  nextStep: string | null
  powerOfAttorneySigned: boolean
}

const LABELS: Record<Status['status'], { title: string; body: string }> = {
  accepted: { title: 'Ansökan mottagen', body: 'Vi har tagit emot din teckning och hanterar nästa steg.' },
  processing: { title: 'Behandlas', body: 'Vi hanterar din teckning och kontaktar dig om vi behöver något från dig.' },
  needs_customer_information: { title: 'Vi behöver en komplettering', body: 'Kontrollera din e-post eller Mina sidor för information om vad vi behöver från dig.' },
  completed: { title: 'Klart', body: 'Teckningen är färdigbehandlad. Du kan följa ditt avtal och kommande steg via Mina sidor.' },
  rejected: { title: 'Teckningen kunde inte slutföras', body: 'Du får mer information via e-post eller Mina sidor.' },
  failed: { title: 'Teckningen kunde inte slutföras', body: 'Du får mer information via e-post eller Mina sidor.' },
}

const stockholmTime = new Intl.DateTimeFormat('sv-SE', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Stockholm',
})

function formatTimestamp(value: string | null) {
  if (!value) return null
  const instant = Date.parse(value)
  return Number.isFinite(instant) ? stockholmTime.format(instant) : null
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="text-xs uppercase tracking-wide text-gray-500">{label}</div><div className="mt-1 break-words text-lg font-semibold text-white">{value}</div></div>
}

export default function ApplicationStatusCard({ applicationNumber, resultToken, receipt, confirmation }: {
  applicationNumber: string | null
  resultToken: string
  receipt: Receipt
  confirmation?: ReactNode
}) {
  const [status, setStatus] = useState<Status | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    if (!applicationNumber || !resultToken) return
    return pollReceiptStatus<Status>(
      `/api/checkout/applications/${encodeURIComponent(applicationNumber)}?result_token=${encodeURIComponent(resultToken)}`,
      (data) => {
        if (!Object.hasOwn(LABELS, data.status)) return null
        setStatus(data)
        setUnavailable(false)
        const email = data.checkout?.confirmation_email
        return ['rejected', 'failed', 'completed'].includes(data.status)
          && (!email?.expected || ['delivered', 'failed', 'not_expected'].includes(email.status))
      },
      () => setUnavailable(true),
    )
  }, [applicationNumber, resultToken])

  const fallbackStatus: Status['status'] = Object.hasOwn(LABELS, receipt.status)
    ? receipt.status as Status['status']
    : 'processing'
  const reportedStatus = status?.status ?? fallbackStatus
  const pageState = status?.checkout?.page_state ?? (status ? undefined : receipt.pageState)
  const currentStatus = reportedStatus === 'rejected' || reportedStatus === 'failed' || reportedStatus === 'completed'
    ? reportedStatus
    : status?.checkout?.customer_action_required || pageState === 'action_required'
    ? 'needs_customer_information'
    : pageState === 'processing' ? 'processing' : reportedStatus
  const copy = LABELS[currentStatus]
  const agreement = status?.checkout?.agreement
  const contractStatus = agreement ? agreement.status : receipt.contractStatus
  const contractNumber = agreement ? agreement.contract_number : receipt.contractNumber
  const signedAt = formatTimestamp(agreement ? agreement.signed_at : receipt.signedAt)
  const withdrawalDeadline = formatTimestamp(agreement ? agreement.withdrawal_deadline_at : receipt.withdrawalDeadlineAt)
  const failed = currentStatus === 'rejected' || currentStatus === 'failed'
  const title = failed ? 'Din teckning kunde inte slutföras'
    : currentStatus === 'needs_customer_information' ? 'Din ansökan behöver kompletteras'
    : contractStatus === 'signed' || contractStatus === 'active' ? 'Ditt avtal är klart'
    : currentStatus === 'completed' ? 'Din teckning är färdigbehandlad'
    : pageState === 'processing' || currentStatus === 'processing' ? 'Din ansökan behandlas'
    : 'Tack! Din teckning är skickad.'
  const agreementCopy = contractStatus === 'signed' ? `Avtalet är signerat${signedAt ? ` ${signedAt}` : ''}.`
    : contractStatus === 'active' ? 'Avtalet är aktivt.'
    : failed || currentStatus === 'completed' ? 'Vi kan ännu inte bekräfta avtalets status.'
    : 'Avtalet behandlas fortfarande.'
  const confirmedStartDate = status?.confirmed_start_date
  const requestedStartDate = status?.requested_start_date
  const emailStatus = status?.checkout?.confirmation_email.status
  const emailCopy = emailStatus ? ({ not_expected: 'Ingen avtalsbekräftelse förväntas ännu.', pending: 'Avtalsbekräftelsen förbereds.', queued: 'Avtalsbekräftelsen är köad.', sent: 'Avtalsbekräftelsen har skickats.', delivered: 'Avtalsbekräftelsen har levererats till mottagarens mejlserver.', failed: 'Avtalsbekräftelsen kunde inte levereras. Vi följer upp ärendet.' }[emailStatus]) : null

  return <>
    <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">Teckning mottagen</div>
    <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">{title}</h1>
    <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">{status ? copy.body : statusDescription(receipt.status)}</p>
    <div className="mt-8 grid gap-4 md:grid-cols-3">
      <Info label="Kundnummer" value={(status ? status.customer_number : receipt.customerNumber) ?? '—'} />
      <Info label="Avtalsnummer" value={contractNumber ?? '—'} />
      <Info label="Ärendenummer" value={applicationNumber ?? '—'} />
    </div>
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-sm font-semibold text-white">Avtal och ångerrätt</div>
        <div className="mt-2 text-sm text-gray-300">{agreementCopy}</div>
        {withdrawalDeadline ? <div className="mt-2 text-xs text-gray-500">Ångerfristen löper till {withdrawalDeadline} svensk tid.</div> : null}
      </div>
      {confirmation}
    </div>
    <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5" data-application-status={currentStatus}>
      <div className="text-sm font-semibold text-white">{copy.title}</div>
      {failed || currentStatus === 'completed' ? null : <p className="mt-2 text-sm leading-6 text-gray-200">{nextStepDescription(status ? status.next_step : receipt.nextStep)}</p>}
      {receipt.powerOfAttorneySigned ? <p className="mt-2 text-xs text-emerald-300">Fullmakten mottogs vid inskickningen.</p> : null}
      {isStrictCalendarDate(confirmedStartDate) ? (
        <p className="mt-2 text-sm text-gray-200">Bekräftat startdatum <time dateTime={confirmedStartDate}>{confirmedStartDate}</time></p>
      ) : isStrictCalendarDate(requestedStartDate) ? (
        <p className="mt-2 text-sm text-gray-200">Önskat startdatum <time dateTime={requestedStartDate}>{requestedStartDate}</time></p>
      ) : null}
      {(status?.missing_customer_action || status?.checkout?.customer_action_required) ? <p className="mt-2 text-xs text-amber-200">Vi behöver en komplettering från dig. Kontrollera din e-post eller Mina sidor.</p> : null}
      {emailCopy ? <p className="mt-2 text-sm text-gray-300" role="status">{emailCopy}</p> : null}
      {unavailable ? <p className="mt-2 text-xs text-gray-400">Aktuell status kunde inte hämtas. Din teckning är fortfarande registrerad.</p> : null}
    </div>
  </>
}
