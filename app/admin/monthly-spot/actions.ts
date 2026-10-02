'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireGlobalAdminActionAccess } from '@/lib/admin/guards'
import { supabaseService } from '@/lib/supabase/service'

const AREAS = ['SE1', 'SE2', 'SE3', 'SE4'] as const

function period(formData: FormData) {
  const year = Number(formData.get('year'))
  const month = Number(formData.get('month'))
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Ogiltigt year/month')
  }
  return { year, month }
}

function refresh() {
  for (const path of ['/admin', '/admin/monthly-spot', '/admin/pricing', '/admin/calculator',
    '/admin/customer-spec', '/avtal', '/elavtal', '/teckna', '/teckna-avtal', '/elpris', '/api/web/market-price/current']) {
    revalidatePath(path)
  }
}

export async function savePricesAction(formData: FormData) {
  const ctx = await requireGlobalAdminActionAccess({ allOf: ['spot.write'] })
  const { year, month } = period(formData)
  const rows = AREAS.map((price_area) => {
    const raw = String(formData.get(`${price_area}_avg_spot_ore`) ?? '').trim().replace(',', '.')
    const avg_spot_ore = raw ? Number(raw) : NaN
    if (!Number.isFinite(avg_spot_ore)) throw new Error(`Ogiltigt värde för ${price_area}`)
    return { price_area, avg_spot_ore }
  })
  const { error } = await supabaseService.rpc('gridex_web_save_monthly_spot_prices', {
    p_actor_id: ctx.userId, p_year: year, p_month: month, p_rows: rows,
  })
  if (error) throw new Error(error.message)
  refresh()
  redirect(`/admin/monthly-spot?year=${year}&month=${month}`)
}

export async function publishActiveAction(formData: FormData) {
  const ctx = await requireGlobalAdminActionAccess({ allOf: ['spot.publish'] })
  const { year, month } = period(formData)
  const reason = String(formData.get('reason') ?? '').trim() || null
  const { error } = await supabaseService.rpc('gridex_web_publish_spot_basis', {
    p_actor_id: ctx.userId, p_year: year, p_month: month, p_reason: reason,
  })
  if (error) throw new Error(error.message)
  refresh()
  redirect(`/admin/monthly-spot?year=${year}&month=${month}`)
}

export async function rollbackAction(formData: FormData) {
  const ctx = await requireGlobalAdminActionAccess({ allOf: ['spot.publish'] })
  const reason = String(formData.get('reason') ?? '').trim() || null
  const { error } = await supabaseService.rpc('gridex_web_rollback_spot_basis', {
    p_actor_id: ctx.userId, p_reason: reason,
  })
  if (error) throw new Error(error.message)
  refresh()
  redirect('/admin/monthly-spot')
}
