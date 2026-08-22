#!/usr/bin/env node
const fs = require('node:fs')

function read(path) { return fs.readFileSync(path, 'utf8') }
function write(path, content) { fs.writeFileSync(path, content) }
function replaceOnce(path, from, to) {
  const source = read(path)
  if (!source.includes(from)) throw new Error(`${path}: patch anchor missing: ${from.slice(0, 100)}`)
  write(path, source.replace(from, to))
}

// 1) Signed website quote: valid_until remains compatibility metadata, never a wall-clock expiry.
{
  const path = 'lib/website/pricingQuote.ts'
  let s = read(path)
  s = s.replace(
`  // OPS valid_until is retained as canonical lifecycle metadata. The browser
  // signature remains verifiable after that timestamp so the server can renew
  // the internal quote without forcing the customer through the calculator again.`,
`  // OPS valid_until is retained only as V1 compatibility/audit metadata.
  // Customer-visible website quotes are not invalidated because wall-clock time passes.`)
  s = s.replace(
`    typeof input.preview.is_binding === "boolean" && Number.isFinite(validUntilTimestamp) &&
    validUntilTimestamp > now.getTime();`,
`    typeof input.preview.is_binding === "boolean" && Number.isFinite(validUntilTimestamp);`)
  s = s.replace(
`    if (!options.allowExpired && Date.parse(parsed.valid_until) <= now.getTime()) {
      return { ok: false, reason: "expired" };
    }
`, '')
  write(path, s)
}

// 2) Snapshot persistence: require a syntactically valid compatibility timestamp, not a future timestamp.
replaceOnce(
  'lib/website/pricingSnapshotStore.ts',
`  if (!Number.isFinite(validUntilTimestamp) || validUntilTimestamp <= Date.parse(issuedAt)) {
    throw new Error('Website pricing snapshot requires a future canonical valid_until.')
  }`,
`  if (!Number.isFinite(validUntilTimestamp)) {
    throw new Error('Website pricing snapshot requires a canonical valid_until compatibility timestamp.')
  }`,
)

// 3) Checkout validation: never silently reprice an accepted quote because time passed.
{
  const path = 'lib/website/canonicalQuoteValidation.ts'
  let s = read(path)
  s = s.replace("import { createHash } from 'node:crypto'\n", '')
  s = s.replace('  fetchOpsWebsiteQuote,\n', '')
  s = s.replace("import { stockholmCalendarDate } from '@/lib/website/businessDate'\n", '')
  s = s.replace(
`import {
  GRIDEX_FALLBACK_INVOICE_DELIVERY_METHOD,
  GRIDEX_WEBSITE_SITE_COUNT,
  gridexWebsiteSelectedComponentReferences,
  matchesGridexWebsiteCheckoutPolicy,
} from '@/lib/website/checkoutPolicy'`,
`import { matchesGridexWebsiteCheckoutPolicy } from '@/lib/website/checkoutPolicy'`)
  s = s.replace(
`import {
  issueWebsitePricingQuote,
  validateWebsitePricingQuote,
  type WebsitePricingQuote,
} from '@/lib/website/pricingQuote'`,
`import {
  validateWebsitePricingQuote,
  type WebsitePricingQuote,
} from '@/lib/website/pricingQuote'`)
  s = s.replace(
`import {
  markWebsitePricingSnapshotValidated,
  persistWebsitePricingSnapshot,
} from '@/lib/website/pricingSnapshotStore'
import { selectAutomaticPublicContractPriceOption } from '@/lib/website/publicContractContract'`,
`import { markWebsitePricingSnapshotValidated } from '@/lib/website/pricingSnapshotStore'`)

  const effectiveStart = s.indexOf('function effectiveStartDate(')
  const refreshArea = s.indexOf('async function refreshCanonicalArea(')
  if (effectiveStart < 0 || refreshArea < 0 || refreshArea <= effectiveStart) throw new Error('canonicalQuoteValidation: helper anchors missing')
  s = s.slice(0, effectiveStart) + s.slice(refreshArea)

  const refreshQuoteStart = s.indexOf('async function refreshCanonicalQuote(')
  const validationStart = s.indexOf('export async function validateCanonicalWebsiteQuote(')
  if (refreshQuoteStart < 0 || validationStart < 0 || validationStart <= refreshQuoteStart) throw new Error('canonicalQuoteValidation: renewal function anchors missing')
  s = s.slice(0, refreshQuoteStart) + s.slice(validationStart)

  s = s.replace(
`  // The browser token remains a tamper-proof record of what the customer saw.
  // Its OPS valid_until is lifecycle metadata, not a reason to force the customer
  // back through the calculator. Expired records are renewed server-side below.`,
`  // The browser token is the tamper-proof record of exactly what the customer accepted.
  // valid_until is compatibility/audit metadata and must never trigger silent repricing.`)

  const blockStart = s.indexOf('  const startDate = effectiveStartDate(input)')
  const opsComment = s.indexOf('  // Revalidate the exact immutable tuple from the signed quote.', blockStart)
  if (blockStart < 0 || opsComment < 0) throw new Error('canonicalQuoteValidation: repricing block anchors missing')
  const replacement = `  // Do not regenerate or reprice the quote when time passes, when the calendar\n  // date changes for earliest_possible, or when a newer catalogue version exists.\n  // The exact signed quote is the accepted commercial evidence; OPS decides whether\n  // that immutable offer/quote has been explicitly revoked or is otherwise invalid.\n  if (!matchesGridexWebsiteCheckoutPolicy(displayedQuote)) {\n    return { ok: false, reason: 'checkout_policy_mismatch' }\n  }\n\n  const effectiveQuote = displayedQuote\n  const effectivePricingToken = input.pricingToken as string\n\n`
  s = s.slice(0, blockStart) + replacement + s.slice(opsComment)

  s = s.replace(
`  if (Date.parse(opsValidation.valid_until) <= Date.now()) {
    return { ok: false, reason: 'quote_expired' }
  }
`, '')
  s = s.replace('      refreshed: shouldRefresh,', '      refreshed: areaExpired,')
  s = s.replace('/** True when an internal area/quote record was renewed server-side. */', '/** True only when location/price-area evidence was refreshed; the accepted quote is never repriced. */')
  write(path, s)
}

