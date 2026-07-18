'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function AuthSessionSync() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const { data } = supabase.auth.onAuthStateChange(() => {
      // Viktigt: App Router + RSC behöver refresh för att SSR-layouts ska revalidera user/role
      router.refresh()
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [router])

  return null
}
