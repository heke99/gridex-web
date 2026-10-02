import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const state = globalThis.__gridexPostalActions = {
  context: { userId: 'staff', permissions: ['pricing.write'], supabase: {} },
  globalPermissions: [], writes: [], revalidated: [], error: null,
}
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const mocks = {
  '@/lib/admin/getAdminContext': fixture('export const getAdminContext = async () => globalThis.__gridexPostalActions.context;'),
  '@/lib/supabase/service': fixture(`export const supabaseService = {
    rpc: async () => ({ data: globalThis.__gridexPostalActions.globalPermissions, error: null }),
    from: (table) => ({ upsert: async (payload, options) => {
      const state = globalThis.__gridexPostalActions;
      state.writes.push({ table, payload, options }); return { error: state.error };
    } }),
  };`),
  'next/cache': fixture('export const revalidatePath = (path) => { globalThis.__gridexPostalActions.revalidated.push(path); };'),
  'next/navigation': fixture('export const redirect = (path) => { throw new Error(`redirect:${path}`); };'),
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
    if (url.startsWith('file:') && url.endsWith('.ts')) {
      return { format: 'module', source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8')), shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})

const { bulkPasteAction, upsertSingleAction } = await import('../app/admin/postal-areas/actions.ts')
const single = new FormData()
single.set('postal_code', '111 22')
single.set('price_area', 'SE3')
const bulk = new FormData()
bulk.set('bulk', '11122,SE3\n21100,SE4')
for (const action of [upsertSingleAction, bulkPasteAction]) {
  await assert.rejects(() => action(action === upsertSingleAction ? single : bulk), (error) => error.status === 403,
    'a company-only pricing.write cannot update the global postal map')
}
state.globalPermissions = ['admin.access', 'support_tickets.manage']
for (const action of [upsertSingleAction, bulkPasteAction]) {
  await assert.rejects(() => action(action === upsertSingleAction ? single : bulk), (error) => error.status === 403,
    'support console entry does not grant postal mutation authority')
}
state.context.userId = ''
state.globalPermissions = ['pricing.write']
await assert.rejects(() => bulkPasteAction(bulk), (error) => error.status === 401)
assert.equal(state.writes.length, 0, 'all denials precede privileged mutations')

state.context.userId = 'staff'
single.set('postal_code', 'ABCDE')
await assert.rejects(() => upsertSingleAction(single), /5 siffror/)
single.set('postal_code', '111 22')
single.set('price_area', 'SE5')
await assert.rejects(() => upsertSingleAction(single), /Ogiltigt elområde/)
assert.equal(state.writes.length, 0, 'invalid mapping cannot reach the service write')
single.set('price_area', 'SE3')
await upsertSingleAction(single)
assert.deepEqual(state.writes.at(-1), {
  table: 'gridex_postal_code_price_area', payload: { postal_code: '11122', price_area: 'SE3', source: 'admin' },
  options: { onConflict: 'postal_code' },
})
bulk.set('bulk', '11122,SE3\nABCDE,SE4\n111 22,SE2\n21100,SE4\n12345,SE5')
await bulkPasteAction(bulk)
assert.deepEqual(state.writes.at(-1).payload, [
  { postal_code: '11122', price_area: 'SE2', source: 'admin' },
  { postal_code: '21100', price_area: 'SE4', source: 'admin' },
], 'valid mappings are numeric and repeated keys cannot break PostgreSQL upsert')
const writesBefore = state.writes.length
bulk.set('bulk', 'ABCDE,SE4\n11122,SE5')
await assert.rejects(() => bulkPasteAction(bulk), /Inga giltiga rader/)
assert.equal(state.writes.length, writesBefore)
state.error = { message: 'synthetic database failure' }
bulk.set('bulk', '11122,SE3')
await assert.rejects(() => bulkPasteAction(bulk), /synthetic database failure/)
assert.deepEqual(state.revalidated, ['/admin/postal-areas', '/admin/postal-areas'], 'failed writes never revalidate success')
delete globalThis.__gridexPostalActions
console.log('Postal actions enforce global pricing.write, validate postcodes, deduplicate imports and preserve database errors')
