// app/admin/contracts/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requirePermissionServer } from '@/lib/auth/requirePermissionServer'
import { logPermissionAudit } from '@/lib/auth/audit'

type ContractType = 'spot_hourly' | 'portfolio_managed' | 'fixed'

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

function normalizeType(v: unknown): ContractType {
  if (v === 'spot_hourly' || v === 'portfolio_managed' || v === 'fixed') return v
  return 'spot_hourly'
}

export async function createContract(formData: FormData) {
  const name = String(formData.get('name') || '').trim()
  const slugInput = String(formData.get('slug') || '').trim()
  const contract_type = normalizeType(formData.get('contract_type'))
  const is_active = String(formData.get('is_active') || 'true') === 'true'

  if (!name) throw new Error('Name is required')

  const slug = slugInput ? slugify(slugInput) : slugify(name)
  if (!slug) throw new Error('Slug is invalid')

  // ✅ Step B: require permission for mutation
  const { supabase, user } = await requirePermissionServer('contracts.write')

  // Unique check
  const { data: existing, error: exErr } = await supabase
    .from('contract_products')
    .select('id')
    .eq('slug', slug)
    .maybeSingle<{ id: string }>()

  if (exErr) throw new Error(exErr.message)
  if (existing?.id) throw new Error('Slug already exists')

  const { error } = await supabase.from('contract_products').insert({
    name,
    slug,
    contract_type,
    is_active,
  })

  if (error) throw new Error(error.message)

  await logPermissionAudit({
    actorId: user.id,
    action: 'contracts.create',
    metadata: { name, slug, contract_type, is_active },
  })

  revalidatePath('/admin/contracts')
  revalidatePath('/admin/pricing')
}

export async function setContractActive(formData: FormData) {
  const id = String(formData.get('id') || '').trim()
  const is_active = String(formData.get('is_active') || 'true') === 'true'
  if (!id) throw new Error('Missing id')

  // ✅ Step B
  const { supabase, user } = await requirePermissionServer('contracts.write')

  const { error } = await supabase
    .from('contract_products')
    .update({ is_active })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await logPermissionAudit({
    actorId: user.id,
    action: 'contracts.set_active',
    metadata: { id, is_active },
  })

  revalidatePath('/admin/contracts')
  revalidatePath('/admin/pricing')
}