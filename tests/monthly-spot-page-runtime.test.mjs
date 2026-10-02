import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const state = globalThis.__gridexMonthlySpotPage = {
  context: { userId: 'actor', permissions: [], supabase: { from() { throw new Error('session RLS rejects server-only gridex_can') } } },
  globalPermissions: [], queries: [], readError: null, prices: [20, 20, 20, 20],
}
const fixture = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const mocks = {
  '@/lib/admin/getAdminContext': fixture('export const getAdminContext = async () => globalThis.__gridexMonthlySpotPage.context;'),
  '@/app/admin/ui/OpsSourceNotice': fixture('export default function OpsSourceNotice() { return null; }'),
  'next/link': fixture("export default 'a';"),
  'next/navigation': fixture('export const redirect = (path) => { throw new Error(`redirect:${path}`); };'),
  './actions': fixture('export const publishActiveAction = async () => {}; export const rollbackAction = async () => {}; export const savePricesAction = async () => {};'),
  '@/lib/supabase/service': fixture(`export const supabaseService = {
    rpc: async () => ({ data: globalThis.__gridexMonthlySpotPage.globalPermissions, error: null }),
    from(table) {
      const state = globalThis.__gridexMonthlySpotPage;
      const query = { table, selected: '', limit: null, filters: [] }; state.queries.push(query);
      const result = () => {
        if (state.readError) return { data: null, error: state.readError };
        if (table === 'gridex_spot_basis_config') return { data: { active_year: 2026, active_month: 9 }, error: null };
        if (table === 'gridex_spot_basis_publish_log') return { data: [{ id: 'log', action: 'publish', active_year: 2026, active_month: 9, reason: 'Verified operator reason', created_at: '2026-10-02T12:00:00Z', created_by: 'actor' }], error: null };
        if (query.selected === 'year') return { data: [{ year: 2026 }], error: null };
        return { data: ['SE1', 'SE2', 'SE3', 'SE4'].map((price_area, index) => ({ price_area, year: 2026, month: 9, avg_spot_ore: state.prices[index], updated_at: '2026-10-02T12:00:00Z' })), error: null };
      };
      return {
        select(fields) { query.selected = fields; return this; }, eq(column, value) { query.filters.push({ column, value }); return this; },
        order() { return this; }, limit(value) { query.limit = value; return this; }, returns() { return this; },
        maybeSingle: async () => result(), then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
      };
    },
  };`),
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
    if (url.startsWith('file:') && /\.tsx?$/.test(url)) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { fileName: fileURLToPath(url),
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      }).outputText }
    return nextLoad(url, context)
  },
})
const { default: MonthlySpotPage } = await import('../app/admin/monthly-spot/page.tsx')
const input = { searchParams: Promise.resolve({ year: '2026', month: '9' }) }
for (const permissions of [['spot.read'], ['admin.access', 'support_tickets.read']]) {
  state.context.permissions = permissions
  state.globalPermissions = []
  await assert.rejects(() => MonthlySpotPage(input), /redirect:\/admin/)
}
state.context.userId = ''
state.globalPermissions = ['spot.read']
await assert.rejects(() => MonthlySpotPage(input), /redirect:\/login\?next=\/admin/)
assert.deepEqual(state.queries, [], 'all denials precede privileged page data reads')
state.context.userId = 'actor'
state.context.permissions = ['spot.read']
state.globalPermissions = ['spot.read']
const tree = await MonthlySpotPage(input)
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('')
  if (node && typeof node === 'object') return text(node.props?.children)
  return node == null || typeof node === 'boolean' ? '' : String(node)
}
assert.ok(text(tree).includes('Spot-basis (månadsgenomsnitt)'))
assert.ok(text(tree).includes('Verified operator reason'), 'the actual page renders log data even though session RLS would reject it')
assert.equal(state.queries.find((query) => query.table === 'gridex_spot_basis_publish_log').limit, 10, 'history remains bounded')
assert.ok(state.queries.filter((query) => query.table === 'gridex_monthly_spot_prices' && query.selected !== 'year')
  .every((query) => query.filters.some((filter) => filter.column === 'year') && query.filters.some((filter) => filter.column === 'month')),
  'spot price reads remain scoped to a requested period')
state.prices = [-5, 0, 20, 10]
const signedTree = await MonthlySpotPage(input)
assert.ok(text(signedTree).includes('Klar för publik prisberäkning'), 'finite negative and zero prices provide complete spot data for all four areas')
assert.ok(!text(signedTree).includes('Saknar publik prisgrund'))
state.prices = [NaN, 0, 20, 10]
assert.ok(text(await MonthlySpotPage(input)).includes('Saknar publik prisgrund'), 'non-finite prices still fail readiness')
state.readError = { message: 'synthetic monthly data failure' }
await assert.rejects(() => MonthlySpotPage(input), /synthetic monthly data failure/, 'a failed read cannot render a successful empty administration view')
delete globalThis.__gridexMonthlySpotPage
console.log('Monthly spot page guards global scope before service reads and renders bounded data without failing session-only RLS')
