'use client'

import { usePermissions } from './PermissionsProvider'

export function Can({
  permission,
  children,
}: {
  permission: string
  children: React.ReactNode
}) {
  const { permissions } = usePermissions()

  if (!permissions.includes(permission)) {
    return null
  }

  return <>{children}</>
}