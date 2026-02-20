'use client'

import { createContext, useContext } from 'react'

type PermissionsContextType = {
  permissions: string[]
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: [],
})

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: string[]
  children: React.ReactNode
}) {
  return (
    <PermissionsContext.Provider value={{ permissions }}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  return useContext(PermissionsContext)
}