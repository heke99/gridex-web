'use client'

import { useMemo, useState } from 'react'
import { faqCategoryLabels, type FaqCategory, type FaqItem } from '@/lib/content/faq'

export default function FaqExplorer({ items }: { items: FaqItem[] }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FaqCategory | 'all'>('all')
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('sv-SE')
    return items.filter((item) => {
      if (category !== 'all' && item.category !== category) return false
      return !needle || `${item.question} ${item.answer}`.toLocaleLowerCase('sv-SE').includes(needle)
    })
  }, [category, items, query])

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-gray-950 p-5 md:p-6">
        <label htmlFor="faq-search" className="text-sm font-semibold text-white">Sök bland frågor och svar</label>
        <input id="faq-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Till exempel anläggnings-ID, pris eller Mina sidor" className="mt-3 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none placeholder:text-gray-600 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20" />
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtrera frågor efter kategori">
          <FilterButton active={category === 'all'} onClick={() => setCategory('all')}>Alla</FilterButton>
          {(Object.entries(faqCategoryLabels) as Array<[FaqCategory, string]>).map(([value, label]) => <FilterButton key={value} active={category === value} onClick={() => setCategory(value)}>{label}</FilterButton>)}
        </div>
      </section>
      <div aria-live="polite" className="text-sm text-gray-400">{filtered.length} {filtered.length === 1 ? 'fråga' : 'frågor'}</div>
      {filtered.length > 0 ? (
        <div className="space-y-8">
          {(Object.entries(faqCategoryLabels) as Array<[FaqCategory, string]>).map(([categoryKey, label]) => {
            const categoryItems = filtered.filter((item) => item.category === categoryKey)
            if (categoryItems.length === 0) return null
            return <section key={categoryKey}><h2 className="text-xl font-bold text-white">{label}</h2><div className="mt-4 space-y-3">{categoryItems.map((item) => <details key={item.id} className="rounded-2xl border border-white/10 bg-gray-950 p-5"><summary className="cursor-pointer font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40">{item.question}</summary><p className="mt-3 max-w-4xl text-sm leading-7 text-gray-300">{item.answer}</p></details>)}</div></section>
          })}
        </div>
      ) : <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-gray-400">Inga frågor matchade sökningen. Prova ett annat ord eller kontakta kundservice.</div>}
    </div>
  )
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${active ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'}`}>{children}</button>
}
