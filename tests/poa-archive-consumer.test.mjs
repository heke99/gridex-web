import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash, generateKeyPairSync, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import PDFDocument from 'pdfkit'

process.env.GRIDEX_API_KEY = 'gridex_live_synthetic_poa_consumer'
process.env.GRIDEX_OPS_API_URL = 'https://app.gridex.se/api/v1'
process.env.GRIDEX_OPS_TIMEOUT_MS = '1000'
process.env.VERCEL_ENV = 'production'
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY = keys.privateKey.export({ format: 'pem', type: 'pkcs8' })
process.env.GRIDEX_CUSTOMER_ASSERTION_KEY_ID = 'synthetic-kid'
process.env.GRIDEX_CUSTOMER_ASSERTION_ISSUER = 'https://gridex.synthetic.invalid'
process.env.GRIDEX_CUSTOMER_ASSERTION_AUDIENCE = 'synthetic-ops'
const user = '11111111-1111-4111-8111-111111111111'
const reference = 'poa_verification_synthetic-archive-12345678'
const listPath = '/api/v1/customer/powers-of-attorney/evidence'
const pdf = await new Promise((resolve, reject) => {
  const doc = new PDFDocument(), chunks = []
  doc.on('data', chunk => chunks.push(chunk)); doc.on('error', reject)
  doc.on('end', () => resolve(Buffer.concat(chunks)))
  doc.text('Synthetic archive proof'); doc.end()
})
const hash = createHash('sha256').update(pdf).digest('hex')
const summary = { power_of_attorney_reference: 'poa_synthetic12345678901234567890', verification_reference: reference,
  consent_status: 'signed', archive_status: 'archived_unverified', archived_sha256: hash,
  download_url: `${listPath}/${reference}?format=pdf` }
const listing = () => ({ data: [{ ...summary }], page: { limit: 20, offset: 0, returned: 1, has_more: false, next_cursor: null },
  request_id: 'synthetic-request', contract_schema_version: '2026-10-09.1' })
const detail = () => ({ data: { ...summary, archive_integrity: 'verified', sha256: hash, submitted_sha256_matches: false,
  accepted_at: null, accepted_at_source: null, signer_ip_address: null, signer_ip_source: null,
  capture_issues: ['poa_acceptance_time_missing', 'poa_signer_ip_missing'], bankid_verified: false,
  pdf_signature_validation: 'not_performed', legal_text_version: 'synthetic-v1', signed_scopes: ['facility_information_lookup'] },
  request_id: 'synthetic-request', contract_schema_version: '2026-10-09.1' })
const client = await import('../lib/ops/client/poaArchive.ts')
const listRoute = await import('../app/api/web/customer/powers-of-attorney/evidence/route.ts')
const detailRoute = await import('../app/api/web/customer/powers-of-attorney/evidence/[verificationReference]/route.ts')
const { default: ArchiveDocuments, loadPoaArchiveDocuments } = await import('../components/customer/PoaArchiveDocuments.tsx')
const { renderToStaticMarkup } = await import('react-dom/server')

function setup(t, fetcher) {
  const original = globalThis.fetch
  globalThis.fetch = fetcher; globalThis.__poaArchiveTestUser = user
  t.after(() => { globalThis.fetch = original; delete globalThis.__poaArchiveTestUser })
}
function pdfResponse(bytes = pdf, digest = createHash('sha256').update(bytes).digest('hex'), ref = reference) {
  return new Response(bytes, { headers: { 'content-type': 'application/pdf',
    'x-gridex-document-sha256': digest, 'x-gridex-verification-reference': ref } })
}
function read(path = '', value = reference) {
  return detailRoute.GET(new Request('https://gridex.synthetic.invalid/api/web/customer/powers-of-attorney/evidence/' + value + path),
    { params: Promise.resolve({ verificationReference: value }) })
}

test('checked-in independent contract has exact reviewed source bytes', () => {
  const bytes = readFileSync(new URL('../docs/openapi/poa-archive-v1.json', import.meta.url))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'ec70eafa96d77563771af0b20eaa71ef2134eff96f75abfd4bb1942c94295d37')
})

test('real transport signs the verified subject and retries with a fresh valid assertion/JTI', async t => {
  const assertions = []
  setup(t, async (url, init) => {
    assert.equal(String(url), 'https://app.gridex.se' + listPath + '?limit=20')
    assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'manual')
    assert.equal(init.headers.get('x-gridex-auth-user-id'), user)
    const jwt = init.headers.get('x-gridex-customer-assertion'), parts = jwt.split('.')
    assert.equal(verify('RSA-SHA256', Buffer.from(parts.slice(0, 2).join('.')), keys.publicKey, Buffer.from(parts[2], 'base64url')), true)
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url')); assert.equal(claims.sub, user)
    assertions.push(claims.jti)
    if (assertions.length === 1) return Response.json({ error: { code: 'busy', message: 'Busy', retryable: true } }, { status: 503 })
    return Response.json(listing())
  })
  const result = await client.listPoaArchives({ userId: user }, { limit: 20 })
  assert.equal(result.data[0].verification_reference, reference)
  assert.equal(assertions.length, 2); assert.notEqual(assertions[0], assertions[1])
})

