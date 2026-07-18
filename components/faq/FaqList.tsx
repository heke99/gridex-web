import Link from 'next/link'
import type { FaqItem } from '@/lib/content/faq'

export default function FaqList({
  items,
  title = 'Vanliga frågor',
  showAllLink = false,
}: {
  items: FaqItem[]
  title?: string
  showAllLink?: boolean
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-gray-950 p-6 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {showAllLink ? <Link href="/vanliga-fragor" className="text-sm font-semibold text-cyan-300 underline underline-offset-4">Se alla frågor</Link> : null}
      </div>
      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <details key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40">{item.question}</summary>
            <p className="mt-3 text-sm leading-6 text-gray-300">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
