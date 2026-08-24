import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const resultStore = read('lib/website/applicationResultStore.ts')

assert.ok(resultStore.includes('randomBytes(32)'))
assert.ok(resultStore.includes('function createOpaqueResultToken()'))
assert.ok(resultStore.includes('const useStatelessToken = Boolean(configuredResultTokenSecret())'))
assert.ok(resultStore.includes('? encodeStatelessResult({'))
assert.ok(resultStore.includes(': createOpaqueResultToken()'))
assert.ok(resultStore.includes('if (useStatelessToken)'))
assert.ok(resultStore.includes("throw new Error('Website result storage is unavailable.')"))
assert.ok(
  resultStore.includes("return /^[A-Za-z0-9_-]{32,160}$/.test(normalized)"),
  'database-backed opaque tokens must remain accepted by the thank-page verifier',
)
assert.ok(
  resultStore.includes(".eq('token_hash', tokenHash(normalized))"),
  'opaque tokens must be verified by hash lookup rather than stored in plaintext',
)
assert.ok(
  resultStore.includes("const secret = env('WEBSITE_RESULT_TOKEN_SECRET')"),
  'dedicated stateless result secret must remain the preferred mode when configured',
)
assert.equal(
  resultStore.includes("env('SUPABASE_SERVICE_ROLE_KEY') ??"),
  false,
  'result-token encryption must never reuse the Supabase service-role secret',
)

console.log('Website result-token fallback checks passed')
