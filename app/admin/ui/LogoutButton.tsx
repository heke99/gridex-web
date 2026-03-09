'use client'

import LogoutForm from '@/components/account/LogoutForm'

export default function LogoutButton({
  fullWidth = false,
}: {
  fullWidth?: boolean
}) {
  return (
    <LogoutForm
      redirectTo="/login"
      variant="ghost"
      label="Logga ut"
      className={fullWidth ? 'w-full' : undefined}
    />
  )
}