'use client'

import Link from 'next/link'
import { useState, type ComponentProps } from 'react'

type Props = Omit<ComponentProps<typeof Link>, 'prefetch'>

/** Keep Next's navigation and invalidation, but warm menus only on hover/focus. */
export default function IntentLink({ onMouseEnter, onFocus, ...props }: Props) {
  const [activeHref, setActiveHref] = useState<Props['href'] | null>(null)
  return (
    <Link
      {...props}
      prefetch={activeHref === props.href ? null : false}
      onMouseEnter={(event) => {
        setActiveHref(props.href)
        onMouseEnter?.(event)
      }}
      onFocus={(event) => {
        setActiveHref(props.href)
        onFocus?.(event)
      }}
    />
  )
}
