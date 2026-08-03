'use client'

import { useEffect, useState } from 'react'

type Status = {
  status: 'accepted' | 'processing' | 'needs_customer_information' | 'completed' | 'rejected' | 'failed'
  stage: string
  customer_number?: string | null
  supplier_switch_status?: string | null
  missing_customer_action: boolean
  next_step?: string | null
  blocking_reason?: string | null
  updated_at: string | null
}

const LABELS: Record<Status['status'], { title: string; body: string }> = {
  accepted: { title: 'Ansökan mottagen', body: 'Vi har tagit emot ansökan och kontrollerar uppgifterna.' },
  processing: { title: 'Behandlas', body: 'Ansökan behandlas nu av Gridex.' },
  needs_customer_information: { title: 'Vi behöver fler uppgifter', body: 'Kontrollera din e-post eller Mina sidor för vad som behöver kompletteras.' },
  completed: { title: 'Avtalet är aktivt', body: 'Ansökningsflödet är klart. Leverantörsbytets detaljstatus kan visas separat.' },
  rejected: { title: 'Ansökan kunde inte godkännas', body: 'Du får mer information via e-post eller Mina sidor.' },
  failed: { title: 'Ansökan behöver hanteras', body: 'Vi behöver kontrollera ärendet innan det kan fortsätta.' },
}

export default function ApplicationStatusCard({ applicationNumber, resultToken, initialStatus }: {
  applicationNumber: string
  resultToken: string
  initialStatus: string
}) {
  const [status, setStatus] = useState<Status | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      const response = await fetch(
        `/api/checkout/applications/${encodeURIComponent(applicationNumber)}?result_token=${encodeURIComponent(resultToken)}`,
        { headers: { Accept: 'application/json' }, cache: 'no-store' },
      ).catch(() => null)
      if (!active) return
      if (!response?.ok) {
        setUnavailable(true)
        return
      }
      const payload = await response.json().catch(() => null) as { data?: Status } | null
      if (payload?.data) setStatus(payload.data)
    }
    void load()
    return () => { active = false }
  }, [applicationNumber, resultToken])

  const fallbackStatus: Status['status'] = Object.hasOwn(LABELS, initialStatus)
    ? initialStatus as Status['status']
    : 'accepted'
  const currentStatus = status?.status ?? fallbackStatus
  const copy = LABELS[currentStatus as Status['status']]

  return (
    <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5" data-application-status={currentStatus}>
      <div className="text-sm font-semibold text-white">{copy.title}</div>
      <p className="mt-2 text-sm leading-6 text-gray-200">{copy.body}</p>
      {status?.next_step ? <p className="mt-2 text-xs text-gray-400">Nästa steg: {status.next_step}</p> : null}
      {status?.missing_customer_action ? <p className="mt-2 text-xs text-amber-200">Åtgärd från dig krävs.</p> : null}
      {unavailable ? <p className="mt-2 text-xs text-gray-400">Aktuell status kunde inte hämtas. Din ansökan är fortfarande registrerad.</p> : null}
    </div>
  )
}
