'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const supabase = createSupabaseBrowserClient()

export default function AuthSessionSync() {
  const router = useRouter()

  useEffect(() => {
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