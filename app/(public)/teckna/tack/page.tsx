import { permanentRedirect } from 'next/navigation'

export default async function LegacySignupThanksPage({
  searchParams,
}: {
  searchParams?: Promise<{ result?: string }>
}) {
  const params = (await searchParams) ?? {}
  const suffix = params.result ? `?result=${encodeURIComponent(params.result)}` : ''
  permanentRedirect(`/teckna-avtal/tack${suffix}`)
}
