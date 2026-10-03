import type { CustomerResourcePage } from '@/lib/customerPortal/types'

export default function CustomerHistoryNotice({
  page,
  label,
  displayedCount,
}: {
  page: CustomerResourcePage | null | undefined
  label: string
  displayedCount?: number
}) {
  if (!page?.has_more || page.returned <= 0) return null

  return (
    <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
      Här visas de {displayedCount ?? page.returned} senaste {label}. Fler uppgifter finns tillgängliga.
      {' '}Kontakta kundservice om du behöver äldre uppgifter.
    </p>
  )
}
