'use client'

import { useEffect, useRef, useState } from 'react'
import type { AssigneeOptions } from '@/support/lib/assignees'

export default function AssigneeSelect({ initial, assigneeId }: {
  initial: AssigneeOptions
  assigneeId: string | null
}) {
  const [pages, setPages] = useState<AssigneeOptions[]>([])
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  const options = new Map<string, string>(assigneeId ? [[assigneeId, 'Nuvarande ansvarig']] : [])
  for (const page of [initial, ...pages]) {
    for (const option of page.options) options.set(option.id, option.label)
  }
  const nextPage = (pages.at(-1) ?? initial).nextPage

  async function loadMore() {
    if (nextPage === null || request.current) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setFailed(false)
    try {
      const response = await fetch(`/api/staff/assignees?page=${nextPage}`, {
        cache: 'no-store', redirect: 'error', signal: controller.signal,
      })
      if (!response.ok) throw new Error('Assignees unavailable')
      const result = await response.json() as AssigneeOptions
      if (!controller.signal.aborted) setPages(previous => [...previous, result])
    } catch {
      if (!controller.signal.aborted) setFailed(true)
    } finally {
      request.current = null
      if (!controller.signal.aborted) setPending(false)
    }
  }

  return (
    <>
      <label htmlFor="case-assignee">Medarbetare</label>
      <select id="case-assignee" name="assignee_user_id" defaultValue={assigneeId ?? ''}>
        <option value="">Ej tilldelat</option>
        {[...options].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
      {nextPage !== null && <button type="button" className="button" disabled={pending} onClick={() => void loadMore()}>
        {pending ? 'Hämtar medarbetare…' : 'Visa fler medarbetare'}
      </button>}
      {failed && <p role="alert">Fler medarbetare kunde inte hämtas. Försök igen.</p>}
    </>
  )
}
