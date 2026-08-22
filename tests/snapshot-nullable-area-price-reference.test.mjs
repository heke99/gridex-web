import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('lib/website/snapshotValidation.ts', 'utf8')

assert.match(source, /function firstNullableStringField\(/)
assert.match(source, /const snapshotAreaPriceReference = firstNullableStringField\(/)
assert.match(source, /snapshotAreaPriceReference\.present/)
assert.match(source, /snapshotAreaPriceReference\.valid/)
assert.match(source, /snapshotAreaPriceReference\.value !== livePreview\.area_price_reference/)
assert.doesNotMatch(
  source,
  /!snapshotAreaPriceReference\s*\|\|\s*snapshotAreaPriceReference\s*!==\s*livePreview\.area_price_reference/,
)

console.log('nullable area_price_reference snapshot regression: ok')
