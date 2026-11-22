import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server.js'
import { AGREEMENT_EXPORT_LIMIT } from '../lib/admin/agreementExport.ts'

const timestamp = '2026-11-22T12:00:00+00:00'
const allRows = Array.from({ length: AGREEMENT_EXPORT_LIMIT + 1 }, (_, index) => ({
  id: String(AGREEMENT_EXPORT_LIMIT + 1 - index).padStart(12, '0'),
  created_at: timestamp,
  status: 'signed',
  customer_number: 'Customer',
  agreement_reference: `AG-${index}`,
  email: '"kund"@example.invalid',
  internal_notes: 'x'.repeat(1000),
}))
const headers = 'created_at,status,customer_number,agreement_reference,email'
const code = ts.transpileModule(readFileSync(new URL('../app/api/admin/agreements/export/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

async function run(records, failPage = 0) {
  let requests = 0
  const audits = []
  const supabase = createClient('https://export-db.invalid', 'synthetic-key', {
    auth: { persistSession: false },
    global: { fetch: async input => {
      requests++
      const url = new URL(input)
      assert.equal(url.pathname, '/rest/v1/contract_agreements')
      assert.equal(url.searchParams.get('select'), `id,${headers}`)
      assert.equal(url.searchParams.get('order'), 'created_at.desc.nullslast,id.desc')
      if (requests === failPage) return Response.json({ message: 'Synthetic database failure' }, { status: 503 })
      const filter = url.searchParams.get('or')
      const eligible = filter ? records.filter(row => {
        const cursor = /id\.lt\.(\d+)\)/.exec(filter)?.[1]
        assert.ok(cursor)
        assert.equal(filter, `(created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${cursor}),created_at.is.null)`)
        return row.created_at === null || row.id < cursor
      }) : records.filter(row => !url.searchParams.has('created_at') || (row.created_at === null && row.id < url.searchParams.get('id').slice(3)))
      // Model PostgREST configured with a lower maximum than the requested size.
      const limit = Math.min(300, Number(url.searchParams.get('limit')))
      return Response.json(eligible.slice(0, limit).map(row =>
        Object.fromEntries(url.searchParams.get('select').split(',').map(key => [key, row[key]]))))
    } },
  })
  const compiledModule = { exports: {} }
  const modules = {
    'next/server': { NextResponse },
    '@/lib/admin/guards': { requireAdminActionAccess: async () => ({ supabase, userId: 'export-test-admin' }) },
    '@/lib/auth/audit': { logPermissionAudit: async event => { audits.push(event) } },
    '@/lib/admin/agreementExport': { AGREEMENT_EXPORT_LIMIT },
  }
  vm.runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, require: key => modules[key], console: { error() {} } })
  return { response: await compiledModule.exports.GET(), audits, requests }
}

const empty = await run([])
assert.equal(await empty.response.text(), `${headers}\n`)
assert.equal(empty.response.headers.get('x-export-truncated'), 'false')

const filled = await run(allRows)
assert.equal(filled.response.status, 200)
assert.equal(filled.response.headers.get('x-export-row-limit'), String(AGREEMENT_EXPORT_LIMIT))
assert.equal(filled.response.headers.get('x-export-truncated'), 'true')
const csv = await filled.response.text()
const lines = csv.trimEnd().split('\n')
assert.equal(lines[0], headers)
assert.deepEqual(lines.slice(1).map(line => line.split(',')[3]), allRows.slice(0, AGREEMENT_EXPORT_LIMIT).map(row => `"${row.agreement_reference}"`))
assert.match(lines[1], /"""kund""@example\.invalid"/)
assert.equal(filled.audits[0].metadata.rows, AGREEMENT_EXPORT_LIMIT)
assert.equal(filled.audits[0].metadata.truncated, true)
assert.ok(filled.requests > 10)
const previousShapeBytes = Buffer.byteLength(allRows.slice(0, AGREEMENT_EXPORT_LIMIT)
  .map(row => Object.values(row).map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n'))
assert.ok(Buffer.byteLength(csv) < previousShapeBytes)
console.log(`Synthetic export ${previousShapeBytes} B before and ${Buffer.byteLength(csv)} B after`)

const exact = await run(allRows.slice(0, AGREEMENT_EXPORT_LIMIT))
assert.equal(exact.response.headers.get('x-export-truncated'), 'false')
const nullDates = await run([allRows[0], ...allRows.slice(1, 350).map(row => ({ ...row, created_at: null }))])
assert.equal((await nullDates.response.text()).trimEnd().split('\n').length, 351)
const failed = await run(allRows, 2)
assert.equal(failed.response.status, 500)
assert.match(failed.response.headers.get('content-type'), /application\/json/)
assert.equal(failed.audits.length, 0)
