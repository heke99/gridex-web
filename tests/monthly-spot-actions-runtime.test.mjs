import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const state = globalThis.__gridexMonthlySpotActions = {
  context: { userId: 'verified-actor', permissions: ['spot.write', 'spot.publish'] },
  globalPermissions: [], calls: [], revalidated: [], error: null,
}
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const mocks = {
  '@/lib/admin/getAdminContext': fixture('export const getAdminContext = async () => globalThis.__gridexMonthlySpotActions.context;'),
  '@/lib/supabase/service': fixture(`export const supabaseService = { rpc: async (name, args) => {
    const state = globalThis.__gridexMonthlySpotActions;
    if (name === 'gridex_get_user_permissions') return { data: state.globalPermissions, error: null };
    state.calls.push({ name, args }); return { data: null, error: state.error };
  } };`),
  'next/cache': fixture('export const revalidatePath = (path) => { globalThis.__gridexMonthlySpotActions.revalidated.push(path); };'),
  'next/navigation': fixture('export const redirect = (path) => { const error = new Error(`redirect:${path}`); error.path = path; throw error; };'),
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './getAdminContext' && context.parentURL?.endsWith('/lib/admin/guards.ts')) {
      return { url: mocks['@/lib/admin/getAdminContext'], shortCircuit: true }
    }
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
    if (specifier.startsWith('@/')) return { url: pathToFileURL(resolve(`${specifier.slice(2)}.ts`)).href, shortCircuit: true }
    if (specifier === './access' && context.parentURL?.endsWith('/lib/admin/guards.ts')) {
      return { url: pathToFileURL(resolve('lib/admin/access.ts')).href, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.ts')) return { format: 'module', shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8')) }
    return nextLoad(url, context)
  },
})
const { savePricesAction, publishActiveAction, rollbackAction } = await import('../app/admin/monthly-spot/actions.ts')
const form = new FormData()
form.set('year', '2026'); form.set('month', '9'); form.set('reason', 'Approved period')
for (const [index, area] of ['SE1', 'SE2', 'SE3', 'SE4'].entries()) form.set(`${area}_avg_spot_ore`, index === 0 ? '-7,25' : String(index + 1))
for (const action of [savePricesAction, publishActiveAction, rollbackAction]) {
  await assert.rejects(() => action(form), (error) => error.status === 403,
    'company-only spot grants cannot mutate global monthly configuration')
}
state.globalPermissions = ['admin.access', 'support_tickets.manage']
for (const action of [savePricesAction, publishActiveAction, rollbackAction]) {
  await assert.rejects(() => action(form), (error) => error.status === 403)
}
state.globalPermissions = ['spot.write']
await assert.rejects(() => publishActiveAction(form), (error) => error.status === 403)
await assert.rejects(() => rollbackAction(form), (error) => error.status === 403)
state.context.userId = ''
await assert.rejects(() => savePricesAction(form), (error) => error.status === 401)
state.context.userId = 'verified-actor'
assert.deepEqual(state.calls, [], 'denied requests cannot call mutation RPCs')

form.set('month', '1.5')
await assert.rejects(() => savePricesAction(form), /Ogiltigt year\/month/)
form.set('month', '9'); form.set('year', 'Infinity')
await assert.rejects(() => savePricesAction(form), /Ogiltigt year\/month/)
form.set('year', '2026'); form.set('SE4_avg_spot_ore', '')
await assert.rejects(() => savePricesAction(form), /Ogiltigt värde för SE4/)
form.set('SE4_avg_spot_ore', 'Infinity')
await assert.rejects(() => savePricesAction(form), /Ogiltigt värde för SE4/)
assert.deepEqual(state.calls, [])
form.set('SE4_avg_spot_ore', '4')
await assert.rejects(() => savePricesAction(form), (error) => error.path === '/admin/monthly-spot?year=2026&month=9')
assert.deepEqual(state.calls.at(-1), {
  name: 'gridex_web_save_monthly_spot_prices', args: {
    p_actor_id: 'verified-actor', p_year: 2026, p_month: 9,
    p_rows: [{ price_area: 'SE1', avg_spot_ore: -7.25 }, { price_area: 'SE2', avg_spot_ore: 2 },
      { price_area: 'SE3', avg_spot_ore: 3 }, { price_area: 'SE4', avg_spot_ore: 4 }],
  },
}, 'the service RPC receives the verified actor and one validated four-area transaction')
state.globalPermissions = ['spot.publish']
await assert.rejects(() => publishActiveAction(form), (error) => error.path === '/admin/monthly-spot?year=2026&month=9')
assert.deepEqual(state.calls.at(-1), { name: 'gridex_web_publish_spot_basis', args: {
  p_actor_id: 'verified-actor', p_year: 2026, p_month: 9, p_reason: 'Approved period',
} })
await assert.rejects(() => rollbackAction(form), (error) => error.path === '/admin/monthly-spot')
assert.deepEqual(state.calls.at(-1), { name: 'gridex_web_rollback_spot_basis', args: {
  p_actor_id: 'verified-actor', p_reason: 'Approved period',
} })
const priorRefreshes = state.revalidated.length
state.error = { message: 'synthetic atomic RPC failure' }
await assert.rejects(() => publishActiveAction(form), /synthetic atomic RPC failure/)
await assert.rejects(() => rollbackAction(form), /synthetic atomic RPC failure/)
state.globalPermissions = ['spot.write']
await assert.rejects(() => savePricesAction(form), /synthetic atomic RPC failure/)
assert.equal(state.revalidated.length, priorRefreshes, 'RPC failure cannot redirect or refresh as a successful save')
delete globalThis.__gridexMonthlySpotActions
console.log('Monthly spot actions enforce fresh global operation rights, validate all areas and use actor-bearing atomic service RPCs')
