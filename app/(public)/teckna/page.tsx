import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ElectricityCalculator from '@/components/ElectricityCalculator'

export const metadata: Metadata = {
  title: 'Teckna elavtal – snabbt & transparent',
  description:
    'Räkna ditt elpris och teckna elavtal direkt. Full specifikation innan du bekräftar.',
  alternates: { canonical: 'https://gridex.se/teckna' },
}

type ContractOption = {
  name: string
  slug: string
}

export default async function TecknaPage() {
  const supabase = await createSupabaseServerClient()
  const nowIso = new Date().toISOString()

  const { data: contracts } = await supabase
    .from('contract_products')
    .select('id,name,slug')
    .eq('is_active', true)

  const contractIds = (contracts ?? []).map((c) => c.id)

  const { data: published } = await supabase
    .from('contract_pricing_versions')
    .select('contract_id')
    .in('contract_id', contractIds.length ? contractIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('status', 'published')
    .lte('valid_from', nowIso)

  const publishedIds = new Set((published ?? []).map((r) => r.contract_id as string))

  const options: ContractOption[] = (contracts ?? [])
    .filter((c) => publishedIds.has(c.id))
    .map((c) => ({
      name: c.name,
      slug: c.slug,
    }))

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 space-y-12">
      <div>
        <h1 className="text-4xl font-bold">Teckna elavtal</h1>
        <p className="text-gray-400 mt-3 max-w-2xl">
          Börja med att räkna ditt elpris. Du ser full specifikation innan du går vidare.
        </p>
      </div>

      <ElectricityCalculator contracts={options} />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Vad händer efter?</h2>
        <p className="text-gray-400">
          Efter att du har valt avtal och sett specifikationen går du vidare till teckningsflödet.
          Alla priser baseras på publicerade versioner och är områdesanpassade.
        </p>
      </section>
    </div>
  )
}