import Link from 'next/link'
import { supabaseService } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

type LegacySignature = {
  sign_method: string
  email_signed_at: string | null
}

export default async function EmailSign({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  let state: 'invalid' | 'unavailable' | 'retired' | 'recorded' = 'invalid'

  if (typeof token === 'string' && token.length > 0 && token.length <= 300) {
    const { data, error } = await supabaseService
      .from('contract_agreements')
      .select('sign_method,email_signed_at')
      .eq('email_sign_token', token)
      .limit(2)
      .returns<LegacySignature[]>()

    if (error) {
      state = 'unavailable'
    } else if (data?.length === 1 && data[0].sign_method === 'email') {
      const signedAt = data[0].email_signed_at
      state = signedAt && Number.isFinite(Date.parse(signedAt)) ? 'recorded' : 'retired'
    }
  }

  // The canonical OPS signup does not use this legacy issuer. Its unsigned
  // rows lack immutable legal/pricing evidence, so an old bearer link cannot
  // grant signing authority or trigger PDF generation.
  const copy = {
    invalid: {
      title: 'Signeringslänken är ogiltig',
      message: 'Kontrollera din aktuella beställning på Mina sidor eller kontakta kundservice.',
    },
    unavailable: {
      title: 'Signeringslänken kunde inte kontrolleras',
      message: 'Försök igen om en stund eller kontakta kundservice.',
    },
    retired: {
      title: 'Den här länken kan inte användas för signering',
      message: 'Det här är en äldre signeringslänk. Se din aktuella beställning på Mina sidor eller kontakta kundservice för hjälp.',
    },
    recorded: {
      title: 'En signering är redan registrerad',
      message: 'Logga in på Mina sidor för att se din aktuella avtalsstatus.',
    },
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <div className="rounded-3xl border border-gray-800 bg-gray-950 p-8 text-center">
        <h1 className="text-2xl font-bold text-white">{copy[state].title}</h1>
        <p className="mt-3 text-gray-400">{copy[state].message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-black hover:bg-cyan-400">
            Gå till Mina sidor
          </Link>
          <Link href="/dashboard/support" className="rounded-xl border border-white/10 px-4 py-3 font-semibold text-white hover:bg-white/5">
            Kontakta kundservice
          </Link>
        </div>
      </div>
    </div>
  )
}
