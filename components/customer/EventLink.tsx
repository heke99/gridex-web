'use client'

import type { AnchorHTMLAttributes, ReactNode } from 'react'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  eventType: string
  entityType?: string
  entityId?: string | null
  children: ReactNode
}

export default function EventLink({
  eventType,
  entityType,
  entityId,
  children,
  onClick,
  ...props
}: Props) {
  function logEvent() {
    const payload = JSON.stringify({
      event_type: eventType,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      client_operation_id: `customer-event:${crypto.randomUUID()}`,
    })

    try {
      if (navigator.sendBeacon?.('/api/web/customer/events', new Blob([payload], { type: 'application/json' }))) return
    } catch { /* Navigation must work even when beacon is unavailable. */ }

    void fetch('/api/web/customer/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined)
  }

  return (
    <a
      {...props}
      onClick={(event) => {
        try { logEvent() } catch { /* Event logging must not interrupt navigation. */ }
        onClick?.(event)
      }}
    >
      {children}
    </a>
  )
}