test('linked identity and assertion are derived from session; extra browser identity is refused', async t => {
  let calls = 0
  setup(t, async () => { calls++; return Response.json(listing()) })
  const refused = await listRoute.GET(new Request('https://gridex.synthetic.invalid/api/web/customer/powers-of-attorney/evidence?userId=other'))
  assert.equal(refused.status, 400); assert.equal(calls, 0)
  const allowed = await listRoute.GET(new Request('https://gridex.synthetic.invalid/api/web/customer/powers-of-attorney/evidence?limit=20'))
  assert.equal(allowed.status, 200); assert.equal(calls, 1)
  assert.equal((await allowed.json()).data[0].download_url, '/api/web/customer/powers-of-attorney/evidence/' + reference + '?format=pdf')
  assert.match(allowed.headers.get('cache-control'), /private.*no-store/)
})

test('no session cannot invoke OPS or retrieve PDF bytes', async t => {
  let calls = 0; setup(t, async () => { calls++; return pdfResponse() }); globalThis.__poaArchiveTestUser = null
  assert.equal((await read('?format=pdf')).status, 401)
  assert.equal((await listRoute.GET(new Request('https://gridex.synthetic.invalid/api/web/customer/powers-of-attorney/evidence'))).status, 401)
  assert.equal(calls, 0)
})

for (const query of ['limit=0', 'limit=101', 'limit=1&limit=2', 'cursor=' + 'a'.repeat(2049)]) {
  test('invalid pagination is refused before OPS: ' + query.slice(0, 40), async t => {
    let calls = 0; setup(t, async () => { calls++; return Response.json(listing()) })
    assert.equal((await listRoute.GET(new Request('https://gridex.synthetic.invalid/api/web/customer/powers-of-attorney/evidence?' + query))).status, 400)
    assert.equal(calls, 0)
  })
}

test('closed response validation rejects private storage metadata', async t => {
  setup(t, async () => { const x = listing(); x.data[0].storage_path = 'private/path'; return Response.json(x) })
  await assert.rejects(() => client.listPoaArchives({ userId: user }), e => e.status === 502)
})

test('cursor is passed opaquely and metadata links are rewritten to the local authenticated proxy', async t => {
  setup(t, async (url) => { assert.equal(new URL(url).searchParams.get('cursor'), 'opaque:cursor-value'); return Response.json(listing()) })
  const out = await client.listPoaArchives({ userId: user }, { limit: 20, cursor: 'opaque:cursor-value' })
  assert.equal(client.poaArchiveDownloadPath(out.data[0]), '/api/web/customer/powers-of-attorney/evidence/' + reference + '?format=pdf')
  assert.equal(client.poaArchiveDownloadPath({ ...summary, verification_reference: '../escape' }), null)
})

test('JSON evidence preserves hash mismatch and missing original IP/time without fabricated assurance', async t => {
  setup(t, async (url) => { assert.equal(new URL(url).searchParams.get('sha256'), '0'.repeat(64)); return Response.json(detail()) })
  const r = await read('?sha256=' + '0'.repeat(64)), body = await r.json()
  assert.equal(r.status, 200); assert.equal(body.data.submitted_sha256_matches, false)
  assert.equal(body.data.signer_ip_address, null); assert.equal(body.data.bankid_verified, false)
  assert.equal(body.data.pdf_signature_validation, 'not_performed')
  assert.equal(body.data.download_url, '/api/web/customer/powers-of-attorney/evidence/' + reference + '?format=pdf')
})

test('PDF is verified before the response and emitted with local safe headers', async t => {
  setup(t, async () => pdfResponse())
  const r = await read('?format=pdf'); assert.equal(r.status, 200)
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), pdf)
  assert.equal(r.headers.get('x-gridex-document-sha256'), hash)
  assert.equal(r.headers.get('x-gridex-verification-reference'), reference)
  assert.match(r.headers.get('cache-control'), /private.*no-store/)
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
  assert.match(r.headers.get('content-disposition'), /^attachment; filename="fullmakt-[A-Za-z0-9_.:-]+\.pdf"$/)
})

for (const mode of ['hash', 'reference', 'mime', 'oversized']) {
  test('invalid PDF fails closed: ' + mode, async t => {
    setup(t, async () => {
      const r = pdfResponse(pdf, mode === 'hash' ? '0'.repeat(64) : undefined,
        mode === 'reference' ? 'poa_some-other-reference' : reference)
      if (mode === 'mime') r.headers.set('content-type', 'text/html')
      if (mode === 'oversized') r.headers.set('content-length', String(15 * 1024 * 1024 + 1))
      return r
    })
    const r = await read('?format=pdf'); assert.equal(r.status, 502)
    assert.equal(r.headers.get('content-type').split(';')[0], 'application/json')
  })
}

