import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../lib/ops/schemaCompatibility.ts', import.meta.url), 'utf8')
assert.ok(source.includes("instancePath === '/contract_schema_version'"))
assert.ok(source.includes("instancePath === '/contract_version'"))
assert.ok(source.includes('versionOnly'))
console.log('Forward contract version compatibility tests passed')