// 4) Treat a version-only const mismatch plus additive fields as forward-compatible.
{
  const path = 'lib/ops/schemaCompatibility.ts'
  let s = read(path)
  s = s.replace(
`  const additivePaths = normalized
    .filter((item) => item.keyword === 'additionalProperties')
    .map((item) => text(item.instancePath) ?? '')
  if (additivePaths.length === 0) return false`,
`  const additivePaths = normalized
    .filter((item) => item.keyword === 'additionalProperties')
    .map((item) => text(item.instancePath) ?? '')
  const versionOnly = normalized.every((item) =>
    item.keyword === 'const' &&
    (text(item.instancePath) === '/contract_schema_version' || text(item.instancePath) === '/contract_version')
  )
  if (versionOnly && normalized.length > 0) return true
  if (additivePaths.length === 0) return false`)
  s = s.replace(
`    if (keyword === 'additionalProperties') return true`,
`    if (keyword === 'additionalProperties') return true
    if (keyword === 'const' && (instancePath === '/contract_schema_version' || instancePath === '/contract_version')) return true`)
  write(path, s)
}

// 5) Lock the new semantics in tests.
write('tests/non-expiring-canonical-quotes.test.mjs', `import assert from 'node:assert/strict'\nimport { readFileSync } from 'node:fs'\nimport { issueWebsitePricingQuote, verifyWebsitePricingQuote } from '../lib/website/pricingQuote.ts'\n\nconst read = (path) => readFileSync(new URL(\`../\${path}\`, import.meta.url), 'utf8')\nprocess.env.GRIDEX_WEBSITE_STATE_SIGNING_SECRET = 'canonical-non-expiring-quote-test-secret-more-than-32-bytes'\nprocess.env.GRIDEX_WEBSITE_STATE_SIGNING_KID = 'canonical-non-expiring-test-key'\n\nconst contract = { offer_reference: 'offer_non_expiring', product_code: 'GRIDEX-TEST', name: 'Gridex test', contract_type: 'variable_monthly', type: 'variable_monthly', energy_direction: 'consumption' }\nconst preview = {\n  resolution_id: 'resolution_non_expiring', energy_direction: 'consumption', production_pricing: null,\n  start_date: '2026-08-01', requested_start_mode: 'earliest_possible', customer_type: 'private',\n  contract: { slug: contract.offer_reference, offer_reference: contract.offer_reference, contract_reference: 'contract_test', product_code: contract.product_code, name: contract.name, contractType: 'spot_monthly' },\n  priceArea: 'SE3', price_area_code: 'SE3', kwh: 500, annual_consumption_kwh: 6000, pricePerKwhOre: 99, totalMonthlyCostSek: 544, totalMonthlyCostInclVatSek: 680, totalYearlyCostSek: 8160,\n  pricing_snapshot_reference: 'wps_non_expiring', ops_quote_reference: 'quote_non_expiring', pricing_interval: 'monthly', estimate_method: 'canonical_monthly_preview', source_period: '2026-07', source_window: null, market_data_timestamp: '2026-07-31T12:00:00.000Z',\n  is_binding: false, assumptions: [], market_sources: [], market_reference: null, pricing_snapshot_schema_version: 'gridex_contract_pricing_v6_selection',\n  valid_until: '2026-08-02T12:30:00.000Z', price_option_reference: 'price_option_test', area_price_reference: 'area_price_test', invoice_delivery_method: 'email', selected_component_references: [], mandatory_component_references: [], conditional_component_references: [], site_count: 1,\n}\nconst issued = issueWebsitePricingQuote({ preview, contract, customerType: 'private', requestedStartMode: 'earliest_possible', quoteAttemptId: '33333333-3333-4333-8333-333333333333', location: { postalCode: '58222', city: 'Linköping', address: 'Storgatan 1' }, now: new Date('2026-08-05T12:00:00.000Z') })\nassert.ok(issued, 'a quote remains signable even when compatibility valid_until is in the past')\nassert.equal(verifyWebsitePricingQuote(issued.token, new Date('2030-01-01T00:00:00.000Z')).ok, true)\nconst quoteSource = read('lib/website/pricingQuote.ts')\nassert.equal(quoteSource.includes('validUntilTimestamp > now.getTime()'), false)\nassert.equal(quoteSource.includes('Date.parse(parsed.valid_until) <= now.getTime()'), false)\nconst canonical = read('lib/website/canonicalQuoteValidation.ts')\nassert.equal(canonical.includes('refreshCanonicalQuote'), false)\nassert.equal(canonical.includes('quoteExpired'), false)\nassert.equal(canonical.includes("reason: 'quote_expired'"), false)\nassert.ok(canonical.includes('exact signed quote is the accepted commercial evidence'))\nconst snapshotStore = read('lib/website/pricingSnapshotStore.ts')\nassert.equal(snapshotStore.includes('requires a future canonical valid_until'), false)\nconsole.log('Non-expiring canonical quote tests passed')\n`)