test('a PDF above 4.5 MB is verified and streamed in bounded chunks', async t => {
  const at = pdf.lastIndexOf('startxref')
  const large = Buffer.concat([pdf.subarray(0, at), Buffer.from('%' + 'x'.repeat(5 * 1024 * 1024) + '\n'), pdf.subarray(at)])
  setup(t, async () => pdfResponse(large))
  const r = await read('?format=pdf'); assert.equal(r.status, 200)
  const reader = r.body.getReader(), result = createHash('sha256'); let total = 0
  while (true) { const chunk = await reader.read(); if (chunk.done) break; assert.ok(chunk.value.length <= 64 * 1024); total += chunk.value.length; result.update(chunk.value) }
  assert.equal(total, large.length); assert.equal(result.digest('hex'), createHash('sha256').update(large).digest('hex'))
  assert.equal(r.headers.get('content-length'), null)
})

test('retry-after and upstream refusal remain visible without retrying early', async t => {
  let calls = 0
  setup(t, async () => { calls++; return Response.json({ error: { code: 'rate_limited', message: 'Vänta', retryable: true } }, { status: 429, headers: { 'retry-after': '120' } }) })
  const r = await read('?format=pdf'); assert.equal(r.status, 429); assert.equal(r.headers.get('retry-after'), '120'); assert.equal(calls, 1)
})

test('missing assertion configuration fails closed before network access', async t => {
  let calls = 0
  setup(t, async () => { calls++; return Response.json(listing()) })
  const names = ['GRIDEX_CUSTOMER_ASSERTION_PRIVATE_KEY', 'GRIDEX_CUSTOMER_ASSERTION_KEY_ID', 'GRIDEX_CUSTOMER_ASSERTION_ISSUER', 'GRIDEX_CUSTOMER_ASSERTION_AUDIENCE']
  const saved = names.map(name => process.env[name]); names.forEach(name => { delete process.env[name] })
  try {
    const r = await listRoute.GET(new Request('https://gridex.synthetic.invalid/api/web/customer/powers-of-attorney/evidence'))
    assert.equal(r.status, 503); assert.equal(calls, 0)
  } finally { names.forEach((name, index) => { process.env[name] = saved[index] }) }
})

test('undeclared oversized PDF stream is cancelled at the hard 15 MiB bound', async t => {
  let cancelled = false, chunks = 0
  setup(t, async () => new Response(new ReadableStream({
    pull(controller) { chunks++; controller.enqueue(new Uint8Array(1024 * 1024)) },
    cancel() { cancelled = true },
  }), { headers: { 'content-type': 'application/pdf', 'x-gridex-document-sha256': hash, 'x-gridex-verification-reference': reference } }))
  const r = await read('?format=pdf'); assert.equal(r.status, 502); assert.equal(cancelled, true); assert.ok(chunks <= 17)
})

test('server-rendered documents use the local authenticated download link and bounded opaque pagination', async t => {
  setup(t, async url => {
    assert.equal(new URL(url).searchParams.get('limit'), '20')
    const value = listing(); value.page.has_more = true; value.page.next_cursor = 'opaque:next/page'
    return Response.json(value)
  })
  const html = renderToStaticMarkup(await ArchiveDocuments({ data: loadPoaArchiveDocuments() }))
  assert.ok(html.includes('Verifikationsnummer: ' + reference))
  assert.ok(html.includes('/api/web/customer/powers-of-attorney/evidence/' + reference + '?format=pdf'))
  assert.ok(html.includes('poa_cursor=opaque%3Anext%2Fpage'))
  assert.ok(!html.includes('https://app.gridex.se')); assert.ok(!html.includes('BankID'))
})

test('server-rendered documents distinguish unavailable archives from an empty list', async t => {
  setup(t, async () => { throw new Error('network unavailable') })
  const repeated = renderToStaticMarkup(await ArchiveDocuments({ data: loadPoaArchiveDocuments(['one', 'two']) }))
  assert.ok(repeated.includes('kan inte hämtas just nu')); assert.ok(!repeated.includes('Inga fullmaktsdokument'))
  globalThis.fetch = async () => { const value = listing(); value.data = []; value.page.returned = 0; return Response.json(value) }
  const empty = renderToStaticMarkup(await ArchiveDocuments({ data: loadPoaArchiveDocuments() }))
  assert.ok(empty.includes('Inga fullmaktsdokument')); assert.ok(!empty.includes('kan inte hämtas just nu'))
})

test('OPS-qualified original with permitted leading and trailing bytes remains downloadable', async t => {
  const padded = Buffer.concat([Buffer.alloc(1024, 32), pdf, Buffer.alloc(1023, 0)])
  setup(t, async () => pdfResponse(padded))
  const response = await read('?format=pdf'); assert.equal(response.status, 200)
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), padded)
})

test('canonical OPS PDF structure refusal is propagated without sending a document', async t => {
  setup(t, async () => Response.json({ error: { code: 'poa_archive_unavailable', message: 'Originalet kunde inte verifieras.', retryable: false } }, { status: 409 }))
  const response = await read('?format=pdf'); assert.equal(response.status, 409)
  assert.equal((await response.json()).error.code, 'poa_archive_unavailable')
  assert.ok(response.headers.get('content-type').includes('application/json'))
})
