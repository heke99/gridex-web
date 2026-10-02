import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { fileURLToPath } from 'node:url'

const userId = 'customer-target'
const date = '2026-10-02T12:00:00Z'
const otherUsers = Array.from({ length: 1200 }, (_, index) => `other-${index}`)
const rows = {
  customer_profiles: [...otherUsers.map((user_id) => ({ user_id, email: 'other@example.test' })),
    { user_id: userId, email: 'target@example.test', full_name: 'Target Customer' }],
  contract_agreements: [...otherUsers.map((user_id, index) => ({ user_id, id: `other-agreement-${index}`, created_at: date })),
    ...Array.from({ length: 620 }, (_, index) => ({ user_id: userId, id: `agreement-${String(index).padStart(4, '0')}`, created_at: date, status: 'email_signed' }))],
  legal_acceptances: [...otherUsers.map((_, index) => ({ id: `other-acceptance-${index}`, agreement_id: `other-agreement-${index}`, accepted_at: date })),
    ...Array.from({ length: 1240 }, (_, index) => ({ id: `acceptance-${String(index).padStart(4, '0')}`, agreement_id: `agreement-${String(Math.floor(index / 2)).padStart(4, '0')}`, accepted_at: date, type: 'terms' }))],
  customer_documents: [...otherUsers.map((user_id, index) => ({ user_id, id: `other-document-${index}`, created_at: date })),
    ...Array.from({ length: 510 }, (_, index) => ({ user_id: userId, id: `document-${String(index).padStart(4, '0')}`, created_at: date }))],
  customer_activity_events: [...otherUsers.map((user_id, index) => ({ user_id, id: `other-activity-${index}`, event_at: date })),
    ...Array.from({ length: 580 }, (_, index) => ({ user_id: userId, id: `activity-${String(index).padStart(4, '0')}`, event_at: date }))],
}
const state = globalThis.__gridexCustomerDetailPerformance = { calls: [], error: null }
rows.contract_agreements.find((row) => row.user_id === userId).status = 'finalized'
const service = {
  from(table) {
    const call = { table, filters: [], orders: [], range: null, limit: null }
    state.calls.push(call)
    return {
      select() { return this }, returns() { return this },
      eq(column, value) { call.filters.push({ kind: 'eq', column, value }); return this },
      in(column, value) { call.filters.push({ kind: 'in', column, value }); return this },
      order(column, options) { call.orders.push({ column, ascending: options.ascending }); return this },
      range(from, to) { call.range = { from, to }; return this },
      limit(limit) { call.limit = limit; return this },
      then(fulfilled, rejected) {
        let selected = [...rows[table]]
        for (const filter of call.filters) selected = selected.filter((row) => filter.kind === 'eq'
          ? row[filter.column] === filter.value : filter.value.includes(row[filter.column]))
        selected.sort((left, right) => {
          for (const order of call.orders) {
            const comparison = String(left[order.column]).localeCompare(String(right[order.column]))
            if (comparison) return order.ascending ? comparison : -comparison
          }
          return 0
        })
        // Simulate Supabase's row cap after database predicates. The target is
        // beyond this cap in the global fixtures and still must be found.
        if (call.range) selected = selected.slice(call.range.from, call.range.to + 1)
        selected = selected.slice(0, call.limit ?? 1000)
        return Promise.resolve({ data: state.error ? null : selected, error: state.error }).then(fulfilled, rejected)
      },
    }
  },
}
state.service = service
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/supabase/service') return { shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent('export const supabaseService = globalThis.__gridexCustomerDetailPerformance.service;')}` }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.ts')) return { format: 'module', shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8')) }
    return nextLoad(url, context)
  },
})
const { getCustomerAdminDetail } = await import('../lib/admin/customerAdmin.ts')
const detail = await getCustomerAdminDetail(userId)
assert.equal(detail.card.userId, userId, 'a customer beyond the global response cap still has a complete card')
assert.equal(detail.card.email, 'target@example.test')
assert.equal(detail.card.agreementsCount, 620)
assert.equal(detail.card.activeAgreementsCount, 0, 'a finalized PDF or legal record is not proof of activation')
assert.equal(detail.agreements.length, 620, 'the scoped agreements use bounded pages past the first cap')
assert.equal(detail.documents.length, 510)
assert.equal(Object.values(detail.acceptancesByAgreementId).flat().length, 1240)
assert.equal(detail.activity.length, 500, 'the latest500 limit applies only to the selected customer')
assert.ok(detail.activity.every((row) => row.user_id === userId))
for (const call of state.calls) {
  if (call.table === 'legal_acceptances') {
    const filter = call.filters.find((filter) => filter.kind === 'in' && filter.column === 'agreement_id')
    assert.ok(filter && filter.value.length <= 100, 'acceptance requests use bounded scoped references')
    assert.ok(filter.value.every((id) => detail.agreements.some((row) => row.id === id)))
  } else assert.ok(call.filters.some((filter) => filter.kind === 'eq' && filter.column === 'user_id' && filter.value === userId),
    'every direct customer query filters before limiting or transferring data')
  if (call.range) assert.ok(call.range.to - call.range.from < 500)
}
assert.ok(state.calls.filter((call) => call.table === 'contract_agreements').length > 1)
assert.ok(state.calls.filter((call) => call.table === 'customer_documents').length > 1)
rows.contract_agreements.find((row) => row.user_id === userId).activated_at = date
assert.equal((await getCustomerAdminDetail(userId)).card.activeAgreementsCount, 1, 'actual activation alone raises the active count')
state.calls = []
const missing = await getCustomerAdminDetail('absent-user')
assert.equal(missing.card, null)
assert.deepEqual(missing.agreements, [])
assert.ok(!state.calls.some((call) => call.table === 'legal_acceptances'), 'no global acceptance scan for a customer without agreements')
state.error = { message: 'synthetic read failure' }
await assert.rejects(() => getCustomerAdminDetail(userId), /synthetic read failure/)
delete globalThis.__gridexCustomerDetailPerformance
console.log('Admin customer detail filters before row limits, reads scoped history in bounded pages and preserves read failures')