{
  const path = 'tests/customer-pricing-copy-and-renewal.test.mjs'
  let s = read(path)
  for (const line of [
    "assert.ok(canonical.includes('refreshCanonicalQuote'))\n",
    "assert.ok(canonical.includes('const shouldRefresh ='))\n",
    "assert.ok(canonical.includes('deterministicRenewalAttemptId'))\n",
    "assert.ok(canonical.includes('displayed_valid_until: input.displayedQuote.valid_until'))\n",
    "assert.ok(canonical.includes('const deterministicSnapshotReference = `wps_auto_'))\n",
    "assert.ok(canonical.includes('idempotent: true'))\n",
  ]) s = s.replace(line, '')
  s = s.replace("assert.ok(canonical.includes('pricingToken: effectivePricingToken'))\n", "assert.ok(canonical.includes('pricingToken: effectivePricingToken'))\nassert.equal(canonical.includes('refreshCanonicalQuote'), false)\nassert.equal(canonical.includes('quoteExpired'), false)\nassert.ok(canonical.includes('exact signed quote is the accepted commercial evidence'))\n")
  write(path, s)
}

write('tests/forward-contract-version-compatibility.test.mjs', `import assert from 'node:assert/strict'\nimport { readFileSync } from 'node:fs'\nconst source = readFileSync(new URL('../lib/ops/schemaCompatibility.ts', import.meta.url), 'utf8')\nassert.ok(source.includes("instancePath === '/contract_schema_version'"))\nassert.ok(source.includes("instancePath === '/contract_version'"))\nassert.ok(source.includes('versionOnly'))\nconsole.log('Forward contract version compatibility tests passed')\n`)

// Ensure launch suite runs the version-compatibility lock.
{
  const path = 'package.json'
  const pkg = JSON.parse(read(path))
  if (!pkg.scripts['test:launch'].includes('forward-contract-version-compatibility.test.mjs')) {
    pkg.scripts['test:launch'] += ' && node tests/forward-contract-version-compatibility.test.mjs'
  }
  write(path, JSON.stringify(pkg, null, 2) + '\n')
}

console.log('Tenant non-expiring settlement compatibility patch applied')
