const fs = require('node:fs')
const path = 'tests/website-api.contract.test.mjs'
let source = fs.readFileSync(path, 'utf8')
const old = `assert.ok(validation.includes("reason: 'quote_expired'"))`
if (!source.includes(old)) throw new Error('legacy quote_expired assertion not found')
source = source.replace(old, `assert.equal(validation.includes("reason: 'quote_expired'"), false)`)
fs.writeFileSync(path, source)
