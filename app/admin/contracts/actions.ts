'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRole, assertCanPublish } from '@/lib/auth/admin'

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

  const supabase = await createSupabaseServerClient()
  const { role } = await requireAdminRole(supabase)
  assertCanPublish(role)

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

  revalidatePath('/admin/contracts')
}

export async function setContractActive(formData: FormData) {
  const id = String(formData.get('id') || '')
  const is_active = String(formData.get('is_active') || 'true') === 'true'
  if (!id) throw new Error('Missing id')

  const supabase = await createSupabaseServerClient()
  const { role } = await requireAdminRole(supabase)
  assertCanPublish(role)

  const { error } = await supabase
    .from('contract_products')
    .update({ is_active })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/contracts')
}