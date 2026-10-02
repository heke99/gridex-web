'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function AuthSessionSync() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // The server already verified the session for this render. Refreshing on
      // initial hydration would repeat the entire private page's data loading.
      if (event === 'INITIAL_SESSION') return
      // Viktigt: App Router + RSC behöver refresh för att SSR-layouts ska revalidera user/role
      router.refresh()
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [router])

  return null
}
